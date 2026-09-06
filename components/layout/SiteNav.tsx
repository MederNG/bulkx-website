"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { HeaderCampaignStatus } from "@/components/layout/HeaderCampaignStatus";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
}

/** Every entry is a plain link now. Aura and Tools used to open submenus; the
 * Tools one pointed at #anchors this site never had, and both put a second
 * layer of navigation over pages that each hold one screen of content. */
const NAV: NavItem[] = [
  { href: "/", label: "Overview" },
  { href: "/aura", label: "Aura" },
  { href: "/tools", label: "Tools" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/trade", label: "Trade" },
];

/** A section is active for its own route and anything nested beneath it. */
function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/";
  const section = `/${item.href.split("/")[1]}`;
  return pathname === section || pathname.startsWith(`${section}/`);
}

export function SiteNav() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Hidden mobile-menu links are out of the viewport, so Next does not
  // prefetch them on its own. Warm every section once the shell is up.
  useEffect(() => {
    for (const item of NAV) {
      router.prefetch(item.href);
    }
  }, [router]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-line)] bg-[rgba(11,11,12,0.92)] backdrop-blur-[10px]">
      <div className="shell flex min-h-[60px] flex-wrap items-center justify-between gap-x-[26px] gap-y-3 py-[11px]">
        <div className="flex min-w-0 items-center gap-[26px]">
          <Link href="/" className="flex min-w-0 items-center gap-[11px] text-text-primary">
            <Image
              src="/logos/bulkx-logo-light.svg"
              alt="BULK"
              width={83}
              height={32}
              priority
              className="hidden sm:block"
            />
            <span className="font-sans text-[17px] font-semibold tracking-[-0.02em] text-text-secondary">
              INTELLIGENCE
            </span>
          </Link>

          <span className="hidden h-[22px] w-px shrink-0 bg-[var(--color-line-strong)] lg:block" aria-hidden />

          <nav className="hidden min-w-0 flex-wrap items-center gap-[26px] lg:flex">
            {NAV.map((item) => {
              const active = isActive(pathname, item);
              return (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "site-nav-link font-sans relative py-[6px] text-[12px] font-semibold uppercase tracking-[0.14em] transition-colors",
                      active ? "text-accent" : "text-text-muted hover:text-text-primary"
                    )}
                    data-active={active || undefined}
                  >
                    {item.label}
                  </Link>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-[18px]">
          <HeaderCampaignStatus />
          {/* Flattened nav for narrow screens, where the inline bar is hidden. */}
          <div ref={menuRef} className="relative lg:hidden">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((open) => !open)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] transition-colors",
                menuOpen
                  ? "border-accent bg-[rgba(255,181,71,0.14)] text-accent"
                  : "border-[rgba(255,181,71,0.4)] text-accent"
              )}
            >
              Menu
              <ChevronDown
                className={cn(
                  "h-[13px] w-[13px] transition-transform duration-200",
                  menuOpen && "rotate-180"
                )}
                strokeWidth={2.4}
              />
            </button>
            <div
              role="menu"
              className={cn(
                "absolute right-0 top-full z-[60] mt-2 min-w-[220px] origin-top-right rounded-[10px] border border-[rgba(255,181,71,0.22)] bg-[var(--color-bulk-base)] p-1.5 shadow-[0_20px_48px_rgba(0,0,0,0.72)] transition-[opacity,transform] duration-150",
                menuOpen
                  ? "pointer-events-auto scale-100 opacity-100"
                  : "pointer-events-none scale-[0.98] opacity-0"
              )}
            >
              {NAV.map((link) => {
                const active = isActive(pathname, link);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    role="menuitem"
                    className={cn(
                      "relative block rounded-md px-3 py-2.5 text-[13px] transition-colors",
                      active
                        ? "bg-[rgba(255,181,71,0.12)] font-medium text-accent"
                        : "text-text-primary hover:bg-[rgba(255,181,71,0.08)] hover:text-accent"
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-1.5 left-0 top-1.5 w-[2px] rounded-full bg-accent"
                      />
                    )}
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
