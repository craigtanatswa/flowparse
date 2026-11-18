import Link from "next/link";

const LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Renders the small amount of inline linking used by the SEO copy without
 * pulling in a Markdown dependency. Internal paths use next/link.
 */
export function RichText({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  LINK_PATTERN.lastIndex = 0;
  while ((match = LINK_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const [, label, href] = match;
    if (href.startsWith("/")) {
      nodes.push(
        <Link
          key={`${href}-${match.index}`}
          href={href}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {label}
        </Link>
      );
    } else {
      nodes.push(
        <a
          key={`${href}-${match.index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {label}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return <>{nodes}</>;
}
