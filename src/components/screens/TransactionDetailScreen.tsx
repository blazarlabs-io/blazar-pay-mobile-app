import { Colors } from "@/constants/Colors";
import { Transaction } from "@/types/db";
import { utxoAssets } from "@/utils/assets";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useColorScheme, View } from "react-native";
import { Icons, ThemedText, ThemedView } from "../core";

export interface TransactionDetailScreenProps {
  data?: Transaction; // undefined when the UTxO is no longer in the wallet's funds list
}

export const TransactionDetailScreen = ({
  data,
}: TransactionDetailScreenProps) => {
  const theme = useColorScheme() ?? "light";

  return (
    <SafeAreaView className="flex-1 px-5">
      <LinearGradient
        className="absolute left-0 right-0 top-0 h-screen"
        colors={["#DEF9FE", "#FFFCE3"]}
      />
      <View className="mt-32 flex w-full flex-col items-center">
        <View
          className="flex h-20 w-20 flex-row items-center justify-center rounded-full border"
          style={{ backgroundColor: Colors[theme].tertiary }}
        >
          <Icons.MoneyBillFly size="32" />
        </View>
        {!data ? (
          <ThemedText type="default" className="mt-8 text-center opacity-50">
            Transaction details are not available.
          </ThemedText>
        ) : (
          <>
            {utxoAssets(data.assets).map(({ symbol, amount }) => (
              <ThemedText key={symbol} type="subtitle" className="mt-4">
                {amount} {symbol}
              </ThemedText>
            ))}
            <ThemedView className="mt-8 w-full rounded-[32px] border p-6">
              <ThemedText type="default" className="opacity-50">
                Transaction
              </ThemedText>
              <ThemedText type="default" selectable className="font-semibold">
                {data.txHash}#{data.outputIndex}
              </ThemedText>
              <ThemedText type="default" className="mt-4 opacity-50">
                Address
              </ThemedText>
              <ThemedText type="default" selectable className="font-semibold">
                {data.address}
              </ThemedText>
            </ThemedView>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};
