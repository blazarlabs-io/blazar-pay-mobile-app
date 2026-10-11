import React from "react";
import { Text } from "react-native";
import renderer, { act, ReactTestRenderer } from "react-test-renderer";
import { BalanceInfo } from "@/components/widgets/BalanceInfo";
import { TransactionCard } from "@/components/core/Card/TransactionCard";

const BTC = "d2a8592ec9673ac18fea1044885f94518e954ab0cb2b6bb0a328d2af425443";
let mockWallet: any = {};

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: () => null }));
jest.mock("@/context/walletContext", () => ({ useWallet: () => mockWallet }));
jest.mock("@/components/core/Icon", () => ({
  Icons: new Proxy({}, { get: () => () => null }),
}));

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

const wallet = (over: object = {}) => ({
  adaBalance: 0, usdmBalance: 0, wbtcBalance: 0,
  adaConversionRate: NaN, usdmConversionRate: 1, wbtcConversionRate: NaN,
  payableInL2: { lovelace: "999999", [BTC]: "39900" },
  totalInL2: { lovelace: "99284300", [BTC]: "69840" },
  l1Balances: {},
  balanceError: null,
  getBalance: jest.fn(),
  btcDeposit: null,
  ...over,
});

describe("BalanceInfo", () => {
  it("shows the exact per-payment maximum, not a rounded value", async () => {
    mockWallet = wallet();
    const out = await texts(<BalanceInfo />);
    expect(out).toMatch(/Payable in one payment \(Hydra L2\)/);
    expect(out).toMatch(/^0\.999999$/m); // toFixed(2) showed "1.00", more than can be paid
    expect(out).toMatch(/^0\.000399$/m);
    expect(out).not.toMatch(/1\.00\b/);
  });

  it("shows the L2 total apart, with ADA flagged as including the locked min-ADA", async () => {
    mockWallet = wallet();
    expect(await texts(<BalanceInfo />)).toMatch(
      "In Hydra L2 in total: 99.2843 ADA · 0 USDM · 0.0006984 BTC (ADA incl. locked min-ADA)"
    );
  });

  it("says when the balances could not be loaded", async () => {
    mockWallet = wallet({ balanceError: "Backend error 503: HYDRA_UNAVAILABLE" });
    expect(await texts(<BalanceInfo />)).toMatch(
      "Balances could not be loaded (Backend error 503: HYDRA_UNAVAILABLE). Tap to retry."
    );
  });
});

describe("TransactionCard", () => {
  const utxo = {
    txHash: "61839ca55a8870f17608a7c3614535f4a00e5dc1860c31fd288a337eadeda555",
    outputIndex: 0,
    assets: { [BTC]: 29940, lovelace: 3142150 },
    address: "addr_test1wpwsntw7nl0shvxt79qcp7jfpgetgqcuvl5r7angq665pls6fx9ch",
    datum: "",
  };

  it("titles a funds UTxO by its layer, never with the funds script address", async () => {
    const l2 = await texts(<TransactionCard data={{ ...utxo, layer: "L2" }} />);
    expect(l2).toMatch(/Hydra L2 funds/);
    expect(l2).not.toMatch(utxo.address);
    expect(await texts(<TransactionCard data={{ ...utxo, layer: "L1" }} />)).toMatch(/L1 funds, not payable yet/);
  });
});
