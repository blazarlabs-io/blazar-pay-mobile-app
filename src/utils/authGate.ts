/**
 * What a route group shows for the auth state: "wait" (render nothing), "render", or a path to redirect to.
 * Private routes need a user; only the sign-in screen sends a signed-in user to Home, so a deep link
 * opened while signed in stays on its target.
 */
export const authGate = (
  group: "(auth)" | "(private)",
  initializing: boolean,
  signedIn: boolean
): "wait" | "render" | "/" | "/home" => {
  if (initializing) return "wait"; // Firebase has not restored the session yet
  if (group === "(private)") return signedIn ? "render" : "/";
  return signedIn ? "/home" : "render";
};
