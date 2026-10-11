# Hydrapay - Micropayments App

Hydrapay is a React Native + Expo Router application for Hydra-powered micropayments on Android and iOS. Developed by Blazar Labs.

## Milestone 3: USDM and BTC payments (testnet)

This app is the payer side of the M3 demo. It works only on **Cardano preprod** and **Bitcoin testnet3**, against the custodial demo backend `https://blazar-api.cardano.vip` (`blazar-hydra`). The other parts are the merchant web (`blazar-pay-merchant-web`), which creates payment requests, and the BLE terminal (`blazar-pay-termial`), which shows the pending request to the phone. Test accounts are provided on request.

### Features
- **Login.** Firebase email/password only (the Google, Sign up and Forgot Password buttons are not wired). The Firebase user must be mapped to a backend `user` account by the operator; every backend call sends the user's Firebase ID token as `Authorization: Bearer`.
- **Balances.** Home shows "Payable balance (Hydra L2)", which is `payableInL2` from `GET /query-funds` (ADA and USDM with 6 decimals, BTC with 8). Funds on Cardano L1 are on a separate line, "On L1, not payable yet", and are never added to the payable amount. A BTC deposit still on its way is shown on its own line, also not payable.
- **Contactless payment (BLE).** The Pay screen scans for the terminal `Hydra TERM` (proximity heuristic of about 5 cm from RSSI) and reads four read-only characteristics: merchant address, amount in base units, asset unit and `paymentId`. It then loads `GET /payments/:paymentId`, aborts if the terminal values differ from the backend record, and shows the amount from the backend. "Pay" calls `POST /payments/:paymentId/authorize`, which is the payer's consent, and the screen shows "Waiting for confirmation..." while it polls every 1 s (up to 120 s) until `confirmed`, `failed` or `expired`. Nothing is written to the terminal, and the Pay button is disabled while a payment is in flight.
- **Success screen verified against the backend.** The success route receives only the `paymentId` and reads `GET /payments/:paymentId` again. It shows the amount, Hydra tx id and snapshot number only when the backend says `confirmed`; any other state, a backend error or a missing id shows "Payment not confirmed" with the reason. A crafted deep link cannot display a false success.
- **BTC testnet deposit.** Home → "Deposit BTC (testnet bridge)". The app never holds BTC keys: the user sends testnet3 BTC from an external wallet through the WanBridge testnet, and the backend commits the bridged BTC into Hydra. Steps below.

### BTC deposit with Electrum (testnet3)
1. Install Electrum 4.5+ and start it with `--testnet` (testnet3, not testnet4 or signet). Create a standard native SegWit wallet and fund it from a testnet3 faucet. You need the deposit amount plus about 500 sat of fee.
2. In the app, enter the amount in BTC (for example `0.0005`; the screen shows the exact sats) and tap "Create deposit". The backend returns the bridge address, the exact amount and an OP_RETURN memo. The app shows them with copy buttons, a QR code of the address only, a 30-minute countdown and the two Electrum "Pay to" lines.
3. In Electrum set the base unit to BTC, open Send, leave Amount empty and paste the two lines into "Pay to":
   ```
   <bridge address>, <amount in BTC>
   script(OP_RETURN <memo>), 0
   ```
   In the preview, check that there is a 0-value output whose script starts with `6a44070205`. Without the memo the bridge cannot attribute the deposit. Sign and broadcast before the countdown ends.
4. Copy the txid from Electrum's History, paste it into the app and tap "Submit transaction". The backend checks the destination, value and memo; a 422 shows its reason. Right after a broadcast the txid may not be indexed yet (`BTC_TX_NOT_FOUND`): submit again a few seconds later.
5. The timeline refreshes every 10 s: BTC sent → Bridge processing → On Cardano (L1) → Committing to Hydra → Available (payable). It shows the BTC tx, the Cardano tx and the Hydra deposit tx. Only "Available" is payable. Measured on preprod: about 24 minutes from broadcast to Available. The bridge keeps a 0.2% fee (minimum 16, maximum 320 sat; minimum deposit 32 sat), so 30000 sat arrive as 29940 units.
6. Pay with BTC through the normal contactless flow once the merchant requests BTC.

The bridge address belongs to a storeman group that rotates monthly: do not reuse an old address or memo, and always create a new deposit in the app before sending.

### Environment variables
Values are baked into the bundle at build time from a `.env` file in the repo root (ignored by git). For EAS cloud builds, set them with `eas env:create`. No secrets are committed.

| Variable | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | yes | Backend base URL, e.g. `https://blazar-api.cardano.vip`. Must be `https://` for release Android builds. Without it payments, balances and deposits are disabled with a clear message |
| `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `EXPO_PUBLIC_FIREBASE_APP_ID`, `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` | yes | Firebase web config. Must be the same Firebase project the backend accepts. Without it the app stops at startup |
| `EXPO_PUBLIC_ADA_WALLET_ADDRESS` | yes | Payer address used for `GET /query-funds`. It must equal the backend account address of the Firebase user who signs in |
| `EXPO_PUBLIC_ADMIN_WALLET_ADDRESS` | no | Kept in the wallet context; not used by the M3 payment or deposit flow |
| `EXPO_PUBLIC_LIVE_COIN_WATCH_API_KEY` | no | USD prices; without it USD values show a dash |

### Build
Android release APK (local, Node 20, JDK 17, Android SDK 34, NDK 26.1.10909125):
```sh
npm ci
# create .env first: its values are baked into the APK
CI=1 npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
# output: android/app/build/outputs/apk/release/app-release.apk
# after changing .env: rm -rf app/build && ./gradlew assembleRelease
```
The APK is signed with the Android debug key and is for testing only (minSdk 23). Install with `adb install -r app-release.apk` or by sideloading ("Install unknown apps"). On Android 12+ grant "Nearby devices"; on Android 11 and older grant Location and turn it on (needed for BLE scanning).

iOS (EAS cloud, ad hoc internal distribution; needs an Expo account with access to the project and an Apple Developer Program team):
```sh
eas login
eas env:create --environment preview --name EXPO_PUBLIC_API_URL --value <url> --visibility plaintext   # repeat for each variable
eas device:create                         # register every test iPhone (UDID) before the build
eas build -p ios --profile preview
```
Install from the EAS link or QR code on a registered iPhone; on iOS 16+ enable Developer Mode.

### Testing
```sh
CI=1 npx jest --ci
```
25 tests in 3 suites: amount conversion, terminal/backend mismatch check, authorize-and-poll outcomes (`src/services/__tests__/payment-flow-test.ts`), the deposit timeline, sats and txid parsing and Electrum lines (`deposit-flow-test.ts`), and the success screen against forged parameters (`src/components/__tests__/PaymentSuccessScreen-test.tsx`).

### Verified so far
On an Android 14 emulator with the release APK and the live backend: the payable L2 balance equals the backend, the success screen of a 5 ADA payment is read from the backend (Hydra tx and snapshot), a forged success deep link shows "Payment not confirmed", and a BTC deposit created in the app went through every timeline step to Available. Not yet verified: a payment over BLE on a physical phone with the Raspberry Pi terminal, and an iOS build.

### Known limitations
- Testnet/preprod only; custodial demo backend (the backend holds the funds and signs).
- The deployed Hydra validator does not enforce the payer's signature; consent is the authenticated `authorize` call.
- Contactless transport: BLE. The BLE scan has no timeout; use "Scan again".
- The payable amount per asset is the largest single L2 funds UTxO (one payment spends one UTxO), not the sum of all deposits.
- All BTC deposits go to one shared bridge address; attribution is by the submitted txid. Only one deposit is tracked per user per device.
- No BTC cash-out, no BTC/ADA swap, no Bitcoin wallet in the app.
- The payer address comes from the build env, not from the signed-in account, so one build serves one payer.
- If the `authorize` response is lost (network drop), the app shows a failure although the payment may still confirm; check with the merchant before paying again.

## Tech Stack
- React Native 0.74, Expo SDK 51, Expo Router with typed routes
- TypeScript with strict mode and path alias `@/*`
- NativeWind + TailwindCSS for styling; React Navigation theming
- Firebase Auth + Firestore for identity and user data
- BLE client (react-native-ble-plx) for contactless terminal pairing
- LiveCoinWatch price feed for ADA/BTC quotes
- Jest + jest-expo for component testing

## Prerequisites
- Node 18+ (Expo SDK 51 requirement) and npm
- Expo CLI (`npx expo start` uses local version) and EAS CLI (`npm i -g eas-cli`) if you plan to build/sign
- Xcode (iOS) and Android Studio SDK/NDK (Android) for native builds/emulators
- Access to Firebase project credentials and LiveCoinWatch API key

## Environment Variables
Create a `.env` file in the repo root (loaded automatically by Expo) with the following keys:
```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
EXPO_PUBLIC_LIVE_COIN_WATCH_API_KEY=
EXPO_PUBLIC_ADMIN_WALLET_ADDRESS=
EXPO_PUBLIC_ADA_WALLET_ADDRESS=
# Required: Hydra Pay backend base URL, e.g. https://<host>. No default; without it payments and balances are disabled.
EXPO_PUBLIC_API_URL=
```
`EXPO_PUBLIC_ADA_WALLET_ADDRESS` must be the address of the backend `Account` linked to the Firebase user who signs in. Every backend call sends that user's Firebase ID token as `Authorization: Bearer`.

## Installing & Running Locally
- Install dependencies: `npm install`
- Start Metro + Expo dev server (with tunnel enabled per package script): `npm run start`
- Run on Android: `npm run android` (device/emulator required)
- Run on iOS: `npm run ios` (Mac + Xcode required)
- Run on web (for lightweight UI checks): `npm run web`

## Project Structure (high level)
- `src/app/` – Expo Router routes. `(auth)` and `(private)` stacks live here alongside screen segments such as `home`, `pay`, `withdraw`, and `wallet-registration`.
- `src/components/` – UI building blocks:
  - `core/` shared primitives (Button, Card, Text, Icons, Layouts)
  - `screens/` and `sections/` composed screens/sections
  - `widgets/` reusable form elements (amount, account selector, balance info)
- `src/context/` – Providers for auth, wallet state, and currency exchange.
- `src/lib/firebase/` – Firebase initialization and Firestore helpers.
- `src/services/` – External integrations:
  - `ble-client/` contactless terminal BLE helper
  - `coinwatch/` price feed client
- `src/hooks/` – Custom hooks (`useWalletRegistration`, theming helpers).
- `src/constants/` – Asset unit IDs, colors.
- `src/utils/` – Common helpers (className merge, date, auth error mapping).

## Core Architecture Notes
- **Navigation**: `src/app/_layout.tsx` sets the root Stack with `(auth)` and `(private)` groups. Themes adapt via `useColorScheme`.
- **Providers**: `src/context/Providers.tsx` wraps the app with `AuthProvider`, `WalletProvider`, and `ExchangeProvider` so screens can consume `useAuth`, `useWallet`, and `useExchange`.
- **Auth & Data**: `AuthProvider` listens to `onAuthStateChanged` and routes authenticated users to `/home`. Firestore accessors live in `src/lib/firebase/services/db`.
- **Wallet state**: `WalletProvider` calls `${EXPO_PUBLIC_API_URL}/query-funds?address=...` (`src/services/api.ts`). The balances shown as spendable are `payableInL2`; L1 funds are listed separately and are not payable. It also subscribes to user Firestore docs.
- **Payments (BLE)**: `NfcScreen` scans for the `Hydra TERM` terminal and reads four read-only characteristics: merchant address, amount in base units, asset unit and `paymentId` (UUIDs in `src/types/payment-contract.ts`). It fetches `GET /payments/:id`, aborts if the terminal values differ, and on "Pay" calls `POST /payments/:id/authorize`, then polls until `confirmed`, `failed` or `expired`. The success screen is shown only for `confirmed`. Nothing is written to the terminal.
- **BTC deposit (testnet)**: Home → "Deposit BTC (testnet bridge)" (`DepositBtcScreen`). The amount in BTC becomes exact sats, `POST /deposits/btc` returns the WanBridge address, amount and OP_RETURN memo, shown with copy buttons, a QR for the address and the Electrum testnet3 "Pay to" lines. The user pays from an external wallet (no BTC keys in the app), pastes the txid (`POST /deposits/:id/btc-tx`), and the app polls `GET /deposits/:id` every 10 s. BTC is payable only when the backend reports `available`; amounts still in the bridge are shown apart from the payable balance. The last deposit id is kept per user in AsyncStorage.
- **Pricing**: `getAdaUsdTicker` and `getBtcUsdTicker` call LiveCoinWatch using `EXPO_PUBLIC_LIVE_COIN_WATCH_API_KEY`.
- **Styling**: Tailwind classes via NativeWind; fonts loaded in `_layout` (`SpaceMono`). Metro is configured to transform SVGs (`metro.config.js`).

## Quality & Tooling
- Tests: `npx jest --ci` (Jest + jest-expo; `npm test` runs in watch mode). Payment logic tests live in `src/services/__tests__`.
- Lint: `npm run lint` (Expo lint preset).
- Formatting: Prettier + Tailwind plugin (run via your editor/`npx prettier`).

## Building & Distribution (EAS)
- Configure credentials in Expo/EAS (`eas login`).
- Profiles are defined in `eas.json`:
  - `development` – dev client, internal distribution, Android APK buildType
  - `preview` – internal distribution, Android APK buildType
  - `production` – default release
- Example commands:
  - Android dev client: `eas build -p android --profile development`
  - iOS internal build: `eas build -p ios --profile preview`
- Submit stores: `eas submit -p android --profile production` (profile in `submit.production`).

## Common Troubleshooting
- **BLE scanning fails / powered off**: The BLE client requests permissions and prompts to enable Bluetooth; ensure location/BLE permissions are granted on Android 12+.
- **Balance stays at zero**: Verify `EXPO_PUBLIC_ADA_WALLET_ADDRESS` and `EXPO_PUBLIC_API_URL`, that you are signed in, and that the backend returns `payableInL2`.
- **Missing env values**: Expo will start but Firebase/Auth calls will fail; confirm `.env` is loaded and keys start with `EXPO_PUBLIC_`.
- **SVG assets not showing**: Ensure `metro.config.js` is intact and assets are imported with `require`/`@/assets/images/...`.

## License

The project's original source code is licensed under the [Apache License 2.0](LICENSE), consistent with the Project Catalyst 1200128 open-source commitment. See [NOTICE](NOTICE) for attribution and scope. Third-party dependencies, bundled third-party assets and files with separate licence notices retain their respective licences.
