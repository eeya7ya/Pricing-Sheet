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
        "group relative rounded-2xl p-5",
        "border border-white/[0.07] bg-white/[0.03]",
        "transition-all duration-300",
        "hover:border-cyan-500/20 hover:bg-white/[0.06]",
        "hover:shadow-xl hover:shadow-black/50"
      )}
    >
      {/* Delete button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          if (confirm(`Delete "${name}" and all its data?`)) {
            onDelete(id);
          }
        }}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* Icon */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20">
        <Factory className="h-5 w-5 text-cyan-400" />
      </div>

      {/* Name */}
      <h3 className="mb-1.5 text-base font-semibold text-white">{name}</h3>

      {/* Stats */}
      <div className="mb-5 flex items-center gap-1.5 text-xs text-slate-500">
        <FolderOpen className="h-3.5 w-3.5" />
        {projectCount} {projectCount === 1 ? "project" : "projects"}
      </div>

      {/* Open link */}
      <Link
        href={`/manufacturer/${id}`}
        className={cn(
          "flex items-center justify-between rounded-xl px-3.5 py-2.5",
          "border border-white/[0.07] bg-white/[0.04]",
          "text-sm font-medium text-slate-300",
          "transition-all hover:bg-cyan-500/10 hover:text-cyan-300 hover:border-cyan-500/20"
        )}
      >
        Open Sheet
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
