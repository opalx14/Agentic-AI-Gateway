"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type AppLanguage = "en" | "vi";

const STORAGE_KEY = "agentic-ai-gateway:language";
const LANGUAGE_EVENT = "agentic-ai-gateway:language-change";

const AppLanguageContext = createContext<{
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
} | null>(null);

function getLanguageSnapshot(): AppLanguage {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(STORAGE_KEY) === "vi" ? "vi" : "en";
}

function subscribeLanguage(callback: () => void) {
  window.addEventListener(LANGUAGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(LANGUAGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function AppLanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore<AppLanguage>(
    subscribeLanguage,
    getLanguageSnapshot,
    () => "en",
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function setLanguage(next: AppLanguage) {
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
    window.dispatchEvent(new Event(LANGUAGE_EVENT));
  }

  const value = useMemo(() => ({ language, setLanguage }), [language]);

  return (
    <AppLanguageContext.Provider value={value}>
      {children}
    </AppLanguageContext.Provider>
  );
}

export function useAppLanguage() {
  const context = useContext(AppLanguageContext);
  if (!context) {
    throw new Error("useAppLanguage must be used inside AppLanguageProvider");
  }
  return context;
}
