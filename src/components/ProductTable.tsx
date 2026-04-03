"use client";

import { useState } from "react";
import {
  calculateRow,
  calculateTotals,
  type Constants,
  type ProductInput,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";
import { Copy, ClipboardPaste } from "lucide-react";

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
}

const CALC_COLUMNS: CalcColumn[] = [
  { label: "JOD Price", unitKey: "jodPrice", totalKey: "jodPriceTotal", color: "text-amber-600" },
  { label: "Shipping", unitKey: "shipping", totalKey: "shippingTotal", color: "text-blue-600" },
  { label: "Customs", unitKey: "customs", totalKey: "customsTotal", color: "text-purple-600" },
  { label: "Landed Cost", unitKey: "landedCost", totalKey: "landedCostTotal", color: "text-orange-600", highlight: true },
  { label: "Profit", unitKey: "profit", totalKey: "profitTotal", color: "text-emerald-600" },
  { label: "Pre-Tax Price", unitKey: "preTaxPrice", totalKey: "preTaxPriceTotal", color: "text-teal-600" },
  { label: "Tax", unitKey: "tax", totalKey: "taxTotal", color: "text-rose-600" },
  { label: "Final Price", unitKey: "finalPrice", totalKey: "finalPriceTotal", color: "text-cyan-600", highlight: true },
];

type InputField = "itemModel" | "priceUsd" | "quantity";

export function ProductTable({ rows, constants, onChange }: Props) {
  const [copiedCol, setCopiedCol] = useState<InputField | null>(null);

  const calculated = rows.map((r) => ({
    ...r,
    ...calculateRow(r, constants),
  }));
  const totals = calculateTotals(calculated);

  const updateRow = (index: number, field: keyof ProductInput, value: string | number) => {
    const updated = rows.map((r, i) =>
      i === index ? { ...r, [field]: value } : r
    );
    onChange(updated);
  };

  const copyColumn = async (field: InputField) => {
    const values = rows.map((r) => String(r[field])).join("\n");
    await navigator.clipboard.writeText(values);
    setCopiedCol(field);
    setTimeout(() => setCopiedCol(null), 1500);
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
      if (field === "priceUsd") parsed = parseFloat(val) || 0;
      if (field === "quantity") parsed = parseInt(val) || 1;

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
    <span className="ml-1.5 inline-flex gap-0.5">
      <button
        title="Copy column"
        onClick={() => copyColumn(field)}
        className={cn(
          "rounded p-0.5 transition-colors",
          copiedCol === field
            ? "text-emerald-500"
            : "text-gray-400 hover:text-gray-700 hover:bg-gray-200"
        )}
      >
        <Copy size={11} />
      </button>
      <button
        title="Paste column"
        onClick={() => pasteColumn(field)}
        className="rounded p-0.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
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
            <th className="sticky left-10 z-10 bg-gray-50 px-3 py-3 text-left font-semibold text-gray-500 whitespace-nowrap min-w-[140px]">
              Item Model
              <ColActions field="itemModel" />
            </th>
            <th className="px-3 py-3 text-right font-semibold text-gray-500 whitespace-nowrap min-w-[90px]">
              USD Price
              <ColActions field="priceUsd" />
            </th>
            <th className="px-3 py-3 text-center font-semibold text-gray-500 whitespace-nowrap min-w-[70px]">
              Qty
              <ColActions field="quantity" />
            </th>
            {/* Calculated columns (each has /Unit and Total) */}
            {CALC_COLUMNS.map((col) => (
              <th
                key={col.label}
                colSpan={2}
                className={cn(
                  "border-l border-gray-100 px-3 py-3 text-center font-semibold whitespace-nowrap",
                  col.highlight ? "bg-gray-100 text-gray-800" : "text-gray-500"
                )}
              >
                {col.label}
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
                  className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-center font-mono text-gray-800 transition-colors focus:border-gray-300 focus:bg-gray-50 focus:outline-none"
                />
              </td>
              {/* Calculated columns */}
              {CALC_COLUMNS.map((col) => (
                <>
                  <td
                    key={`${col.label}-unit`}
                    className={cn(
                      "border-l border-gray-100 px-3 py-2.5 text-right font-mono whitespace-nowrap",
                      col.color,
                      col.highlight && "bg-gray-50"
                    )}
                  >
                    {row.priceUsd ? N((row as any)[col.unitKey]) : "—"}
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
              ))}
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
