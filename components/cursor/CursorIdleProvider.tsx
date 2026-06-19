"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useCursorIdleHide, useIsDesktopPointer } from "@/components/cursor/useCursorIdleHide";

const CursorIdleContext = createContext(false);

export function useCursorIdle(): boolean {
  return useContext(CursorIdleContext);
}

export function CursorIdleProvider({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktopPointer();
  const isIdle = useCursorIdleHide(isDesktop);

  return <CursorIdleContext.Provider value={isIdle}>{children}</CursorIdleContext.Provider>;
}
