import { useCallback, useEffect, useState } from "react";
import { Image, Modal, useColorScheme, View, Text } from "react-native";
import { BleClient } from "../../services/ble-client";
import { Button, Icons, SafeLayout, ThemedText, ThemedView } from "../core";
import { useWalletRegistration } from "@/hooks/useWalletRegistration";
import { Colors } from "@/constants/Colors";
import { useRouter } from "expo-router";
import { useWallet } from "@/context/walletContext";
import { authorize, getPayment } from "@/services/api";
import { findMismatch, payAndWait } from "@/services/payment-flow";
import { ASSETS, formatBaseUnits, type Payment } from "@/types/payment-contract";

type Step =
  | { step: "scanning" }
  | { step: "ready" | "paying"; payment: Payment }
  | { step: "error"; message: string };

export const NfcScreen = () => {
  const { isWalletRegistered } = useWallet();
  const router = useRouter();
  const [modalVisible, setModalVisible] =
    useState<boolean>(!isWalletRegistered);
  const theme = useColorScheme() ?? "light";
  const [view, setView] = useState<Step>({ step: "scanning" });
  const [bleClient] = useState(() => new BleClient());

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  const handleStartWalletRegistration = () => {
    setModalVisible(false);
    router.push("/wallet-registration/register");
  };

  // * Read the terminal, then show what the backend says for that paymentId
  const startScan = useCallback(async () => {
    setView({ step: "scanning" });
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
      setView({ step: "ready", payment });
    } catch (error: any) {
      console.log(error);
      setView({ step: "error", message: error?.message ?? String(error) });
    }
  }, [bleClient]);

  const handleSendPayment = async (payment: Payment) => {
    setView({ step: "paying", payment });
    const outcome = await payAndWait(
      { authorize, getPayment },
      payment.paymentId
    );
    if (!outcome.ok) {
      setView({ step: "error", message: outcome.message });
      return;
    }
    router.push({
      pathname: "/payment-success",
      params: {
        amountBaseUnits: outcome.payment.amountBaseUnits,
        assetUnit: outcome.payment.assetUnit,
        hydraTxId: outcome.payment.hydraTxId ?? "",
        snapshotNumber: String(outcome.payment.snapshotNumber ?? ""),
      },
    });
  };

  useEffect(() => {
    startScan();
  }, [startScan]);

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
        {view.step === "scanning" && (
          <>
            <ThemedText type="subtitle" className="max-w-[70%] text-center">
              Buy fast and safely with our contactless payments.
            </ThemedText>
            <ThemedText type="default" className="mt-6 max-w-[90%] text-center">
              Activating our contactless system allows you to pay with your
              phone in any hydrapay compatible terminal.
            </ThemedText>
          </>
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
              label="Scan again"
              fullWidth
              icon={null}
              className="mt-8"
              onPress={startScan}
            />
          </>
        )}
      </View>
    </SafeLayout>
  );
};
