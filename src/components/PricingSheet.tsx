"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Plus, Trash2, Download, FileSpreadsheet, Printer } from "lucide-react";
import { ProjectSelector } from "./ProjectSelector";
import { ConstantsPanel } from "./ConstantsPanel";
import { ProductTable } from "./ProductTable";
import { PricingCharts } from "./PricingCharts";
import { type Constants, DEFAULT_CONSTANTS } from "@/lib/calculations";
import { exportToCsv, exportToPrint } from "@/lib/export";

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
  shippingOverride?: number | null;
  customsOverride?: number | null;
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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load projects list
  const loadProjects = useCallback(async () => {
    const res = await fetch(`/api/projects?manufacturerId=${manufacturerId}`);
    if (res.ok) {
      const data = await res.json();
      setProjects(data);
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
              shippingOverride: l.shippingOverride != null ? parseFloat(l.shippingOverride) : null,
              customsOverride: l.customsOverride != null ? parseFloat(l.customsOverride) : null,
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

  const handleAddRow = () => {
    const newRow: ProductRow = {
      id: Date.now(),
      position: rows.length + 1,
      itemModel: "",
      priceUsd: 0,
      quantity: 1,
    };
    setRows([...rows, newRow]);
  };

  const handleClearRows = () => {
    if (rows.length === 0) return;
    if (confirm("Clear all product rows?")) {
      setRows([]);
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleExportCsv = () => {
    if (!selectedProject || rows.length === 0) return;
    exportToCsv(rows, constants, selectedProject.name, manufacturerName);
    setShowExportMenu(false);
  };

  const handleExportPrint = () => {
    if (!selectedProject || rows.length === 0) return;
    exportToPrint(rows, constants, selectedProject.name, manufacturerName);
    setShowExportMenu(false);
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
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Saving…
            </span>
          )}
          {!saving && savedAt && (
            <span className="text-xs text-gray-400">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Export button */}
        {selectedProjectId && rows.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={handleExportPrint}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <Printer className="h-3.5 w-3.5 text-gray-400" />
                    Print / Save as PDF
                  </button>
                  <button
                    onClick={handleExportCsv}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-gray-400" />
                    Export as CSV
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {!selectedProjectId ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-300">
          <div className="text-center">
            <p className="text-sm text-gray-500">No project selected</p>
            <p className="mt-1 text-xs text-gray-400">
              Use the dropdown above to select or create a project
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-cyan-500" />
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
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Product Lines
              </h3>
              <div className="flex items-center gap-2">
                {rows.length > 0 && (
                  <button
                    onClick={handleClearRows}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear
                  </button>
                )}
                <button
                  onClick={handleAddRow}
                  className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-cyan-400"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Row
                </button>
              </div>
            </div>
            {rows.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-gray-200">
                <div className="text-center">
                  <p className="text-sm text-gray-400">No products yet</p>
                  <button
                    onClick={handleAddRow}
                    className="mt-2 flex items-center gap-1.5 mx-auto rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-cyan-400"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Row
                  </button>
                </div>
              </div>
            ) : (
              <ProductTable
                rows={rows}
                constants={constants}
                onChange={setRows}
              />
            )}
          </div>

          {/* Charts */}
          <PricingCharts rows={rows} constants={constants} />
        </>
      )}
    </div>
  );
}
