# Hydrapay - Micropayments App

Hydrapay is a React Native + Expo Router application for Hydra-powered micropayments on Android and iOS. Developed by Blazar Labs.

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
# Optional: Hydra/TxPipe endpoint used by NFC payment flow drafts
# EXPO_PUBLIC_TXPIPE_API_URL=
```

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
- **Wallet state**: `WalletProvider` pulls Hydra balances via an HTTP endpoint (currently `http://192.168.18.4:5000/query-funds?address=...` placeholder) and subscribes to user Firestore docs. Update that base URL to your Hydra node/ngrok endpoint for live balances.
- **Payments (BLE/NFC)**: `NfcScreen` scans for BLE terminals (`DEVICE_NAME` default `Hydra TERM`), reads payment request characteristics, and responds by writing the user ADA address. Characteristic UUIDs are defined inline; adjust for your hardware as needed.
- **Pricing**: `getAdaUsdTicker` and `getBtcUsdTicker` call LiveCoinWatch using `EXPO_PUBLIC_LIVE_COIN_WATCH_API_KEY`.
- **Styling**: Tailwind classes via NativeWind; fonts loaded in `_layout` (`SpaceMono`). Metro is configured to transform SVGs (`metro.config.js`).

## Quality & Tooling
- Tests: `npm test` (Jest + jest-expo). Snapshot example lives in `src/components/__tests__`.
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
- **Balance stays at zero**: Verify `EXPO_PUBLIC_ADA_WALLET_ADDRESS` and the Hydra endpoint (`getBalance` URL) point to a live node returning `totalInL1/totalInL2`.
- **Missing env values**: Expo will start but Firebase/Auth calls will fail; confirm `.env` is loaded and keys start with `EXPO_PUBLIC_`.
- **SVG assets not showing**: Ensure `metro.config.js` is intact and assets are imported with `require`/`@/assets/images/...`.

## License

The project's original source code is licensed under the [Apache License 2.0](LICENSE), consistent with the Project Catalyst 1200128 open-source commitment. See [NOTICE](NOTICE) for attribution and scope. Third-party dependencies, bundled third-party assets and files with separate licence notices retain their respective licences.
