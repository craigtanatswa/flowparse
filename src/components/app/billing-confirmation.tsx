"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Ask the server to re-read the subscription after a checkout redirect. The
 * redirect itself never grants access: the server page only reports a paid
 * plan after the signed Dodo webhook has updated Supabase.
 */
export function BillingConfirmation({ confirmed }: { confirmed: boolean }) {
  const router = useRouter();
  const attempts = React.useRef(0);

  React.useEffect(() => {
    if (confirmed) return;

    const timer = setInterval(() => {
      attempts.current += 1;
      if (attempts.current > 20) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, 3000);

    return () => clearInterval(timer);
  }, [confirmed, router]);

  return null;
}
