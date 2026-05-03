export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  projects,
  projectConstants,
  productLines,
} from "@/db/schema";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";

function canAccess(
  user: { id: number; role: "admin" | "user" },
  project: { userId: number | null }
) {
  if (user.role === "admin") return true;
  return project.userId === user.id;
}

/**
 * Save-as-Revision: create a new project that clones the source
 * project's name, constants and product lines, but is linked to the
 * original via parent_project_id. The revision number is the highest
 * existing revision in the lineage (root + all descendants) plus one,
 * so v2, v3… are unambiguous regardless of which sibling the user
 * branches from.
 *
 * GET returns the full lineage (root + every descendant) ordered by
 * revisionNumber so the UI can show a revision picker.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sourceId = parseInt(id, 10);
    if (!Number.isFinite(sourceId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const source = await db.query.projects.findFirst({
      where: (p, { eq, isNull, and }) =>
        and(eq(p.id, sourceId), isNull(p.deletedAt)),
    });
    if (!source) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canAccess(user, source)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse optional payload — the client may send a custom name or
    // override the in-memory snapshot to clone instead of the persisted
    // row. Fall back to the source project's data when omitted.
    const body = await req.json().catch(() => ({}));
    const customName: string | undefined = body?.name?.trim?.() || undefined;
    const customDate: string | null | undefined = body?.date;
    const customResponsible: string | undefined =
      body?.responsiblePerson?.trim?.() || undefined;
    const overrideConstants = body?.constants;
    const overrideLines: any[] | undefined = Array.isArray(body?.productLines)
      ? body.productLines
      : undefined;

    // Walk the lineage to find the root and the next revision number.
    // The root is whichever project sits at the top of the parent chain;
    // every revision (the original + each clone) shares it.
    const rootId = source.parentProjectId ?? source.id;

    const lineage = await db
      .select({
        id: projects.id,
        revisionNumber: projects.revisionNumber,
      })
      .from(projects)
      .where(
        or(eq(projects.id, rootId), eq(projects.parentProjectId, rootId))
      );

    const nextRevision =
      lineage.reduce(
        (acc, r) => (r.revisionNumber > acc ? r.revisionNumber : acc),
        0
      ) + 1;

    // Default the new name to "<source name> — v<n>" but skip if the
    // source already ends in a revision suffix to avoid stacking.
    const baseName = customName ?? source.name;
    const newName = customName
      ? baseName
      : /\bv\d+$/.test(baseName.trim())
        ? baseName
        : `${baseName} — v${nextRevision}`;

    const sourceConstants = await db.query.projectConstants.findFirst({
      where: (c, { eq }) => eq(c.projectId, source.id),
    });
    const sourceLines = await db.query.productLines.findMany({
      where: (l, { eq }) => eq(l.projectId, source.id),
      orderBy: (l, { asc }) => [asc(l.position)],
    });

    const [created] = await db
      .insert(projects)
      .values({
        name: newName,
        date: customDate !== undefined ? customDate ?? null : source.date,
        responsiblePerson:
          customResponsible !== undefined
            ? customResponsible
            : source.responsiblePerson,
        manufacturerId: source.manufacturerId,
        userId: source.userId ?? user.id,
        parentProjectId: rootId,
        revisionNumber: nextRevision,
      })
      .returning();

    // Constants — clone the row, applying any overrides from the request.
    const c = overrideConstants ?? sourceConstants;
    await db.insert(projectConstants).values({
      projectId: created.id,
      currencyRate: c?.currencyRate != null ? String(c.currencyRate) : "0.710000",
      shippingRate: c?.shippingRate != null ? String(c.shippingRate) : "0.150000",
      customsRate: c?.customsRate != null ? String(c.customsRate) : "0.120000",
      profitMargin: c?.profitMargin != null ? String(c.profitMargin) : "0.250000",
      taxRate: c?.taxRate != null ? String(c.taxRate) : "0.160000",
      targetCurrency: c?.targetCurrency ?? "JOD",
      sourceCurrency: c?.sourceCurrency ?? "USD",
    });

    // Product lines — prefer the in-memory snapshot if supplied so a
    // "Save as Revision" click captures the user's unsaved edits.
    const linesToCopy =
      overrideLines && overrideLines.length > 0
        ? overrideLines.map((l, idx) => ({
            position: idx + 1,
            itemModel: l.itemModel ?? "",
            priceUsd: String(l.priceUsd ?? 0),
            quantity: l.quantity ?? 1,
            shippingOverride:
              l.shippingOverride != null ? String(l.shippingOverride) : null,
            customsOverride:
              l.customsOverride != null ? String(l.customsOverride) : null,
            shippingRateOverride:
              l.shippingRateOverride != null
                ? String(l.shippingRateOverride)
                : null,
            customsRateOverride:
              l.customsRateOverride != null
                ? String(l.customsRateOverride)
                : null,
            profitRateOverride:
              l.profitRateOverride != null
                ? String(l.profitRateOverride)
                : null,
          }))
        : sourceLines.map((l, idx) => ({
            position: idx + 1,
            itemModel: l.itemModel,
            priceUsd: l.priceUsd,
            quantity: l.quantity,
            shippingOverride: l.shippingOverride,
            customsOverride: l.customsOverride,
            shippingRateOverride: l.shippingRateOverride,
            customsRateOverride: l.customsRateOverride,
            profitRateOverride: l.profitRateOverride,
          }));

    if (linesToCopy.length > 0) {
      await db.insert(productLines).values(
        linesToCopy.map((l) => ({ ...l, projectId: created.id }))
      );
    }

    await logAudit({
      actor: user,
      action: "create",
      entityType: "project",
      entityId: created.id,
      details: {
        name: created.name,
        manufacturerId: source.manufacturerId,
        revisionOf: source.id,
        rootProjectId: rootId,
        revisionNumber: nextRevision,
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[projects/:id/revisions POST]", error);
    return NextResponse.json(
      { error: "Failed to create revision" },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sourceId = parseInt(id, 10);
    if (!Number.isFinite(sourceId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const source = await db.query.projects.findFirst({
      where: (p, { eq }) => eq(p.id, sourceId),
    });
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!canAccess(user, source)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rootId = source.parentProjectId ?? source.id;
    const lineage = await db
      .select({
        id: projects.id,
        name: projects.name,
        date: projects.date,
        responsiblePerson: projects.responsiblePerson,
        revisionNumber: projects.revisionNumber,
        parentProjectId: projects.parentProjectId,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(
        and(
          isNull(projects.deletedAt),
          or(eq(projects.id, rootId), eq(projects.parentProjectId, rootId))
        )
      )
      .orderBy(asc(projects.revisionNumber));

    return NextResponse.json({ rootProjectId: rootId, revisions: lineage });
  } catch (error) {
    console.error("[projects/:id/revisions GET]", error);
    return NextResponse.json(
      { error: "Failed to load revisions" },
      { status: 500 }
    );
  }
}
