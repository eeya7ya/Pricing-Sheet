"use client";

import Link from "next/link";
import { Factory, FolderOpen, ArrowRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  id: number;
  name: string;
  projectCount: number;
  onDelete: (id: number) => void;
}

export function ManufacturerCard({ id, name, projectCount, onDelete }: Props) {
  return (
    <div
      className={cn(
        "group relative rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5",
        "transition-all duration-200 hover:border-slate-600 hover:bg-slate-800/70 hover:shadow-lg hover:shadow-black/30"
      )}
    >
      {/* Delete button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          if (confirm(`Delete "${name}" and all its data?`)) {
            onDelete(id);
          }
        }}
        className="absolute right-3 top-3 rounded-md p-1.5 text-slate-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-slate-700 hover:text-rose-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* Icon */}
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20">
        <Factory className="h-5 w-5 text-cyan-400" />
      </div>

      {/* Name */}
      <h3 className="mb-1 text-base font-semibold text-slate-100">{name}</h3>

      {/* Stats */}
      <div className="mb-4 flex items-center gap-1.5 text-xs text-slate-500">
        <FolderOpen className="h-3.5 w-3.5" />
        {projectCount} {projectCount === 1 ? "project" : "projects"}
      </div>

      {/* Open link */}
      <Link
        href={`/manufacturer/${id}`}
        className={cn(
          "flex items-center justify-between rounded-lg px-3 py-2.5",
          "bg-slate-700/40 text-sm font-medium text-slate-300",
          "transition-colors hover:bg-cyan-500/10 hover:text-cyan-300"
        )}
      >
        Open Sheet
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
