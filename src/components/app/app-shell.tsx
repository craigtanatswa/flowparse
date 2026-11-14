import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { LockKeyhole } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { MobileNav, SidebarNav } from "@/components/app/sidebar-nav";
import { UserMenu } from "@/components/app/user-menu";

export function AppShell({
  user,
  children,
}: {
  user: User;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="px-5 pb-7 pt-6">
          <Logo href="/dashboard" imageClassName="h-[26px]" />
        </div>
        <div className="px-3">
          <SidebarNav />
        </div>
        <div className="mt-auto px-4 pb-4">
          <div className="rounded-xl border border-sidebar-border bg-[#f7faf8] p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-foreground">
              <LockKeyhole className="size-3.5 text-primary" />
              Private by default
            </div>
            <p className="mt-1.5 text-[10.5px] leading-[1.65] text-sidebar-muted">
              Statements are protected by per-user access rules. Only you can open
              your documents and conversions.
            </p>
          </div>
          <div className="mt-4 border-t border-sidebar-border pt-4">
            <UserMenu email={user.email} />
          </div>
        </div>
      </aside>

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-md lg:hidden">
          <Logo href="/dashboard" imageClassName="h-6" />
          <div className="flex items-center gap-2">
            <MobileNav />
            <UserMenu email={user.email} variant="mobile" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1360px] px-4 pb-20 pt-7 sm:px-6 lg:px-10 lg:pt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
