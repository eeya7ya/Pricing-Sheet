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
} from "recharts";
import { calculateRow, type Constants, type ProductInput } from "@/lib/calculations";

interface Row extends ProductInput {
  position: number;
}

interface Props {
  rows: Row[];
  constants: Constants;
}

const COLORS = {
  jodPrice: "#d97706",
  shipping: "#2563eb",
  customs: "#7c3aed",
  profit: "#16a34a",
  tax: "#e11d48",
  finalPrice: "#0891b2",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-lg">
      <p className="mb-2 font-semibold text-gray-800">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="text-gray-500">{entry.name}</span>
          </span>
          <span className="font-mono font-medium text-gray-800">
            {entry.value.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} JOD
          </span>
        </div>
      ))}
    </div>
  );
};

export function PricingCharts({ rows, constants }: Props) {
  const activeRows = rows.filter((r) => r.priceUsd > 0 && r.itemModel);

  if (activeRows.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">
        Enter product data above to see visualizations
      </div>
    );
  }

  const calculated = activeRows.map((r) => ({
    ...r,
    ...calculateRow(r, constants),
  }));

  // Bar chart data — cost breakdown per product
  const barData = calculated.map((r) => ({
    name: r.itemModel.length > 12 ? r.itemModel.slice(0, 12) + "…" : r.itemModel,
    "JOD Base": parseFloat(r.jodPrice.toFixed(3)),
    "Shipping": parseFloat(r.shipping.toFixed(3)),
    "Customs": parseFloat(r.customs.toFixed(3)),
    "Profit": parseFloat(r.profit.toFixed(3)),
    "Tax": parseFloat(r.tax.toFixed(3)),
  }));

  // Final price comparison
  const finalPriceData = calculated.map((r) => ({
    name: r.itemModel.length > 12 ? r.itemModel.slice(0, 12) + "…" : r.itemModel,
    "Final Price/Unit": parseFloat(r.finalPrice.toFixed(3)),
    "Total Revenue": parseFloat(r.finalPriceTotal.toFixed(3)),
  }));

  // Pie data — average cost composition
  const avgCalc = calculated.reduce(
    (acc, r) => ({
      jod: acc.jod + r.jodPrice,
      ship: acc.ship + r.shipping,
      cust: acc.cust + r.customs,
      profit: acc.profit + r.profit,
      tax: acc.tax + r.tax,
    }),
    { jod: 0, ship: 0, cust: 0, profit: 0, tax: 0 }
  );
  const n = calculated.length;
  const pieData = [
    { name: "JOD Base", value: parseFloat((avgCalc.jod / n).toFixed(3)), color: COLORS.jodPrice },
    { name: "Shipping", value: parseFloat((avgCalc.ship / n).toFixed(3)), color: COLORS.shipping },
    { name: "Customs", value: parseFloat((avgCalc.cust / n).toFixed(3)), color: COLORS.customs },
    { name: "Profit", value: parseFloat((avgCalc.profit / n).toFixed(3)), color: COLORS.profit },
    { name: "Tax", value: parseFloat((avgCalc.tax / n).toFixed(3)), color: COLORS.tax },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Visualizations
      </h3>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Cost Breakdown Stacked Bar */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-xs font-medium text-gray-500">
            Cost Breakdown per Product (JOD / unit)
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
                width={55}
                tickFormatter={(v) => v.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
              <Bar dataKey="JOD Base" stackId="a" fill={COLORS.jodPrice} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Shipping" stackId="a" fill={COLORS.shipping} />
              <Bar dataKey="Customs" stackId="a" fill={COLORS.customs} />
              <Bar dataKey="Profit" stackId="a" fill={COLORS.profit} />
              <Bar dataKey="Tax" stackId="a" fill={COLORS.tax} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart — avg composition */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-xs font-medium text-gray-500">
            Avg Cost Composition
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(3)} JOD`, ""]}
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelStyle={{ color: "#475569" }}
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

      {/* Final price comparison */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-3 text-xs font-medium text-gray-500">
          Final Selling Price Comparison (JOD)
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={finalPriceData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 10 }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
              width={65}
              tickFormatter={(v) => v.toLocaleString()}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
            <Bar dataKey="Final Price/Unit" fill="#0891b2" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Total Revenue" fill="#0284c7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
