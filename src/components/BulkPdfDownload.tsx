"use client";

import { useState } from "react";
import { Archive, Loader2, AlertCircle } from "lucide-react";
import { exportAllAsZip, type BulkExportProgress } from "@/lib/exportAll";

/**
 * Single-button bulk download. Walks every manufacturer / project the
 * current user can see, builds a PDF for each, and zips them into a
 * `Pricing-sheets/<Manufacturer>/<Project>.pdf` tree.
 */
export function BulkPdfDownload() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<BulkExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      await exportAllAsZip(setProgress);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(false);
      // Keep the last progress visible briefly so users see the "Done" state.
      setTimeout(() => setProgress(null), 1500);
    }
  };

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        title="Download every project as a PDF, organized by manufacturer"
        className="flex items-center gap-2 rounded-xl border border-cyan-200 bg-white px-4 py-2.5 text-sm font-semibold text-cyan-700 transition-all hover:border-cyan-400 hover:bg-cyan-50 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Archive className="h-4 w-4" />
        )}
        {busy ? "Building ZIP…" : "Download All PDFs"}
      </button>

      {progress && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>
            {progress.completed}/{progress.total}
            {progress.total > 0 ? ` · ${pct}%` : ""}
          </span>
          <span className="max-w-[260px] truncate text-gray-400">
            {progress.currentLabel}
          </span>
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-rose-500">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
