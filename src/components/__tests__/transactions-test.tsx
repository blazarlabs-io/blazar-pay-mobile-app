import React from "react";
import { Text } from "react-native";
import renderer, { act, ReactTestRenderer } from "react-test-renderer";
import type { Transaction } from "@/types/db";
import { assetLine, utxoAssets } from "@/utils/assets";
import { MyTransactionsScreen } from "@/components/screens/MyTransactionsScreen";
import { TransactionDetailScreen } from "@/components/screens/TransactionDetailScreen";

let mockTransactions: Transaction[] = [];

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: () => null }));
jest.mock("@/context/walletContext", () => ({
  useWallet: () => ({ transactions: mockTransactions }),
}));
jest.mock("@/components/core", () => {
  const { Text, View } = require("react-native");
  return {
    Icons: { MoneyBillFly: () => null },
    ThemedText: ({ children }: any) => <Text>{children}</Text>,
    ThemedView: ({ children }: any) => <View>{children}</View>,
    TransactionCard: ({ data }: any) => <Text>card {data.txHash}</Text>,
  };
});

const BTC = "d2a8592ec9673ac18fea1044885f94518e954ab0cb2b6bb0a328d2af425443";
const CONTROL_TOKEN = "5d09adde".padEnd(120, "0");
// A real funds UTxO from GET /query-funds (bridged BTC deposit)
const utxo: Transaction = {
  layer: "L2",
  txHash: "61839ca55a8870f17608a7c3614535f4a00e5dc1860c31fd288a337eadeda555",
  outputIndex: 0,
  assets: { [CONTROL_TOKEN]: 1, [BTC]: 29940, lovelace: 3142150 },
  address: "addr_test1wpwsntw7nl0shvxt79qcp7jfpgetgqcuvl5r7angq665pls6fx9ch",
  datum: "d87980",
};

async function texts(el: React.ReactElement): Promise<string> {
  let tree: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(el);
  });
  return tree!.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(""))
    .join("\n");
}

describe("utxoAssets", () => {
  it("formats ADA, USDM and BTC with their decimals, skips control tokens and unknown units", () => {
    expect(
      utxoAssets({
        [CONTROL_TOKEN]: 1,
        [BTC]: 29940,
        "77484e67c1ed6c96f55b89206cb5d6caae9a09a0bd473bba817929fe5553444d": "2500000",
        lovelace: 3142150,
        ["ff".repeat(28)]: 7,
      })
    ).toEqual([
      { symbol: "ADA", amount: "3.14215" },
      { symbol: "USDM", amount: "2.5" },
      { symbol: "BTC", amount: "0.0002994" },
    ]);
  });

  it("keeps a zero quantity instead of dropping it", () => {
    expect(utxoAssets({ lovelace: 0 })).toEqual([{ symbol: "ADA", amount: "0" }]);
  });
});

describe("assetLine", () => {
  it("prints every asset exactly, missing units as 0", () => {
    // live totalInL2 of the test payer: 3 funds UTxOs, two of them BTC
    expect(assetLine({ lovelace: 99284300, [BTC]: 69840 })).toBe("99.2843 ADA · 0 USDM · 0.0006984 BTC");
    expect(assetLine({})).toBe("0 ADA · 0 USDM · 0 BTC");
  });
});

describe("MyTransactionsScreen", () => {
  it("lists the wallet's funds, not mock data", async () => {
    mockTransactions = [utxo];
    expect(await texts(<MyTransactionsScreen />)).toMatch(`card ${utxo.txHash}`);
  });

  it("shows an empty state when there are none", async () => {
    mockTransactions = [];
    expect(await texts(<MyTransactionsScreen />)).toMatch(/No funds yet/);
  });
});

describe("TransactionDetailScreen", () => {
  it("renders a safe state for an unknown transaction", async () => {
    expect(await texts(<TransactionDetailScreen data={undefined} />)).toMatch(
      /not among your funds/
    );
  });

  it("shows the real UTxO with BTC in 8 decimals", async () => {
    const out = await texts(<TransactionDetailScreen data={utxo} />);
    expect(out).toMatch(/0\.0002994 BTC/);
    expect(out).toMatch(/3\.14215 ADA/);
    expect(out).toMatch(`${utxo.txHash}#0`);
  });

  it("labels the UTxO and the funds script, and says the ADA includes the locked deposit", async () => {
    const out = await texts(<TransactionDetailScreen data={utxo} />);
    expect(out).toMatch(/UTxO in Hydra L2/);
    expect(out).toMatch(/Held at the Blazar funds script/);
    expect(out).toMatch(/locked min-ADA deposit, which is not payable/);
    expect(await texts(<TransactionDetailScreen data={{ ...utxo, layer: "L1" }} />)).toMatch(/UTxO on L1 \(not payable yet\)/);
  });
});
