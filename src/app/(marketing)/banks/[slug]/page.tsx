import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BankPageView } from "@/components/seo/bank-page-view";
import { BANK_PAGES, getBankPage } from "@/lib/seo/banks";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamicParams = false;

export function generateStaticParams() {
  return BANK_PAGES.map((bank) => ({ slug: bank.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const bank = getBankPage(slug);
  if (!bank) return {};

  return buildPageMetadata({
    title: bank.title,
    description: bank.description,
    path: `/banks/${bank.slug}`,
  });
}

export default async function BankPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bank = getBankPage(slug);
  if (!bank) notFound();

  return <BankPageView bank={bank} />;
}
