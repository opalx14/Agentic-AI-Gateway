"use client";

import { useState } from "react";

import {
  useAppLanguage,
  type AppLanguage,
} from "@/components/i18n/AppLanguageProvider";

const OPTIONS: Array<{
  value: AppLanguage;
  flag: string;
  short: string;
  label: string;
}> = [
  { value: "en", flag: "🇺🇸", short: "EN", label: "English" },
  { value: "vi", flag: "🇻🇳", short: "VI", label: "Tiếng Việt" },
];

export function HeaderLanguageControl() {
  const { language, setLanguage } = useAppLanguage();
  const [open, setOpen] = useState(false);
  const active = OPTIONS.find((option) => option.value === language) ?? OPTIONS[0];

  return (
    <div className="header-language-control">
      <button
        type="button"
        className="header-language-trigger"
        aria-label="Choose language"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{active.flag}</span>
        <strong>{active.short}</strong>
        <i aria-hidden="true">⌄</i>
      </button>

      {open ? (
        <div className="header-language-menu" role="menu" aria-label="Language">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === language}
              className={option.value === language ? "is-active" : ""}
              onClick={() => {
                setLanguage(option.value);
                setOpen(false);
              }}
            >
              <span aria-hidden="true">{option.flag}</span>
              <div>
                <strong>{option.label}</strong>
                <small>{option.short}</small>
              </div>
              {option.value === language ? <b>✓</b> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
