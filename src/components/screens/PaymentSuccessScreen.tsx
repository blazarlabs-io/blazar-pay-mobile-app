import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { Button, SafeLayout, ThemedText } from "../core";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useWallet } from "@/context/walletContext";
import { getPayment } from "@/services/api";
import {
  ASSETS,
  formatBaseUnits,
  isAssetUnit,
  type Payment,
} from "@/types/payment-contract";

type Result =
  | { status: "loading" }
  | { status: "confirmed"; payment: Payment }
  | { status: "error"; message: string };

// Route params are untrusted (the route is deep-linkable): only the paymentId is read, and success is
// shown only when the backend reports state "confirmed".
export const PaymentSuccessScreen = () => {
  const router = useRouter();
  const { getBalance } = useWallet();
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const [result, setResult] = useState<Result>({ status: "loading" });

  useEffect(() => {
    if (!paymentId) {
      setResult({ status: "error", message: "No payment to show." });
      return;
    }
    getPayment(paymentId)
      .then((p) => {
        if (p.state !== "confirmed") {
          setResult({
            status: "error",
            message: `Payment ${p.state}${p.error ? `: ${p.error}` : ""}`,
          });
          return;
        }
        setResult({ status: "confirmed", payment: p });
        getBalance(); // * Balances changed: refresh them for the home screen
      })
      .catch((e: any) =>
        setResult({ status: "error", message: e?.message ?? String(e) })
      );
  }, [paymentId]);

  const payment = result.status === "confirmed" ? result.payment : null;
  const asset =
    payment && isAssetUnit(payment.assetUnit)
      ? ASSETS[payment.assetUnit]
      : null;

  return (
    <SafeLayout>
      <View className="flex-1 flex-col items-center justify-between">
        <View className="mt-20 flex items-center justify-center">
          <Image
            source={require("@/assets/images/pay.png")}
            style={{
              width: 220,
              height: 220,
            }}
          />
          <ThemedText type="subtitle" className="">
            Payment
          </ThemedText>
          {result.status === "loading" && (
            <ThemedText type="default" className="mt-8 text-center">
              Checking the payment with the backend...
            </ThemedText>
          )}
          {result.status === "error" && (
            <ThemedText type="default" className="mt-8 text-center">
              Payment not confirmed. {result.message}
            </ThemedText>
          )}
          {payment && (
            <>
              <ThemedText type="default" className="mt-8 text-center">
                Congratulations. Your payment was successful. The amount has
                been transferred.
              </ThemedText>
              {asset && (
                <ThemedText type="title" className="mt-8 text-center">
                  {formatBaseUnits(payment.amountBaseUnits, asset.decimals)}{" "}
                  {asset.symbol}
                </ThemedText>
              )}
              <ThemedText
                type="default"
                className="mt-4 text-center opacity-50"
              >
                Hydra tx: {payment.hydraTxId || "-"}
              </ThemedText>
              <ThemedText
                type="default"
                className="mt-2 text-center opacity-50"
              >
                Snapshot: {payment.snapshotNumber ?? "-"}
              </ThemedText>
            </>
          )}
        </View>
        <View className="w-full pb-8">
          <Button
            label="Done"
            variant="primary"
            onPress={() => router.push("/(private)/home")}
          />
        </View>
      </View>
    </SafeLayout>
  );
};
