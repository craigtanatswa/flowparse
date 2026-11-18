import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CtaPanel({
  title = "Convert your first statement free",
  body = "The Free plan includes 3 processed pages per month. Upload a PDF, review the ledger, and export Excel or CSV when it looks right.",
  primaryHref = "/signup?next=%2Fdashboard%23upload",
  primaryLabel = "Start free",
}: {
  title?: string;
  body?: string;
  primaryHref?: string;
  primaryLabel?: string;
}) {
  return (
    <section className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8">
      <div className="relative isolate overflow-hidden rounded-3xl bg-[#0b5c4d] px-6 py-12 sm:px-12">
        <div className="pointer-events-none absolute inset-0 -z-10 brand-rings opacity-25" />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="max-w-xl text-[26px] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-[32px]">
              {title}
            </h2>
            <p className="mt-3 max-w-xl text-[13px] leading-6 text-white/75">
              {body}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-white text-[#0b5c4d] hover:bg-white/90"
            >
              <Link href={primaryHref}>
                {primaryLabel}
                <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/#pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
