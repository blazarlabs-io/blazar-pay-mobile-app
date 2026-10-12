import { ASSETS, isAssetUnit, TERMINAL_STATES, type Payment } from "@/types/payment-contract";
import type { DeviceKey } from "@/services/device-key";
import { payInfoCbor } from "@/services/pay-message";

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
  signPayload: (paymentId: string) => Promise<{ fundsInRef: string; payInfoCbor: string }>;
  authorize: (paymentId: string, consent: { fundsInRef: string; signature: string }) => Promise<Payment>;
  getPayment: (paymentId: string) => Promise<Payment>;
};

const KEY_ERRORS: Record<string, string> = {
  BAD_SIGNATURE: "This phone's payment key is not the one registered for your account. Contact the merchant or support.",
  NO_PUBLIC_KEY: "This phone is not registered for payments yet. Sign out and sign in again, then retry.",
};

/**
 * Sign, authorize, then poll GET until confirmed | failed | expired. The phone signs PayInfo built from the
 * payment it shows and the funds UTxO the backend proposes; if the backend's bytes differ, nothing is signed.
 * Only `ok: true` (state confirmed) means success.
 */
export async function payAndWait(
  api: PayApi,
  key: DeviceKey,
  payment: Payment,
  {
    intervalMs = 1000,
    timeoutMs = 120_000,
    sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    now = Date.now,
  } = {}
): Promise<PayOutcome> {
  const paymentId = payment.paymentId;
  let p: Payment;
  try {
    const { fundsInRef, payInfoCbor: fromServer } = await api.signPayload(paymentId);
    const mine = payInfoCbor({ ...payment, fundsInRef });
    if (mine !== fromServer) {
      return { ok: false, message: "The server asked to sign different payment data. Nothing was signed." };
    }
    p = await api.authorize(paymentId, { fundsInRef, signature: key.sign(mine) });
  } catch (e: any) {
    const message: string = e?.message ?? String(e);
    const code = Object.keys(KEY_ERRORS).find((c) => message.includes(c));
    return { ok: false, message: code ? KEY_ERRORS[code] : message };
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
