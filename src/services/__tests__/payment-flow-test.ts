import { findMismatch, payAndWait } from "@/services/payment-flow";
import { ASSETS, AssetUnit, formatBaseUnits, Payment, toBaseUnits } from "@/types/payment-contract";

const USDM: AssetUnit = "e675b46e4d2242c991a8932a99db3044e80515ae14b4c4ccf6b3f4c90014df10745553444d";
const TX = "a".repeat(64);

const payment = (over: Partial<Payment> = {}): Payment => ({
  paymentId: "6f1c1b7e-0000-4000-8000-000000000001",
  merchantAddress: "addr_test1merchant",
  assetUnit: USDM,
  decimals: 6,
  amountBaseUnits: "1500000",
  state: "created",
  expiresAt: "2026-10-10T12:02:00.000Z",
  payerAddress: null,
  fundsInRef: null,
  hydraTxId: null,
  snapshotNumber: null,
  error: null,
  createdAt: "2026-10-10T12:00:00.000Z",
  updatedAt: "2026-10-10T12:00:00.000Z",
  ...over,
});

describe("toBaseUnits / formatBaseUnits", () => {
  it("converts exactly, without floats", () => {
    expect(toBaseUnits("1.5", 6)).toBe("1500000");
    expect(toBaseUnits("0.1", 6)).toBe("100000");
    expect(toBaseUnits("0.00000001", 8)).toBe("1");
    expect(toBaseUnits(" 007.", 6)).toBe("7000000");
    expect(toBaseUnits("9999999999999.999999", 6)).toBe("9999999999999999999"); // beyond 2^53
    expect(formatBaseUnits("1500000", 6)).toBe("1.5");
    expect(formatBaseUnits("1", 8)).toBe("0.00000001");
    expect(formatBaseUnits("100000000", 8)).toBe("1");
    expect(formatBaseUnits("0", 6)).toBe("0");
    expect(formatBaseUnits("9999999999999999999", 6)).toBe("9999999999999.999999");
  });

  it("rejects bad input", () => {
    for (const bad of ["", "-1", "1e6", "1,5", "abc", "0", "0.000000", "10000000000000"]) {
      expect(() => toBaseUnits(bad, 6)).toThrow();
    }
    expect(() => toBaseUnits("1.0000001", 6)).toThrow("at most 6 decimals");
  });

  it("round-trips every asset", () => {
    for (const { decimals } of Object.values(ASSETS)) {
      for (const base of ["1", "10", "123456789", "100000000"]) {
        expect(toBaseUnits(formatBaseUnits(base, decimals), decimals)).toBe(base);
      }
    }
  });
});

describe("findMismatch", () => {
  const ble = { value1: "addr_test1merchant", value2: "1500000", value3: USDM, value4: payment().paymentId };

  it("accepts matching values", () => {
    expect(findMismatch(payment(), ble)).toBeNull();
  });

  it("names the field that differs", () => {
    expect(findMismatch(payment(), { ...ble, value1: "addr_test1other" })).toBe("merchant address");
    expect(findMismatch(payment(), { ...ble, value2: "1500001" })).toBe("amount");
    expect(findMismatch(payment(), { ...ble, value3: "lovelace" })).toBe("asset");
    expect(findMismatch(payment(), { ...ble, value4: "other" })).toBe("payment id");
  });

  it("rejects units or decimals the app does not know", () => {
    expect(findMismatch(payment({ decimals: 0 }), ble)).toBe("unsupported asset");
    const unknown = "ff".repeat(30) as AssetUnit;
    expect(findMismatch(payment({ assetUnit: unknown }), { ...ble, value3: unknown })).toBe("unsupported asset");
  });
});

describe("payAndWait", () => {
  // Fake clock: sleep advances time, so timeouts are deterministic.
  const run = (authorize: () => Promise<Payment>, polls: (Payment | Error)[], timeoutMs = 10_000) => {
    let t = 0;
    const getPayment = jest.fn(async () => {
      const next = polls.shift() ?? payment({ state: "submitted" });
      if (next instanceof Error) throw next;
      return next;
    });
    const promise = payAndWait({ authorize: jest.fn(authorize), getPayment }, "id", {
      intervalMs: 1000,
      timeoutMs,
      sleep: async (ms) => {
        t += ms;
      },
      now: () => t,
    });
    return { promise, getPayment };
  };

  it("succeeds only when the backend reports confirmed", async () => {
    const confirmed = payment({ state: "confirmed", hydraTxId: TX, snapshotNumber: 42 });
    const { promise, getPayment } = run(async () => payment({ state: "submitted" }), [
      payment({ state: "submitted" }),
      confirmed,
    ]);
    await expect(promise).resolves.toEqual({ ok: true, payment: confirmed });
    expect(getPayment).toHaveBeenCalledTimes(2);
  });

  it("returns a final authorize response without polling", async () => {
    const { promise, getPayment } = run(async () => payment({ state: "confirmed", hydraTxId: TX }), []);
    expect((await promise).ok).toBe(true);
    expect(getPayment).not.toHaveBeenCalled();
  });

  it("reports failed and expired as errors", async () => {
    const failed = run(async () => payment({ state: "submitted" }), [
      payment({ state: "failed", error: "INSUFFICIENT_FUNDS" }),
    ]);
    await expect(failed.promise).resolves.toEqual({ ok: false, message: "Payment failed: INSUFFICIENT_FUNDS" });
    const expired = run(async () => payment({ state: "expired", error: "EXPIRED" }), []);
    await expect(expired.promise).resolves.toEqual({ ok: false, message: "Payment expired: EXPIRED" });
  });

  it("reports an authorize error (e.g. 409/410, signed out) without polling", async () => {
    const { promise, getPayment } = run(async () => {
      throw new Error("Backend error 410: EXPIRED");
    }, []);
    await expect(promise).resolves.toEqual({ ok: false, message: "Backend error 410: EXPIRED" });
    expect(getPayment).not.toHaveBeenCalled();
  });

  it("keeps polling through transient GET errors", async () => {
    const { promise } = run(async () => payment({ state: "authorized" }), [
      new Error("Network request failed"),
      payment({ state: "confirmed", hydraTxId: TX }),
    ]);
    expect((await promise).ok).toBe(true);
  });

  it("gives up with an error, never success, when no final state arrives", async () => {
    const { promise, getPayment } = run(async () => payment({ state: "submitted" }), [], 5000);
    const outcome = await promise;
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.message).toMatch(/not confirmed after 5 s \(last state: submitted\)/);
    expect(getPayment).toHaveBeenCalledTimes(5);
  });
});
