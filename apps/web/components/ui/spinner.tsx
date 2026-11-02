import * as React from "react";
import { cn } from "@/lib/utils";

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: "sm" | "md" | "lg" | number;
  variant?: "white" | "navy" | "current";
}

/**
 * Reusable circular rotating spinner.
 * - Circular SVG ring with arc stroke.
 * - 16-20px sizing options.
 * - White inside navy buttons, navy on light backgrounds.
 * - Smooth rotation animation that respects prefers-reduced-motion.
 */
export function Spinner({
  size = "sm",
  variant = "current",
  className,
  ...props
}: SpinnerProps) {
  const pixelSize =
    typeof size === "number"
      ? size
      : size === "sm"
      ? 16
      : size === "md"
      ? 18
      : 24;

  const colorClass =
    variant === "white"
      ? "text-white"
      : variant === "navy"
      ? "text-[#111827]"
      : "text-current";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "animate-spin motion-reduce:animate-none shrink-0 inline-block align-middle",
        colorClass,
        className
      )}
      aria-hidden="true"
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2.5"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2.5"
      />
    </svg>
  );
}
