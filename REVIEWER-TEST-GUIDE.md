# HydraPay M3: test it on your own phone

This guide is for Catalyst reviewers of Milestone 3 (project 1300188). It walks you through the physical tests: tapping an NFC tag with an Android phone to pay in ADA, USDM and BTC. Optional parts cover BLE with a Raspberry Pi terminal and a BTC testnet deposit.

Everything runs on test networks: **Cardano preprod**, a **Hydra head** on preprod, and **Bitcoin testnet3** bridged through the **WanBridge testnet**. No real funds are involved. The team's own runs used the Android emulator, which has no NFC hardware. The tag tap on a real phone is what this guide adds.

## Public test values

| What | Value |
|---|---|
| Android APK (release page) | https://github.com/blazarlabs-io/blazar-pay-mobile-app/releases/tag/m3-nfc-0ec653f |
| APK file | `hydrapay-m3-0ec653f.apk` |
| APK sha256 | `53d0bc2bd53b348499cafacf7edf024b4ccf473524dad244a07bef1759b17add` |
| Merchant web | https://m3-merchant.blazarlabs.io |
| Backend | `https://blazar-api.cardano.vip` (health: https://blazar-api.cardano.vip/health) |
| Terminal NFC tag (one NDEF URI record) | `myapp://home/nfc?terminal=3c0825c6-3f78-4d34-bf34-e39130fecd73` |
| Payer address (preprod) | `addr_test1qqv50nl9rp55wt9lvpsshsuu9fxmlqskudg8gmdygpldy6kgtmx9p4gfkl52500g8kcxs7d683w89ne7d5gkgl4yl0jq0ve0zj` |
| Merchant address (preprod) | `addr_test1qqkmdp58hy4urz4zyszpdawfr23fhc3aky27rd7wh0u95h2pvaaxc8qdc6kmpuhz4t5kchxcneya5qtwfes0549pyujqveuc6j` |

USDM here means Moneta's preprod test token tUSDM. The app and the merchant web label it USDM.

## 0. Prerequisites

- An Android phone with NFC. Android 10 or newer is recommended (the APK's minimum is Android 6.0).
- A writable NFC tag, such as an NTAG213 or NTAG215 sticker. A Flipper Zero emulating an NTAG215 also works.
- The free **NFC Tools** app (wakdev) from Google Play.
- A laptop with a desktop browser for the merchant web.
- The test accounts, one payer and one merchant: **request the test accounts from the team.** All reviewers share one terminal, so please also agree a time slot with the team. A new payment request at the terminal expires the previous unpaid one.
- **iOS is not available yet.** Installing on an iPhone needs TestFlight, and TestFlight needs a paid Apple Developer team. NFC tag reading on iPhone needs the same paid team. Until that exists, test on Android only.

## 1. Install the APK and sign in

1. Download `hydrapay-m3-0ec653f.apk` from the release page above.
   *Expected:* a file of 91,110,999 bytes.
2. Check its sha256 against the value above. Use `shasum -a 256 hydrapay-m3-0ec653f.apk` on macOS, `sha256sum hydrapay-m3-0ec653f.apk` on Linux, or `certutil -hashfile hydrapay-m3-0ec653f.apk SHA256` on Windows. The same value is in `hydrapay-m3-0ec653f.apk.sha256` on the release page.
   *Expected:* `53d0bc2bd53b348499cafacf7edf024b4ccf473524dad244a07bef1759b17add`. If it differs, stop and do not install.
3. Install the APK. Either open the file on the phone and allow "Install unknown apps" for your browser or file manager when Android asks, or run `adb install -r hydrapay-m3-0ec653f.apk` from a computer. The APK is signed with a test key, so Google Play Protect may warn; choose to install anyway.
   *Expected:* HydraPay is installed.
4. Turn NFC on: Settings → Connected devices → Connection preferences → NFC. The path varies by vendor.
   *Expected:* NFC is on.
5. Open HydraPay and sign in with the **payer** email and password. Only email/password sign-in works in this build.
   *Expected:* the Home screen.
6. Check the balances on Home.
   *Expected:* "Payable in one payment (Hydra L2)" shows the amounts of ADA, USDM and BTC that can be spent. Below it, "In Hydra L2 in total" and "On L1, not payable yet" are separate lines; L1 funds are never added to the payable amount. Optional cross-check: `https://blazar-api.cardano.vip/query-funds?address=<payer address>` returns the same values as `payableInL2`.

## 2. Write the terminal tag

You write the tag once. It carries only the terminal's id; the amount always comes from the backend.

**With a sticker:**

1. Open NFC Tools → **Write** → **Add a record** → **URL / URI**. If that record only offers `http://` or `https://` prefixes, use **Custom URL / URI**.
2. Enter exactly `myapp://home/nfc?terminal=3c0825c6-3f78-4d34-bf34-e39130fecd73` (62 characters) → OK → **Write**, then hold the phone on the sticker.
   *Expected:* NFC Tools confirms the write. Do not lock the tag.
3. Check it: NFC Tools → **Read** → touch the sticker.
   *Expected:* one record of type URI with exactly the link above. A Text record will not work.

**With a Flipper Zero instead:** on the Flipper choose NFC → Add manually → NTAG215, save it, then Emulate. While it emulates, do steps 1 to 3 above with the phone on the back of the Flipper. Keep the Flipper emulating for the whole test. If it leaves emulation, read it again with NFC Tools and rewrite the record if it is gone.

## 3. NFC payment in ADA

1. **Merchant.** On the laptop, open the merchant web and sign in with the **merchant** account. No wallet is needed: a request is created for the signed-in merchant's own address.
   *Expected:* the dashboard with a "Receive payment" card.
2. **Merchant.** Click **Receive** → choose the **ADA** token → type `1` → **Request**.
   *Expected:* the sheet shows "Awaiting payment". The request expires after **120 seconds**, so do the next steps without delay.
3. **Phone.** In HydraPay open the **Pay** tab, the middle tab of the bottom bar.
   *Expected:* "Tap the terminal" and a spinner.
4. Hold the back of the phone on the tag (or the Flipper) for about a second.
   *Expected:* "Payment requested from addr_test1qqkmdp58…" and **1 ADA**. This amount comes from the backend, not from the tag.
5. Lift the phone off the tag, then tap **Pay**.
   *Expected:* "Waiting for confirmation...", then the success screen with the amount, **Hydra tx** and **Snapshot**.
6. **Merchant.** Look at the sheet in the merchant web.
   *Expected:* "Payment confirmed", State `confirmed`, and the same Hydra tx and Snapshot as on the phone.
7. **A second payment in a row.** On the phone tap **Done**, then open the Pay tab again. In the merchant web start a new request (Receive → ADA → `1` → Request) and tap the tag again.
   *Expected:* the new amount appears and the payment confirms as before, without restarting the app.

## 4. NFC payments in USDM and BTC

Repeat section 3, steps 2 to 6, with another token in the merchant web:

| Token in the merchant web | Amount to type | Expected on the phone |
|---|---|---|
| USDM | `1` | 1 USDM |
| BTC | `0.00001` (1,000 sat; BTC has 8 decimals) | 0.00001 BTC |

*Expected:* for each token, the phone's success screen and the merchant sheet show the same Hydra tx and Snapshot, and the payer's payable balance on Home drops by exactly that amount.

## 5. Optional: BLE with a Raspberry Pi terminal

BLE is the alternative to the NFC tag. It needs a Raspberry Pi (Zero 2W or similar with Bluetooth) running the terminal software.

1. Set up the terminal by following [QUICK_START.md](https://github.com/blazarlabs-io/blazar-pay-termial/blob/m3/payments/QUICK_START.md) and [INSTALLATION.md](https://github.com/blazarlabs-io/blazar-pay-termial/blob/m3/payments/INSTALLATION.md) of the terminal repo, branch `m3/payments`. Use `API_BASE_URL=https://blazar-api.cardano.vip`. The terminal's **device key is provided by the team on request**; the setup script asks for it at a hidden prompt.
   *Expected:* `sudo journalctl -u hydra-terminal.service -f` shows the terminal polling the backend.
2. **Merchant.** Create a request (Receive → ADA → `1` → Request).
   *Expected:* the terminal log shows `[poll] new payment <paymentId> created`, and the Pi advertises as `Hydra TERM`.
3. **Phone.** On the Pay tab tap **Use Bluetooth instead**. Grant "Nearby devices" (Android 12 and newer), or Location with the Location service on (Android 11 and older). Hold the phone within about 5 cm of the Pi.
   *Expected:* the amount from the backend appears. If nothing is found in 30 seconds, the app says "No terminal found nearby"; move closer and tap **Scan again**.
4. Tap **Pay**.
   *Expected:* the success screen with Hydra tx and Snapshot, the merchant sheet confirmed, and the terminal log shows `[session] <paymentId> ended: confirmed`.

## 6. Optional: BTC deposit from a testnet3 wallet

The app never holds BTC keys. You send testnet3 BTC from your own wallet; the bridge mints it on Cardano preprod and the backend commits it into Hydra for the payer account.

1. Install Electrum 4.5 or newer from electrum.org and start it with the `--testnet` flag (on macOS: `/Applications/Electrum.app/Contents/MacOS/run_electrum --testnet`). The window title must say testnet, not testnet4 or signet. Create a standard native SegWit wallet and fund it from a testnet3 faucet, for example https://coinfaucet.eu/en/btc-testnet/.
   *Expected:* a confirmed testnet3 balance of at least the deposit plus about 500 sat for the fee.
2. In HydraPay: Home → **Deposit BTC (testnet bridge)** → enter an amount in BTC, for example `0.0001` → **Create deposit**.
   *Expected:* the bridge address, the exact amount, the **memo** (OP_RETURN), a 30-minute countdown and two ready-made "Pay to" lines.
3. In Electrum set Tools → Preferences → Units → base unit to `BTC`. Open **Send**, leave Amount empty and paste both lines into "Pay to":
   ```
   <bridge address>, <amount in BTC>
   script(OP_RETURN <memo>), 0
   ```
   *Expected:* the preview has **both outputs**: the payment to the bridge address and a 0-value output whose script starts with `6a44070205`. Without the memo output the bridge cannot credit the deposit, so do not send it that way.
4. Sign and broadcast before the countdown ends. Copy the txid from Electrum's History, paste it into the app and tap **Submit transaction**.
   *Expected:* the deposit is accepted. If the app reports `BTC_TX_NOT_FOUND` right after the broadcast, submit again a few seconds later.
5. Wait and watch the timeline in the app, which refreshes every 10 seconds.
   *Expected:* BTC sent → Bridge processing → On Cardano (L1) → Committing to Hydra → **Available (payable)**, in about **20 to 40 minutes**. The bridge keeps a 0.2% fee (16 to 320 sat), so 10,000 sat arrive as 9,980. Only "Available" is payable; before that the amount appears on its own line on Home.

The bridge address rotates monthly. Always create a new deposit in the app right before sending, never reuse an old address or memo, and avoid the last 24 hours before a rotation (the current period ends on 9 November 2026 at 04:00 UTC).

## 7. What to report, and troubleshooting

**Please send the team, for each test:**

- the phone model and Android version, and whether you used a sticker or a Flipper Zero;
- the time (UTC), the token and the amount;
- screenshots of the phone's success screen (Hydra tx and Snapshot) and of the merchant sheet;
- for a deposit, the BTC txid;
- any error message, word for word, with a screenshot.

Never send passwords, device keys or wallet seeds.

| What you see | Cause | What to do |
|---|---|---|
| "No payment is waiting at this terminal. Ask the merchant to start the payment, then tap again." | The request expired after 120 seconds, was replaced by a newer one, or was not created yet | Create a new request in the merchant web and tap again |
| The Pay tab goes straight to Bluetooth with "NFC is turned off: turn it on in Settings to tap the terminal instead." | NFC is off | Turn NFC on (section 1, step 4) and open the Pay tab again |
| "This is not a HydraPay terminal tag or link." | The tag holds another link, a Text record, or a mistyped URI | Rewrite the tag (section 2) and check it with NFC Tools → Read |
| Another app (for example NFC Tools) opens after the tap | The phone stayed on the tag after HydraPay had read it, and Android handed the tag to another app | Go back to HydraPay; the amount is already there. Next time, lift the phone as soon as the amount appears |
| Nothing happens when you tap | The tag is not under the phone's NFC antenna, or the Pay tab is not open | Open the Pay tab ("Tap the terminal") and move the tag slowly over the back of the phone |
| "Connect your wallet first" in the merchant web | The merchant address is not set in this browser | Do section 3, step 1 |
| "Payment request failed (403)" in the merchant web | The address set in the browser does not belong to the signed-in merchant | Set exactly the merchant address from section 3, step 1 |

## 8. Out of scope

- **Mainnet.** Everything runs on Cardano preprod and Bitcoin testnet3; there is no mainnet deployment.
- **iOS**, until a signed build is on TestFlight (this needs a paid Apple Developer team).
- **App stores.** There is no Google Play or App Store release; Android is installed from the APK.
