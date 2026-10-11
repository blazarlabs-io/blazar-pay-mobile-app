import { useAuth } from "@/context/authContext";
import { authGate } from "@/utils/authGate";
import { Redirect, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import "react-native-reanimated";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function AuthRootLayout() {
  const { user, initializing } = useAuth();
  const gate = authGate("(auth)", initializing, !!user);
  if (gate === "wait") return null;
  if (gate !== "render") return <Redirect href={gate} />; // replace, so Back on Home does not reveal sign-in

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
