import { auth } from "@/lib/firebase/client";
import { onAuthStateChanged, User } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";

interface ContextInterface {
  user: User | null;
  initializing: boolean; // true until Firebase reports the restored session (or none)
}

const AuthContext = createContext<ContextInterface>({
  user: null,
  initializing: true,
});

export const useAuth = () => {
  const context = useContext<ContextInterface>(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used as within a Provider");
  }
  return context;
};

// Navigation on auth changes is done by the (auth) and (private) layouts (utils/authGate), not here:
// a redirect here also fired on session restore and moved a deep-linked screen to Home.
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, initializing }}>
      {children}
    </AuthContext.Provider>
  );
};
