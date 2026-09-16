"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  CircuitBoard,
  Coins,
  Layers3,
  RadioTower,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", key: "navStudio" as const, icon: CircuitBoard },
  { href: "/providers", key: "navProviders" as const, icon: RadioTower },
  { href: "/sessions", key: "navSessions" as const, icon: Layers3 },
  { href: "/protocol", key: "navProtocol" as const, icon: ArrowLeftRight },
  { href: "/savings", key: "navSavings" as const, icon: Coins },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t, toggle } = useLanguage();

  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_circle_at_10%_-10%,oklch(0.28_0.04_80/0.55),transparent_55%),radial-gradient(900px_circle_at_90%_0%,oklch(0.3_0.04_170/0.35),transparent_50%)]">
      <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-4 pb-24 pt-5 md:flex-row md:gap-8 md:px-6 md:pb-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-6 space-y-6">
            <div>
              <p className="font-mono text-[11px] tracking-[0.22em] text-primary/80">C2X</p>
              <h1 className="mt-1 font-heading text-xl text-foreground">{t.product}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t.tagline}</p>
            </div>
            <nav className="space-y-1">
              {LINKS.map((link) => {
                const active = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {t[link.key]}
                  </Link>
                );
              })}
            </nav>
            <Button variant="outline" size="sm" onClick={toggle} className="w-full">
              {t.language}
            </Button>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          {children}
          <p className="mt-10 max-w-2xl text-xs text-muted-foreground">{t.unaffiliated}</p>
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2.5 text-[10px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
                {t[link.key]}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
