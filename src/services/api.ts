import { auth } from "@/lib/firebase/client";
import type { Payment } from "@/types/payment-contract";

// Required at build time; no LAN or hosted fallback.
const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");
if (!API_URL) {
  console.error("[api] EXPO_PUBLIC_API_URL is not set: payments and balances are disabled in this build");
}

export type QueryFunds = {
  fundsInL1: any[];
  totalInL1: Record<string, number | string>; // L1 validator funds, not payable
  fundsInL2: any[];
  totalInL2: Record<string, number | string>;
  payableInL2?: Record<string, string>; // base units; absent on a backend without the M3 change
};

async function call<T>(path: string, method: "GET" | "POST" = "GET"): Promise<T> {
  if (!API_URL) throw new Error("This build has no backend configured (EXPO_PUBLIC_API_URL is missing).");
  const user = auth.currentUser;
  if (!user) throw new Error("You are signed out. Sign in to pay.");
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      "Content-Type": "application/json",
    },
    body: method === "POST" ? "{}" : undefined,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Backend error ${res.status}${body?.error ? `: ${body.error}` : ""}`);
  return body as T;
}

export const getPayment = (paymentId: string) =>
  call<Payment>(`/payments/${encodeURIComponent(paymentId)}`);

/** 200 = final state, 202 = submitted (keep polling GET). Repeating it for the same payer is a no-op. */
export const authorize = (paymentId: string) =>
  call<Payment>(`/payments/${encodeURIComponent(paymentId)}/authorize`, "POST");

export const queryFunds = (address: string) =>
  call<QueryFunds>(`/query-funds?address=${encodeURIComponent(address)}`);
