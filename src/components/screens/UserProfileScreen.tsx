import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, Button } from "../core";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { router } from "expo-router";
import { useAuth } from "@/context/authContext";
import { LinearGradient } from "expo-linear-gradient";
import { Logout } from "../core/Icon/Logout";

export const UserProfileScreen = () => {
  const { user } = useAuth();

  const handleSignOut = async () => {
    signOut(auth)
      .then(() => {
        // Sign-out successful.
        router.replace("/");
      })
      .catch((error) => {
        // An error happened.
      });
  };

  return (
    <SafeAreaView className="flex-1 px-5">
      <LinearGradient
        className="absolute left-0 right-0 top-0 h-screen"
        colors={["#DEF9FE", "#FFFCE3"]}
      />
      {user && (
        <View className="mt-20 flex-1 items-center justify-start">
          <View>
            <Avatar
              size={88}
              image={user?.photoURL as string}
              name={user?.email as string}
            />
          </View>
          <View>
            <Text className="text-2xl font-bold">{user?.displayName}</Text>
            <Text className="text-base font-semibold opacity-60">
              {user?.email}
            </Text>
          </View>
          {/* Help, Settings, FAQ and Delete Account had no handler: hidden in the M3 test build */}
          <View className="mt-8 w-full">
            <Button
              onPress={handleSignOut}
              variant="outline"
              label="Logout"
              icon={Logout}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};
