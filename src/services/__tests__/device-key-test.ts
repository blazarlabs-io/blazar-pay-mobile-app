jest.mock("expo-secure-store", () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6 }));
jest.mock("expo-crypto", () => ({ getRandomBytes: jest.fn() }));

import { deviceKey, KeyStore } from "@/services/device-key";

// Golden vectors (seed 01×32), the same as the backend pay-message.test.ts and the validator consent.ak.
const SEED = new Uint8Array(32).fill(1);
const PAYER_PK = "8a88e3dd7409f195fd52db2d3cba5d72ca6709bf1d94121bf3748801b40f6f5c";
const ADA_MSG =
  "d8799fa140a1401a004c4b40d8799fd8799f581ce1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1ffd8799fd8799fd8799f581c0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0fffffffffd8799f5820111111111111111111111111111111111111111111111111111111111111111100ffff";
const ADA_SIG =
  "722aea99e109cc990a416a8b84a6ead4a1568c5dbebb4755b52c56382056aa7d1f8b6ba42e42526ea97e0281145102b813229077bfa376888f967e477f688a04";

const memoryStore = (): KeyStore & { items: Map<string, string> } => {
  const items = new Map<string, string>();
  return {
    items,
    getItemAsync: async (k) => items.get(k) ?? null,
    setItemAsync: async (k, v) => void items.set(k, v),
  };
};

describe("deviceKey", () => {
  it("creates the key once per user, keeps only the seed in the store, and signs like the validator expects", async () => {
    const store = memoryStore();
    const random = jest.fn(() => SEED);
    const key = await deviceKey("uid-1", store, random);
    expect(key.publicKeyHex).toBe(PAYER_PK);
    expect(key.sign(ADA_MSG)).toBe(ADA_SIG);
    expect([...store.items.keys()]).toEqual(["hydrapay.ed25519.uid-1"]);

    const again = await deviceKey("uid-1", store, random);
    expect(again.publicKeyHex).toBe(PAYER_PK);
    expect(random).toHaveBeenCalledTimes(1); // reused, not regenerated

    const other = await deviceKey("uid-2", store, () => new Uint8Array(32).fill(2));
    expect(other.publicKeyHex).toBe("8139770ea87d175f56a35466c34c7ecccb8d8a91b4ee37a25df60f5b8fc9b394");
  });
});
