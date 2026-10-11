const mockManager = { startDeviceScan: jest.fn(), stopDeviceScan: jest.fn() };
jest.mock("react-native-ble-plx", () => ({ BleManager: jest.fn(() => mockManager) }));
jest.mock("react-native-bluetooth-state-manager", () => ({}));

import { BleClient, NO_TERMINAL } from "@/services/ble-client";

describe("BleClient.scan", () => {
  it("stops scanning and rejects with a retry message when no terminal answers in time", async () => {
    jest.useFakeTimers();
    const scan = new BleClient().scan(1000);
    expect(mockManager.startDeviceScan).toHaveBeenCalled();
    expect(mockManager.stopDeviceScan).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await expect(scan).rejects.toThrow(NO_TERMINAL);
    expect(mockManager.stopDeviceScan).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
