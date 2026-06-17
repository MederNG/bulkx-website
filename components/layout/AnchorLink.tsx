"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";

const HEADER_OFFSET = 72;
const RETRY_DELAYS_MS = [150, 400, 900, 1500];

export function scrollToSection(id: string) {
  const run = () => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  };

  run();
  requestAnimationFrame(run);
  for (const delay of RETRY_DELAYS_MS) {
    window.setTimeout(run, delay);
  }
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
