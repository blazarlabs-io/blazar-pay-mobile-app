import { ASSETS, AssetUnit, formatBaseUnits } from "@/types/payment-contract";

/** Payable assets of a funds UTxO for display, in ASSETS order (ADA, USDM, BTC). Control tokens and unknown units are skipped. */
export const utxoAssets = (assets: Record<string, number | string>) =>
  (Object.keys(ASSETS) as AssetUnit[])
    .filter((unit) => assets[unit] != null)
    // ponytail: query-funds sends quantities as JSON numbers; exact below 2^53, which covers every testnet amount here
    .map((unit) => ({
      symbol: ASSETS[unit].symbol,
      amount: formatBaseUnits(String(assets[unit]), ASSETS[unit].decimals),
    }));
