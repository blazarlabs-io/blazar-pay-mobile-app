import { Icons } from "@/components/core";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { TouchableOpacity, View } from "react-native";
import "react-native-reanimated";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function MyTransactionsLayout() {
  return (
    <Stack screenOptions={{}}>
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: "My funds",
          headerTitleAlign: "center",
          headerLeft: () => (
            <View className="">
              <TouchableOpacity onPress={() => router.back()}>
                <Icons.ChevronLeft size="24" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <Stack.Screen
        name="detail"
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: "Funds UTxO",
          headerTitleAlign: "center",
          headerLeft: () => (
            <View className="">
              <TouchableOpacity onPress={() => router.back()}>
                <Icons.ChevronLeft size="24" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
    </Stack>
  );
}
