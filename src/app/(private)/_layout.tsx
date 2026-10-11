import { useAuth } from "@/context/authContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import { authGate } from "@/utils/authGate";
import { useFonts } from "expo-font";
import { Redirect, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function PrivateLayout() {
  const { user, initializing } = useAuth();
  const gate = authGate("(private)", initializing, !!user);
  if (gate === "wait") return null; // no private content before the session is known
  if (gate !== "render") return <Redirect href={gate} />;

  return (
    <Stack>
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="my-transactions" options={{ headerShown: false }} />
      <Stack.Screen name="withdraw" options={{ headerShown: false }} />
      <Stack.Screen name="pay" options={{ headerShown: false }} />
      <Stack.Screen name="benefits" options={{ headerShown: false }} />
      <Stack.Screen
        name="wallet-registration"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="payment-success" options={{ headerShown: false }} />
      <Stack.Screen
        name="deposit-btc"
        options={{ title: "Deposit BTC", headerTransparent: true }}
      />
    </Stack>
  );
}
