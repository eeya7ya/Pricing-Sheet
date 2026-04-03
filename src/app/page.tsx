"use client";

import { useState, useEffect } from "react";
import { Plus, Factory, BarChart3 } from "lucide-react";
import { ManufacturerCard } from "@/components/ManufacturerCard";
import { cn } from "@/lib/utils";

interface Manufacturer {
  id: number;
  name: string;
  createdAt: string;
}

interface ManufacturerWithCount {
  manufacturer: Manufacturer;
  projectCount: number;
}

export default function DashboardPage() {
  const [items, setItems] = useState<ManufacturerWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mRes] = await Promise.all([fetch("/api/manufacturers")]);
      if (mRes.ok) {
        const manufacturers: Manufacturer[] = await mRes.json();
        // Fetch project counts in parallel
        const withCounts = await Promise.all(
          manufacturers.map(async (m) => {
            const pRes = await fetch(`/api/projects?manufacturerId=${m.id}`);
            const projects = pRes.ok ? await pRes.json() : [];
            return { manufacturer: m, projectCount: projects.length };
          })
        );
        setItems(withCounts);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/manufacturers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        setNewName("");
        setCreating(false);
        await loadData();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/manufacturers/${id}`, { method: "DELETE" });
    await loadData();
  };

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6">
      {/* Page header */}
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-400">
            <BarChart3 className="h-3.5 w-3.5" />
            Manufacturers
          </div>
          <h1 className="text-3xl font-bold text-slate-100">Pricing Dashboard</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Manage manufacturers and their smart pricing sheets
          </p>
        </div>

        {/* Add manufacturer */}
        <div className="flex-shrink-0">
          {creating ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                placeholder="Manufacturer name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                  }
                }}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || saving}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-400 disabled:opacity-50"
              >
                {saving ? "Adding…" : "Add"}
              </button>
              <button
                onClick={() => { setCreating(false); setNewName(""); }}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold",
                "bg-cyan-500 text-white transition-colors hover:bg-cyan-400",
                "focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              )}
            >
              <Plus className="h-4 w-4" />
              Add Manufacturer
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800">
            <Factory className="h-7 w-7 text-slate-500" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-slate-300">
            No manufacturers yet
          </h3>
          <p className="mb-6 text-sm text-slate-500">
            Add your first manufacturer to get started
          </p>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-400 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Manufacturer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map(({ manufacturer, projectCount }) => (
            <div key={manufacturer.id} className="animate-fade-in">
              <ManufacturerCard
                id={manufacturer.id}
                name={manufacturer.name}
                projectCount={projectCount}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
