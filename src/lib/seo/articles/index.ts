import type { ArticleContent } from "@/lib/seo/content-types";
import { conversionArticles } from "@/lib/seo/articles/conversion";
import { practiceArticles } from "@/lib/seo/articles/practice";

export const ARTICLES: ArticleContent[] = [
  ...conversionArticles,
  ...practiceArticles,
];

export function getArticle(slug: string): ArticleContent | undefined {
  return ARTICLES.find((article) => article.slug === slug);
}

export function articlePath(slug: string): string {
  return `/resources/${slug}`;
}
