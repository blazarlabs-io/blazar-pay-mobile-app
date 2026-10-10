import { ThemedText, TransactionCard } from "@/components/core";
import { Colors } from "@/constants/Colors";
import { TouchableOpacity, useColorScheme, View } from "react-native";
// import { transactions } from "@/data/transactionsTemplate";
import { router } from "expo-router";
import { dateOptions } from "@/utils/dateUtils";
import { useWallet } from "@/context/walletContext";
import { Transaction } from "@/types/db";

export const MyTransactionsSection = () => {
  const theme = useColorScheme() ?? "light";
  const { transactions } = useWallet();

  return (
    <View>
      <View className="flex flex-row items-center justify-between">
        <ThemedText className="font-bold">My funds</ThemedText>
        <TouchableOpacity onPress={() => router.push("/my-transactions")}>
          <ThemedText
            className="text-sm font-bold"
            style={{ color: Colors[theme]["muted-foreground"] }}
          >
            See All
          </ThemedText>
        </TouchableOpacity>
      </View>
      <View className="w-full">
        {transactions &&
          transactions !== undefined &&
          transactions.length > 0 &&
          transactions.map((transaction, index) => (
            <View
              key={`transaction-${index}-${transaction.txHash}`}
              className="w-full"
            >
              {index < 2 && (
                <View className="mt-4 w-full">
                  <TransactionCard
                    data={transaction}
                    // date={transaction.date.toLocaleDateString(
                    //   "en-US",
                    //   dateOptions as any
                    // )}
                    // value={transaction.value}
                    // icon={
                    //   transaction.type === "income"
                    //     ? "CurrencyDecrease"
                    //     : transaction.type === "shop"
                    //       ? "ShoppingBag"
                    //       : "Exchange"
                    // }
                    // bgColor={
                    //   transaction.type === "income"
                    //     ? "primary"
                    //     : transaction.type === "shop"
                    //       ? "secondary"
                    //       : "warning"
                    // }
                    onPress={() =>
                      router.push(
                        `/my-transactions/detail/${transaction.txHash}`
                      )
                    }
                  />
                </View>
              )}
            </View>
          ))}
        {transactions.length > 0 && (
          <ThemedText className="mt-2 px-2 text-xs opacity-50">
            ADA in a funds UTxO includes its locked min-ADA deposit, which is not payable.
          </ThemedText>
        )}
        {/* <View className="mt-8">
          <TransactionCard
            label="Shell"
            date="May 26, 2024"
            value="$31.05"
            icon="Receipt"
            bgColor="secondary"
          />
        </View>
        <View className="mt-4">
          <TransactionCard
            label="Shell"
            date="May 26, 2024"
            value="$87.41"
            icon="Receipt"
            bgColor="primary"
          />
        </View> */}
      </View>
    </View>
  );
};
