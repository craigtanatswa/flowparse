/**
 * One JSON-LD script per page. Passing several nodes produces a single
 * @graph document, which avoids duplicate @context blocks and makes the
 * relationships explicit.
 */
export function JsonLd({
  nodes,
}: {
  nodes: Array<Record<string, unknown>>;
}) {
  const payload =
    nodes.length === 1
      ? { "@context": "https://schema.org", ...nodes[0] }
      : { "@context": "https://schema.org", "@graph": nodes };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(payload).replace(/</g, "\\u003c"),
      }}
    />
  );
}
