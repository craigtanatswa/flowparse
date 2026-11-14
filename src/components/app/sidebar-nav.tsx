"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, Plus, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/statements", label: "Statements", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      <p className="mb-2 px-2 text-[10.5px] font-semibold tracking-[0.02em] text-sidebar-muted/80">
        Workspace
      </p>
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-primary"
                : "text-sidebar-muted hover:bg-muted/70 hover:text-foreground"
            )}
          >
            <Icon
              className={cn(
                "size-[17px] transition-colors",
                active ? "text-primary" : "text-sidebar-muted group-hover:text-foreground"
              )}
            />
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/dashboard#upload"
        className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(12,42,36,0.16)] transition-colors hover:bg-primary/90"
      >
        <Plus className="size-4" />
        New conversion
      </Link>
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0.5" aria-label="Main navigation">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex size-9 items-center justify-center gap-1.5 rounded-lg text-[12px] font-medium transition-colors sm:w-auto sm:px-2.5",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            aria-label={item.label}
          >
            <Icon className="size-4 sm:hidden" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
