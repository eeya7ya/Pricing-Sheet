"use client";

import { useState, useEffect } from "react";
import { Plus, Factory, BarChart3, AlertCircle } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mRes, meRes] = await Promise.all([
        fetch("/api/manufacturers"),
        fetch("/api/auth/me"),
      ]);
      if (meRes.ok) {
        const me = await meRes.json();
        setIsAdmin(me.role === "admin");
      }
      if (mRes.ok) {
        const manufacturers: Manufacturer[] = await mRes.json();
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
    setError(null);
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
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to add manufacturer. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and database.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setCreating(false);
    setNewName("");
    setError(null);
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/manufacturers/${id}`, { method: "DELETE" });
    await loadData();
  };

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6">
      {/* Page header */}
      <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-600">
            <BarChart3 className="h-3.5 w-3.5" />
            Manufacturers
          </div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            Pricing Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Manage manufacturers and their smart pricing sheets
          </p>
        </div>

        {/* Add manufacturer (admin only) */}
        {isAdmin && <div className="flex-shrink-0">
          {creating ? (
            <div className="flex flex-col gap-2 items-end">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Manufacturer name…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") handleCancel();
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 min-w-[200px]"
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newName.trim() || saving}
                  className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  {saving ? "Adding…" : "Add"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              </div>
              {error && (
                <p className="text-xs text-rose-500 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {error}
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold",
                "bg-cyan-500 text-white transition-all hover:bg-cyan-400",
                "shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              )}
            >
              <Plus className="h-4 w-4" />
              Add Manufacturer
            </button>
          )}
        </div>}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-cyan-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-gray-50 py-24 text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100 ring-1 ring-gray-200">
            <Factory className="h-9 w-9 text-gray-400" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-gray-700">
            No manufacturers yet
          </h3>
          <p className="mb-7 text-sm text-gray-500">
            {isAdmin ? "Add your first manufacturer to get started" : "No manufacturers have been added yet"}
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-white hover:bg-cyan-400 transition-all shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Add Manufacturer
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
