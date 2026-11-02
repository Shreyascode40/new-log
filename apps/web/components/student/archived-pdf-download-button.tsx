"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export interface ArchivedPdfDownloadButtonProps {
  exportId: string;
  fileName?: string;
}

/**
 * Isolated download button for an individual archived PDF entry in "Past generations".
 * Maintains its own loading state so only the actively clicked row shows a spinner
 * and disabled state, leaving all other buttons interactive.
 */
export function ArchivedPdfDownloadButton({
  exportId,
  fileName,
}: ArchivedPdfDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);

    try {
      const res = await fetch(`/api/pdf/${encodeURIComponent(exportId)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch archived PDF (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      const defaultName = fileName || `logbook-archive-${exportId.slice(0, 8)}.pdf`;

      // Trigger standard browser file save
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = defaultName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (error) {
      console.error("[ArchivedPdfDownloadButton] Download error:", error);
      // Fallback: direct navigation to let browser handle download
      window.location.href = `/api/pdf/${encodeURIComponent(exportId)}`;
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={downloading}
      onClick={() => void handleDownload()}
      className="border-[#DCE4EF] text-[#111111] hover:bg-neutral-100 min-w-[90px]"
    >
      {downloading ? (
        <span className="inline-flex items-center gap-1.5 text-xs">
          <Spinner variant="navy" size={14} />
          <span>1/1 — Downloading...</span>
        </span>
      ) : (
        "Download"
      )}
    </Button>
  );
}
