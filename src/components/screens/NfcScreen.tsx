import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, useColorScheme, View, Text } from "react-native";
import { BleClient } from "../../services/ble-client";
import { Button, Icons, SafeLayout, ThemedText, ThemedView } from "../core";
import { useWalletRegistration } from "@/hooks/useWalletRegistration";
import { Colors } from "@/constants/Colors";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useRoute } from "@react-navigation/native";
import { useWallet } from "@/context/walletContext";
import { authorize, currentDeviceKey, getPayment, getTerminalPendingPayment, signPayload } from "@/services/api";
import { findMismatch, isSupportedAsset, payAndWait, type PayOutcome } from "@/services/payment-flow";
import { cancelNfcRead, nfcStatus, readTerminalTag, toNfcTarget, type NfcTarget } from "@/services/nfc-client";
import { ASSETS, formatBaseUnits, type Payment } from "@/types/payment-contract";

type Step =
  | { step: "tap" } // NFC: waiting for the terminal's tag
  | { step: "scanning" } // BLE scan
  | { step: "loading" }
  | { step: "ready" | "paying"; payment: Payment }
  | { step: "error"; message: string };

const NO_HYDRAPAY_LINK = "This is not a HydraPay terminal tag or link.";
const NO_PENDING_PAYMENT =
  "No payment is waiting at this terminal. Ask the merchant to start the payment, then tap again.";

export const NfcScreen = () => {
  const { isWalletRegistered } = useWallet();
  const router = useRouter();
  const [modalVisible, setModalVisible] =
    useState<boolean>(!isWalletRegistered);
  const theme = useColorScheme() ?? "light";
  const [view, setView] = useState<Step>({ step: "loading" });
  const [bleClient] = useState(() => new BleClient());
  const [nfc, setNfc] = useState<"on" | "off" | "none">();
  const { terminal, paymentId } = useLocalSearchParams<{ terminal?: string; paymentId?: string }>();
  const { params } = useRoute(); // a new object on every navigation here, also for the same link opened again
  const run = useRef(0);
  const paying = useRef(false); // payAndWait is running: leaving the tab neither drops nor restarts it

  // Each flow takes a new run id; results of an older one (a cancelled NFC read, an earlier scan) are dropped
  const begin = useCallback((first: Step) => {
    const id = ++run.current;
    setView(first);
    return (next: Step) => {
      if (id === run.current) setView(next);
    };
  }, []);

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  const handleStartWalletRegistration = () => {
    setModalVisible(false);
    router.push("/wallet-registration/register");
  };

  // * Read the terminal, then show what the backend says for that paymentId
  const startScan = useCallback(async () => {
    cancelNfcRead();
    const show = begin({ step: "scanning" });
    try {
      if (!(await bleClient.requestPermissions())) {
        throw new Error("Bluetooth permission was not granted.");
      }
      const values = await bleClient.scan();
      const payment = await getPayment(values.value4);
      const mismatch = findMismatch(payment, values);
      if (mismatch) {
        throw new Error(
          `The terminal and the backend disagree on the ${mismatch}. Payment aborted.`
        );
      }
      show({ step: "ready", payment });
    } catch (error: any) {
      console.log(error);
      show({ step: "error", message: error?.message ?? String(error) });
    }
  }, [bleClient, begin]);

  // * Read the terminal's NFC tag (or take the same link from a deep link), then show the backend's payment
  const startNfc = useCallback(
    async (link?: NfcTarget | null) => {
      const show = begin({ step: link === undefined ? "tap" : "loading" });
      try {
        const target = link === undefined ? await readTerminalTag() : link;
        if (!target) throw new Error(NO_HYDRAPAY_LINK);
        show({ step: "loading" });
        const payment =
          "paymentId" in target
            ? await getPayment(target.paymentId)
            : await getTerminalPendingPayment(target.terminal);
        if (!payment) throw new Error(NO_PENDING_PAYMENT);
        if (payment.state !== "created") throw new Error(`This payment is already ${payment.state}.`);
        if (!isSupportedAsset(payment)) {
          throw new Error("This payment is in an asset the app does not support.");
        }
        show({ step: "ready", payment });
      } catch (error: any) {
        console.log(error);
        show({ step: "error", message: error?.message ?? String(error) });
      }
    },
    [begin]
  );

  const handleSendPayment = async (payment: Payment) => {
    const show = begin({ step: "paying", payment });
    paying.current = true;
    let outcome: PayOutcome;
    try {
      outcome = await payAndWait({ signPayload, authorize, getPayment }, await currentDeviceKey(), payment);
    } catch (e: any) {
      outcome = { ok: false, message: e?.message ?? String(e) }; // signed out, or the secure store failed
    }
    paying.current = false;
    if (!outcome.ok) {
      show({ step: "error", message: outcome.message });
      return;
    }
    router.push({
      pathname: "/payment-success",
      params: { paymentId: outcome.payment.paymentId }, // the screen re-reads it from the backend
    });
  };

  useEffect(() => {
    nfcStatus().then(setNfc);
    return () => {
      run.current++;
      cancelNfcRead();
    };
  }, []);

  // * Each time the Pay tab gains focus or is navigated to (a deep link, even the same one again): a deep link
  // (?terminal= or ?paymentId=) is resolved like a tag; otherwise NFC when it is on, else BLE. Losing focus stops
  // the NFC read and drops the run, except a payment being confirmed, which keeps its screen and its outcome.
  useFocusEffect(
    useCallback(() => {
      if (!nfc || paying.current) return;
      if (terminal !== undefined || paymentId !== undefined) startNfc(toNfcTarget({ terminal, paymentId }));
      else if (nfc === "on") startNfc();
      else startScan();
      return () => {
        if (!paying.current) run.current++;
        cancelNfcRead();
      };
    }, [nfc, terminal, paymentId, params, startNfc, startScan])
  );

  const bluetoothButton = (
    <Button
      variant="outline"
      label="Use Bluetooth instead"
      fullWidth
      icon={null}
      className="mt-4"
      onPress={startScan}
    />
  );

  return (
    <SafeLayout>
      {/* * MODAL START */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCloseModal}
      >
        <View className="flex h-full w-full items-center justify-center bg-black/60">
          <ThemedView className="flex max-w-[75%] flex-col items-center justify-center rounded-[32px] border p-8">
            <View className="flex w-full flex-row items-center justify-center gap-x-4">
              <View
                style={{
                  backgroundColor: Colors[theme]?.primary,
                  borderColor: Colors[theme]?.foreground,
                  borderWidth: 1,
                }}
                className="rounded-[16px] p-4"
              >
                <Icons.Wallet />
              </View>
              <ThemedText className="max-w-[75%]">
                Please register your wallet address to continue.
              </ThemedText>
            </View>
            <View className="mt-8 flex w-full flex-row items-center justify-end">
              <Button
                variant="link"
                label="Ok"
                fullWidth={false}
                onPress={handleStartWalletRegistration}
              />
            </View>
          </ThemedView>
        </View>
      </Modal>
      {/* * MODAL END */}
      <View className="items-center justify-center py-4">
        <ThemedText type="subtitle" className="text-center">
          Contactless Payments
        </ThemedText>
      </View>
      <View className="flex-1 items-center justify-center">
        <Image
          source={require("@/assets/images/nfc-illustration.png")}
          className="h-[30%] w-[55%]"
          resizeMode="contain"
        />
        {view.step === "tap" && (
          <>
            <ThemedText type="subtitle" className="max-w-[70%] text-center">
              Tap the terminal
            </ThemedText>
            <ThemedText type="default" className="mt-6 max-w-[90%] text-center">
              Hold the back of your phone against the HydraPay terminal's NFC
              tag.
            </ThemedText>
            <ActivityIndicator style={{ marginTop: 24 }} size="large" />
            {bluetoothButton}
          </>
        )}
        {view.step === "scanning" && (
          <>
            <ThemedText type="subtitle" className="max-w-[70%] text-center">
              Buy fast and safely with our contactless payments.
            </ThemedText>
            <ThemedText type="default" className="mt-6 max-w-[90%] text-center">
              Hold your phone near a HydraPay terminal. The app finds it over
              Bluetooth (BLE).
              {nfc === "none" && " This phone has no NFC, so tapping the terminal is not available."}
              {nfc === "off" && " NFC is turned off: turn it on in Settings to tap the terminal instead."}
            </ThemedText>
            <ActivityIndicator style={{ marginTop: 24 }} size="large" />
          </>
        )}
        {view.step === "loading" && (
          <ActivityIndicator style={{ marginTop: 24 }} size="large" />
        )}
        {(view.step === "ready" || view.step === "paying") && (
          <>
            <View className="flex flex-col items-center justify-center gap-y-4">
              <ThemedText type="subtitle" className="max-w-[90%] text-center">
                Payment requested from
              </ThemedText>
              <ThemedText
                type="default"
                className="max-w-[80%] text-center opacity-50"
              >
                {view.payment.merchantAddress}
              </ThemedText>
              <View className="flex flex-row items-start justify-center">
                <ThemedText
                  type="title"
                  className="mt-8 max-w-[70%] text-center"
                >
                  {formatBaseUnits(
                    view.payment.amountBaseUnits,
                    ASSETS[view.payment.assetUnit].decimals
                  )}
                </ThemedText>
                <Text className="ml-2 mt-8 max-w-[70%] text-center text-[10px] font-bold opacity-50">
                  {ASSETS[view.payment.assetUnit].symbol}
                </Text>
              </View>
            </View>
            <Button
              variant="primary"
              label={view.step === "paying" ? "Waiting for confirmation..." : "Pay"}
              fullWidth
              icon={null}
              className="mt-8"
              disabled={view.step === "paying"}
              onPress={() => handleSendPayment(view.payment)}
            />
          </>
        )}
        {view.step === "error" && (
          <>
            <ThemedText type="subtitle" className="max-w-[90%] text-center">
              Payment not completed
            </ThemedText>
            <ThemedText type="default" className="mt-6 max-w-[90%] text-center">
              {view.message}
            </ThemedText>
            <Button
              variant="primary"
              label={nfc === "on" ? "Tap the terminal" : "Scan again"}
              fullWidth
              icon={null}
              className="mt-8"
              onPress={() => (nfc === "on" ? startNfc() : startScan())}
            />
            {nfc === "on" && bluetoothButton}
          </>
        )}
      </View>
    </SafeLayout>
  );
};
