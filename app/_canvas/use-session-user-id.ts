"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "rplace_session_user_id";

function readSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

function getOrCreateSessionUserId(): string {
  const existing = readSessionUserId();
  if (existing) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  window.localStorage.setItem(STORAGE_KEY, id);
  return id;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

/** Stable anonymous id for this browser tab/session (persisted in localStorage). */
export function useSessionUserId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => getOrCreateSessionUserId(),
    () => null,
  );
}
