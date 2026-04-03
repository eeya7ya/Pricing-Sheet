"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  calculateRow,
  calculateTotals,
  type Constants,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";
import { GitCompare, Factory, ArrowRight } from "lucide-react";

interface ProductLine {
  id: number;
  position: number;
  itemModel: string;
  priceUsd: string;
  quantity: number;
}

interface RawConstants {
  currencyRate: string;
  shippingRate: string;
  customsRate: string;
  profitMargin: string;
  taxRate: string;
}

interface ProjectData {
  project: { id: number; name: string };
  constants: RawConstants | null;
  productLines: ProductLine[];
}

interface ManufacturerData {
  manufacturer: { id: number; name: string };
  projects: ProjectData[];
}

const MANUFACTURER_COLORS = [
  "#06b6d4",
  "#8b5cf6",
  "#22c55e",
  "#f59e0b",
  "#f43f5e",
  "#3b82f6",
];

function N(v: number) {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function computeSummary(data: ManufacturerData) {
  let grandFinalTotal = 0;
  let grandLandedTotal = 0;
  let totalProducts = 0;

  for (const { constants: c, productLines } of data.projects) {
    if (!c) continue;
    const constants: Constants = {
      currencyRate: parseFloat(c.currencyRate),
      shippingRate: parseFloat(c.shippingRate),
      customsRate: parseFloat(c.customsRate),
      profitMargin: parseFloat(c.profitMargin),
      taxRate: parseFloat(c.taxRate),
    };
    const active = productLines.filter((l) => parseFloat(l.priceUsd) > 0);
    totalProducts += active.length;
    const calcs = active.map((l) =>
      calculateRow(
        {
          itemModel: l.itemModel,
          priceUsd: parseFloat(l.priceUsd),
          quantity: l.quantity,
        },
        constants
      )
    );
    const totals = calculateTotals(calcs);
    grandFinalTotal += totals.finalPriceTotal;
    grandLandedTotal += totals.landedCostTotal;
  }

  return { grandFinalTotal, grandLandedTotal, totalProducts };
}

export default function ComparePage() {
  const [data, setData] = useState<ManufacturerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/compare");
        if (res.ok) {
          const d: ManufacturerData[] = await res.json();
          setData(d);
          // Select all by default
          setSelected(new Set(d.map((m) => m.manufacturer.id)));
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = data.filter((d) => selected.has(d.manufacturer.id));

  // Build comparison bar chart data
  const summaries = filtered.map((d, i) => {
    const { grandFinalTotal, grandLandedTotal } = computeSummary(d);
    return {
      name: d.manufacturer.name.length > 12
        ? d.manufacturer.name.slice(0, 12) + "…"
        : d.manufacturer.name,
      "Total Revenue (JOD)": parseFloat(grandFinalTotal.toFixed(2)),
      "Total Landed Cost (JOD)": parseFloat(grandLandedTotal.toFixed(2)),
      color: MANUFACTURER_COLORS[i % MANUFACTURER_COLORS.length],
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-slate-600 bg-slate-800 p-3 text-xs shadow-xl">
        <p className="mb-2 font-semibold text-slate-200">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: entry.color }}
              />
              <span className="text-slate-400">{entry.name}</span>
            </span>
            <span className="font-mono font-medium text-slate-200">
              {entry.value.toLocaleString()} JOD
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-400">
          <GitCompare className="h-3.5 w-3.5" />
          All Manufacturers
        </div>
        <h1 className="text-3xl font-bold text-slate-100">Comparison View</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Compare revenue and cost totals across all manufacturers
        </p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 py-20 text-center">
          <Factory className="mb-4 h-10 w-10 text-slate-600" />
          <p className="text-slate-400">No manufacturers yet</p>
          <Link
            href="/"
            className="mt-4 text-sm text-cyan-400 hover:text-cyan-300"
          >
            Go to Dashboard →
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Filter toggles */}
          <div className="flex flex-wrap gap-2">
            {data.map((d, i) => (
              <button
                key={d.manufacturer.id}
                onClick={() => {
                  const next = new Set(selected);
                  if (next.has(d.manufacturer.id)) {
                    next.delete(d.manufacturer.id);
                  } else {
                    next.add(d.manufacturer.id);
                  }
                  setSelected(next);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                  selected.has(d.manufacturer.id)
                    ? "ring-1 text-slate-100"
                    : "bg-slate-800 text-slate-500"
                )}
                style={
                  selected.has(d.manufacturer.id)
                    ? {
                        background: `${MANUFACTURER_COLORS[i % MANUFACTURER_COLORS.length]}18`,
                        border: `1px solid ${MANUFACTURER_COLORS[i % MANUFACTURER_COLORS.length]}50`,
                      }
                    : {}
                }
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: selected.has(d.manufacturer.id)
                      ? MANUFACTURER_COLORS[i % MANUFACTURER_COLORS.length]
                      : "#475569",
                  }}
                />
                {d.manufacturer.name}
              </button>
            ))}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((d, i) => {
              const { grandFinalTotal, grandLandedTotal, totalProducts } =
                computeSummary(d);
              const color = MANUFACTURER_COLORS[
                data.findIndex((x) => x.manufacturer.id === d.manufacturer.id) %
                  MANUFACTURER_COLORS.length
              ];
              return (
                <Link
                  key={d.manufacturer.id}
                  href={`/manufacturer/${d.manufacturer.id}`}
                  className={cn(
                    "group rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 transition-all",
                    "hover:border-slate-600 hover:bg-slate-800/70"
                  )}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                    >
                      <Factory className="h-4 w-4" style={{ color }} />
                    </div>
                    <ArrowRight
                      className="h-3.5 w-3.5 text-slate-600 transition-colors group-hover:text-slate-400"
                    />
                  </div>
                  <h3 className="mb-1 font-semibold text-slate-100">
                    {d.manufacturer.name}
                  </h3>
                  <div className="mb-3 text-xs text-slate-500">
                    {d.projects.length} projects · {totalProducts} products
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Landed Cost</span>
                      <span className="font-mono font-medium text-slate-300">
                        {N(grandLandedTotal)} JOD
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Total Revenue</span>
                      <span className="font-mono font-semibold" style={{ color }}>
                        {N(grandFinalTotal)} JOD
                      </span>
                    </div>
                    {grandLandedTotal > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Margin</span>
                        <span className="font-mono font-medium text-emerald-400">
                          {N(((grandFinalTotal - grandLandedTotal) / grandLandedTotal) * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Revenue comparison chart */}
          {summaries.length > 0 && (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-300">
                Revenue vs Landed Cost (JOD)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={summaries}
                  margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    axisLine={{ stroke: "#334155" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={{ stroke: "#334155" }}
                    tickLine={false}
                    width={70}
                    tickFormatter={(v) => v.toLocaleString()}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                  <Bar
                    dataKey="Total Revenue (JOD)"
                    fill="#06b6d4"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Total Landed Cost (JOD)"
                    fill="#475569"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-manufacturer detailed breakdown */}
          <div className="space-y-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
              Detailed Breakdown
            </h2>
            {filtered.map((d, idx) => {
              const color =
                MANUFACTURER_COLORS[
                  data.findIndex((x) => x.manufacturer.id === d.manufacturer.id) %
                    MANUFACTURER_COLORS.length
                ];

              return (
                <div
                  key={d.manufacturer.id}
                  className="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden"
                >
                  {/* Manufacturer header */}
                  <div
                    className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50"
                    style={{ borderLeft: `3px solid ${color}` }}
                  >
                    <div className="flex items-center gap-2">
                      <Factory className="h-4 w-4" style={{ color }} />
                      <span className="font-semibold text-slate-200">
                        {d.manufacturer.name}
                      </span>
                    </div>
                    <Link
                      href={`/manufacturer/${d.manufacturer.id}`}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Open Sheet
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>

                  {/* Projects table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700/30 bg-slate-800/50">
                          <th className="px-4 py-2.5 text-left text-slate-500 font-medium">Project</th>
                          <th className="px-4 py-2.5 text-right text-slate-500 font-medium">Products</th>
                          <th className="px-4 py-2.5 text-right text-slate-500 font-medium">Landed Cost</th>
                          <th className="px-4 py-2.5 text-right text-slate-500 font-medium">Revenue</th>
                          <th className="px-4 py-2.5 text-right text-slate-500 font-medium">Gross Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.projects.map(({ project, constants: c, productLines }) => {
                          if (!c) return null;
                          const constants: Constants = {
                            currencyRate: parseFloat(c.currencyRate),
                            shippingRate: parseFloat(c.shippingRate),
                            customsRate: parseFloat(c.customsRate),
                            profitMargin: parseFloat(c.profitMargin),
                            taxRate: parseFloat(c.taxRate),
                          };
                          const active = productLines.filter(
                            (l) => parseFloat(l.priceUsd) > 0
                          );
                          const calcs = active.map((l) =>
                            calculateRow(
                              {
                                itemModel: l.itemModel,
                                priceUsd: parseFloat(l.priceUsd),
                                quantity: l.quantity,
                              },
                              constants
                            )
                          );
                          const totals = calculateTotals(calcs);
                          const margin =
                            totals.landedCostTotal > 0
                              ? ((totals.finalPriceTotal - totals.landedCostTotal) /
                                  totals.landedCostTotal) *
                                100
                              : 0;

                          return (
                            <tr
                              key={project.id}
                              className="border-b border-slate-700/20 hover:bg-slate-700/10 transition-colors"
                            >
                              <td className="px-4 py-2.5 text-slate-300">{project.name}</td>
                              <td className="px-4 py-2.5 text-right text-slate-400">{active.length}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                                {N(totals.landedCostTotal)}
                              </td>
                              <td
                                className="px-4 py-2.5 text-right font-mono font-semibold"
                                style={{ color }}
                              >
                                {N(totals.finalPriceTotal)}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-emerald-400">
                                {N(margin)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
