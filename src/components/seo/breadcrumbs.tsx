import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[11.5px] text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? (
              <ChevronRight className="size-3 text-muted-foreground/60" aria-hidden="true" />
            ) : null}
            {item.href ? (
              <Link href={item.href} className="transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-foreground/80">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
