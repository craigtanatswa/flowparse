import { MarketingFooter } from "@/components/seo/marketing-footer";
import { MarketingHeader } from "@/components/seo/marketing-header";

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
