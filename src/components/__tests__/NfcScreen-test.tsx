import React from "react";
import { Text } from "react-native";
import renderer, { act, ReactTestRenderer } from "react-test-renderer";
import type { Payment } from "@/types/payment-contract";
import type { PayOutcome } from "@/services/payment-flow";
import { NfcScreen } from "@/components/screens/NfcScreen";

const TERMINAL = "3c0825c6-3f78-4d34-bf34-e39130fecd73";
let mockRoute: { params?: Record<string, string> } = {};
const mockPush = jest.fn();
const mockPending = jest.fn();
const mockGetPayment = jest.fn();
const mockPayAndWait = jest.fn();
const mockRead = jest.fn();
const mockCancel = jest.fn();
let mockNfc: "on" | "off" | "none" = "none";
// useFocusEffect reduced to what React Navigation does: run while focused, clean up on blur and on new deps
const mockNav = { focused: true, listeners: new Set<() => void>() };

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockRoute.params ?? {},
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (effect: () => (() => void) | undefined) =>
    require("react").useEffect(() => {
      let cleanup = mockNav.focused ? effect() : undefined;
      const onChange = () => {
        cleanup?.();
        cleanup = mockNav.focused ? effect() : undefined;
      };
      mockNav.listeners.add(onChange);
      return () => {
        cleanup?.();
        mockNav.listeners.delete(onChange);
      };
    }, [effect]),
}));
jest.mock("@react-navigation/native", () => ({ useRoute: () => mockRoute }));
jest.mock("react-native-nfc-manager", () => ({
  __esModule: true,
  default: {},
  NfcTech: {},
  Ndef: {},
}));
jest.mock("@/services/nfc-client", () => ({
  ...jest.requireActual("@/services/nfc-client"),
  nfcStatus: async () => mockNfc,
  readTerminalTag: () => mockRead(),
  cancelNfcRead: () => mockCancel(),
}));
jest.mock("@/services/api", () => ({
  authorize: jest.fn(),
  getPayment: (id: string) => mockGetPayment(id),
  getTerminalPendingPayment: (id: string) => mockPending(id),
}));
jest.mock("@/services/payment-flow", () => ({
  ...jest.requireActual("@/services/payment-flow"),
  payAndWait: (_api: unknown, id: string) => mockPayAndWait(id),
}));
jest.mock("@/services/ble-client", () => ({
  BleClient: class {
    requestPermissions = async () => true;
    scan = () => new Promise(() => {}); // never finds a terminal
  },
}));
jest.mock("@/hooks/useWalletRegistration", () => ({}));
jest.mock("@/context/walletContext", () => ({
  useWallet: () => ({ isWalletRegistered: true }),
}));
jest.mock("@/components/core", () => {
  const { Text, View } = require("react-native");
  return {
    SafeLayout: ({ children }: any) => <View>{children}</View>,
    ThemedView: ({ children }: any) => <View>{children}</View>,
    ThemedText: ({ children }: any) => <Text>{children}</Text>,
    Button: ({ label, onPress, disabled }: any) => (
      <Text onPress={disabled ? undefined : onPress}>{label}</Text>
    ),
    Icons: { Wallet: () => null },
  };
});

const payment = (paymentId: string, over: Partial<Payment> = {}): Payment => ({
  paymentId,
  merchantAddress: "addr_test1merchant",
  assetUnit: "lovelace",
  decimals: 6,
  amountBaseUnits: "1000000",
  state: "created",
  expiresAt: "2026-10-11T19:05:00.000Z",
  payerAddress: null,
  fundsInRef: null,
  hydraTxId: null,
  snapshotNumber: null,
  error: null,
  createdAt: "2026-10-11T19:03:00.000Z",
  updatedAt: "2026-10-11T19:03:00.000Z",
  ...over,
});
const P1 = payment("11111111-0000-4000-8000-000000000001");
const P2 = payment("22222222-0000-4000-8000-000000000002");

let tree: ReactTestRenderer;
const flush = () => act(async () => {});
const texts = () =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(""));
const press = (label: string) =>
  act(async () => {
    tree.root
      .findAllByType(Text)
      .find((t) => t.props.children === label)!
      .props.onPress(); // not awaited: Pay runs on
  });
const setFocus = (focused: boolean) =>
  act(async () => {
    mockNav.focused = focused;
    mockNav.listeners.forEach((l) => l());
  });
const openLink = (params: Record<string, string>) =>
  act(async () => {
    mockRoute = { params }; // React Navigation replaces route.params on each navigation, same values or not
    tree.update(<NfcScreen />);
  });
async function mount(params?: Record<string, string>) {
  mockRoute = { params };
  await act(async () => {
    tree = renderer.create(<NfcScreen />);
  });
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNav.focused = true;
  mockNav.listeners.clear();
  mockNfc = "none";
  jest.spyOn(console, "log").mockImplementation(() => {}); // the screen logs every error it shows
});

describe("NfcScreen", () => {
  it("after a confirmed payment, coming back to the Pay tab resolves the terminal again (no stuck 'paying')", async () => {
    mockPending.mockResolvedValueOnce(P1).mockResolvedValueOnce(P2);
    mockPayAndWait.mockResolvedValueOnce({
      ok: true,
      payment: { ...P1, state: "confirmed" },
    });
    await mount({ terminal: TERMINAL });
    await press("Pay");
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/payment-success",
      params: { paymentId: P1.paymentId },
    });

    await setFocus(false); // the success screen is on top
    await setFocus(true); // back on the Pay tab
    await flush();
    expect(mockPending).toHaveBeenCalledTimes(2);
    expect(texts()).toContain("Pay");
    expect(texts()).not.toContain("Waiting for confirmation...");
  });

  it("the same terminal link opened again while the tab is focused starts over", async () => {
    mockPending.mockResolvedValueOnce(null).mockResolvedValueOnce(P2);
    await mount({ terminal: TERMINAL });
    expect(texts().join("\n")).toContain(
      "No payment is waiting at this terminal"
    );

    await openLink({ terminal: TERMINAL });
    await flush();
    expect(mockPending).toHaveBeenCalledTimes(2);
    expect(texts()).toContain("Pay");
  });

  it("leaving the tab stops the NFC read and drops its result; coming back starts a new read", async () => {
    mockNfc = "on";
    let fail!: (e: Error) => void;
    mockRead
      .mockReturnValueOnce(new Promise((_, reject) => (fail = reject)))
      .mockReturnValueOnce(new Promise(() => {}));
    await mount();
    expect(texts()).toContain("Tap the terminal");

    await setFocus(false);
    expect(mockCancel).toHaveBeenCalled();
    await act(async () => fail(new Error("The tag was not read."))); // the cancelled read
    await setFocus(true);
    await flush();
    expect(mockRead).toHaveBeenCalledTimes(2);
    expect(texts()).toContain("Tap the terminal");
    expect(texts()).not.toContain("Payment not completed");
  });

  it("a payment being confirmed survives a tab switch; only 'confirmed' opens the success screen", async () => {
    let settle!: (o: PayOutcome) => void;
    mockPending.mockResolvedValueOnce(P1);
    mockPayAndWait.mockReturnValueOnce(new Promise((r) => (settle = r)));
    await mount({ terminal: TERMINAL });
    await press("Pay");
    await setFocus(false);
    await setFocus(true);
    await flush();
    expect(mockPending).toHaveBeenCalledTimes(1); // not restarted under the running payment
    expect(texts()).toContain("Waiting for confirmation...");

    await act(async () =>
      settle({ ok: false, message: "Payment expired: EXPIRED" })
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(texts()).toContain("Payment expired: EXPIRED");
  });

  it("a paymentId link to a payment that is no longer open is refused", async () => {
    mockGetPayment.mockResolvedValueOnce({ ...P1, state: "confirmed" });
    await mount({ paymentId: P1.paymentId });
    expect(texts()).toContain("This payment is already confirmed.");
    expect(texts()).not.toContain("Pay");
  });
});
