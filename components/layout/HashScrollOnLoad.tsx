"use client";

import { useEffect } from "react";
import { scrollToSection } from "@/components/layout/AnchorLink";

export function HashScrollOnLoad() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    scrollToSection(hash);
  }, []);

  return null;
}
