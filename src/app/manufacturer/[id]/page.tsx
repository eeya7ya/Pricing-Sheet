"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Factory, Pencil, Check, X } from "lucide-react";
import { PricingSheet } from "@/components/PricingSheet";
import { cn } from "@/lib/utils";

interface Manufacturer {
  id: number;
  name: string;
}

export default function ManufacturerPage() {
  const params = useParams();
  const router = useRouter();
  const id = parseInt(params.id as string);

  const [manufacturer, setManufacturer] = useState<Manufacturer | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/manufacturers/${id}`);
        if (!res.ok) {
          router.push("/");
          return;
        }
        const data = await res.json();
        setManufacturer(data);
        setEditName(data.name);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSaveName = async () => {
    if (!editName.trim() || !manufacturer) return;
    const res = await fetch(`/api/manufacturers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (res.ok) {
      const updated = await res.json();
      setManufacturer(updated);
    }
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
      </div>
    );
  }

  if (!manufacturer) return null;

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link
          href="/"
          className="flex items-center gap-1 text-slate-500 transition-colors hover:text-slate-300"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        <span className="text-slate-700">/</span>
        <span className="text-slate-300">{manufacturer.name}</span>
      </div>

      {/* Page header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20">
          <Factory className="h-5 w-5 text-cyan-400" />
        </div>

        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") {
                  setEditing(false);
                  setEditName(manufacturer.name);
                }
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-lg font-bold text-slate-100 focus:border-cyan-500/60 focus:outline-none"
            />
            <button
              onClick={handleSaveName}
              className="rounded-md p-1.5 text-emerald-400 hover:bg-slate-800"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEditName(manufacturer.name);
              }}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-100">{manufacturer.name}</h1>
            <button
              onClick={() => setEditing(true)}
              className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-800 hover:text-slate-400"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Pricing sheet */}
      <PricingSheet
        manufacturerId={id}
        manufacturerName={manufacturer.name}
      />
    </div>
  );
}
