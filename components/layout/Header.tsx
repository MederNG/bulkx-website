import Image from "next/image";
import Link from "next/link";
import { NavMoreMenu } from "@/components/layout/NavMoreMenu";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(198,182,186,0.1)] bg-[#141310]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logos/bulkx-logo-light.svg" alt="BULK" width={83} height={32} priority />
          <span className="hidden text-xs font-medium tracking-[0.2em] text-text-secondary sm:inline">
            INTELLIGENCE
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-xs">
          <div className="hidden items-center gap-1 md:flex">
            <a href="#lookup" className="btn-ghost btn-ghost-header">
              Lookup
            </a>
            <a href="#analytics" className="btn-ghost btn-ghost-header">
              Analytics
            </a>
            <a href="#leaderboards" className="btn-ghost btn-ghost-header">
              Leaderboards
            </a>
            <a href="#calculator" className="btn-ghost btn-ghost-header">
              Calculator
            </a>
          </div>
          <NavMoreMenu />
          <a
            href="https://early.bulk.trade/deposit?ref=maker"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary ml-1"
          >
            Deposit
          </a>
        </nav>
      </div>
    </header>
  );
}
