jest.mock("react-native-nfc-manager", () => ({
  __esModule: true,
  default: { requestTechnology: jest.fn(), getTag: jest.fn(), cancelTechnologyRequest: jest.fn() },
  NfcTech: { Ndef: "Ndef" },
  Ndef: jest.requireActual("react-native-nfc-manager/ndef-lib"),
}));

import NfcManager, { Ndef } from "react-native-nfc-manager";
import { firstUri, parseNfcUri, readTerminalTag, TAG_NOT_READ, toNfcTarget } from "@/services/nfc-client";

const ID = "3c0825c6-3f78-4d34-bf34-e39130fecd73";
const bytes = (s: string) => Array.from(Buffer.from(s, "utf8"));
const uriRecord = (code: number, rest: string) => ({ tnf: Ndef.TNF_WELL_KNOWN, type: bytes("U"), payload: [code, ...bytes(rest)] });
const nfc = jest.mocked(NfcManager);

describe("firstUri", () => {
  it("decodes the identifier-code prefix of the first URI record", () => {
    expect(firstUri([uriRecord(0x00, `myapp://home/nfc?terminal=${ID}`)])).toBe(`myapp://home/nfc?terminal=${ID}`);
    expect(firstUri([uriRecord(0x04, "blazar-api.cardano.vip/t")])).toBe("https://blazar-api.cardano.vip/t");
    expect(firstUri([uriRecord(0x01, "example.com")])).toBe("http://www.example.com");
    expect(firstUri([Ndef.uriRecord(`myapp://home/nfc?paymentId=${ID}`) as any])).toBe(`myapp://home/nfc?paymentId=${ID}`);
  });

  it("skips other records and returns null without a URI record", () => {
    const text = Ndef.textRecord(`myapp://home/nfc?terminal=${ID}`) as any;
    expect(firstUri([text, uriRecord(0x00, "myapp://a"), uriRecord(0x00, "myapp://b")])).toBe("myapp://a");
    expect(firstUri([text])).toBeNull();
    expect(firstUri([])).toBeNull();
    expect(firstUri(undefined)).toBeNull();
  });
});

describe("parseNfcUri", () => {
  it("accepts the terminal tag and the direct paymentId handoff", () => {
    expect(parseNfcUri(`myapp://home/nfc?terminal=${ID}`)).toEqual({ terminal: ID });
    expect(parseNfcUri(`myapp://home/nfc?paymentId=${ID}`)).toEqual({ paymentId: ID });
    expect(parseNfcUri(`myapp://home/nfc?terminal=${ID.toUpperCase()}`)).toEqual({ terminal: ID });
  });

  it("rejects other schemes, paths, params and ids", () => {
    for (const bad of [
      `hydrapay://home/nfc?terminal=${ID}`,
      `https://home/nfc?terminal=${ID}`,
      `myapp://home/pay?terminal=${ID}`,
      `myapp://payment-success?paymentId=${ID}`,
      `myapp://home/nfc/x?terminal=${ID}`,
      `myapp://home/nfc?merchant=${ID}`,
      `myapp://home/nfc?terminal=${ID}&paymentId=${ID}`,
      `myapp://home/nfc?terminal=${ID}&amount=1`,
      `myapp://home/nfc?terminal=${ID}#x`,
      `myapp://home/nfc?terminal=`,
      `myapp://home/nfc?terminal=${ID.slice(1)}`,
      `myapp://home/nfc?terminal=${ID}0`,
      `myapp://home/nfc?terminal=${ID.replace(/-/g, "")}`,
      `myapp://home/nfc`,
      "",
    ]) {
      expect(parseNfcUri(bad)).toBeNull();
    }
  });

  it("checks deep-link params the same way", () => {
    expect(toNfcTarget({ paymentId: ID })).toEqual({ paymentId: ID });
    expect(toNfcTarget({ terminal: ID, paymentId: ID })).toBeNull();
    expect(toNfcTarget({ terminal: [ID, ID] })).toBeNull();
    expect(toNfcTarget({ terminal: "1" })).toBeNull();
    expect(toNfcTarget({})).toBeNull();
  });
});

describe("readTerminalTag", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    nfc.requestTechnology.mockResolvedValue("Ndef" as any);
    nfc.cancelTechnologyRequest.mockResolvedValue(undefined);
  });

  it("returns the target and ends the session", async () => {
    nfc.getTag.mockResolvedValue({ ndefMessage: [uriRecord(0x00, `myapp://home/nfc?terminal=${ID}`)] } as any);
    await expect(readTerminalTag()).resolves.toEqual({ terminal: ID });
    expect(nfc.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });

  it("returns null for a tag without a HydraPay link and ends the session", async () => {
    nfc.getTag.mockResolvedValue({ ndefMessage: [uriRecord(0x04, "example.com")] } as any);
    await expect(readTerminalTag()).resolves.toBeNull();
    expect(nfc.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });

  it("ends the session when the read fails or is cancelled", async () => {
    nfc.requestTechnology.mockRejectedValue(new Error("cancelled"));
    await expect(readTerminalTag()).rejects.toThrow(TAG_NOT_READ);
    expect(nfc.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
  });
});
