import { notFound } from "next/navigation";

import { StatementDetail } from "@/components/statements/statement-detail";
import { requireUser } from "@/lib/auth";
import { logServerError } from "@/lib/log";
import { isUuid } from "@/lib/utils";

export default async function StatementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { user, supabase } = await requireUser();

  const [{ data: statement, error: statementError }, { data: transactions, error: transactionsError }] =
    await Promise.all([
      supabase
        .from("statements")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("*")
        .eq("statement_id", id)
        .order("sort_index", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

  if (statementError || transactionsError) {
    logServerError("Could not load statement detail", statementError, transactionsError);
    throw new Error("Could not load this statement.");
  }
  if (!statement) notFound();

  return (
    <StatementDetail
      initialStatement={statement}
      initialTransactions={transactions ?? []}
    />
  );
}
