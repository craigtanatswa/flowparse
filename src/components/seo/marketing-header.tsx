import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { MarketingMobileNav } from "@/components/marketing/mobile-nav";
import { Button } from "@/components/ui/button";

const navigation = [
  { href: "/convert-bank-statements-to-spreadsheets", label: "Converters" },
  { href: "/banks", label: "Bank guides" },
  { href: "/resources", label: "Resources" },
  { href: "/#pricing", label: "Pricing" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Logo imageClassName="h-8" />

        <nav
          className="hidden items-center gap-7 text-[12.5px] font-medium text-muted-foreground md:flex"
          aria-label="Main navigation"
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          >
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/signup?next=%2Fdashboard%23upload">
              Convert a statement
              <ArrowRight />
            </Link>
          </Button>
          <MarketingMobileNav signedIn={false} links={navigation} />
        </div>
      </div>
    </header>
  );
}
