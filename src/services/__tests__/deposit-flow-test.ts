import { Deposit, depositTimeline, DepositState, electrumPayTo, inProgressSats, parseBtcTxid } from "@/services/deposit-flow";
import { formatBaseUnits, toBaseUnits } from "@/types/payment-contract";

const TXID = "6633762d" + "ab".repeat(28);
const dep = (state: DepositState, over: Partial<Deposit> = {}): Deposit => ({
  depositId: "6f1c1b7e-0000-4000-8000-000000000002",
  state,
  expiresAt: "2026-10-10T12:30:00.000Z",
  amountSats: "50000",
  ...over,
});
const statuses = (d: Deposit) => depositTimeline(d).steps.map((s) => s.status);

describe("BTC amount -> sats (8 decimals, exact)", () => {
  it("converts", () => {
    expect(toBaseUnits("0.0005", 8)).toBe("50000");
    expect(toBaseUnits("0.00000001", 8)).toBe("1");
    expect(toBaseUnits("1", 8)).toBe("100000000");
    expect(toBaseUnits("0.1", 8)).toBe("10000000"); // 0.1 is not exact as a float
    expect(toBaseUnits("21000000", 8)).toBe("2100000000000000");
    expect(formatBaseUnits("50000", 8)).toBe("0.0005");
    expect(formatBaseUnits("199680", 8)).toBe("0.0019968");
  });

  it("rejects sub-sat precision, zero and junk", () => {
    expect(() => toBaseUnits("0.000000001", 8)).toThrow("at most 8 decimals");
    for (const bad of ["0", "0.00000000", "", "-0.1", "1e-4", "0,0005", "abc"]) {
      expect(() => toBaseUnits(bad, 8)).toThrow();
    }
  });
});

describe("parseBtcTxid", () => {
  it("accepts 64 hex, trimmed and lowercased", () => {
    expect(parseBtcTxid(TXID)).toBe(TXID);
    expect(parseBtcTxid(`  ${TXID.toUpperCase()}\n`)).toBe(TXID);
  });

  it("rejects anything else", () => {
    for (const bad of ["", TXID.slice(1), TXID + "a", "0x" + TXID.slice(2), "g" + TXID.slice(1), `${TXID.slice(0, 32)} ${TXID.slice(33)}`]) {
      expect(parseBtcTxid(bad)).toBeNull();
    }
  });
});

describe("depositTimeline", () => {
  it("walks sent -> bridge -> L1 -> committing -> available", () => {
    expect(statuses(dep("btc_sent"))).toEqual(["current", "todo", "todo", "todo", "todo"]);
    expect(statuses(dep("bridge_processing"))).toEqual(["done", "current", "todo", "todo", "todo"]);
    expect(statuses(dep("l1_confirmed"))).toEqual(["done", "done", "current", "todo", "todo"]);
    expect(statuses(dep("committing"))).toEqual(["done", "done", "done", "current", "todo"]);
    expect(statuses(dep("available"))).toEqual(["done", "done", "done", "done", "done"]);
    expect(depositTimeline(dep("btc_sent")).steps.map((s) => s.label)).toEqual([
      "BTC sent", "Bridge processing", "On Cardano (L1)", "Committing to Hydra", "Available (payable)",
    ]);
  });

  it("polls until available, failed or expired; needs_attention keeps polling", () => {
    const final = (s: DepositState) => depositTimeline(dep(s)).final;
    expect(["created", "btc_sent", "bridge_processing", "l1_confirmed", "committing", "needs_attention"].map((s) => final(s as DepositState))).toEqual(
      [false, false, false, false, false, false]
    );
    expect(["available", "failed", "expired"].map((s) => final(s as DepositState))).toEqual([true, true, true]);
  });

  it("shows problems with the reason and never ticks Available", () => {
    const t = depositTimeline(dep("failed", { btcTxid: TXID, error: "Refund" }));
    expect(t.problem).toBe("Failed: Refund");
    expect(t.steps.map((s) => s.status)).toEqual(["done", "todo", "todo", "todo", "todo"]);

    const na = depositTimeline(dep("needs_attention", { btcTxid: TXID, redeemTxHash: "b1".repeat(32), depositTxId: "c2".repeat(32), error: "commit failed 3 times" }));
    expect(na.problem).toBe("Needs attention: commit failed 3 times");
    expect(na.steps.map((s) => s.status)).toEqual(["done", "done", "done", "todo", "todo"]);

    expect(depositTimeline(dep("expired")).problem).toBe("Expired: the backend gave no reason");
    const odd = depositTimeline(dep("credited" as DepositState, { btcTxid: TXID, redeemTxHash: "b1".repeat(32) }));
    expect(odd.problem).toMatch(/^Unknown state "credited"/);
    expect(odd.final).toBe(false);
    expect(odd.steps[4].status).toBe("todo");
  });
});

describe("inProgressSats", () => {
  it("counts only sent, unfinished deposits; prefers the L1-measured amount", () => {
    expect(inProgressSats(null)).toBeNull();
    for (const s of ["created", "available", "failed", "expired"] as DepositState[]) expect(inProgressSats(dep(s))).toBeNull();
    expect(inProgressSats(dep("bridge_processing"))).toBe("50000");
    expect(inProgressSats(dep("needs_attention"))).toBe("50000");
    expect(inProgressSats(dep("committing", { receivedBaseUnits: "49900" }))).toBe("49900");
    expect(inProgressSats(dep("btc_sent", { amountSats: undefined, btc: { toAccount: "tb1p", valueSats: "60000", memo: "07" } }))).toBe("60000");
  });
});

it("electrumPayTo builds the two Pay-to lines", () => {
  expect(electrumPayTo("tb1pabc", "0.0005", "070205")).toBe("tb1pabc, 0.0005\nscript(OP_RETURN 070205), 0");
});
