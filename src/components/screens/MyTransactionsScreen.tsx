import { useWallet } from "@/context/walletContext";
import { LinearGradient } from "expo-linear-gradient";
import { FlatList, SafeAreaView, StatusBar, View } from "react-native";
import { ThemedText, TransactionCard } from "../core";
import { router } from "expo-router";

// Same data as the Home section: the payer's funds UTxOs from GET /query-funds.
export const MyTransactionsScreen = () => {
  const { transactions } = useWallet();
  return (
    <>
      <LinearGradient
        className="absolute left-0 right-0 top-0 h-screen"
        colors={["#DEF9FE", "#FFFCE3"]}
      />
      <SafeAreaView
        className="flex-1 px-5 pt-20"
        style={{ marginTop: StatusBar.currentHeight ?? 0 }}
      >
        <FlatList
          data={transactions}
          ListEmptyComponent={
            <ThemedText className="mt-8 text-center opacity-50">
              No transactions yet.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <View className="mt-4">
              <TransactionCard
                data={item}
                onPress={() =>
                  router.push(`/my-transactions/detail/${item.txHash}`)
                }
              />
            </View>
          )}
          keyExtractor={(item) => `${item.txHash}#${item.outputIndex}`}
        />
      </SafeAreaView>
    </>
  );
};
