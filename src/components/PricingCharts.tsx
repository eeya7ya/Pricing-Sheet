"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import {
  calculateRow,
  calculateTotals,
  type Constants,
  type ProductInput,
} from "@/lib/calculations";

interface Row extends ProductInput {
  position: number;
}

interface Props {
  rows: Row[];
  constants: Constants;
}

const COLORS = {
  jodPrice:   "#d97706",
  shipping:   "#2563eb",
  customs:    "#7c3aed",
  landedCost: "#ea580c",
  profit:     "#16a34a",
  tax:        "#e11d48",
  finalPrice: "#0891b2",
};

function fmtJod(v: number) {
  return v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="mb-1 text-xs font-medium text-gray-500">{label}</p>
      <p className="text-xl font-bold leading-tight" style={{ color }}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Shared tooltip ────────────────────────────────────────────────────────────
const JodTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-lg">
      <p className="mb-2 font-semibold text-gray-800">{label}</p>
      {payload
        .filter((e: any) => e.dataKey !== "base" && e.value !== 0)
        .map((e: any) => (
          <div key={e.dataKey} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: e.color }} />
              <span className="text-gray-500">{e.name}</span>
            </span>
            <span className="font-mono font-medium text-gray-800">
              {fmtJod(e.value)} JOD
            </span>
          </div>
        ))}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export function PricingCharts({ rows, constants }: Props) {
  const activeRows = rows.filter((r) => r.priceUsd > 0 && r.itemModel);

  if (activeRows.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
        Enter product data above to see visualizations
      </div>
    );
  }

  const calculated = activeRows.map((r) => ({ ...r, ...calculateRow(r, constants) }));
  const totals = calculateTotals(calculated);

  const totalItems = activeRows.reduce((s, r) => s + r.quantity, 0);
  const marginPct =
    totals.finalPriceTotal > 0
      ? (totals.profitTotal / totals.finalPriceTotal) * 100
      : 0;

  // ── Waterfall — accumulative cost buildup ──────────────────────────────────
  // Each non-milestone bar floats above its predecessor using an invisible base.
  const waterfallData = [
    {
      name: "JOD Base",
      base: 0,
      value: totals.jodPriceTotal,
      color: COLORS.jodPrice,
    },
    {
      name: "+ Shipping",
      base: totals.jodPriceTotal,
      value: totals.shippingTotal,
      color: COLORS.shipping,
    },
    {
      name: "+ Customs",
      base: totals.jodPriceTotal + totals.shippingTotal,
      value: totals.customsTotal,
      color: COLORS.customs,
    },
    {
      name: "Landed Cost",
      base: 0,
      value: totals.landedCostTotal,
      color: COLORS.landedCost,
      milestone: true,
    },
    {
      name: "+ Profit",
      base: totals.landedCostTotal,
      value: totals.profitTotal,
      color: COLORS.profit,
    },
    {
      name: "+ Tax",
      base: totals.preTaxPriceTotal,
      value: totals.taxTotal,
      color: COLORS.tax,
    },
    {
      name: "Final Revenue",
      base: 0,
      value: totals.finalPriceTotal,
      color: COLORS.finalPrice,
      milestone: true,
    },
  ];

  // ── Donut — totals composition ─────────────────────────────────────────────
  const donutData = [
    { name: "JOD Base", value: totals.jodPriceTotal,  color: COLORS.jodPrice  },
    { name: "Shipping",  value: totals.shippingTotal,  color: COLORS.shipping  },
    { name: "Customs",   value: totals.customsTotal,   color: COLORS.customs   },
    { name: "Profit",    value: totals.profitTotal,    color: COLORS.profit    },
    { name: "Tax",       value: totals.taxTotal,       color: COLORS.tax       },
  ];

  // ── Product contribution — sorted by total revenue ─────────────────────────
  const contributionData = [...calculated]
    .sort((a, b) => b.finalPriceTotal - a.finalPriceTotal)
    .map((r) => ({
      name: r.itemModel.length > 18 ? r.itemModel.slice(0, 18) + "…" : r.itemModel,
      revenue: parseFloat(r.finalPriceTotal.toFixed(3)),
      pct: parseFloat(
        ((r.finalPriceTotal / totals.finalPriceTotal) * 100).toFixed(1)
      ),
    }));

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Analysis
      </h3>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total Revenue"
          value={`${fmtJod(totals.finalPriceTotal)} JOD`}
          sub={`across ${totalItems} unit${totalItems !== 1 ? "s" : ""}`}
          color={COLORS.finalPrice}
        />
        <KpiCard
          label="Total Landed Cost"
          value={`${fmtJod(totals.landedCostTotal)} JOD`}
          sub="before markup"
          color={COLORS.landedCost}
        />
        <KpiCard
          label="Total Gross Profit"
          value={`${fmtJod(totals.profitTotal)} JOD`}
          sub="after all costs"
          color={COLORS.profit}
        />
        <KpiCard
          label="Net Margin"
          value={`${marginPct.toFixed(1)}%`}
          sub="profit ÷ revenue"
          color="#7c3aed"
        />
      </div>

      {/* ── Waterfall + Donut ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Accumulative waterfall */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-1 text-xs font-medium text-gray-500">
            Accumulative Cost Buildup — all products combined (JOD)
          </p>
          <p className="mb-3 text-[10px] text-gray-400">
            Milestone bars (Landed Cost, Final Revenue) show the full running total at that stage.
          </p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={waterfallData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
                width={62}
                tickFormatter={(v) => v.toLocaleString()}
              />
              <Tooltip content={<JodTooltip />} />
              {/* Invisible offset bar — creates the floating waterfall effect */}
              <Bar dataKey="base" stackId="w" fill="transparent" legendType="none" />
              <Bar dataKey="value" stackId="w" radius={[4, 4, 0, 0]} name="JOD">
                {waterfallData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.color}
                    opacity={entry.milestone ? 1 : 0.82}
                    stroke={entry.milestone ? entry.color : "none"}
                    strokeWidth={entry.milestone ? 2 : 0}
                  />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(v: number) => fmtJod(v)}
                  style={{ fill: "#475569", fontSize: 9 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue composition donut (totals, not averages) */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-1 text-xs font-medium text-gray-500">
            Revenue Composition
          </p>
          <p className="mb-3 text-[10px] text-gray-400">Totals across all products</p>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="44%"
                innerRadius={62}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {donutData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => [`${fmtJod(v)} JOD`, ""]}
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, color: "#64748b" }}
                iconType="circle"
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Product Revenue Contribution — only when >1 product ───────────── */}
      {contributionData.length > 1 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-1 text-xs font-medium text-gray-500">
            Revenue by Product (sorted high → low)
          </p>
          <p className="mb-3 text-[10px] text-gray-400">
            Final selling price × quantity — percentage of total project revenue shown at right
          </p>
          <ResponsiveContainer
            width="100%"
            height={Math.max(160, contributionData.length * 38)}
          >
            <BarChart
              data={contributionData}
              layout="vertical"
              margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
                tickFormatter={(v) => v.toLocaleString()}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#475569", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={110}
              />
              <Tooltip
                formatter={(v: number) => [`${fmtJod(v)} JOD`, "Revenue"]}
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              <Bar dataKey="revenue" fill={COLORS.finalPrice} radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="pct"
                  position="right"
                  formatter={(v: number) => `${v}%`}
                  style={{ fill: "#64748b", fontSize: 10 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
