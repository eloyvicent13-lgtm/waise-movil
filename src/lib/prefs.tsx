import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { serverFetch } from "./auth";
import type { Accent } from "./theme";

export interface Prefs {
  display_name: string;
  custom_instructions: string;
  accent: Accent;
  font_size: "sm" | "md" | "lg";
  effort: "low" | "medium" | "high";
}

const DEFAULT_PREFS: Prefs = {
  display_name: "",
  custom_instructions: "",
  accent: "gold",
  font_size: "md",
  effort: "medium",
};

interface PrefsState {
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
}

const Ctx = createContext<PrefsState | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  // The desktop app shares this same /me/settings blob (shape:
  // { active_provider_id, active_model_id, prefs: {...} }). The server
  // replaces the whole object on PUT (no merge), so we must read-modify-write
  // the full blob to avoid clobbering the desktop app's fields.
  const remoteBlob = useRef<Record<string, unknown>>({});

  useEffect(() => {
    serverFetch("/me/settings")
      .then((r) => r.json())
      .then((blob) => {
        remoteBlob.current = blob || {};
        const remotePrefs = (blob?.prefs || {}) as Partial<Prefs>;
        setPrefsState((p) => ({ ...p, ...remotePrefs }));
      })
      .catch(() => {});
  }, []);

  function setPrefs(patch: Partial<Prefs>) {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      const blob = { ...remoteBlob.current, prefs: { ...(remoteBlob.current.prefs as object), ...next } };
      remoteBlob.current = blob;
      serverFetch("/me/settings", { method: "PUT", body: JSON.stringify(blob) }).catch(() => {});
      return next;
    });
  }

  return <Ctx.Provider value={{ prefs, setPrefs }}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePrefs outside PrefsProvider");
  return ctx;
}
