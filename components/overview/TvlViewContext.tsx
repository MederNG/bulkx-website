"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface TvlViewState {
  viewId: string;
  setViewId: (id: string) => void;
}

const TvlViewContext = createContext<TvlViewState | null>(null);

export function useTvlView(): TvlViewState {
  const value = useContext(TvlViewContext);
  if (!value) throw new Error("useTvlView must be used within TvlViewProvider");
  return value;
}

/**
 * Holds which TVL view — current or projected — the dashboard is showing.
 *
 * It lives above both the KPI strip and the chart panel because the toggle
 * is rendered in one and read by the other: pressing "Projected" on the
 * chart has to swap the headline figure in the card at the top of the page
 * too, otherwise the two disagree about which number the page is showing.
 * The page itself is a server component, so this client provider wraps it
 * and the server-rendered panels pass through as children.
 */
export function TvlViewProvider({ children }: { children: ReactNode }) {
  const [viewId, setViewId] = useState("current");
  const value = useMemo(() => ({ viewId, setViewId }), [viewId]);
  return <TvlViewContext.Provider value={value}>{children}</TvlViewContext.Provider>;
}
