"use client";

import { type Constants } from "@/lib/calculations";
import { cn } from "@/lib/utils";

interface ConstantField {
  key: keyof Constants;
  label: string;
  description: string;
  isRate: boolean;
  color: string;
}

const CONSTANT_FIELDS: ConstantField[] = [
  {
    key: "currencyRate",
    label: "Currency Rate",
    description: "USD → JOD",
    isRate: false,
    color: "text-amber-400",
  },
  {
    key: "shippingRate",
    label: "Shipping Cost",
    description: "% of JOD price",
    isRate: true,
    color: "text-blue-400",
  },
  {
    key: "customsRate",
    label: "Customs / Clearance",
    description: "% of shipping cost",
    isRate: true,
    color: "text-purple-400",
  },
  {
    key: "profitMargin",
    label: "Profit Margin",
    description: "% on landed cost",
    isRate: true,
    color: "text-emerald-400",
  },
  {
    key: "taxRate",
    label: "Tax Rate",
    description: "% on pre-tax price",
    isRate: true,
    color: "text-rose-400",
  },
];

interface Props {
  constants: Constants;
  onChange: (updated: Constants) => void;
  saving?: boolean;
}

export function ConstantsPanel({ constants, onChange, saving }: Props) {
  const handleChange = (key: keyof Constants, raw: string) => {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      const value = CONSTANT_FIELDS.find((f) => f.key === key)?.isRate
        ? parsed / 100
        : parsed;
      onChange({ ...constants, [key]: value });
    }
  };

  const displayValue = (field: ConstantField) => {
    const v = constants[field.key];
    return field.isRate ? (v * 100).toFixed(1) : v.toFixed(4);
  };

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Global Constants
        </h3>
        {saving && (
          <span className="text-xs text-slate-500 animate-pulse">Saving…</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CONSTANT_FIELDS.map((field) => (
          <div key={field.key} className="group">
            <label className="mb-1 block text-xs text-slate-500">
              {field.label}
              <span className="ml-1 text-slate-600">({field.description})</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step={field.isRate ? "0.1" : "0.0001"}
                min="0"
                value={displayValue(field)}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className={cn(
                  "w-full rounded-lg border border-slate-700 bg-slate-900/80 py-2 pl-3 pr-7 text-sm font-mono font-medium",
                  "focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30",
                  "transition-colors",
                  field.color
                )}
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                {field.isRate ? "%" : "×"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
