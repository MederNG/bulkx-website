"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LiveFinancialPayload } from "@/lib/live-financial-payload";

const POLL_MS = 90_000;
const MIN_REFRESH_GAP_MS = 15_000;

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
  const inflightRef = useRef<Promise<void> | null>(null);
  const lastRefreshAtRef = useRef(0);

  const refresh = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastRefreshAtRef.current < MIN_REFRESH_GAP_MS) return;
    if (inflightRef.current) return inflightRef.current;

    const run = (async () => {
      try {
        const response = await fetch("/api/live-financials");
        if (!response.ok) return;
        const next: LiveFinancialPayload = await response.json();
        lastRefreshAtRef.current = Date.now();
        setData(next);
      } catch {
        // Keep the last good payload when polling fails.
      } finally {
        inflightRef.current = null;
      }
    })();

    inflightRef.current = run;
    return run;
  }, []);

  useEffect(() => {
    void refresh(true);

    const intervalId = window.setInterval(() => {
      void refresh(true);
    }, POLL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh(false);
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
