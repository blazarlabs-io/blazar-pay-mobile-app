import React from "react";
import { Text } from "react-native";
import renderer, { act, ReactTestRenderer } from "react-test-renderer";
import type { Payment } from "@/types/payment-contract";
import { PaymentSuccessScreen } from "@/components/screens/PaymentSuccessScreen";

const mockGetPayment = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/services/api", () => ({
  getPayment: (id: string) => mockGetPayment(id),
}));
jest.mock("@/context/walletContext", () => ({
  useWallet: () => ({ getBalance: jest.fn() }),
}));
jest.mock("@/components/core", () => {
  const { Text, View } = require("react-native");
  return {
    SafeLayout: ({ children }: any) => <View>{children}</View>,
    ThemedText: ({ children }: any) => <Text>{children}</Text>,
    Button: ({ label }: any) => <Text>{label}</Text>,
  };
});

const ID = "6f1c1b7e-0000-4000-8000-000000000001";
const payment = (over: Partial<Payment>): Payment => ({
  paymentId: ID,
  merchantAddress: "addr_test1merchant",
  assetUnit: "lovelace",
  decimals: 6,
  amountBaseUnits: "1500000",
  state: "created",
  expiresAt: "2026-10-10T12:02:00.000Z",
  payerAddress: null,
  fundsInRef: null,
  hydraTxId: null,
  snapshotNumber: null,
  error: null,
  createdAt: "2026-10-10T12:00:00.000Z",
  updatedAt: "2026-10-10T12:00:00.000Z",
  ...over,
});

async function render(params: Record<string, string>): Promise<string> {
  mockParams = params;
  let tree: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<PaymentSuccessScreen />);
  });
  const texts = tree!.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(""));
  return texts.join("\n");
}

beforeEach(() => mockGetPayment.mockReset());

describe("PaymentSuccessScreen", () => {
  it("ignores amount params from a deep link and shows the backend state when it is not confirmed", async () => {
    mockGetPayment.mockResolvedValue(
      payment({ state: "failed", error: "INSUFFICIENT_FUNDS" })
    );
    const out = await render({
      paymentId: ID,
      amountBaseUnits: "50000000",
      assetUnit: "lovelace",
    });
    expect(mockGetPayment).toHaveBeenCalledWith(ID);
    expect(out).not.toMatch(/successful/);
    expect(out).not.toMatch(/50 ADA/);
    expect(out).toMatch(/failed: INSUFFICIENT_FUNDS/);
  });

  it("a deep link without a paymentId never shows success", async () => {
    const out = await render({
      amountBaseUnits: "50000000",
      assetUnit: "lovelace",
    });
    expect(out).not.toMatch(/successful/);
    expect(mockGetPayment).not.toHaveBeenCalled();
  });

  it("a backend error is not success", async () => {
    mockGetPayment.mockRejectedValue(new Error("Backend error 404: NOT_FOUND"));
    const out = await render({ paymentId: ID });
    expect(out).not.toMatch(/successful/);
    expect(out).toMatch(/404/);
  });

  it("shows success with the backend amount only when the backend says confirmed", async () => {
    mockGetPayment.mockResolvedValue(
      payment({
        state: "confirmed",
        hydraTxId: "a".repeat(64),
        snapshotNumber: 7,
      })
    );
    const out = await render({ paymentId: ID, amountBaseUnits: "50000000" });
    expect(out).toMatch(/successful/);
    expect(out).toMatch(/1\.5 ADA/);
    expect(out).toMatch(/Snapshot: 7/);
  });
});
