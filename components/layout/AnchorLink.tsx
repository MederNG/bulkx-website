"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";

const HEADER_OFFSET = 72;
const WAIT_FOR_MOUNT_MS = 2500;

let scrollSession = 0;
let activeObserver: MutationObserver | null = null;
let activeTimeout: number | null = null;

function clearPendingScroll() {
  activeObserver?.disconnect();
  activeObserver = null;
  if (activeTimeout !== null) {
    window.clearTimeout(activeTimeout);
    activeTimeout = null;
  }
}

export function scrollToSection(id: string) {
  scrollSession += 1;
  const session = scrollSession;
  clearPendingScroll();

  const attempt = (): boolean => {
    if (session !== scrollSession) return false;
    const el = document.getElementById(id);
    if (!el) return false;

    const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
    return true;
  };

  if (attempt()) return;

  activeObserver = new MutationObserver(() => {
    if (attempt()) clearPendingScroll();
  });
  activeObserver.observe(document.body, { childList: true, subtree: true });

  activeTimeout = window.setTimeout(() => {
    if (session === scrollSession) {
      attempt();
      clearPendingScroll();
    }
  }, WAIT_FOR_MOUNT_MS);
}

type AnchorLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

export function AnchorLink({ href, onClick, ...props }: AnchorLinkProps) {
  const id = href.startsWith("#") ? href.slice(1) : null;

  if (!id) {
    return <a href={href} onClick={onClick} {...props} />;
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    scrollToSection(id);
    window.history.pushState(null, "", href);
    onClick?.(event);
  };

  return <a href={href} onClick={handleClick} {...props} />;
}
