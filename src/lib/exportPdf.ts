import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { calculateRow, calculateTotals, type Constants, type ProductInput } from "./calculations";

interface Row extends ProductInput {
  id: number;
  position: number;
}

const fmt = (v: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/**
 * Build a single-project PDF (A4 landscape) that mirrors the on-screen
 * report: header with factors, table of product lines, result analysis
 * with KPIs and revenue-composition bar.
 */
export function buildProjectPdf(
  rows: Row[],
  constants: Constants,
  projectName: string,
  manufacturerName: string,
  targetCurrency = "JOD",
  responsiblePerson?: string | null
): jsPDF {
  const cur = targetCurrency;
  const calculated = rows.map((r) => ({ ...r, ...calculateRow(r, constants) }));
  const totals = calculateTotals(calculated);
  const activeRows = calculated.filter((r) => r.priceUsd > 0 && r.itemModel);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  // ─── Header band ───
  const headerH = 32;
  doc.setFillColor(8, 145, 178); // cyan-600
  doc.roundedRect(margin, margin, pageW - margin * 2, headerH, 3, 3, "F");

  // Manufacturer & project
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PRICING SHEET · MANUFACTURER", margin + 5, margin + 6);

  doc.setFontSize(20);
  doc.text(manufacturerName || "—", margin + 5, margin + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const projLine = `Project: ${projectName}${responsiblePerson ? `   ·   Responsible: ${responsiblePerson}` : ""}`;
  doc.text(projLine, margin + 5, margin + 20);

  // Right-aside meta
  doc.setFontSize(8);
  const meta = [
    `Exported: ${new Date().toLocaleString()}`,
    `Currency: ${cur}`,
    `${calculated.length} product line${calculated.length !== 1 ? "s" : ""}`,
  ];
  meta.forEach((line, i) => {
    doc.text(line, pageW - margin - 5, margin + 6 + i * 4, { align: "right" });
  });

  // Factors strip (5 cards inside the header band)
  const factors = [
    { label: "Currency Rate", value: `1 USD = ${constants.currencyRate}`, hint: `${cur} per USD` },
    { label: "Shipping",      value: `${(constants.shippingRate * 100).toFixed(2)}%`, hint: "of local price" },
    { label: "Customs",       value: `${(constants.customsRate * 100).toFixed(2)}%`,  hint: "of local + shipping" },
    { label: "Profit Margin", value: `${(constants.profitMargin * 100).toFixed(2)}%`, hint: "on landed cost" },
    { label: "Tax Rate",      value: `${(constants.taxRate * 100).toFixed(2)}%`,      hint: "on pre-tax price" },
  ];

  const factorsY = margin + 23;
  const factorsH = 8;
  const gap = 2;
  const factorW = (pageW - margin * 2 - 10 - gap * 4) / 5;
  factors.forEach((f, i) => {
    const x = margin + 5 + i * (factorW + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(255, 255, 255);
    // semi-transparent panel: emulate with light fill
    doc.setFillColor(14, 116, 144); // cyan-700
    doc.roundedRect(x, factorsY, factorW, factorsH, 1.2, 1.2, "F");
    doc.setTextColor(220, 240, 245);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text(f.label.toUpperCase(), x + 1.5, factorsY + 2.6);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.text(f.value, x + 1.5, factorsY + 5.2);
    doc.setTextColor(200, 230, 240);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.text(f.hint, x + 1.5, factorsY + 7.2);
  });

  // ─── Product Lines Table ───
  const tableStartY = margin + headerH + 4;

  const tableHead = [
    [
      { content: "#", rowSpan: 2 },
      { content: "Item Model", rowSpan: 2 },
      { content: "USD Price", colSpan: 2 },
      { content: "Qty", rowSpan: 2 },
      { content: `${cur} Price`, colSpan: 2 },
      { content: "Shipping", colSpan: 2 },
      { content: "Customs", colSpan: 2 },
      { content: "Landed Cost", colSpan: 2 },
      { content: "Profit", colSpan: 2 },
      { content: "Pre-Tax", colSpan: 2 },
      { content: "Tax", colSpan: 2 },
      { content: "Final Price", colSpan: 2 },
    ],
    [
      "/unit", "total",
      "/unit", "total",
      "/unit", "total",
      "/unit", "total",
      "/unit", "total",
      "/unit", "total",
      "/unit", "total",
      "/unit", "total",
      "/unit", "total",
    ],
  ];

  const tableBody = calculated.map((row) => [
    row.position,
    row.itemModel || "—",
    fmt(row.priceUsd),
    row.priceUsd ? fmt(row.usdTotal) : "—",
    row.quantity,
    row.priceUsd ? fmt(row.jodPrice) : "—",
    row.priceUsd ? fmt(row.jodPriceTotal) : "—",
    row.priceUsd ? fmt(row.shipping) : "—",
    row.priceUsd ? fmt(row.shippingTotal) : "—",
    row.priceUsd ? fmt(row.customs) : "—",
    row.priceUsd ? fmt(row.customsTotal) : "—",
    row.priceUsd ? fmt(row.landedCost) : "—",
    row.priceUsd ? fmt(row.landedCostTotal) : "—",
    row.priceUsd ? fmt(row.profit) : "—",
    row.priceUsd ? fmt(row.profitTotal) : "—",
    row.priceUsd ? fmt(row.preTaxPrice) : "—",
    row.priceUsd ? fmt(row.preTaxPriceTotal) : "—",
    row.priceUsd ? fmt(row.tax) : "—",
    row.priceUsd ? fmt(row.taxTotal) : "—",
    row.priceUsd ? fmt(row.finalPrice) : "—",
    row.priceUsd ? fmt(row.finalPriceTotal) : "—",
  ]);

  const tableFoot = [[
    { content: "TOTALS", colSpan: 2, styles: { halign: "left" as const, fontStyle: "bold" as const } },
    "",
    fmt(totals.usdTotal),
    "",
    "",
    fmt(totals.jodPriceTotal),
    "",
    fmt(totals.shippingTotal),
    "",
    fmt(totals.customsTotal),
    "",
    fmt(totals.landedCostTotal),
    "",
    fmt(totals.profitTotal),
    "",
    fmt(totals.preTaxPriceTotal),
    "",
    fmt(totals.taxTotal),
    "",
    fmt(totals.finalPriceTotal),
  ]];

  autoTable(doc, {
    startY: tableStartY,
    head: tableHead as any,
    body: tableBody as any,
    foot: tableFoot as any,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 6.5,
      cellPadding: 1.2,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      overflow: "ellipsize",
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [71, 85, 105],
      fontStyle: "bold",
      fontSize: 6.5,
      halign: "center",
    },
    bodyStyles: { textColor: [30, 41, 59] },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { cellWidth: 30, halign: "left" },
    },
    didParseCell: (data) => {
      // Right-align numeric columns (everything except # and Item Model)
      if (data.section === "body" && data.column.index >= 2) {
        data.cell.styles.halign = "right";
        data.cell.styles.font = "courier";
      }
      if (data.section === "foot" && data.column.index >= 2) {
        data.cell.styles.halign = "right";
        data.cell.styles.font = "courier";
      }
    },
  });

  // ─── Analysis section ───
  let cursorY = (doc as any).lastAutoTable.finalY + 6;
  if (activeRows.length > 0) {
    // If too close to page bottom, add a new page
    if (cursorY > pageH - 60) {
      doc.addPage();
      cursorY = margin;
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("RESULT ANALYSIS", margin, cursorY);
    cursorY += 4;

    // KPI cards
    const rev = totals.finalPriceTotal;
    const marginPct = rev > 0 ? ((totals.profitTotal / rev) * 100).toFixed(1) : "0.0";
    const kpis = [
      { label: "Total Revenue",      value: `${fmt(rev)} ${cur}`,                     color: [8, 145, 178],   bg: [236, 254, 255] },
      { label: "Total Landed Cost",  value: `${fmt(totals.landedCostTotal)} ${cur}`,   color: [234, 88, 12],   bg: [255, 247, 237] },
      { label: "Total Gross Profit", value: `${fmt(totals.profitTotal)} ${cur}`,       color: [22, 163, 74],   bg: [240, 253, 244] },
      { label: "Net Margin",         value: `${marginPct}%`,                           color: [124, 58, 237],  bg: [245, 243, 255] },
    ];

    const kpiW = (pageW - margin * 2 - 6) / 4;
    const kpiH = 14;
    kpis.forEach((k, i) => {
      const x = margin + i * (kpiW + 2);
      doc.setFillColor(k.bg[0], k.bg[1], k.bg[2]);
      doc.roundedRect(x, cursorY, kpiW, kpiH, 1.5, 1.5, "F");
      doc.setFillColor(k.color[0], k.color[1], k.color[2]);
      doc.rect(x, cursorY, 1.2, kpiH, "F");
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.text(k.label.toUpperCase(), x + 3, cursorY + 4);
      doc.setTextColor(k.color[0], k.color[1], k.color[2]);
      doc.setFontSize(11);
      doc.text(k.value, x + 3, cursorY + 10);
    });

    cursorY += kpiH + 5;

    // Revenue composition bar
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Revenue Composition", margin, cursorY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("— contribution of each cost component to final price", margin + 38, cursorY);
    cursorY += 3;

    const segments = [
      { label: `${cur} Base`, value: totals.jodPriceTotal,  color: [217, 119, 6] },
      { label: "Shipping",     value: totals.shippingTotal, color: [37, 99, 235] },
      { label: "Customs",      value: totals.customsTotal,  color: [124, 58, 237] },
      { label: "Profit",       value: totals.profitTotal,   color: [22, 163, 74] },
      { label: "Tax",          value: totals.taxTotal,      color: [225, 29, 72] },
    ];

    const barW = pageW - margin * 2;
    const barH = 5;
    let barX = margin;
    segments.forEach((s) => {
      const segW = rev > 0 ? (s.value / rev) * barW : 0;
      doc.setFillColor(s.color[0], s.color[1], s.color[2]);
      doc.rect(barX, cursorY, segW, barH, "F");
      barX += segW;
    });
    // Outline
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, cursorY, barW, barH);

    cursorY += barH + 4;

    // Legend
    let legX = margin;
    doc.setFontSize(7);
    segments.forEach((s) => {
      const pct = rev > 0 ? ((s.value / rev) * 100).toFixed(1) : "0.0";
      doc.setFillColor(s.color[0], s.color[1], s.color[2]);
      doc.circle(legX + 1.5, cursorY - 0.8, 1, "F");
      doc.setTextColor(71, 85, 105);
      doc.setFont("helvetica", "normal");
      doc.text(`${s.label} `, legX + 4, cursorY);
      const labelW = doc.getTextWidth(`${s.label} `);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`${pct}%`, legX + 4 + labelW, cursorY);
      legX += 4 + labelW + doc.getTextWidth(`${pct}%`) + 5;
    });
  }

  // ─── Footer ───
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      `Generated by Pricing Sheet · ${new Date().toLocaleDateString()} · All amounts in ${cur}`,
      pageW / 2,
      pageH - 5,
      { align: "center" }
    );
    doc.text(`Page ${i} / ${totalPages}`, pageW - margin, pageH - 5, { align: "right" });
  }

  return doc;
}

/** Trigger a single-project PDF download (used by the per-project Export menu). */
export function exportProjectPdf(
  rows: Row[],
  constants: Constants,
  projectName: string,
  manufacturerName: string,
  targetCurrency = "JOD",
  responsiblePerson?: string | null
) {
  const doc = buildProjectPdf(rows, constants, projectName, manufacturerName, targetCurrency, responsiblePerson);
  const safeName = `${manufacturerName}-${projectName}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
  doc.save(`${safeName}.pdf`);
}
