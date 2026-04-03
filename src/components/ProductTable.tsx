"use client";

import { useState } from "react";
import {
  calculateRow,
  calculateTotals,
  type Constants,
  type ProductInput,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";
import { Copy, ClipboardPaste, Lock, Unlock } from "lucide-react";

interface Row extends ProductInput {
  id: number;
  position: number;
}

interface Props {
  rows: Row[];
  constants: Constants;
  onChange: (rows: Row[]) => void;
}

function N(v: number) {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

interface CalcColumn {
  label: string;
  unitKey: string;
  totalKey: string;
  color: string;
  highlight?: boolean;
  copyable?: boolean;
}

const CALC_COLUMNS: CalcColumn[] = [
  { label: "JOD Price", unitKey: "jodPrice", totalKey: "jodPriceTotal", color: "text-amber-600" },
  { label: "Shipping", unitKey: "shipping", totalKey: "shippingTotal", color: "text-blue-600" },
  { label: "Customs", unitKey: "customs", totalKey: "customsTotal", color: "text-purple-600" },
  { label: "Landed Cost", unitKey: "landedCost", totalKey: "landedCostTotal", color: "text-orange-600", highlight: true },
  { label: "Profit", unitKey: "profit", totalKey: "profitTotal", color: "text-emerald-600" },
  { label: "Pre-Tax Price", unitKey: "preTaxPrice", totalKey: "preTaxPriceTotal", color: "text-teal-600", copyable: true },
  { label: "Tax", unitKey: "tax", totalKey: "taxTotal", color: "text-rose-600" },
  { label: "Final Price", unitKey: "finalPrice", totalKey: "finalPriceTotal", color: "text-cyan-600", highlight: true, copyable: true },
];

type InputField = "itemModel" | "priceUsd" | "quantity";
type OverrideField = "shippingOverride" | "customsOverride";

export function ProductTable({ rows, constants, onChange }: Props) {
  const [copiedCol, setCopiedCol] = useState<InputField | null>(null);
  const [copiedCalcCol, setCopiedCalcCol] = useState<string | null>(null);

  const calculated = rows.map((r) => ({
    ...r,
    ...calculateRow(r, constants),
  }));
  const totals = calculateTotals(calculated);

  const updateRow = (index: number, field: keyof Row, value: string | number | null) => {
    const updated = rows.map((r, i) =>
      i === index ? { ...r, [field]: value } : r
    );
    onChange(updated);
  };

  const toggleOverride = (index: number, field: OverrideField, currentCalculatedValue: number) => {
    const row = rows[index];
    const currentOverride = row[field];
    if (currentOverride != null) {
      // Lock: clear the override
      updateRow(index, field, null);
    } else {
      // Unlock: seed with current calculated value
      updateRow(index, field, parseFloat(currentCalculatedValue.toFixed(4)));
    }
  };

  const copyColumn = async (field: InputField) => {
    const values = rows.map((r) => String(r[field])).join("\n");
    await navigator.clipboard.writeText(values);
    setCopiedCol(field);
    setTimeout(() => setCopiedCol(null), 1500);
  };

  const copyCalcColumn = async (unitKey: string) => {
    const values = calculated.map((r) => N((r as any)[unitKey])).join("\n");
    await navigator.clipboard.writeText(values);
    setCopiedCalcCol(unitKey);
    setTimeout(() => setCopiedCalcCol(null), 1500);
  };

  const pasteColumn = async (field: InputField) => {
    const text = await navigator.clipboard.readText();
    const values = text
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter((v) => v !== "");

    if (values.length === 0) return;

    const updated = [...rows];

    values.forEach((val, i) => {
      let parsed: string | number = val;
      if (field === "priceUsd") {
        const clean = val.replace(/[^0-9.]/g, "");
        parsed = parseFloat(clean) || 0;
      }
      if (field === "quantity") {
        const clean = val.replace(/[^0-9]/g, "");
        parsed = parseInt(clean) || 1;
      }

      if (i < updated.length) {
        updated[i] = { ...updated[i], [field]: parsed };
      } else {
        updated.push({
          id: Date.now() + i,
          position: updated.length + 1,
          itemModel: field === "itemModel" ? String(parsed) : "",
          priceUsd: field === "priceUsd" ? Number(parsed) : 0,
          quantity: field === "quantity" ? Number(parsed) : 1,
        });
      }
    });

    onChange(updated);
  };

  const ColActions = ({ field }: { field: InputField }) => (
    <span className="ml-1.5 inline-flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        title="Copy column"
        onClick={() => copyColumn(field)}
        className={cn(
          "rounded p-0.5 transition-colors",
          copiedCol === field
            ? "text-emerald-600"
            : "text-gray-400 hover:text-gray-600 hover:bg-gray-200"
        )}
      >
        <Copy size={11} />
      </button>
      <button
        title="Paste column"
        onClick={() => pasteColumn(field)}
        className="rounded p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
      >
        <ClipboardPaste size={11} />
      </button>
    </span>
  );

  return (
    <div className="table-container rounded-xl border border-gray-200 bg-white">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            {/* Fixed input columns */}
            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-3 text-left font-semibold text-gray-500 whitespace-nowrap min-w-[40px]">
              #
            </th>
            <th className="group sticky left-10 z-10 bg-gray-50 px-3 py-3 text-left font-semibold text-gray-500 whitespace-nowrap min-w-[140px]">
              Item Model
              <ColActions field="itemModel" />
            </th>
            <th className="group px-3 py-3 text-right font-semibold text-gray-500 whitespace-nowrap min-w-[90px]">
              USD Price
              <ColActions field="priceUsd" />
            </th>
            <th className="group px-3 py-3 text-center font-semibold text-gray-500 whitespace-nowrap min-w-[70px]">
              Qty
              <ColActions field="quantity" />
            </th>
            {/* Calculated columns (each has /Unit and Total) */}
            {CALC_COLUMNS.map((col) => (
              <th
                key={col.label}
                colSpan={2}
                className={cn(
                  "group border-l border-gray-100 px-3 py-3 text-center font-semibold whitespace-nowrap",
                  col.highlight ? "bg-gray-100 text-gray-800" : "text-gray-500"
                )}
              >
                {col.label}
                {col.copyable && (
                  <span className="ml-1.5 inline-flex opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      title="Copy column (/unit values)"
                      onClick={() => copyCalcColumn(col.unitKey)}
                      className={cn(
                        "rounded p-0.5 transition-colors",
                        copiedCalcCol === col.unitKey
                          ? "text-emerald-600"
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      <Copy size={11} />
                    </button>
                  </span>
                )}
              </th>
            ))}
          </tr>
          {/* Sub-header for /Unit and Total */}
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="sticky left-0 z-10 bg-gray-50" />
            <th className="sticky left-10 z-10 bg-gray-50" />
            <th className="px-3 pb-2 text-right text-gray-400 text-[10px]">per unit</th>
            <th className="px-3 pb-2 text-center text-gray-400 text-[10px]" />
            {CALC_COLUMNS.map((col) => (
              <>
                <th
                  key={`${col.label}-unit`}
                  className={cn(
                    "border-l border-gray-100 px-3 pb-2 text-right text-[10px] text-gray-400",
                    col.highlight && "bg-gray-100"
                  )}
                >
                  /unit
                </th>
                <th
                  key={`${col.label}-total`}
                  className={cn(
                    "px-3 pb-2 text-right text-[10px] text-gray-400",
                    col.highlight && "bg-gray-100"
                  )}
                >
                  total
                </th>
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          {calculated.map((row, i) => (
            <tr
              key={row.id}
              className={cn(
                "border-b border-gray-100 transition-colors",
                "hover:bg-gray-50",
                !row.itemModel && !row.priceUsd && "opacity-60"
              )}
            >
              {/* Row number */}
              <td className="sticky left-0 z-10 bg-white px-3 py-2.5 text-center font-medium text-gray-400">
                {row.position}
              </td>
              {/* Item Model */}
              <td className="sticky left-10 z-10 bg-white px-2 py-1.5">
                <input
                  type="text"
                  placeholder="Item model…"
                  value={row.itemModel}
                  onChange={(e) => updateRow(i, "itemModel", e.target.value)}
                  className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-gray-800 placeholder-gray-300 transition-colors focus:border-gray-300 focus:bg-gray-50 focus:outline-none"
                />
              </td>
              {/* USD Price */}
              <td className="px-2 py-1.5">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.priceUsd || ""}
                  placeholder="0.00"
                  onChange={(e) =>
                    updateRow(i, "priceUsd", parseFloat(e.target.value) || 0)
                  }
                  onPaste={(e) => {
                    e.preventDefault();
                    const raw = e.clipboardData.getData("text");
                    const clean = raw.replace(/[^0-9.]/g, "");
                    updateRow(i, "priceUsd", parseFloat(clean) || 0);
                  }}
                  className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-right font-mono text-gray-800 placeholder-gray-300 transition-colors focus:border-gray-300 focus:bg-gray-50 focus:outline-none"
                />
              </td>
              {/* Quantity */}
              <td className="px-2 py-1.5">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={row.quantity}
                  onChange={(e) =>
                    updateRow(i, "quantity", parseInt(e.target.value) || 1)
                  }
                  onPaste={(e) => {
                    e.preventDefault();
                    const raw = e.clipboardData.getData("text");
                    const clean = raw.replace(/[^0-9]/g, "");
                    updateRow(i, "quantity", parseInt(clean) || 1);
                  }}
                  className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-center font-mono text-gray-800 transition-colors focus:border-gray-300 focus:bg-gray-50 focus:outline-none"
                />
              </td>
              {/* Calculated columns */}
              {CALC_COLUMNS.map((col) => {
                const isShipping = col.unitKey === "shipping";
                const isCustoms = col.unitKey === "customs";
                const overrideField: OverrideField | null = isShipping
                  ? "shippingOverride"
                  : isCustoms
                  ? "customsOverride"
                  : null;
                const isOverridden = isShipping
                  ? row.shippingIsOverridden
                  : isCustoms
                  ? row.customsIsOverridden
                  : false;
                const overrideValue = overrideField ? (rows[i][overrideField] ?? null) : null;
                const calcValue = row.priceUsd ? (row as any)[col.unitKey] : null;

                return (
                  <>
                    <td
                      key={`${col.label}-unit`}
                      className={cn(
                        "border-l border-gray-100 px-2 py-1.5 text-right font-mono whitespace-nowrap",
                        col.color,
                        col.highlight && "bg-gray-50",
                        overrideField && "group/cell"
                      )}
                    >
                      {overrideField ? (
                        <div className="flex items-center justify-end gap-1">
                          {isOverridden ? (
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={overrideValue ?? ""}
                              onChange={(e) =>
                                updateRow(i, overrideField, parseFloat(e.target.value) || 0)
                              }
                              className={cn(
                                "w-24 rounded border bg-white px-1.5 py-0.5 text-right font-mono text-xs focus:outline-none",
                                isShipping
                                  ? "border-blue-300 text-blue-700 focus:border-blue-400"
                                  : "border-purple-300 text-purple-700 focus:border-purple-400"
                              )}
                            />
                          ) : (
                            <span className={row.priceUsd ? col.color : "text-gray-300"}>
                              {calcValue != null ? N(calcValue) : "—"}
                            </span>
                          )}
                          <button
                            title={isOverridden ? "Lock (use calculated value)" : "Unlock to override"}
                            onClick={() =>
                              toggleOverride(i, overrideField, calcValue ?? 0)
                            }
                            className={cn(
                              "rounded p-0.5 transition-colors flex-shrink-0",
                              isOverridden
                                ? isShipping
                                  ? "text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                  : "text-purple-500 hover:text-purple-700 hover:bg-purple-50"
                                : "text-gray-300 hover:text-gray-500 hover:bg-gray-100 opacity-0 group-hover/cell:opacity-100"
                            )}
                          >
                            {isOverridden ? <Unlock size={10} /> : <Lock size={10} />}
                          </button>
                        </div>
                      ) : (
                        <span>{row.priceUsd ? N((row as any)[col.unitKey]) : "—"}</span>
                      )}
                    </td>
                    <td
                      key={`${col.label}-total`}
                      className={cn(
                        "px-3 py-2.5 text-right font-mono whitespace-nowrap text-gray-500",
                        col.highlight && "bg-gray-50 !text-gray-800 font-medium"
                      )}
                    >
                      {row.priceUsd ? N((row as any)[col.totalKey]) : "—"}
                    </td>
                  </>
                );
              })}
            </tr>
          ))}
        </tbody>
        {/* Totals row */}
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50">
            <td className="sticky left-0 z-10 bg-gray-100 px-3 py-3 text-center" />
            <td className="sticky left-10 z-10 bg-gray-100 px-3 py-3 text-sm font-bold text-gray-700">
              TOTALS
            </td>
            <td className="px-3 py-3" />
            <td className="px-3 py-3" />
            {CALC_COLUMNS.map((col) => (
              <>
                <td
                  key={`total-${col.label}-unit`}
                  className={cn(
                    "border-l border-gray-100 px-3 py-3",
                    col.highlight && "bg-gray-100"
                  )}
                />
                <td
                  key={`total-${col.label}-total`}
                  className={cn(
                    "px-3 py-3 text-right font-mono font-bold whitespace-nowrap",
                    col.highlight ? "bg-gray-100 text-cyan-600 text-sm" : "text-gray-700"
                  )}
                >
                  {N((totals as any)[col.totalKey])}
                </td>
              </>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
