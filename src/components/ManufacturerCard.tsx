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
        "border border-gray-200 bg-white",
        "transition-all duration-300",
        "hover:border-cyan-200 hover:shadow-lg hover:shadow-gray-200"
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
        className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* Icon */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 ring-1 ring-cyan-200">
        <Factory className="h-5 w-5 text-cyan-600" />
      </div>

      {/* Name */}
      <h3 className="mb-1.5 text-base font-semibold text-gray-900">{name}</h3>

      {/* Stats */}
      <div className="mb-5 flex items-center gap-1.5 text-xs text-gray-500">
        <FolderOpen className="h-3.5 w-3.5" />
        {projectCount} {projectCount === 1 ? "project" : "projects"}
      </div>

      {/* Open link */}
      <Link
        href={`/manufacturer/${id}`}
        className={cn(
          "flex items-center justify-between rounded-xl px-3.5 py-2.5",
          "border border-gray-200 bg-gray-50",
          "text-sm font-medium text-gray-700",
          "transition-all hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200"
        )}
      >
        Open Sheet
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
