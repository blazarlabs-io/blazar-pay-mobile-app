import { ScrollView, useColorScheme, View } from "react-native";
import { SafeLayout } from "../core";
import { ActionsSection, MyTransactionsSection } from "../sections";
import { BalanceInfo } from "../widgets";
import { StatusBar } from "expo-status-bar";
import { Colors } from "@/constants/Colors";

export const HomeScreen = () => {
  const theme = useColorScheme() ?? "light";
  return (
    <SafeLayout>
      <ScrollView
        contentContainerStyle={{
          flex: 1,
        }}
      >
        <View className="mt-20">
          <BalanceInfo />
        </View>
        <View className="mt-6">
          <ActionsSection />
        </View>
        <View className="mt-6">
          <MyTransactionsSection />
        </View>
        {/* Benefits (rewards, staking, exchange) was template UI with no working action: hidden for M3 */}
      </ScrollView>
    </SafeLayout>
  );
};
