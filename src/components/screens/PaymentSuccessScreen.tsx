import { useEffect } from "react";
import { Image, View } from "react-native";
import { Button, SafeLayout, ThemedText } from "../core";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useWallet } from "@/context/walletContext";
import { ASSETS, formatBaseUnits, isAssetUnit } from "@/types/payment-contract";

// Reached only from NfcScreen after the backend reports state "confirmed".
export const PaymentSuccessScreen = () => {
  const router = useRouter();
  const { getBalance } = useWallet();
  const { amountBaseUnits, assetUnit, hydraTxId, snapshotNumber } =
    useLocalSearchParams<{
      amountBaseUnits: string;
      assetUnit: string;
      hydraTxId: string;
      snapshotNumber: string;
    }>();
  const asset = assetUnit && isAssetUnit(assetUnit) ? ASSETS[assetUnit] : null;

  // * Balances changed: refresh them for the home screen
  useEffect(() => {
    getBalance();
  }, []);

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
          <ThemedText type="default" className="mt-8 text-center">
            Congratulations. Your payment was successful. The amount has been
            transferred.
          </ThemedText>
          {asset && amountBaseUnits && (
            <ThemedText type="title" className="mt-8 text-center">
              {formatBaseUnits(amountBaseUnits, asset.decimals)} {asset.symbol}
            </ThemedText>
          )}
          <ThemedText type="default" className="mt-4 text-center opacity-50">
            Hydra tx: {hydraTxId || "-"}
          </ThemedText>
          <ThemedText type="default" className="mt-2 text-center opacity-50">
            Snapshot: {snapshotNumber || "-"}
          </ThemedText>
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
