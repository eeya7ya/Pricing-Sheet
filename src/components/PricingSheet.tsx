"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Save, RefreshCw } from "lucide-react";
import { ProjectSelector } from "./ProjectSelector";
import { ConstantsPanel } from "./ConstantsPanel";
import { ProductTable } from "./ProductTable";
import { PricingCharts } from "./PricingCharts";
import { type Constants, DEFAULT_CONSTANTS } from "@/lib/calculations";
import { cn } from "@/lib/utils";

interface Project {
  id: number;
  name: string;
}

interface ProductRow {
  id: number;
  position: number;
  itemModel: string;
  priceUsd: number;
  quantity: number;
}

interface Props {
  manufacturerId: number;
  manufacturerName: string;
}

export function PricingSheet({ manufacturerId, manufacturerName }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [constants, setConstants] = useState<Constants>(DEFAULT_CONSTANTS);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load projects list
  const loadProjects = useCallback(async () => {
    const res = await fetch(`/api/projects?manufacturerId=${manufacturerId}`);
    if (res.ok) {
      const data = await res.json();
      setProjects(data);
      // Auto-select first project if none selected
      if (data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data[0].id);
      }
    }
  }, [manufacturerId, selectedProjectId]);

  useEffect(() => {
    loadProjects();
  }, [manufacturerId]);

  // Load project data when selection changes
  useEffect(() => {
    if (!selectedProjectId) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${selectedProjectId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.constants) {
          setConstants({
            currencyRate: parseFloat(data.constants.currencyRate),
            shippingRate: parseFloat(data.constants.shippingRate),
            customsRate: parseFloat(data.constants.customsRate),
            profitMargin: parseFloat(data.constants.profitMargin),
            taxRate: parseFloat(data.constants.taxRate),
          });
        }

        if (data.productLines) {
          setRows(
            data.productLines.map((l: any) => ({
              id: l.id,
              position: l.position,
              itemModel: l.itemModel,
              priceUsd: parseFloat(l.priceUsd),
              quantity: l.quantity,
            }))
          );
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [selectedProjectId]);

  // Auto-save with debounce
  const scheduleSave = useCallback(() => {
    if (!selectedProjectId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`/api/projects/${selectedProjectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ constants, productLines: rows }),
        });
        setSavedAt(new Date());
      } finally {
        setSaving(false);
      }
    }, 800);
  }, [selectedProjectId, constants, rows]);

  // Trigger auto-save when data changes
  useEffect(() => {
    if (!loading && selectedProjectId) {
      scheduleSave();
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [constants, rows]);

  const handleCreateProject = async (name: string) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, manufacturerId }),
    });
    if (res.ok) {
      const project = await res.json();
      await loadProjects();
      setSelectedProjectId(project.id);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ProjectSelector
            projects={projects}
            selectedId={selectedProjectId}
            onSelect={setSelectedProjectId}
            onCreateNew={handleCreateProject}
          />
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Saving…
            </span>
          )}
          {!saving && savedAt && (
            <span className="text-xs text-slate-600">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {!selectedProjectId ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-700">
          <div className="text-center">
            <p className="text-sm text-slate-400">No project selected</p>
            <p className="mt-1 text-xs text-slate-600">
              Use the dropdown above to select or create a project
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
        </div>
      ) : (
        <>
          {/* Constants */}
          <ConstantsPanel
            constants={constants}
            onChange={setConstants}
            saving={saving}
          />

          {/* Product table */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Product Lines
            </h3>
            <ProductTable
              rows={rows}
              constants={constants}
              onChange={setRows}
            />
          </div>

          {/* Charts */}
          <PricingCharts rows={rows} constants={constants} />
        </>
      )}
    </div>
  );
}
