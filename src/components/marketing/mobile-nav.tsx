"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const defaultLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#formats", label: "Formats" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
  { href: "/resources", label: "Resources" },
  { href: "/banks", label: "Bank guides" },
];

export function MarketingMobileNav({
  signedIn,
  links = defaultLinks,
}: {
  signedIn: boolean;
  links?: Array<{ href: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex size-9 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-border bg-white p-2 shadow-[0_18px_48px_-16px_rgba(16,28,24,0.24)]">
          <nav className="flex flex-col" aria-label="Mobile navigation">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[13px] font-medium text-foreground/75 transition-colors hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-1 border-t border-border pt-2">
            {signedIn ? (
              <Button asChild size="sm" className="w-full">
                <Link href="/dashboard" onClick={() => setOpen(false)}>
                  Open workspace
                </Link>
              </Button>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Button asChild variant="ghost" size="sm" className="w-full">
                  <Link href="/login" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild size="sm" className="w-full">
                  <Link
                    href="/signup?next=%2Fdashboard%23upload"
                    onClick={() => setOpen(false)}
                  >
                    Convert a Statement
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
