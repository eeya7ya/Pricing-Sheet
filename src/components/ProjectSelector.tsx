"use client";

import { useState } from "react";
import { ChevronDown, Plus, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

interface Project {
  id: number;
  name: string;
}

interface Props {
  projects: Project[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreateNew: (name: string) => Promise<void>;
}

export function ProjectSelector({
  projects,
  selectedId,
  onSelect,
  onCreateNew,
}: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  const selected = projects.find((p) => p.id === selectedId);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await onCreateNew(newName.trim());
      setNewName("");
      setCreating(false);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm font-medium",
          "transition-colors hover:border-slate-600 hover:bg-slate-700",
          "focus:outline-none focus:ring-2 focus:ring-cyan-500/30",
          open && "border-slate-600 bg-slate-700"
        )}
      >
        <Folder className="h-3.5 w-3.5 text-cyan-400" />
        <span className="text-slate-200">
          {selected ? selected.name : "Select Project…"}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-slate-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[220px] rounded-xl border border-slate-700 bg-slate-800 shadow-2xl shadow-black/50">
          {/* Create new project option */}
          <div className="border-b border-slate-700/50 p-1">
            {creating ? (
              <div className="flex items-center gap-2 p-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Project name…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") {
                      setCreating(false);
                      setNewName("");
                    }
                  }}
                  className="flex-1 rounded-md border border-slate-600 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-500/60 focus:outline-none"
                />
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || loading}
                  className="rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-cyan-400 disabled:opacity-50"
                >
                  {loading ? "…" : "Add"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-cyan-400 transition-colors hover:bg-slate-700/60"
              >
                <Plus className="h-3.5 w-3.5" />
                New Project…
              </button>
            )}
          </div>

          {/* Existing projects */}
          <div className="max-h-56 overflow-y-auto p-1">
            {projects.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-500">
                No projects yet
              </p>
            ) : (
              projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelect(p.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    p.id === selectedId
                      ? "bg-cyan-500/10 text-cyan-300"
                      : "text-slate-300 hover:bg-slate-700/60"
                  )}
                >
                  <Folder
                    className={cn(
                      "h-3.5 w-3.5 flex-shrink-0",
                      p.id === selectedId ? "text-cyan-400" : "text-slate-500"
                    )}
                  />
                  {p.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Click outside */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setOpen(false);
            setCreating(false);
            setNewName("");
          }}
        />
      )}
    </div>
  );
}
