"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, MoreHorizontal, Settings } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { cn, initials } from "@/lib/utils";

export function UserMenu({
  email,
  variant = "sidebar",
  className,
}: {
  email: string | null | undefined;
  variant?: "sidebar" | "mobile";
  className?: string;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-xl text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
            variant === "sidebar"
              ? "px-2 py-2 hover:bg-muted/70"
              : "size-9 justify-center border border-border bg-white hover:bg-muted",
            className
          )}
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
              variant === "sidebar"
                ? "bg-accent text-primary ring-1 ring-border"
                : "bg-card text-foreground ring-1 ring-border"
            )}
          >
            {initials(email)}
          </span>
          {variant === "mobile" ? <span className="sr-only">Account menu</span> : null}
          {variant === "sidebar" ? (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-sidebar-foreground">
                  {email || "Your account"}
                </span>
                <span className="block text-[10.5px] tracking-[0.01em] text-sidebar-muted">
                  Private workspace
                </span>
              </span>
              <MoreHorizontal className="size-4 text-sidebar-muted" />
            </>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={variant === "sidebar" ? "top" : "bottom"}
        align={variant === "sidebar" ? "start" : "end"}
        className="w-64"
      >
        <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
        <p className="truncate px-2.5 pb-2 text-xs text-muted-foreground">{email || "—"}</p>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            Account settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="danger"
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
          disabled={signingOut}
        >
          <LogOut />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
