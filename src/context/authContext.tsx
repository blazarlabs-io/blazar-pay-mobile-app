import { auth } from "@/lib/firebase/client";
import { onAuthStateChanged, User } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { router } from "expo-router";

interface ContextInterface {
  user: User | null;
}

const AuthContext = createContext<ContextInterface>({ user: null });

export const useAuth = () => {
  const context = useContext<ContextInterface>(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used as within a Provider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        router.replace("/home"); // not push: Back on Home must not reveal the sign-in screen
      } else {
        setUser(null);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
  );
};
