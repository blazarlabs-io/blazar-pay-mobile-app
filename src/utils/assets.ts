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

/** "91 ADA · 0 USDM · 0.0006984 BTC": every asset, exact, a missing unit counts as 0. */
export const assetLine = (amounts: Record<string, number | string>) =>
  (Object.keys(ASSETS) as AssetUnit[])
    .map((unit) => `${formatBaseUnits(String(amounts[unit] ?? 0), ASSETS[unit].decimals)} ${ASSETS[unit].symbol}`)
    .join(" · ");
