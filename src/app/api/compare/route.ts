export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin sees all; regular user sees only their manufacturer
    const allManufacturers =
      user.role === "admin"
        ? await db.query.manufacturers.findMany({
            orderBy: (m, { asc }) => [asc(m.createdAt)],
          })
        : user.manufacturerId
        ? await db.query.manufacturers.findMany({
            where: (m, { eq }) => eq(m.id, user.manufacturerId!),
          })
        : [];

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
