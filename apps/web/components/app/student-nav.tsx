"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/student", label: "Dashboard" },
  { href: "/student/group", label: "My group" },
  { href: "/student/cover", label: "Cover" },
  { href: "/student/members", label: "Group info" },
  { href: "/student/rules", label: "Rules" },
  { href: "/student/undertaking", label: "Undertaking" },
  { href: "/student/schedule", label: "Schedule" },
  { href: "/student/topics", label: "Topics" },
  { href: "/student/activity/june", label: "Activity" },
  { href: "/student/reviews", label: "Reviews" },
  { href: "/student/mock", label: "Mock eval" },
  { href: "/student/final", label: "Final eval" },
  { href: "/student/examiner/TERM_I", label: "Examiner" },
  { href: "/student/competitions", label: "Competitions" },
  { href: "/student/papers", label: "Papers" },
  { href: "/student/checklists", label: "Checklists" },
  { href: "/student/rtm", label: "RTM" },
  { href: "/student/cost", label: "Cost" },
  { href: "/student/notes", label: "Notes" },
  { href: "/student/sponsored", label: "Sponsored" },
  { href: "/student/pdf", label: "PDF" },
];

/**
 * Determines whether a link corresponds to the active route.
 * Handles nested routes such as /student/activity/* and /student/examiner/*.
 */
function isLinkActive(linkHref: string, pathname: string): boolean {
  if (linkHref === "/student") {
    return pathname === "/student";
  }
  if (linkHref.startsWith("/student/activity")) {
    return pathname.startsWith("/student/activity");
  }
  if (linkHref.startsWith("/student/examiner")) {
    return pathname.startsWith("/student/examiner");
  }
  return pathname === linkHref || pathname.startsWith(linkHref + "/");
}

export function StudentNav() {
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const el = scrollContainerRef.current;
    if (!el) return;

    // Automatically center active link into view on navigation or initial load
    const activeLink = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (activeLink) {
      activeLink.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }

    // Keep scroll button state accurate on resize
    const handleResize = () => updateScrollButtons();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [pathname, updateScrollButtons]);

  const handleScroll = (distance: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: distance, behavior: "smooth" });
  };

  return (
    <nav
      className="border-b border-[#DCE4EF] bg-white py-2"
      aria-label="Student Navigation"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 sm:px-4">
        {/* Left scroll control arrow */}
        <button
          type="button"
          onClick={() => handleScroll(-220)}
          disabled={!canScrollLeft}
          aria-label="Scroll navigation left"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#DCE4EF] bg-white text-[#111111] transition-colors duration-150 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
        >
          <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
        </button>

        {/* Horizontal scrollable navigation tabs */}
        <div
          ref={scrollContainerRef}
          onScroll={updateScrollButtons}
          tabIndex={0}
          role="region"
          aria-label="Student logbook sections"
          className="nav-horizontal-scrollbar flex flex-1 items-center gap-1.5 overflow-x-auto py-1 scroll-smooth focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-300"
        >
          {LINKS.map((link) => {
            const active = isLinkActive(link.href, pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-md border px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1",
                  active
                    ? "border-[#111111] bg-[#111111] text-[#FFFFFF] shadow-xs cursor-default"
                    : "border-[#DCE4EF] bg-[#FFFFFF] text-[#111111] hover:border-[#111111] hover:bg-[#111111] hover:text-[#FFFFFF]"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right scroll control arrow */}
        <button
          type="button"
          onClick={() => handleScroll(220)}
          disabled={!canScrollRight}
          aria-label="Scroll navigation right"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#DCE4EF] bg-white text-[#111111] transition-colors duration-150 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
        >
          <ChevronRight className="h-4 w-4 stroke-[2.5]" />
        </button>
      </div>
    </nav>
  );
}
