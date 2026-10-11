import { authGate } from "@/utils/authGate";

describe("authGate", () => {
  it("waits for Firebase to restore the session before deciding", () => {
    expect(authGate("(private)", true, false)).toBe("wait");
    expect(authGate("(auth)", true, false)).toBe("wait");
  });

  it("sends a signed-out user from any private route to sign-in", () => {
    expect(authGate("(private)", false, false)).toBe("/");
  });

  it("shows a private route, e.g. a deep-linked payment, to a signed-in user without redirecting", () => {
    expect(authGate("(private)", false, true)).toBe("render");
  });

  it("sends a signed-in user from the sign-in screen to Home", () => {
    expect(authGate("(auth)", false, true)).toBe("/home");
  });

  it("shows the sign-in screen to a signed-out user", () => {
    expect(authGate("(auth)", false, false)).toBe("render");
  });
});
