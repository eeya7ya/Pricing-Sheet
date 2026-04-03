import { calculateRow, calculateTotals, type Constants, type ProductInput, type TotalsRow } from "./calculations";

interface Row extends ProductInput {
  id: number;
  position: number;
}

function N(v: number, decimals = 3) {
  return v.toFixed(decimals);
}

// ─── CSV Export ────────────────────────────────────────────────────────────────

export function exportToCsv(
  rows: Row[],
  constants: Constants,
  projectName: string,
  manufacturerName: string
) {
  const calculated = rows.map((r) => ({ ...r, ...calculateRow(r, constants) }));
  const totals = calculateTotals(calculated);

  const headers = [
    "#",
    "Item Model",
    "USD Price",
    "Qty",
    "JOD Price /unit",
    "JOD Price Total",
    "Shipping /unit",
    "Shipping Total",
    "Customs /unit",
    "Customs Total",
    "Landed Cost /unit",
    "Landed Cost Total",
    "Profit /unit",
    "Profit Total",
    "Pre-Tax Price /unit",
    "Pre-Tax Price Total",
    "Tax /unit",
    "Tax Total",
    "Final Price /unit",
    "Final Price Total",
  ];

  const dataRows = calculated.map((row) => [
    row.position,
    `"${row.itemModel.replace(/"/g, '""')}"`,
    N(row.priceUsd),
    row.quantity,
    N(row.jodPrice),
    N(row.jodPriceTotal),
    N(row.shipping),
    N(row.shippingTotal),
    N(row.customs),
    N(row.customsTotal),
    N(row.landedCost),
    N(row.landedCostTotal),
    N(row.profit),
    N(row.profitTotal),
    N(row.preTaxPrice),
    N(row.preTaxPriceTotal),
    N(row.tax),
    N(row.taxTotal),
    N(row.finalPrice),
    N(row.finalPriceTotal),
  ]);

  const totalRow = [
    "",
    "TOTALS",
    "",
    "",
    "",
    N(totals.jodPriceTotal),
    "",
    N(totals.shippingTotal),
    "",
    N(totals.customsTotal),
    "",
    N(totals.landedCostTotal),
    "",
    N(totals.profitTotal),
    "",
    N(totals.preTaxPriceTotal),
    "",
    N(totals.taxTotal),
    "",
    N(totals.finalPriceTotal),
  ];

  const constantsBlock = [
    [""],
    ["Settings"],
    [`Currency Rate,${constants.currencyRate}`],
    [`Shipping Rate,${(constants.shippingRate * 100).toFixed(2)}%`],
    [`Customs Rate,${(constants.customsRate * 100).toFixed(2)}%`],
    [`Profit Margin,${(constants.profitMargin * 100).toFixed(2)}%`],
    [`Tax Rate,${(constants.taxRate * 100).toFixed(2)}%`],
  ];

  const csvLines = [
    `"${manufacturerName} – ${projectName}"`,
    `"Exported: ${new Date().toLocaleString()}"`,
    "",
    headers.join(","),
    ...dataRows.map((r) => r.join(",")),
    totalRow.join(","),
    ...constantsBlock.map((r) => r.join(",")),
  ];

  const csv = csvLines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${manufacturerName}-${projectName}-${new Date().toISOString().slice(0, 10)}.csv`
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Chart section for print ──────────────────────────────────────────────────

function buildChartsHtml(totals: TotalsRow, totalItems: number): string {
  const fmt3 = (v: number) =>
    v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const rev = totals.finalPriceTotal;
  const marginPct = rev > 0 ? ((totals.profitTotal / rev) * 100).toFixed(1) : "0.0";

  // KPI cards
  const kpis = [
    { label: "Total Revenue",      value: `${fmt3(rev)} JOD`,                      color: "#0891b2" },
    { label: "Total Landed Cost",  value: `${fmt3(totals.landedCostTotal)} JOD`,    color: "#ea580c" },
    { label: "Total Gross Profit", value: `${fmt3(totals.profitTotal)} JOD`,         color: "#16a34a" },
    { label: "Net Margin",         value: `${marginPct}%`,                           color: "#7c3aed" },
  ];

  const kpiHtml = kpis
    .map(
      (k) => `
      <div style="flex:1;min-width:130px;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;background:#fff;">
        <div style="font-size:10px;color:#64748b;margin-bottom:4px;">${k.label}</div>
        <div style="font-size:16px;font-weight:700;color:${k.color};">${k.value}</div>
      </div>`
    )
    .join("");

  // Horizontal stacked composition bar
  const segments = [
    { label: "JOD Base", value: totals.jodPriceTotal,  color: "#d97706" },
    { label: "Shipping",  value: totals.shippingTotal,  color: "#2563eb" },
    { label: "Customs",   value: totals.customsTotal,   color: "#7c3aed" },
    { label: "Profit",    value: totals.profitTotal,    color: "#16a34a" },
    { label: "Tax",       value: totals.taxTotal,       color: "#e11d48" },
  ];

  const barSegments = segments
    .map((s) => {
      const pct = rev > 0 ? ((s.value / rev) * 100).toFixed(2) : "0";
      return `<div title="${s.label}: ${fmt3(s.value)} JOD (${pct}%)" style="width:${pct}%;background:${s.color};height:100%;"></div>`;
    })
    .join("");

  const legendItems = segments
    .map(
      (s) => {
        const pct = rev > 0 ? ((s.value / rev) * 100).toFixed(1) : "0.0";
        return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#475569;margin-right:12px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.color};"></span>
          ${s.label} <strong style="color:#1e293b;">${pct}%</strong>
        </span>`;
      }
    )
    .join("");

  // Waterfall SVG — simple grouped bars showing accumulation stages
  const stages = [
    { name: "JOD Base",     v: totals.jodPriceTotal,   color: "#d97706", isTotal: false },
    { name: "+Shipping",    v: totals.shippingTotal,   color: "#2563eb", isTotal: false },
    { name: "+Customs",     v: totals.customsTotal,    color: "#7c3aed", isTotal: false },
    { name: "Landed",       v: totals.landedCostTotal, color: "#ea580c", isTotal: true  },
    { name: "+Profit",      v: totals.profitTotal,     color: "#16a34a", isTotal: false },
    { name: "+Tax",         v: totals.taxTotal,        color: "#e11d48", isTotal: false },
    { name: "Revenue",      v: totals.finalPriceTotal, color: "#0891b2", isTotal: true  },
  ];

  const svgW = 540;
  const svgH = 160;
  const padL = 12;
  const padR = 12;
  const padT = 12;
  const padB = 30;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;
  const maxVal = Math.max(...stages.map((s) => s.v)) * 1.08;
  const barW = Math.floor(chartW / stages.length) - 6;

  // For non-total bars, compute their float base
  let runningBase = 0;
  const svgBars = stages.map((s, i) => {
    const base = s.isTotal ? 0 : runningBase;
    const barH = Math.max(2, Math.round((s.v / maxVal) * chartH));
    const baseY = Math.round(((maxVal - base - s.v) / maxVal) * chartH);
    const x = padL + i * (chartW / stages.length) + 3;
    const y = padT + baseY;
    if (!s.isTotal) runningBase += s.v;
    else runningBase = s.v; // reset running total to milestone value

    const labelY = y - 4;
    const labelVal =
      s.v >= 1000
        ? `${(s.v / 1000).toFixed(1)}k`
        : s.v.toFixed(0);

    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${s.color}" opacity="${s.isTotal ? 1 : 0.82}" rx="3"/>
      <text x="${x + barW / 2}" y="${labelY}" text-anchor="middle" font-size="8" fill="#475569">${labelVal}</text>
      <text x="${x + barW / 2}" y="${padT + chartH + 14}" text-anchor="middle" font-size="8" fill="#64748b">${s.name}</text>
    `;
  });

  return `
  <div style="margin-bottom:24px;">
    <div style="font-size:12px;font-weight:600;color:#1e293b;margin-bottom:10px;">Summary</div>

    <!-- KPI row -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">${kpiHtml}</div>

    <!-- Waterfall bar chart -->
    <div style="border:1px solid #e2e8f0;border-radius:10px;background:#fff;padding:14px 16px;margin-bottom:14px;">
      <div style="font-size:10px;color:#64748b;margin-bottom:8px;">
        Accumulative Cost Buildup — all products combined (JOD) &nbsp;·&nbsp;
        <em>Landed Cost and Final Revenue are milestone totals; other bars show the incremental addition.</em>
      </div>
      <svg width="${svgW}" height="${svgH}" style="overflow:visible;">${svgBars.join("")}</svg>
    </div>

    <!-- Composition bar -->
    <div style="border:1px solid #e2e8f0;border-radius:10px;background:#fff;padding:14px 16px;">
      <div style="font-size:10px;color:#64748b;margin-bottom:8px;">Revenue Composition — how each cost component contributes to final price</div>
      <div style="display:flex;width:100%;height:22px;border-radius:6px;overflow:hidden;margin-bottom:8px;">${barSegments}</div>
      <div>${legendItems}</div>
    </div>
  </div>`;
}

// ─── Print / PDF Export ────────────────────────────────────────────────────────

export function exportToPrint(
  rows: Row[],
  constants: Constants,
  projectName: string,
  manufacturerName: string
) {
  const activeRows = rows.filter((r) => r.priceUsd > 0 && r.itemModel);
  const calculated = rows.map((r) => ({ ...r, ...calculateRow(r, constants) }));
  const totals = calculateTotals(calculated);
  const totalItems = activeRows.reduce((s, r) => s + r.quantity, 0);
  const chartsHtml = activeRows.length > 0 ? buildChartsHtml(totals, totalItems) : "";

  const fmt = (v: number) =>
    v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const colGroups = [
    { label: "JOD Price", unit: "jodPrice", total: "jodPriceTotal", color: "#d97706" },
    { label: "Shipping", unit: "shipping", total: "shippingTotal", color: "#2563eb" },
    { label: "Customs", unit: "customs", total: "customsTotal", color: "#7c3aed" },
    { label: "Landed Cost", unit: "landedCost", total: "landedCostTotal", color: "#ea580c", highlight: true },
    { label: "Profit", unit: "profit", total: "profitTotal", color: "#059669" },
    { label: "Pre-Tax", unit: "preTaxPrice", total: "preTaxPriceTotal", color: "#0d9488" },
    { label: "Tax", unit: "tax", total: "taxTotal", color: "#e11d48" },
    { label: "Final Price", unit: "finalPrice", total: "finalPriceTotal", color: "#0891b2", highlight: true },
  ];

  const headerCells = colGroups
    .map(
      (c) =>
        `<th colspan="2" style="background:${c.highlight ? "#f1f5f9" : "#f8fafc"};color:${c.color};border:1px solid #e2e8f0;padding:6px 8px;text-align:center;font-size:11px;">${c.label}</th>`
    )
    .join("");

  const subHeaderCells = colGroups
    .map(
      () =>
        `<th style="border:1px solid #e2e8f0;padding:3px 8px;text-align:right;font-size:9px;color:#94a3b8;">/unit</th><th style="border:1px solid #e2e8f0;padding:3px 8px;text-align:right;font-size:9px;color:#94a3b8;">total</th>`
    )
    .join("");

  const dataRows = calculated
    .map((row) => {
      const cells = colGroups
        .map(
          (c) => `
        <td style="border:1px solid #e2e8f0;padding:5px 8px;text-align:right;font-family:monospace;font-size:10px;color:${c.color};${c.highlight ? "background:#fafafa;" : ""}">
          ${row.priceUsd ? fmt((row as any)[c.unit]) : "—"}
        </td>
        <td style="border:1px solid #e2e8f0;padding:5px 8px;text-align:right;font-family:monospace;font-size:10px;color:#64748b;${c.highlight ? "background:#fafafa;font-weight:600;" : ""}">
          ${row.priceUsd ? fmt((row as any)[c.total]) : "—"}
        </td>`
        )
        .join("");
      return `<tr>
        <td style="border:1px solid #e2e8f0;padding:5px 8px;text-align:center;color:#94a3b8;font-size:10px;">${row.position}</td>
        <td style="border:1px solid #e2e8f0;padding:5px 8px;font-size:10px;color:#1e293b;">${row.itemModel || "—"}</td>
        <td style="border:1px solid #e2e8f0;padding:5px 8px;text-align:right;font-family:monospace;font-size:10px;color:#1e293b;">${fmt(row.priceUsd)}</td>
        <td style="border:1px solid #e2e8f0;padding:5px 8px;text-align:center;font-family:monospace;font-size:10px;color:#1e293b;">${row.quantity}</td>
        ${cells}
      </tr>`;
    })
    .join("");

  const totalCells = colGroups
    .map(
      (c) => `
    <td style="border:1px solid #e2e8f0;padding:6px 8px;${c.highlight ? "background:#f1f5f9;" : ""}"></td>
    <td style="border:1px solid #e2e8f0;padding:6px 8px;text-align:right;font-family:monospace;font-size:10px;font-weight:700;color:${c.highlight ? "#0891b2" : "#1e293b"};${c.highlight ? "background:#f1f5f9;" : ""}">
      ${fmt((totals as any)[c.total])}
    </td>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${manufacturerName} – ${projectName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1e293b; background: #fff; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
    .page { padding: 32px; max-width: 100%; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .title { font-size: 22px; font-weight: 700; color: #0f172a; }
    .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
    .meta { text-align: right; font-size: 11px; color: #94a3b8; }
    .settings { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; }
    .setting { font-size: 11px; color: #475569; }
    .setting strong { color: #1e293b; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f8fafc; color: #64748b; font-weight: 600; border: 1px solid #e2e8f0; padding: 7px 8px; }
    .print-btn { display: inline-flex; align-items: center; gap: 6px; background: #0891b2; color: #fff; border: none; border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 20px; }
    .print-btn:hover { background: #0e7490; }
    .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="page">
    <button class="print-btn no-print" onclick="window.print()">🖨 Print / Save as PDF</button>
    <div class="header">
      <div>
        <div class="title">${manufacturerName}</div>
        <div class="subtitle">Project: ${projectName}</div>
      </div>
      <div class="meta">
        Exported: ${new Date().toLocaleString()}<br/>
        ${calculated.length} product line${calculated.length !== 1 ? "s" : ""}
      </div>
    </div>

    <div class="settings">
      <div class="setting">Currency Rate: <strong>${constants.currencyRate}</strong></div>
      <div class="setting">Shipping Rate: <strong>${(constants.shippingRate * 100).toFixed(2)}%</strong></div>
      <div class="setting">Customs Rate: <strong>${(constants.customsRate * 100).toFixed(2)}%</strong></div>
      <div class="setting">Profit Margin: <strong>${(constants.profitMargin * 100).toFixed(2)}%</strong></div>
      <div class="setting">Tax Rate: <strong>${(constants.taxRate * 100).toFixed(2)}%</strong></div>
    </div>

    ${chartsHtml}

    <table>
      <thead>
        <tr>
          <th style="width:30px;">#</th>
          <th style="text-align:left;min-width:120px;">Item Model</th>
          <th style="text-align:right;">USD Price</th>
          <th style="text-align:center;">Qty</th>
          ${headerCells}
        </tr>
        <tr>
          <th></th><th></th>
          <th style="text-align:right;font-size:9px;color:#94a3b8;">per unit</th>
          <th></th>
          ${subHeaderCells}
        </tr>
      </thead>
      <tbody>${dataRows}</tbody>
      <tfoot>
        <tr style="background:#f1f5f9;">
          <td colspan="2" style="border:1px solid #e2e8f0;padding:6px 8px;font-weight:700;font-size:11px;color:#1e293b;">TOTALS</td>
          <td style="border:1px solid #e2e8f0;"></td>
          <td style="border:1px solid #e2e8f0;"></td>
          ${totalCells}
        </tr>
      </tfoot>
    </table>

    <div class="footer">Generated by Pricing Sheet · ${new Date().toLocaleDateString()}</div>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
