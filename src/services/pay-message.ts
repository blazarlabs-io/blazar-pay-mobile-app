import { bech32 } from "bech32";

/** Plutus Data as the validator's `cbor.serialise` sees it (same encoder as the backend's pay-message.ts). */
type PlutusData =
  | { constr: number; fields: PlutusData[] }
  | { map: [PlutusData, PlutusData][] }
  | { bytes: string }
  | { int: bigint };

const head = (major: number, n: bigint): string => {
  const m = major << 5;
  if (n < 24n) return (m | Number(n)).toString(16).padStart(2, "0");
  if (n < 256n) return (m | 24).toString(16) + n.toString(16).padStart(2, "0");
  if (n < 65536n) return (m | 25).toString(16) + n.toString(16).padStart(4, "0");
  if (n < 4294967296n) return (m | 26).toString(16) + n.toString(16).padStart(8, "0");
  return (m | 27).toString(16) + n.toString(16).padStart(16, "0");
};

// Constructor fields as an indefinite list (9f..ff; none: 80); maps and byte strings definite.
const cbor = (d: PlutusData): string => {
  if ("int" in d) return d.int >= 0n ? head(0, d.int) : head(1, -d.int - 1n);
  if ("bytes" in d) return head(2, BigInt(d.bytes.length / 2)) + d.bytes;
  if ("map" in d) return head(5, BigInt(d.map.length)) + d.map.map(([k, v]) => cbor(k) + cbor(v)).join("");
  return `d8${(121 + d.constr).toString(16)}${d.fields.length === 0 ? "80" : `9f${d.fields.map(cbor).join("")}ff`}`;
};

const hex = (b: number[]) => b.map((x) => x.toString(16).padStart(2, "0")).join("");

/** Plutus Address of a Shelley base or enterprise address (header type 0-3 or 6-7); anything else throws. */
function addressData(address: string): PlutusData {
  const bytes = bech32.fromWords(bech32.decode(address, 1023).words);
  const type = bytes[0] >> 4;
  const cred = (isScript: number, from: number): PlutusData => ({
    constr: isScript,
    fields: [{ bytes: hex(bytes.slice(from, from + 28)) }],
  });
  if (type <= 3 && bytes.length === 57) {
    const stake = { constr: 0, fields: [{ constr: 0, fields: [cred((type >> 1) & 1, 29)] }] }; // Some(Inline)
    return { constr: 0, fields: [cred(type & 1, 1), stake] };
  }
  if ((type === 6 || type === 7) && bytes.length === 29) {
    return { constr: 0, fields: [cred(type & 1, 1), { constr: 1, fields: [] }] }; // stake None
  }
  throw new Error("This merchant address type is not supported for payments.");
}

/** The PayInfo bytes the phone signs: built from what the screen shows, never taken from the server. */
export function payInfoCbor(p: {
  merchantAddress: string;
  assetUnit: string;
  amountBaseUnits: string;
  fundsInRef: string;
}): string {
  const ref = /^([0-9a-f]{64})#(\d+)$/.exec(p.fundsInRef);
  if (!ref) throw new Error("Bad funds reference from the server.");
  const lovelace = p.assetUnit === "lovelace";
  return cbor({
    constr: 0,
    fields: [
      {
        map: [
          [
            { bytes: lovelace ? "" : p.assetUnit.slice(0, 56) },
            { map: [[{ bytes: lovelace ? "" : p.assetUnit.slice(56) }, { int: BigInt(p.amountBaseUnits) }]] },
          ],
        ],
      },
      addressData(p.merchantAddress),
      { constr: 0, fields: [{ bytes: ref[1] }, { int: BigInt(ref[2]) }] },
    ],
  });
}
