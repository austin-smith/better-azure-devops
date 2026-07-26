import { sql } from "drizzle-orm";
import { getLocalSettingsDb } from "@/db";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store",
};

export function GET() {
  try {
    getLocalSettingsDb().run(sql`SELECT 1`);

    return Response.json(
      {
        status: "ok",
      },
      {
        headers: responseHeaders,
      },
    );
  } catch (error) {
    console.error("Health check failed.", error);

    return Response.json(
      {
        status: "error",
      },
      {
        headers: responseHeaders,
        status: 503,
      },
    );
  }
}
