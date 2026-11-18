import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleView } from "@/components/seo/article-view";
import { ARTICLES, getArticle } from "@/lib/seo/articles";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const dynamicParams = false;

export function generateStaticParams() {
  return ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};

  return buildPageMetadata({
    title: article.title,
    description: article.description,
    path: `/resources/${article.slug}`,
    type: "article",
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  return <ArticleView article={article} />;
}
