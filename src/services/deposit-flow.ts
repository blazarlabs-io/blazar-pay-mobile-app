// BTC deposit (WanBridge testnet3 -> Cardano preprod -> Hydra L2). Pure logic; the screen and the API call it.

export type DepositState =
  | "created" // instructions issued, waiting for the user's BTC tx
  | "btc_sent"
  | "bridge_processing"
  | "l1_confirmed"
  | "committing"
  | "available" // committed in the Hydra head: payable
  | "failed"
  | "expired"
  | "needs_attention";

/** The backend Deposit (shared/payment-contract.ts), every route returns all fields. Base units = sats, as strings. */
export type Deposit = {
  depositId: string;
  userAddress: string;
  assetUnit: string;
  state: DepositState;
  requestedBaseUnits: string; // sats to send
  receivedBaseUnits: string | null; // measured on L1
  btc: { toAccount: string; valueSats: string; memo: string }; // always set
  expiresAt: string;
  btcTxid: string | null;
  btcVout: number | null;
  l1Ref: string | null; // "redeemHash#ix"
  fundsTxId: string | null; // L1 funds tx
  depositTxId: string | null; // Hydra deposit tx
  error: string | null; // error code
  createdAt: string;
  updatedAt: string;
};

export const DEPOSIT_LABEL: Record<DepositState, string> = {
  created: "Waiting for your BTC transaction",
  btc_sent: "BTC sent",
  bridge_processing: "Bridge processing",
  l1_confirmed: "On Cardano (L1)",
  committing: "Committing to Hydra",
  available: "Available (payable)",
  failed: "Failed",
  expired: "Expired",
  needs_attention: "Needs attention",
};

const PROGRESS: DepositState[] = ["created", "btc_sent", "bridge_processing", "l1_confirmed", "committing", "available"];

export type StepStatus = "done" | "current" | "todo";
export type Timeline = {
  steps: { label: string; status: StepStatus }[];
  problem: string | null; // failed / expired / needs_attention (or an unknown state) with the backend's reason
  final: boolean; // stop polling
};

/** Timeline for the status screen. "Available" is done only when the backend says `available`. */
export function depositTimeline(d: Deposit): Timeline {
  const known = PROGRESS.includes(d.state);
  // failed / expired / needs_attention: tick only what the record proves (txid = BTC sent, l1Ref = on L1).
  const reached = known ? PROGRESS.indexOf(d.state) : d.l1Ref ? 3 : d.btcTxid ? 1 : 0;
  const steps = PROGRESS.slice(1).map((state, i) => {
    const n = i + 1;
    let status: StepStatus = "todo";
    if (n < reached || (n === reached && (!known || d.state === "available"))) status = "done";
    else if (n === reached) status = "current";
    return { label: DEPOSIT_LABEL[state], status };
  });
  if (known) return { steps, problem: null, final: d.state === "available" };
  return {
    steps,
    problem: `${DEPOSIT_LABEL[d.state] ?? `Unknown state "${d.state}"`}: ${d.error || "the backend gave no reason"}`,
    final: d.state === "failed" || d.state === "expired", // needs_attention can still recover (late bridge Success)
  };
}

/** Sats on the way (sent, not yet payable), or null. Payable BTC comes only from query-funds `payableInL2`. */
export function inProgressSats(d: Deposit | null): string | null {
  if (!d || ["created", "available", "failed", "expired"].includes(d.state)) return null;
  return d.receivedBaseUnits ?? d.requestedBaseUnits;
}

/** BTC txid as Electrum shows it: 64 hex. Returns it lowercased, or null. */
export function parseBtcTxid(input: string): string | null {
  const t = input.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(t) ? t : null;
}

/** The two Electrum "Pay to" lines (testnet3). The OP_RETURN line is what lets the bridge credit the deposit. */
export const electrumPayTo = (toAccount: string, btc: string, memo: string) =>
  `${toAccount}, ${btc}\nscript(OP_RETURN ${memo}), 0`;
