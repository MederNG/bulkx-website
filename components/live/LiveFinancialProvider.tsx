"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { LiveFinancialPayload } from "@/lib/live-financial-payload";

const POLL_MS = 60_000;

const LiveFinancialContext = createContext<LiveFinancialPayload | null>(null);

export function useLiveFinancials(): LiveFinancialPayload {
  const value = useContext(LiveFinancialContext);
  if (!value) {
    throw new Error("useLiveFinancials must be used within LiveFinancialProvider");
  }
  return value;
}

export function LiveFinancialProvider({
  initial,
  children,
}: {
  initial: LiveFinancialPayload;
  children: ReactNode;
}) {
  const [data, setData] = useState(initial);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/live-financials", { cache: "no-store" });
      if (!response.ok) return;
      const next: LiveFinancialPayload = await response.json();
      setData(next);
    } catch {
      // Keep the last good payload when polling fails.
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh();
    }, POLL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  return (
    <LiveFinancialContext.Provider value={data}>{children}</LiveFinancialContext.Provider>
  );
}
