import NfcManager, { Ndef, NfcTech, type NdefRecord } from "react-native-nfc-manager";
import { NFC } from "@/types/payment-contract";

export const TAG_NOT_READ = "The tag was not read. Hold your phone still on the terminal and try again.";

/** What a terminal tag (or the same deep link) points at. */
export type NfcTarget = { terminal: string } | { paymentId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIX = `${NFC.SCHEME}://${NFC.PATH}?`;
const QUERY = new RegExp(`^(${NFC.TERMINAL_PARAM}|${NFC.PAYMENT_ID_PARAM})=([^&#]*)$`);

/** Exactly one of terminal / paymentId, holding a UUID; anything else is null. Also checks deep-link params. */
export function toNfcTarget({ terminal, paymentId }: { terminal?: unknown; paymentId?: unknown }): NfcTarget | null {
  if (paymentId === undefined && typeof terminal === "string" && UUID.test(terminal)) return { terminal: terminal.toLowerCase() };
  if (terminal === undefined && typeof paymentId === "string" && UUID.test(paymentId)) return { paymentId: paymentId.toLowerCase() };
  return null;
}

/** `myapp://home/nfc?terminal=<uuid>` or `myapp://home/nfc?paymentId=<uuid>`; any other scheme, path or query is null. */
export function parseNfcUri(uri: string): NfcTarget | null {
  const m = uri.startsWith(PREFIX) && QUERY.exec(uri.slice(PREFIX.length));
  return m ? toNfcTarget({ [m[1]]: m[2] }) : null;
}

/** The first NDEF URI record (well-known type "U") decoded: identifier-code prefix + UTF-8 rest. Null when there is none. */
export function firstUri(records: NdefRecord[] | undefined): string | null {
  const r = records?.find((r) => Ndef.isType(r, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI));
  return r ? Ndef.uri.decodePayload(r.payload as any) : null;
}

let started: Promise<void> | undefined;

/** "on": NFC reader present and switched on (iOS has no switch); "off": off in Settings; "none": no NFC (e.g. the emulator). */
export async function nfcStatus(): Promise<"on" | "off" | "none"> {
  try {
    if (!(await NfcManager.isSupported())) return "none";
    await (started ??= NfcManager.start());
    return (await NfcManager.isEnabled()) ? "on" : "off";
  } catch {
    started = undefined;
    return "none";
  }
}

/** Ends a pending read; a no-op when there is none. */
export const cancelNfcRead = () => NfcManager.cancelTechnologyRequest().catch(() => {});

/** Waits for one tag and returns where its first URI record points (null: no HydraPay link). Always ends the NFC session. */
export async function readTerminalTag(): Promise<NfcTarget | null> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, { alertMessage: "Hold your iPhone near the HydraPay terminal." });
    const uri = firstUri((await NfcManager.getTag())?.ndefMessage);
    return uri ? parseNfcUri(uri) : null;
  } catch {
    throw new Error(TAG_NOT_READ); // also when the read is cancelled (iOS sheet closed, or the user switched to Bluetooth)
  } finally {
    await cancelNfcRead();
  }
}
