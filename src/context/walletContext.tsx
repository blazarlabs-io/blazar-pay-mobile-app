import { useWalletRegistration } from "@/hooks/useWalletRegistration";
import { db } from "@/lib/firebase/client";
import { getAdaUsdTicker, getBtcUsdTicker } from "@/services/coinwatch/client";
import { doc, onSnapshot } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./authContext";
import { USERS } from "@/lib/firebase/services/constants";
import { ASSET_UNITS } from "@/constants/assetUnits";
import { Transaction } from "@/types/db";
import { queryFunds } from "@/services/api";
import { ASSETS, AssetUnit, formatBaseUnits } from "@/types/payment-contract";

export type CurrencyType = "ADA" | "USDM" | "WBTC";

interface ContextInterface {
  isWalletRegistered: boolean;
  adminWalletAddress: string;
  adaAddress: string;
  adaBalance: number; // ada/usdm/wbtc balances = payable in L2, display units
  getBalance: () => any;
  l1Balances: Record<string, string>; // base units on L1, not payable
  adaConversionRate: number;
  usdmBalance: number;
  usdmConversionRate: number;
  wbtcBalance: number;
  wbtcConversionRate: number;
  selectedCurrency: CurrencyType;
  updateSelectedCurrency: (currency: CurrencyType) => void;
  transactions: Transaction[];
}

const WalletContext = createContext<ContextInterface>({
  isWalletRegistered: false,
  adminWalletAddress: "",
  adaAddress: "",
  adaBalance: 0.0,
  wbtcBalance: 0.0,
  getBalance: () => {},
  l1Balances: {},
  adaConversionRate: 0.35,
  wbtcConversionRate: 1.0,
  usdmBalance: 0.0,
  usdmConversionRate: 1.0,
  selectedCurrency: "ADA",
  updateSelectedCurrency: () => {},
  transactions: [],
});

export const useWallet = () => {
  const context = useContext<ContextInterface>(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used as within a Provider");
  }
  return context;
};

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const { isRegistered } = useWalletRegistration();
  const { user } = useAuth();

  const [isWalletRegistered, setIsWalletRegistered] = useState<boolean>(false);
  const [adminWalletAddress, setAdminWalletAddress] = useState<string>(
    process.env.EXPO_PUBLIC_ADMIN_WALLET_ADDRESS as string
  );
  const [adaAddress, setAdaAddress] = useState<string>(
    process.env.EXPO_PUBLIC_ADA_WALLET_ADDRESS as string
  );
  const [adaBalance, setAdaBalance] = useState<number>(0.0);
  const [usdmBalance, setUsdmBalance] = useState<number>(0.0);
  const [wbtcBalance, setWbtcBalance] = useState<number>(0.0);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyType>("ADA");
  const [l1Balances, setL1Balances] = useState<Record<string, string>>({});
  const [adaConversionRate, setAdaConversionRate] = useState<number>(0);
  const [usdmConversionRate, setUsdmConversionRate] = useState<number>(1.0);
  const [wbtcConversionRate, setWbtcConversionRate] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const updateSelectedCurrency = (currency: CurrencyType) => {
    setSelectedCurrency(currency);
  };

  const getBalance = async (): Promise<void> => {
    if (!adaAddress || !user) return;
    try {
      console.info("[GET-BALANCE]", adaAddress);
      const data = await queryFunds(adaAddress);
      console.log("\n\n[QUERY-FUNDS]", JSON.stringify(data, null, 2), "\n\n");
      // * Spendable = payable in L2. L1 validator funds are shown apart and never summed in.
      const payable = data.payableInL2 ?? {};
      // ponytail: Number() only for display and USD estimates; payments use base-unit strings
      const display = (unit: AssetUnit) =>
        Number(formatBaseUnits(payable[unit] ?? "0", ASSETS[unit].decimals));
      setAdaBalance(display(ASSET_UNITS.ada));
      setUsdmBalance(display(ASSET_UNITS.usdm));
      setWbtcBalance(display(ASSET_UNITS.wbtc));
      setL1Balances(
        Object.fromEntries(
          Object.entries(data.totalInL1).map(([unit, qty]) => [unit, String(qty)])
        )
      );
      setTransactions(() => [...data.fundsInL1, ...data.fundsInL2]);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    setIsWalletRegistered(isRegistered);
    console.log("isRegistered", isRegistered);
  }, [isRegistered]);

  useEffect(() => {
    // * GET ADA TICKER
    getAdaUsdTicker()
      .then((data) => {
        setAdaConversionRate(data.rate);
      })
      .catch((error) => {
        console.log(error);
      });

    getBtcUsdTicker()
      .then((data) => {
        setWbtcConversionRate(data.rate);
      })
      .catch((error) => {
        console.log(error);
      });
  }, []);

  useEffect(() => {
    getBalance();
  }, [adaAddress, user]);

  useEffect(() => {
    let unsubsUserData: any = null;
    if (user && db) {
      // firestore snapshot of user
      unsubsUserData = onSnapshot(doc(db, USERS, user?.uid), (doc) => {
        console.log("Current data: ", doc.data());
      });
    }

    return () => {
      if (unsubsUserData) {
        unsubsUserData();
      }
    };
  }, [user, db]);

  return (
    <WalletContext.Provider
      value={{
        isWalletRegistered,
        adminWalletAddress,
        adaAddress,
        adaBalance,
        getBalance,
        l1Balances,
        adaConversionRate,
        usdmBalance,
        usdmConversionRate,
        wbtcBalance,
        wbtcConversionRate,
        selectedCurrency,
        updateSelectedCurrency,
        transactions,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
