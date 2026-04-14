// Server-to-server integration: pushes a finalised pricing project into
// AdvancedGate as a "waiting_to_assign" quotation. The client + other
// commercial parameters are filled in on the AdvancedGate side.
//
// Auth model:
//  - Inbound: the current Pricing-Sheet user must be logged in (JWT cookie)
//  - Outbound: we call AdvancedGate with a shared API key held in an
//    env var (ADVANCEDGATE_INTAKE_API_KEY). The key is never exposed to
//    the browser — the fetch happens from this route handler.

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";
import { calculateRow, type Constants } from "@/lib/calculations";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { projectId?: number } | null;
  const projectId = Number(body?.projectId);
  if (!Number.isFinite(projectId) || projectId <= 0) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  // Load project + manufacturer + constants + lines.
  const project = await db.query.projects.findFirst({
    where: (p, { eq, isNull, and }) => and(eq(p.id, projectId), isNull(p.deletedAt)),
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  // Non-admin users can only send their own projects.
  if (user.role !== "admin" && project.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [manufacturer, constantsRow, lines] = await Promise.all([
    db.query.manufacturers.findFirst({
      where: (m, { eq }) => eq(m.id, project.manufacturerId),
    }),
    db.query.projectConstants.findFirst({
      where: (c, { eq }) => eq(c.projectId, projectId),
    }),
    db.query.productLines.findMany({
      where: (l, { eq }) => eq(l.projectId, projectId),
      orderBy: (l, { asc }) => [asc(l.position)],
    }),
  ]);

  if (!constantsRow) {
    return NextResponse.json(
      { error: "Project has no constants row — save the project first" },
      { status: 400 },
    );
  }
  if (lines.length === 0) {
    return NextResponse.json(
      { error: "Project has no product lines to transfer" },
      { status: 400 },
    );
  }

  const constants: Constants = {
    currencyRate: parseFloat(constantsRow.currencyRate),
    shippingRate: parseFloat(constantsRow.shippingRate),
    customsRate: parseFloat(constantsRow.customsRate),
    profitMargin: parseFloat(constantsRow.profitMargin),
    taxRate: parseFloat(constantsRow.taxRate),
  };
  const currency = constantsRow.targetCurrency || "JOD";

  // Compute the final (post-tax) per-unit price for each line using the
  // shared calculation helper — so AdvancedGate receives the exact same
  // figure the user sees in the Pricing-Sheet table.
  const lineItems = lines.map((l) => {
    const calc = calculateRow(
      {
        itemModel: l.itemModel,
        priceUsd: parseFloat(l.priceUsd),
        quantity: l.quantity,
        shippingOverride: l.shippingOverride != null ? parseFloat(l.shippingOverride) : null,
        customsOverride: l.customsOverride != null ? parseFloat(l.customsOverride) : null,
        shippingRateOverride: l.shippingRateOverride != null ? parseFloat(l.shippingRateOverride) : null,
        customsRateOverride: l.customsRateOverride != null ? parseFloat(l.customsRateOverride) : null,
        profitRateOverride: l.profitRateOverride != null ? parseFloat(l.profitRateOverride) : null,
      },
      constants,
    );
    return {
      itemModel: l.itemModel,
      quantity: l.quantity,
      // Per-unit price, after tax, in the project's target currency.
      priceAfterTax: Number(calc.finalPrice.toFixed(4)),
    };
  });

  // Only transfer lines that actually have a model name — blank default
  // rows in Pricing-Sheet shouldn't leak into AdvancedGate as empty line
  // items. If nothing remains, block the send.
  const cleanedLineItems = lineItems.filter((li) => li.itemModel.trim().length > 0);
  if (cleanedLineItems.length === 0) {
    return NextResponse.json(
      { error: "No product lines with a model name to transfer" },
      { status: 400 },
    );
  }

  const apiUrl = process.env.ADVANCEDGATE_API_URL;
  const apiKey = process.env.ADVANCEDGATE_INTAKE_API_KEY;
  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { error: "AdvancedGate integration is not configured on the server" },
      { status: 503 },
    );
  }

  const endpoint = apiUrl.replace(/\/+$/, "") + "/api/quotations/intake";
  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        source: "pricing-sheet",
        sourceProjectId: project.id,
        sourceProjectName: project.name,
        sourceManufacturerName: manufacturer?.name ?? null,
        currency,
        notes: project.responsiblePerson
          ? `Responsible (at pricing): ${project.responsiblePerson}`
          : null,
        lineItems: cleanedLineItems,
      }),
      // Don't cache — this is a one-shot POST.
      cache: "no-store",
    });
  } catch (err) {
    console.error("[integrations/advancedgate] network error:", err);
    return NextResponse.json(
      { error: "Could not reach AdvancedGate" },
      { status: 502 },
    );
  }

  const upstreamJson = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      {
        error:
          (upstreamJson as { error?: string }).error ??
          `AdvancedGate returned ${upstream.status}`,
      },
      { status: 502 },
    );
  }

  const quotationId = (upstreamJson as { quotationId?: number }).quotationId ?? null;

  await logAudit({
    actor: user,
    action: "send_to_advancedgate",
    entityType: "project",
    entityId: project.id,
    details: {
      quotationId,
      lineCount: cleanedLineItems.length,
      currency,
    },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({
    ok: true,
    quotationId,
    lineCount: cleanedLineItems.length,
  });
}
