"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { copy, type Lang } from "@/lib/i18n";

type LanguageContextValue = {
  lang: Lang;
  t: (typeof copy)[Lang];
  toggle: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("vi");
  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      t: copy[lang],
      toggle: () => setLang((current) => (current === "vi" ? "en" : "vi")),
    }),
    [lang],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return value;
}
