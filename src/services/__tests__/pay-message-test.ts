import { payInfoCbor } from "@/services/pay-message";

// Golden vectors, checked against Aiken v1.1.17 (validator lib/consent.ak) and the backend.
const MERCHANT =
  "addr_test1qrs7rc0pu8s7rc0pu8s7rc0pu8s7rc0pu8s7rc0pu8s7rcg0pu8s7rc0pu8s7rc0pu8s7rc0pu8s7rc0pu8s7rc0pu8sxahxqw";
const ENTERPRISE = "addr_test1vrs7rc0pu8s7rc0pu8s7rc0pu8s7rc0pu8s7rc0pu8s7rcgurlewq";
const USDM = "e675b46e4d2242c991a8932a99db3044e80515ae14b4c4ccf6b3f4c90014df10745553444d";
const ADA_MSG =
  "d8799fa140a1401a004c4b40d8799fd8799f581ce1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1ffd8799fd8799fd8799f581c0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0fffffffffd8799f5820111111111111111111111111111111111111111111111111111111111111111100ffff";
const USDM_MSG =
  "d8799fa1581ce675b46e4d2242c991a8932a99db3044e80515ae14b4c4ccf6b3f4c9a1490014df10745553444d1a0016e360d8799fd8799f581ce1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1ffd87a80ffd8799f5820222222222222222222222222222222222222222222222222222222222222222203ffff";

describe("payInfoCbor", () => {
  it("matches the validator for an ADA payment to a base address", () => {
    expect(
      payInfoCbor({ merchantAddress: MERCHANT, assetUnit: "lovelace", amountBaseUnits: "5000000", fundsInRef: `${"11".repeat(32)}#0` })
    ).toBe(ADA_MSG);
  });

  it("matches the validator for a USDM payment to an enterprise address", () => {
    expect(
      payInfoCbor({ merchantAddress: ENTERPRISE, assetUnit: USDM, amountBaseUnits: "1500000", fundsInRef: `${"22".repeat(32)}#3` })
    ).toBe(USDM_MSG);
  });

  it("refuses what it cannot encode exactly", () => {
    const base = { assetUnit: "lovelace", amountBaseUnits: "1", fundsInRef: `${"11".repeat(32)}#0` };
    expect(() => payInfoCbor({ ...base, merchantAddress: "addr_test1merchant" })).toThrow();
    // script payment credential: the backend's tx builder encodes every credential as a key
    const scriptBase =
      "addr_test1zrhwamhwamhwamhwamhwamhwamhwamhwamhwamhwamhwams0pu8s7rc0pu8s7rc0pu8s7rc0pu8s7rc0pu8s7rc0pu8saqnrty";
    expect(() => payInfoCbor({ ...base, merchantAddress: scriptBase })).toThrow(/not supported/);
    expect(() => payInfoCbor({ ...base, merchantAddress: MERCHANT, fundsInRef: "abc#0" })).toThrow(/funds/);
  });
});
