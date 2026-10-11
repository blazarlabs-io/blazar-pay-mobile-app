import { ASSETS, isAssetUnit, TERMINAL_STATES, type Payment } from "@/types/payment-contract";

/** UTF-8 strings read from the terminal: value1 merchant, value2 amount (base units), value3 unit, value4 paymentId. */
export type BleValues = { value1: string; value2: string; value3: string; value4: string };

/** Names the first field where the terminal disagrees with the backend record, or null when they match. */
export function findMismatch(p: Payment, ble: BleValues): string | null {
  if (p.paymentId !== ble.value4) return "payment id";
  if (p.merchantAddress !== ble.value1) return "merchant address";
  if (p.amountBaseUnits !== ble.value2) return "amount";
  if (p.assetUnit !== ble.value3) return "asset";
  if (!isSupportedAsset(p)) return "unsupported asset";
  return null;
}

/** The app knows the payment's asset, with the backend's decimals. */
export const isSupportedAsset = (p: Payment) =>
  isAssetUnit(p.assetUnit) && ASSETS[p.assetUnit].decimals === p.decimals;

export type PayOutcome = { ok: true; payment: Payment } | { ok: false; message: string };

type PayApi = {
  authorize: (paymentId: string) => Promise<Payment>;
  getPayment: (paymentId: string) => Promise<Payment>;
};

/** Authorize, then poll GET until confirmed | failed | expired. Only `ok: true` (state confirmed) means success. */
export async function payAndWait(
  api: PayApi,
  paymentId: string,
  {
    intervalMs = 1000,
    timeoutMs = 120_000,
    sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    now = Date.now,
  } = {}
): Promise<PayOutcome> {
  let p: Payment;
  try {
    p = await api.authorize(paymentId);
  } catch (e: any) {
    return { ok: false, message: e?.message ?? String(e) };
  }
  const deadline = now() + timeoutMs;
  while (!TERMINAL_STATES.includes(p.state)) {
    if (now() >= deadline) {
      return {
        ok: false,
        message: `Payment not confirmed after ${timeoutMs / 1000} s (last state: ${p.state}). It may still complete; check with the merchant.`,
      };
    }
    await sleep(intervalMs);
    try {
      p = await api.getPayment(paymentId);
    } catch {
      // ponytail: transient network errors are retried until the deadline; the last known state stands.
    }
  }
  if (p.state === "confirmed") return { ok: true, payment: p };
  return { ok: false, message: `Payment ${p.state}${p.error ? `: ${p.error}` : ""}` };
}
