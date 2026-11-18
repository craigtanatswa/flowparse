export interface FaqItem {
  question: string;
  answer: string;
}

export interface ContentTable {
  caption?: string;
  headers: string[];
  rows: string[][];
}

export interface ContentSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  ordered?: boolean;
  table?: ContentTable;
}

export interface Step {
  title: string;
  body: string;
}

export interface AudienceCard {
  title: string;
  body: string;
}

export interface LandingPageContent {
  /** URL path without a leading slash. */
  slug: string;
  /** Metadata title, without the " · FlowParse" suffix. */
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string[];
  keyPoints: string[];
  steps: Step[];
  sections: ContentSection[];
  audienceHeading: string;
  audience: AudienceCard[];
  faq: FaqItem[];
  /** Site-relative paths to related pages. */
  related: string[];
  updatedAt: string;
}

export interface ArticleContent {
  /** URL path under /resources, without a leading slash. */
  slug: string;
  title: string;
  description: string;
  category: string;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  intro: string[];
  sections: ContentSection[];
  faq: FaqItem[];
  /** Site-relative paths to related pages. */
  related: string[];
}

export interface BankContent {
  slug: string;
  name: string;
  region: string;
  currency: string;
  dateOrder: string;
  title: string;
  description: string;
  intro: string[];
  /** What the bank profile changes in parsing defaults. */
  profileNote: string;
  /** Honest description of what was actually exercised in the test suite. */
  testedNote: string;
  testedLayouts: string[];
  /** Independence disclaimer, for example "not affiliated with Barclays". */
  disclaimer: string;
  sections: ContentSection[];
  faq: FaqItem[];
}
