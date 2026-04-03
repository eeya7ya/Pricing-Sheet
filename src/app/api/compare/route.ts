export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const allManufacturers = await db.query.manufacturers.findMany({
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    });

    const result = await Promise.all(
      allManufacturers.map(async (manufacturer) => {
        const mProjects = await db.query.projects.findMany({
          where: (p, { eq }) => eq(p.manufacturerId, manufacturer.id),
          orderBy: (p, { asc }) => [asc(p.createdAt)],
        });

        const projectsWithData = await Promise.all(
          mProjects.map(async (project) => {
            const constants = await db.query.projectConstants.findFirst({
              where: (c, { eq }) => eq(c.projectId, project.id),
            });
            const lines = await db.query.productLines.findMany({
              where: (l, { eq }) => eq(l.projectId, project.id),
              orderBy: (l, { asc }) => [asc(l.position)],
            });
            return { project, constants, productLines: lines };
          })
        );

        return { manufacturer, projects: projectsWithData };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch comparison data" }, { status: 500 });
  }
}
