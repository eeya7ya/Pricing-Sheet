import JSZip from "jszip";
import { buildProjectPdf } from "./exportPdf";
import type { Constants, ProductInput } from "./calculations";

interface ManufacturerLite {
  id: number;
  name: string;
  ownerUserId?: number | null;
}
interface ProjectLite {
  id: number;
  name: string;
  responsiblePerson?: string | null;
}
interface ProductLineRaw {
  id: number;
  position: number;
  itemModel: string;
  priceUsd: string;
  quantity: number;
  shippingOverride?: string | null;
  customsOverride?: string | null;
  shippingRateOverride?: string | null;
  customsRateOverride?: string | null;
  profitRateOverride?: string | null;
}

export interface BulkExportProgress {
  total: number;
  completed: number;
  currentLabel: string;
}

const sanitize = (name: string) =>
  name.replace(/[<>:"/\\|?*\x00-\x1f]+/g, "_").replace(/^\.+/, "").trim() || "untitled";

/**
 * Fetch every manufacturer the current user can see, then every project
 * inside each, generate a PDF for each project, and zip them into a tree:
 *
 *   Pricing-sheets/<Manufacturer>/<Project>.pdf
 */
export async function exportAllAsZip(
  onProgress?: (p: BulkExportProgress) => void
): Promise<void> {
  // 1. Manufacturers
  const mfgRes = await fetch("/api/manufacturers", { cache: "no-store" });
  if (!mfgRes.ok) throw new Error("Failed to load manufacturers");
  const manufacturers: ManufacturerLite[] = await mfgRes.json();

  // 2. For each manufacturer, fetch its project list
  type Job = { mfg: ManufacturerLite; project: ProjectLite };
  const jobs: Job[] = [];

  for (const mfg of manufacturers) {
    const params = new URLSearchParams({ manufacturerId: String(mfg.id) });
    if (mfg.ownerUserId != null) params.set("ownerUserId", String(mfg.ownerUserId));
    const pRes = await fetch(`/api/projects?${params.toString()}`, { cache: "no-store" });
    if (!pRes.ok) continue;
    const projects: ProjectLite[] = await pRes.json();
    for (const project of projects) jobs.push({ mfg, project });
  }

  if (jobs.length === 0) {
    throw new Error("No projects found to export.");
  }

  const zip = new JSZip();
  const root = zip.folder("Pricing-sheets")!;

  let completed = 0;
  onProgress?.({ total: jobs.length, completed, currentLabel: "Starting…" });

  // 3. For each (manufacturer, project) pull the full project, build PDF
  for (const { mfg, project } of jobs) {
    const label = `${mfg.name} / ${project.name}`;
    onProgress?.({ total: jobs.length, completed, currentLabel: label });

    try {
      const dRes = await fetch(`/api/projects/${project.id}`, { cache: "no-store" });
      if (!dRes.ok) {
        completed += 1;
        continue;
      }
      const data = await dRes.json();

      const constants: Constants = {
        currencyRate: parseFloat(data.constants?.currencyRate ?? "0.71"),
        shippingRate: parseFloat(data.constants?.shippingRate ?? "0.05"),
        customsRate: parseFloat(data.constants?.customsRate ?? "0.15"),
        profitMargin: parseFloat(data.constants?.profitMargin ?? "0.18"),
        taxRate: parseFloat(data.constants?.taxRate ?? "0.16"),
      };
      const targetCurrency: string = data.constants?.targetCurrency ?? "JOD";

      const lines: ProductLineRaw[] = data.productLines ?? [];
      const rows = lines.map((l, idx) => ({
        id: l.id ?? idx + 1,
        position: l.position ?? idx + 1,
        itemModel: l.itemModel ?? "",
        priceUsd: parseFloat(l.priceUsd ?? "0"),
        quantity: l.quantity ?? 1,
        shippingOverride: l.shippingOverride != null ? parseFloat(l.shippingOverride) : null,
        customsOverride: l.customsOverride != null ? parseFloat(l.customsOverride) : null,
        shippingRateOverride: l.shippingRateOverride != null ? parseFloat(l.shippingRateOverride) : null,
        customsRateOverride: l.customsRateOverride != null ? parseFloat(l.customsRateOverride) : null,
        profitRateOverride: l.profitRateOverride != null ? parseFloat(l.profitRateOverride) : null,
      })) satisfies (ProductInput & { id: number; position: number })[];

      const projectName: string = data.project?.name ?? project.name;
      const responsible: string | null = data.project?.responsiblePerson ?? null;

      const doc = buildProjectPdf(
        rows,
        constants,
        projectName,
        mfg.name,
        targetCurrency,
        responsible
      );
      const blob = doc.output("blob");

      const folder = root.folder(sanitize(mfg.name))!;
      folder.file(`${sanitize(projectName)}.pdf`, blob);
    } catch (e) {
      console.warn("Bulk export: failed for", label, e);
    } finally {
      completed += 1;
      onProgress?.({ total: jobs.length, completed, currentLabel: label });
    }
  }

  // 4. Generate the zip and trigger download
  const zipBlob = await zip.generateAsync({ type: "blob" }, (meta) => {
    onProgress?.({
      total: jobs.length,
      completed: jobs.length,
      currentLabel: `Compressing… ${meta.percent.toFixed(0)}%`,
    });
  });

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Pricing-sheets-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  onProgress?.({ total: jobs.length, completed: jobs.length, currentLabel: "Done" });
}
