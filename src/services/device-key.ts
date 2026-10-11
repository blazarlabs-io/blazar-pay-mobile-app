import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import nacl from "tweetnacl";

export type KeyStore = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string, options?: SecureStore.SecureStoreOptions) => Promise<void>;
};

export type DeviceKey = { publicKeyHex: string; sign: (messageHex: string) => string };

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
const keyName = (uid: string) => `hydrapay.ed25519.${uid}`;

/**
 * The payer's ed25519 signing key for this Firebase user: created on first use, only its 32-byte seed is
 * kept, in the OS secure store (this device only). The backend knows the public key; every payment is
 * signed here, so the server cannot pay a merchant without this phone.
 */
export async function deviceKey(
  uid: string,
  store: KeyStore = SecureStore,
  random: (n: number) => Uint8Array = Crypto.getRandomBytes
): Promise<DeviceKey> {
  let seedHex = await store.getItemAsync(keyName(uid));
  if (!seedHex) {
    seedHex = toHex(random(32));
    await store.setItemAsync(keyName(uid), seedHex, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  const pair = nacl.sign.keyPair.fromSeed(fromHex(seedHex));
  return {
    publicKeyHex: toHex(pair.publicKey),
    sign: (messageHex) => toHex(nacl.sign.detached(fromHex(messageHex), pair.secretKey)),
  };
}
