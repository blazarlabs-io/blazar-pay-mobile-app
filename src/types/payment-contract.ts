// Mobile copy of the shared M3 payment contract (ASSETS, BLE, amount helpers, Payment type), without zod.
// Keep in sync with blazar-hydra src/shared/payment-contract.ts.

/** Payable assets. Execution moves base units only; `decimals` is for entry/display. */
export const ASSETS = {
  lovelace: { symbol: "ADA", decimals: 6 },
  // Moneta's official preprod USDM (tUSDM, CIP-68 333 FT); decimals 6 from its CIP-68 reference datum (000643b0…).
  "e675b46e4d2242c991a8932a99db3044e80515ae14b4c4ccf6b3f4c90014df10745553444d": { symbol: "USDM", decimals: 6 },
  // WanBridge pair 517 (BTC testnet3 -> preprod): 8 decimals, 1 unit = 1 sat.
  "d2a8592ec9673ac18fea1044885f94518e954ab0cb2b6bb0a328d2af425443": { symbol: "BTC", decimals: 8 },
} as const;
export type AssetUnit = keyof typeof ASSETS;

export const isAssetUnit = (unit: string): unit is AssetUnit =>
  Object.prototype.hasOwnProperty.call(ASSETS, unit);

/** Positive integer in base units as a decimal string: no sign, no leading zeros, < 1e19 (u64). */
const BASE_UNITS = /^[1-9][0-9]{0,18}$/;

export type PaymentState = "created" | "authorized" | "submitted" | "confirmed" | "failed" | "expired";
export const TERMINAL_STATES: readonly PaymentState[] = ["confirmed", "failed", "expired"];

export type PaymentError =
  | "EXPIRED"
  | "NO_L2_FUNDS"
  | "INSUFFICIENT_FUNDS"
  | "MERCHANT_NOT_BOOTSTRAPPED"
  | "TX_INVALID"
  | "NOT_SUBMITTED"
  | "INTERNAL"
  | "STALE_FUNDS"; // the funds UTxO the payer signed for was spent or locked meanwhile

/** Body of every /payments response. GET /payments/:id is the single source of truth for all UIs. */
export type Payment = {
  paymentId: string;
  merchantAddress: string;
  assetUnit: AssetUnit;
  decimals: number;
  amountBaseUnits: string;
  state: PaymentState;
  expiresAt: string;
  payerAddress: string | null;
  fundsInRef: string | null; // "txId#ix"
  hydraTxId: string | null;
  snapshotNumber: number | null; // null when confirmed by reconcile
  error: PaymentError | null;
  createdAt: string;
  updatedAt: string;
};

/** BLE GATT layout. Terminal = peripheral "Hydra TERM"; every characteristic is read-only UTF-8. */
export const BLE = {
  DEVICE_NAME: "Hydra TERM",
  SERVICE_UUID: "1d4ddcb2-279d-42e2-a95a-274352a25248",
  MERCHANT_ADDRESS: "a781af9a-9a04-4422-9d78-9014497ccdc0", // value1
  AMOUNT_BASE_UNITS: "61b64163-35fa-438a-810c-018d1a719667", // value2 = Payment.amountBaseUnits verbatim
  ASSET_UNIT: "52f34145-0363-4f4e-9fab-a133e8e5b0b1", // value3
  PAYMENT_ID: "44f2e2a5-f323-44a2-bfbb-4afe3ef2b3ba", // value4
  // Retired: write characteristic 9b16159d-7c3e-4ae6-990b-0d34f22389bb (payer address). A BLE write never moves money.
} as const;

/**
 * NFC NDEF URI record read by the phone: `myapp://home/nfc?terminal=<merchant Account.id>` (static tag
 * on the terminal -> GET /terminals/:id/pending-payment) or `myapp://home/nfc?paymentId=<uuid>`. Also the app's deep link.
 */
export const NFC = {
  SCHEME: "myapp",
  PATH: "home/nfc",
  TERMINAL_PARAM: "terminal",
  PAYMENT_ID_PARAM: "paymentId",
} as const;

/** "1.5", 6 -> "1500000". Rejects excess decimals, signs, exponents, zero and out-of-range values. */
export function toBaseUnits(human: string, decimals: number): string {
  const m = /^(\d+)(?:\.(\d*))?$/.exec(human.trim());
  if (!m) throw new Error("invalid amount");
  const frac = m[2] ?? "";
  if (frac.length > decimals) throw new Error(`at most ${decimals} decimals`);
  const base = (m[1] + frac.padEnd(decimals, "0")).replace(/^0+/, "");
  if (!BASE_UNITS.test(base)) throw new Error("amount must be > 0 and < 1e19 base units");
  return base;
}

/** "1500000", 6 -> "1.5". Display only. */
export function formatBaseUnits(base: string, decimals: number): string {
  const s = base.padStart(decimals + 1, "0");
  const i = s.length - decimals;
  const frac = s.slice(i).replace(/0+$/, "");
  return frac ? `${s.slice(0, i)}.${frac}` : s.slice(0, i);
}
