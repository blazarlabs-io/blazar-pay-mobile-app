import { useEffect, useState } from "react";
import { ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { Button, Icons, SafeLayout, ThemedText } from "../core";
import { useWallet } from "@/context/walletContext";
import { createBtcDeposit, getDeposit, submitBtcTx } from "@/services/api";
import { depositTimeline, electrumPayTo, parseBtcTxid } from "@/services/deposit-flow";
import { ASSETS, formatBaseUnits, toBaseUnits } from "@/types/payment-contract";
import { ASSET_UNITS } from "@/constants/assetUnits";

const DECIMALS = ASSETS[ASSET_UNITS.wbtc].decimals; // 8: 1 unit = 1 sat
const POLL_MS = 10_000;
const MARK = { done: "✓", current: "●", todo: "○" } as const;
const errorText = (e: any) => e?.message ?? String(e);

const CopyRow = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <View className="mt-3 w-full rounded-[16px] border p-3">
      <View className="flex-row items-center justify-between">
        <ThemedText type="defaultSemiBold">{label}</ThemedText>
        <TouchableOpacity
          accessibilityLabel={`Copy ${label}`}
          onPress={() => Clipboard.setStringAsync(value).then(() => setCopied(true))}
        >
          {copied ? <ThemedText type="caption">Copied</ThemedText> : <Icons.Copy size="20" />}
        </TouchableOpacity>
      </View>
      <ThemedText selectable className="mt-1">
        {value}
      </ThemedText>
    </View>
  );
};

/** BTC testnet3 -> WanBridge -> Cardano preprod -> Hydra. The user pays from an external wallet (Electrum). */
export const DepositBtcScreen = () => {
  const { btcDeposit: deposit, trackBtcDeposit } = useWallet();
  const [amount, setAmount] = useState("");
  const [txid, setTxid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  let sats: string | null = null;
  let amountError: string | null = null;
  try {
    sats = amount ? toBaseUnits(amount.replace(",", "."), DECIMALS) : null;
  } catch (e) {
    amountError = errorText(e);
  }
  const btcTxid = parseBtcTxid(txid);
  const id = deposit?.depositId;
  const state = deposit?.state;
  const timeline = deposit ? depositTimeline(deposit) : null;
  const final = timeline?.final ?? true;

  // * Refresh now, then every 10 s once the BTC tx is recorded, until available | failed | expired
  useEffect(() => {
    if (!id || final) return;
    let live = true;
    const refresh = () =>
      getDeposit(id)
        .then((d) => {
          if (!live) return;
          trackBtcDeposit(d);
          setPollError(null);
        })
        .catch((e) => live && setPollError(errorText(e)));
    refresh();
    const t = state === "created" ? undefined : setInterval(refresh, POLL_MS);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [id, state, final]);

  // * Expiry countdown while waiting for the BTC tx
  useEffect(() => {
    if (state !== "created") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const d = await createBtcDeposit(sats!);
      trackBtcDeposit(d);
      setTxid("");
    });

  const submit = () =>
    run(async () => {
      try {
        trackBtcDeposit(await submitBtcTx(id!, btcTxid!));
      } catch (e) {
        // A rejected tx (422) can still be recorded as needs_attention: show what the backend now says.
        await getDeposit(id!).then(trackBtcDeposit).catch(() => {});
        throw e;
      }
    });

  const startOver = () => {
    trackBtcDeposit(null);
    setAmount("");
    setError(null);
    setPollError(null);
  };

  const msLeft = deposit ? Date.parse(deposit.expiresAt) - now : 0;
  const countdown = `${Math.floor(msLeft / 60_000)}:${String(Math.floor(msLeft / 1000) % 60).padStart(2, "0")}`;

  return (
    <SafeLayout>
      <ScrollView
        contentContainerStyle={{ paddingTop: 56, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* * 1. Amount */}
        {!deposit && (
          <>
            <ThemedText type="subtitle">Deposit BTC (testnet)</ThemedText>
            <ThemedText className="mt-2 opacity-70">
              Send Bitcoin testnet3 from an external wallet (Electrum). The WanBridge bridge mints it on Cardano
              preprod, then the backend commits it to Hydra. Only then is it payable.
            </ThemedText>
            <ThemedText type="defaultSemiBold" className="mt-6">
              Amount in BTC
            </ThemedText>
            <TextInput
              className="mt-2 h-12 w-full rounded-[32px] border px-4"
              placeholder="0.0005"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <ThemedText className="mt-2 opacity-70">
              {amountError ?? (sats ? `= ${sats} sats` : "Up to 8 decimals (1 sat = 0.00000001 BTC).")}
            </ThemedText>
            <Button
              variant="primary"
              label={busy ? "Creating..." : "Create deposit"}
              className="mt-6"
              disabled={!sats || busy}
              onPress={create}
            />
          </>
        )}

        {/* * 2. Instructions for the external wallet, then the txid */}
        {deposit?.state === "created" && (
          <>
            <ThemedText type="subtitle">Send exactly</ThemedText>
            <ThemedText type="title" className="mt-2">
              {`${formatBaseUnits(deposit.btc.valueSats, DECIMALS)} BTC`}
            </ThemedText>
            <ThemedText className="opacity-70">{`${deposit.btc.valueSats} sats`}</ThemedText>
            <ThemedText type="defaultSemiBold" className="mt-2">
              {msLeft > 0
                ? `Expires in ${countdown}`
                : "Expired. Do not send BTC for this deposit: the bridge address may have changed. Start a new one."}
            </ThemedText>

            <View className="mt-4 items-center rounded-[16px] bg-white p-4">
              <QRCode value={deposit.btc.toAccount} size={180} />
              <ThemedText className="mt-2 text-center text-xs opacity-70">
                The QR holds only the address. The OP_RETURN memo is also required.
              </ThemedText>
            </View>
            <CopyRow label="Deposit address (testnet3)" value={deposit.btc.toAccount} />
            <CopyRow label="Amount (BTC)" value={formatBaseUnits(deposit.btc.valueSats, DECIMALS)} />
            <CopyRow label="Amount (sats)" value={deposit.btc.valueSats} />
            <CopyRow label="OP_RETURN memo" value={deposit.btc.memo} />

            <ThemedText type="subtitle" className="mt-6">
              Electrum (testnet3)
            </ThemedText>
            <ThemedText className="mt-2">
              {`1. Start Electrum 4.5+ with --testnet (testnet3; testnet4 and signet are different networks). Unit: BTC.
2. Send tab: leave Amount empty and paste both lines into "Pay to":`}
            </ThemedText>
            <CopyRow
              label="Pay to (2 lines)"
              value={electrumPayTo(
                deposit.btc.toAccount,
                formatBaseUnits(deposit.btc.valueSats, DECIMALS),
                deposit.btc.memo
              )}
            />
            <ThemedText className="mt-3">
              {`3. In the preview, check one 0 BTC output whose script is 6a44 followed by the memo (6a44${deposit.btc.memo.slice(0, 6)}…). Without it the bridge cannot credit you.
4. Broadcast before the timer ends, then paste the transaction ID from Electrum's History tab below.`}
            </ThemedText>

            <ThemedText type="defaultSemiBold" className="mt-6">
              BTC transaction ID
            </ThemedText>
            <TextInput
              className="mt-2 w-full rounded-[16px] border px-4 py-2"
              style={{ minHeight: 48 }}
              placeholder="64 hex characters"
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              value={txid}
              onChangeText={setTxid}
            />
            {txid.length > 0 && !btcTxid && (
              <ThemedText className="mt-2 text-red-600">A txid is 64 hex characters (0-9, a-f).</ThemedText>
            )}
            <Button
              variant="primary"
              label={busy ? "Submitting..." : "Submit transaction"}
              className="mt-4"
              disabled={!btcTxid || busy}
              onPress={submit}
            />
            <Button variant="outline" label="Start over" className="mt-3" disabled={busy} onPress={startOver} />
          </>
        )}

        {/* * 3. Status timeline (backend states only) */}
        {deposit && timeline && deposit.state !== "created" && (
          <>
            <ThemedText type="subtitle">BTC deposit status</ThemedText>
            <View className="mt-4">
              {timeline.steps.map((s) => (
                <View key={s.label} className="flex-row items-center py-1">
                  <ThemedText className="w-8">{MARK[s.status]}</ThemedText>
                  <ThemedText
                    type={s.status === "current" ? "defaultSemiBold" : "default"}
                    className={s.status === "todo" ? "opacity-40" : ""}
                  >
                    {s.status === "current" ? `${s.label}...` : s.label}
                  </ThemedText>
                </View>
              ))}
            </View>
            {timeline.problem && (
              <ThemedText type="defaultSemiBold" className="mt-4 text-red-600">
                {timeline.problem}
              </ThemedText>
            )}
            {deposit.state === "available" && (
              <ThemedText type="defaultSemiBold" className="mt-4">
                {`${formatBaseUnits(deposit.receivedBaseUnits ?? deposit.requestedBaseUnits, DECIMALS)} BTC is payable in Hydra.`}
              </ThemedText>
            )}
            <View className="mt-4">
              {!!deposit.requestedBaseUnits && (
                <ThemedText className="opacity-70">{`Requested: ${formatBaseUnits(deposit.requestedBaseUnits, DECIMALS)} BTC (${deposit.requestedBaseUnits} sats)`}</ThemedText>
              )}
              {!!deposit.receivedBaseUnits && (
                <ThemedText className="opacity-70">{`Received on Cardano: ${formatBaseUnits(deposit.receivedBaseUnits, DECIMALS)} BTC (${deposit.receivedBaseUnits} sats, after bridge fee)`}</ThemedText>
              )}
              {!!deposit.btcTxid && <ThemedText selectable className="opacity-70">{`BTC tx: ${deposit.btcTxid}`}</ThemedText>}
              {!!deposit.l1Ref && (
                <ThemedText selectable className="opacity-70">{`Cardano tx: ${deposit.l1Ref}`}</ThemedText>
              )}
              {!!deposit.depositTxId && (
                <ThemedText selectable className="opacity-70">{`Hydra deposit tx: ${deposit.depositTxId}`}</ThemedText>
              )}
            </View>
            {!final && (
              <ThemedText className="mt-4 opacity-70">
                {pollError
                  ? `Could not refresh (${pollError}). Retrying every 10 s.`
                  : "Checking every 10 s. The bridge waits for 2 BTC confirmations, which can take a while on testnet3."}
              </ThemedText>
            )}
            {final && <Button variant="primary" label="New deposit" className="mt-6" onPress={startOver} />}
          </>
        )}

        {!!error && (
          <ThemedText type="defaultSemiBold" className="mt-4 text-red-600">
            {error}
          </ThemedText>
        )}
      </ScrollView>
    </SafeLayout>
  );
};
