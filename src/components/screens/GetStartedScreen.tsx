import {
  Button,
  Icons,
  Input,
  SafeLayout,
  ThemedText,
  ThemedView,
} from "@/components/core";
import { Colors } from "@/constants/Colors";
import { auth } from "@/lib/firebase/client";
import { firebaseAuthErrors } from "@/utils/firebaseAuthErrors";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { Image, Modal, ScrollView, useColorScheme, View } from "react-native";

export const GetStartedScreen = () => {
  // * HOOKS
  const theme = useColorScheme() ?? "light";

  // * STATES
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  const handleSignIn = async () => {
    await signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Signed in
        const user = userCredential.user;
      })
      .catch((error) => {
        console.log("error", firebaseAuthErrors[error.code]);
        setError(firebaseAuthErrors[error.code]);
        setModalVisible(true);
      });
  };

  return (
    <SafeLayout>
      {/* * MODAL START */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(!modalVisible);
        }}
      >
        <View className="flex h-full w-full items-center justify-center bg-black/60">
          <ThemedView className="flex max-w-[75%] flex-col items-center justify-center rounded-[32px] border p-8">
            <View className="flex w-full flex-row items-center justify-center gap-x-4">
              <View
                style={{
                  backgroundColor: Colors[theme].error,
                  borderColor: Colors[theme].foreground,
                  borderWidth: 1,
                }}
                className="rounded-[16px] p-4"
              >
                <Icons.ErrorCircle />
              </View>
              <ThemedText className="max-w-[75%]">{error}</ThemedText>
            </View>
            <View className="mt-8 flex w-full flex-row items-center justify-end">
              <Button
                variant="link"
                label="Close"
                fullWidth={false}
                onPress={() => setModalVisible(!modalVisible)}
              />
            </View>
          </ThemedView>
        </View>
      </Modal>
      {/* * MODAL END */}
      <ScrollView>
        <View className="flex h-full w-full flex-col items-center justify-start bg-transparent">
          <View className="mt-8 w-full">
            <Image
              source={require("@/assets/images/money-transfer.png")}
              style={{ width: 340, height: 200 }}
              resizeMode="contain"
            />
          </View>
          <View className="w-full gap-y-3">
            <View className="flex w-full flex-col items-center justify-center">
              <ThemedText type="defaultSemiBold">Welcome to</ThemedText>
              <Image
                source={require("@/assets/images/hydrapay.png")}
                className=""
                style={{ width: 200, height: 64 }}
                resizeMode="contain"
              />
            </View>
            {/* M3 test build: email/password only; Google, sign-up and password reset have no handler */}
            <View className="flex w-full items-center justify-center">
              <View className="w-full">
                <Input
                  placeholder="Email"
                  type="email"
                  value={email}
                  onValueChange={(value) => setEmail(value)}
                />
              </View>
              <View className="mt-4 w-full">
                <Input
                  placeholder="Password"
                  type="password"
                  value={password}
                  onValueChange={(value) => setPassword(value)}
                />
              </View>
            </View>
            <View className="mt-4 flex w-full items-center justify-center">
              <Button
                label="Continue"
                variant="primary"
                onPress={() => handleSignIn()}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeLayout>
  );
};
