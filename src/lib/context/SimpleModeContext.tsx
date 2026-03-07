"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

interface SimpleModeContextType {
  isSimpleMode: boolean;
  toggleSimpleMode: () => void;
}

const SimpleModeContext = createContext<SimpleModeContextType>({
  isSimpleMode: false,
  toggleSimpleMode: () => {},
});

export function SimpleModeProvider({ children }: { children: ReactNode }) {
  const [isSimpleMode, setIsSimpleMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const supabase = createClient();

  // Load preference from localStorage first (instant), then sync with DB
  useEffect(() => {
    const stored = localStorage.getItem("pref_simple_mode");
    if (stored === "true") {
      setIsSimpleMode(true);
    }
    setIsLoaded(true);

    // Sync with user's database preference if logged in
    async function syncFromDB() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("users")
          .select("pref_simple_mode")
          .eq("id", user.id)
          .single<{ pref_simple_mode: boolean }>();
        if (data) {
          setIsSimpleMode(data.pref_simple_mode);
          localStorage.setItem(
            "pref_simple_mode",
            String(data.pref_simple_mode)
          );
        }
      }
    }
    syncFromDB();
  }, [supabase]);

  // Apply data attribute to html element for CSS targeting
  useEffect(() => {
    if (isLoaded) {
      document.documentElement.setAttribute(
        "data-simple-mode",
        String(isSimpleMode)
      );
    }
  }, [isSimpleMode, isLoaded]);

  const toggleSimpleMode = async () => {
    const newValue = !isSimpleMode;
    setIsSimpleMode(newValue);
    localStorage.setItem("pref_simple_mode", String(newValue));

    // Persist to database if logged in
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("users")
        .update({ pref_simple_mode: newValue } as Record<string, unknown>)
        .eq("id", user.id);
    }
  };

  return (
    <SimpleModeContext.Provider value={{ isSimpleMode, toggleSimpleMode }}>
      {children}
    </SimpleModeContext.Provider>
  );
}

export function useSimpleMode() {
  const context = useContext(SimpleModeContext);
  if (!context) {
    throw new Error("useSimpleMode must be used within a SimpleModeProvider");
  }
  return context;
}
