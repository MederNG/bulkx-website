"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
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
  { href: "/aura/sources", label: "Aura" },
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

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-line)] bg-[rgba(11,11,12,0.92)] backdrop-blur-[10px]">
      <div className="shell flex min-h-[60px] flex-wrap items-center justify-between gap-x-6 gap-y-4 py-[11px]">
        {/* flex-1 on BOTH flanks, with the nav sized to its own content
            between them: the two sides then take an equal share of whatever
            is left, which is what centres the menu on the header itself.
            justify-center alone did not — the nav was the flexible item, so
            it centred its links inside the space remaining AFTER the logo,
            leaving the whole menu sitting half a logo's width right of the
            page's centre. */}
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-[11px] text-text-primary">
          <Image
            src="/logos/bulkx-logo-light.svg"
            alt="BULK"
            width={83}
            height={32}
            priority
            className="block"
          />
          <span className="hidden text-[17px] font-normal tracking-[0.16em] text-text-secondary sm:inline">
            INTELLIGENCE
          </span>
        </Link>

        <nav className="hidden min-w-0 shrink-0 flex-wrap items-center justify-center gap-[26px] lg:flex">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "site-nav-link relative py-[6px] text-sm transition-colors",
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

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          {/* Flattened nav for narrow screens, where the inline bar is hidden. */}
          <div className="site-nav-menu relative lg:hidden">
            <button
              type="button"
              className="ghost-pill inline-flex items-center gap-1.5 px-3 py-2 text-[13px]"
            >
              Menu
              <ChevronDown className="h-[13px] w-[13px]" strokeWidth={2.4} />
            </button>
            <div className="site-nav-drop absolute right-0 top-full z-[60] mt-3 min-w-[210px] rounded-[10px] border border-[var(--color-line-strong)] bg-[var(--color-bg-primary)] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
              {NAV.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-md px-3 py-[9px] text-[13.5px] text-text-secondary transition-colors hover:bg-[rgba(255,181,71,0.1)] hover:text-accent"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
