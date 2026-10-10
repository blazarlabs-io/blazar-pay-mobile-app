import { Colors } from "@/constants/Colors";
import {
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { Icons } from "../../core";
import { router } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";

export const ActionsSection = () => {
  const theme = useColorScheme() ?? "light";

  return (
    <>
      <View className="flex w-full flex-row items-center justify-between px-2">
        <TouchableOpacity
          onPress={() => router.push("/withdraw")}
          className="flex h-[48px] w-[48%] flex-row items-center justify-center gap-x-1 rounded-[32px] pl-4"
          style={{ backgroundColor: Colors[theme].foreground }}
        >
          <View
            className="flex h-8 w-8 items-center justify-center rounded-[32px]"
            style={{ backgroundColor: Colors[theme].background }}
          >
            <Icons.CurrencyDecrease size="24" />
          </View>
          <View className="w-20">
            <Text
              className=""
              style={{ color: Colors[theme].background, fontSize: 12 }}
            >
              Withdraw
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/home/nfc")} // the contactless (BLE) payment flow
          className="flex h-[48px] w-[48%] flex-row items-center justify-center gap-x-2 rounded-[32px] pl-4"
          style={{ backgroundColor: Colors[theme].foreground }}
        >
          <View
            className="flex h-8 w-8 items-center justify-center rounded-[32px]"
            style={{ backgroundColor: Colors[theme].background }}
          >
            <Icons.MoneyBillFly size="24" />
          </View>
          <View className="w-20">
            <Text
              className=""
              style={{ color: Colors[theme].background, fontSize: 12 }}
            >
              Pay
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </>
  );
};
