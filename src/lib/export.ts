import { calculateRow, calculateTotals, type Constants, type ProductInput } from "./calculations";

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

// ─── Print / PDF Export ────────────────────────────────────────────────────────

export function exportToPrint(
  rows: Row[],
  constants: Constants,
  projectName: string,
  manufacturerName: string
) {
  const calculated = rows.map((r) => ({ ...r, ...calculateRow(r, constants) }));
  const totals = calculateTotals(calculated);

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
