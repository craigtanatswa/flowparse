import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { createClient } from "@/lib/supabase/server";

// Authenticated pages read cookies and live data on every request. Mark the
// whole route group dynamic so Next never tries to prerender it (and never
// requires Supabase build-time env vars to render it during `next build`).
export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
