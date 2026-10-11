import { Alert, PermissionsAndroid, Platform } from "react-native";
import { BleManager } from "react-native-ble-plx";
import BluetoothStateManager from "react-native-bluetooth-state-manager";
import { Buffer } from "buffer";
import { BLE } from "@/types/payment-contract";
import type { BleValues } from "@/services/payment-flow";

// ponytail: fixed 30 s scan window; make it configurable if real terminals need longer
export const SCAN_TIMEOUT_MS = 30_000;
export const NO_TERMINAL = "No terminal found nearby — move closer and retry.";

export class BleClient {
  // Properties
  private manager: any;

  // Constructor
  constructor() {
    this.manager = new BleManager();
  }

  calculateDistance(
    referenceRSSI: number,
    pathLossExponent: number,
    rssi: number
  ) {
    const distance = Math.pow(
      10,
      (referenceRSSI - rssi) / (10 * pathLossExponent)
    );
    return parseFloat(distance.toFixed(2));
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === "ios") {
      return true;
    }
    if (
      Platform.OS === "android" &&
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    ) {
      const apiLevel = parseInt(Platform.Version.toString(), 10);

      if (apiLevel < 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      if (
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN &&
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
      ) {
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return (
          result["android.permission.BLUETOOTH_CONNECT"] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          result["android.permission.BLUETOOTH_SCAN"] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          result["android.permission.ACCESS_FINE_LOCATION"] ===
            PermissionsAndroid.RESULTS.GRANTED
        );
      }
    }

    console.log("Permission have not been granted");
    return false;
  }

  /** Scans for the terminal, reads value1..4 (read-only, UTF-8) and disconnects. Gives up after `timeoutMs` with no terminal in range. */
  async scan(timeoutMs = SCAN_TIMEOUT_MS): Promise<BleValues> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.manager.stopDeviceScan();
        reject(new Error(NO_TERMINAL));
      }, timeoutMs);
      this.manager.startDeviceScan(null, null, (error: any, device: any) => {
        // console.log("Scanning...");

        if (error) {
          clearTimeout(timer);
          // * Handle error (scanning will be stopped automatically)
          console.log("ERROR:", error.message);
          // * [BleError: BluetoothLE is powered off]
          if (error.message === "BluetoothLE is powered off") {
            this.manager.stopDeviceScan();
            BluetoothStateManager.requestToEnable()
              .then((result) => {
                this.scan();
              })
              .catch((error) => {
                console.log(error.message);
                Alert.alert(
                  "Bluetooth is off",
                  "Please turn on your bluetooth and try again"
                );
              });
          }
          reject(error.message);
        } else {
          if (
            device?.name === BLE.DEVICE_NAME &&
            this.calculateDistance(-59, 2, device.rssi) <= 0.05
          ) {
            console.log(this.calculateDistance(-59, 2, device.rssi));
            clearTimeout(timer);
            // * Stop scanning as it's not necessary if you are scanning for one device
            this.manager.stopDeviceScan();
            // * Connect to the device
            device
              .connect()
              .then(async (device: any) => {
                try {
                  await device.discoverAllServicesAndCharacteristics();
                  const read = async (uuid: string) => {
                    const c = await device.readCharacteristicForService(
                      BLE.SERVICE_UUID,
                      uuid
                    );
                    return Buffer.from(c.value ?? "", "base64").toString("utf8");
                  };
                  const values: BleValues = {
                    value1: await read(BLE.MERCHANT_ADDRESS),
                    value2: await read(BLE.AMOUNT_BASE_UNITS),
                    value3: await read(BLE.ASSET_UNIT),
                    value4: await read(BLE.PAYMENT_ID),
                  };
                  console.log("\n [RECEIVED CHARACTERISTICS]", values);
                  // * Nothing is written back: the payer authorizes through the backend API
                  await device.cancelConnection().catch(() => {});
                  resolve(values);
                } catch (error) {
                  reject(error);
                }
              })
              .catch((error: any) => {
                console.log("Connection error", error);
                reject(error);
              });
          }
        }
      });
    });
  }
}
