import { cn } from "@/lib/utils";
import type { SVGProps } from "react";

/** Tabler satellite glyph. Color comes from `currentColor`. */
export function SatelliteIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0", className)}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M3.707 6.293l2.586 -2.586a1 1 0 0 1 1.414 0l5.586 5.586a1 1 0 0 1 0 1.414l-2.586 2.586a1 1 0 0 1 -1.414 0l-5.586 -5.586a1 1 0 0 1 0 -1.414z" />
      <path d="M6 10l-3 3l3 3l3 -3" />
      <path d="M10 6l3 -3l3 3l-3 3" />
      <path d="M12 12l1.5 1.5" />
      <path d="M14.5 17a2.5 2.5 0 0 0 2.5 -2.5" />
      <path d="M15 21a6 6 0 0 0 6 -6" />
    </svg>
  );
}
