import { TouchableOpacity, useColorScheme, View } from "react-native";
import { ThemedText } from "../Text/ThemedText";
import { Icons } from "../Icon";
import { Colors } from "@/constants/Colors";
import { Transaction } from "@/types/db";
import { utxoAssets } from "@/utils/assets";

type ColorKey = keyof typeof Colors.light; // or keyof typeof Colors.dark

export interface TransactionCardProps {
  // label: string;
  // date?: string;
  // value: number;
  // icon: any;
  // bgColor: ColorKey;
  data: Transaction;
  onPress?: () => void;
}

export const TransactionCard = ({
  // label,
  // date,
  // value,
  // icon,
  // bgColor,
  data,
  onPress,
}: TransactionCardProps) => {
  const theme = useColorScheme() ?? "light";

  // const Icon: any = Icons[icon as keyof typeof Icons];

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex w-full flex-row items-center justify-between rounded-[48px] border p-2"
    >
      <View className="flex flex-row items-center justify-start gap-x-2">
        <View
          style={{
            backgroundColor: Colors[theme]["tertiary" as ColorKey],
          }}
          className="flex h-14 w-14 items-center justify-center rounded-[32px] border"
        >
          <Icons.MoneyBillFly size="24" />
        </View>
        <View className="flex-1 flex-row items-center justify-center">
          <View className="flex-1 justify-center">
            <View className="flex flex-row items-center justify-start">
              <ThemedText
                numberOfLines={1}
                className="truncate text-xs font-medium"
              >
                {/* not data.address: that is the Blazar funds script, not a counterparty */}
                {data.layer === "L1" ? "L1 funds, not payable yet" : "Hydra L2 funds"}
              </ThemedText>
            </View>
            <ThemedText className="text-xs opacity-50" numberOfLines={1}>
              {data.txHash}
            </ThemedText>
          </View>

          <View className="flex-1 flex-col items-end justify-center pr-2">
            {utxoAssets(data.assets).map(({ symbol, amount }) => (
              <View
                key={symbol}
                className="flex-0 shrink flex-row items-center gap-x-1"
              >
                <ThemedText
                  numberOfLines={1}
                  className="flex max-w-fit text-[8px] font-bold opacity-50"
                >
                  {symbol}
                </ThemedText>
                <ThemedText
                  numberOfLines={1}
                  className="flex max-w-fit text-xs font-medium"
                >
                  {amount}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View className="mr-2">{/* <ThemedText>${value}</ThemedText> */}</View>
    </TouchableOpacity>
  );
};
