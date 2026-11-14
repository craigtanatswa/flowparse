import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Rounded teal app tile with the white FlowParse glyph. Use this where the
 * brand needs a compact, self-contained mark (badges, empty states, avatars).
 */
export function LogoMark({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <Image
      src={inverted ? "/brand/flowparse-icon-reversed.svg" : "/brand/flowparse-app-icon.svg"}
      alt=""
      aria-hidden="true"
      width={760}
      height={760}
      unoptimized
      className={cn("size-9 shrink-0", className)}
    />
  );
}

/**
 * Transparent single-colour glyph. Designed for watermarks, patterns, and
 * large brand moments where a tile would be too heavy.
 */
export function LogoGlyph({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <Image
      src={inverted ? "/brand/flowparse-icon-reversed.svg" : "/brand/flowparse-icon.svg"}
      alt=""
      aria-hidden="true"
      width={760}
      height={760}
      unoptimized
      className={cn("size-9 shrink-0", className)}
    />
  );
}

/**
 * Horizontal FlowParse lockup (glyph + lowercase wordmark).
 */
export function Logo({
  dark = false,
  href = "/",
  className,
  imageClassName,
}: {
  dark?: boolean;
  href?: string;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center", className)}
      aria-label="FlowParse home"
    >
      <Image
        src={dark ? "/brand/flowparse-logo-reversed.svg" : "/brand/flowparse-logo.svg"}
        alt="FlowParse"
        width={1978}
        height={419}
        unoptimized
        loading="eager"
        className={cn("h-7 w-auto", imageClassName)}
      />
    </Link>
  );
}
