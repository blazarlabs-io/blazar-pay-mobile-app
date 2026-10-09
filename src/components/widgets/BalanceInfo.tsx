import { LinearGradient } from "expo-linear-gradient";
import { Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Icons } from "../core";
import { useWallet } from "@/context/walletContext";
import { useEffect } from "react";
import { ASSETS, AssetUnit, formatBaseUnits } from "@/types/payment-contract";
import { ASSET_UNITS } from "@/constants/assetUnits";
import { DEPOSIT_LABEL, inProgressSats } from "@/services/deposit-flow";

export const BalanceInfo = () => {
  const {
    adaBalance,
    usdmBalance,
    wbtcBalance,
    adaConversionRate,
    usdmConversionRate,
    wbtcConversionRate,
    l1Balances,
    btcDeposit,
  } = useWallet();
  const pendingSats = inProgressSats(btcDeposit);

  useEffect(() => {
    console.log("adaBalance", adaBalance);
    console.log("usdmBalance", usdmBalance);
    console.log("wbtcBalance", wbtcBalance);
    console.log("adaConversionRate", adaConversionRate);
    console.log("usdmConversionRate", usdmConversionRate);
    console.log("wbtcConversionRate", wbtcConversionRate);
    console.log("usdFromWbtc", wbtcBalance * wbtcConversionRate);
  }, [
    adaBalance,
    usdmBalance,
    wbtcBalance,
    adaConversionRate,
    usdmConversionRate,
    wbtcConversionRate,
  ]);
  return (
    <>
    <View className="relative h-[200px] rounded-[32px]">
      <LinearGradient
        className="absolute left-0 right-0 top-0 h-[200px] rounded-[32px] border"
        colors={["#FFD5E9", "#8CE4F3"]}
      />
      <View className="flex flex-row items-center justify-start gap-x-2 px-6 pt-6">
        <Text className="text-5xl font-black">{`$${(adaBalance * adaConversionRate + usdmBalance * usdmConversionRate + wbtcBalance * wbtcConversionRate).toFixed(2)}`}</Text>
        <Text className="text-base font-black opacity-50">USD</Text>
      </View>
      <View className="px-6">
        <Text className="text-base">Payable balance (Hydra L2)</Text>
      </View>
      <View
        style={{ flex: 1 }}
        className="flex flex-row items-center justify-between px-6"
      >
        {/* * ADA */}
        <View className="flex max-w-fit flex-col items-start justify-center">
          <View className="flex flex-row items-center justify-start gap-x-1 pt-6">
            <Icons.AdaIcon />
            <Text className="text-base font-bold">{adaBalance.toFixed(2)}</Text>
            {/* <Text className="pl-1 text-xs font-black opacity-50">ADA</Text> */}
          </View>
          <View className="flex flex-row items-center justify-start gap-x-1 opacity-50">
            <Text className="text-xs font-normal">
              ${(adaBalance * adaConversionRate).toFixed(2)}
            </Text>
            <Text className="text-xs font-bold">USD</Text>
          </View>
        </View>
        {/* * USDM */}
        <View className="flex flex-col items-end justify-center">
          <View className="flex flex-row items-center justify-start gap-x-1 pt-6">
            <Icons.UsdmIcon />
            <Text className="text-base font-bold">
              {usdmBalance.toFixed(2)}
            </Text>
            {/* <Text className="pl-1 text-xs font-black opacity-50">USDM</Text> */}
          </View>
          <View className="flex flex-row items-center justify-end gap-x-1 opacity-50">
            <Text className="text-xs font-normal">
              ${(usdmBalance * usdmConversionRate).toFixed(2)}
            </Text>
            <Text className="text-xs font-bold">USD</Text>
          </View>
        </View>
        {/* * WBTC */}
        <View className="flex flex-col items-end justify-center">
          <View className="flex flex-row items-center justify-start gap-x-1 pt-6">
            <Icons.Wbtc />
            <Text className="text-base font-bold">
              {wbtcBalance.toFixed(6)}
            </Text>
          </View>
          <View className="flex flex-row items-center justify-end gap-x-1 opacity-50">
            <Text className="text-xs font-normal">
              ${(wbtcBalance * wbtcConversionRate).toFixed(2)}
            </Text>
            <Text className="text-xs font-bold">USD</Text>
          </View>
        </View>
      </View>
    </View>
    {/* * L1 funds are not payable until committed to the Hydra head */}
    <Text className="mt-2 px-6 text-xs opacity-50">
      {`On L1, not payable yet: ${(Object.keys(ASSETS) as AssetUnit[])
        .map((u) => `${formatBaseUnits(l1Balances[u] ?? "0", ASSETS[u].decimals)} ${ASSETS[u].symbol}`)
        .join(" · ")}`}
    </Text>
    {/* * BTC on its way through the bridge: never part of the payable balance above */}
    {pendingSats && btcDeposit && (
      <Text className="mt-1 px-6 text-xs opacity-50">
        {`BTC deposit in progress, not payable yet: ${formatBaseUnits(pendingSats, ASSETS[ASSET_UNITS.wbtc].decimals)} BTC (${DEPOSIT_LABEL[btcDeposit.state] ?? btcDeposit.state})`}
      </Text>
    )}
    <TouchableOpacity onPress={() => router.push("/deposit-btc")} className="mt-2 px-6">
      <Text className="text-sm font-bold underline">Deposit BTC (testnet bridge)</Text>
    </TouchableOpacity>
    </>
  );
};
