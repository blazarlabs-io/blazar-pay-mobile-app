import { Timestamp } from "firebase/firestore";

export interface DbResponse {
  data: any;
  error: any;
  code: number;
}

export type UserType = "admin" | "client" | "merchant";

export type HydraWallet = {
  address: string;
  balance: number;
  icon?: string;
  name?: string;
  transactions?: any[];
};

export type UserData = {
  id: string;
  avatar: string;
  createdAt: Timestamp;
  lastUpdated: Timestamp;
  email: string;
  emailVerified: boolean;
  name: string;
  type: UserType;
  wallet: HydraWallet;
};

export type Transaction = {
  layer?: "L1" | "L2"; // set by walletContext: query-funds fundsInL1 or fundsInL2
  txHash: string;
  outputIndex: number;
  assets: {
    [key: string]: number;
  };
  address: string;
  datum: string;
};
