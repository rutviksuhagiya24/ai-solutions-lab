// app/api/businesses/route.ts
import { NextResponse } from "next/server";
// Prefer using your existing DB helpers if available:
import { createBusiness } from "@/lib/database"; // <-- if you have it

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name: string = (body.name ?? body.businessName ?? "").trim();
    const description: string = (body.description ?? body.businessDescription ?? "").trim();
    const brandColor: string | null = body.brandColor ?? null;

    if (!name) {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 });
    }

    // If you already have createBusiness in lib/database, use it:
    if (typeof createBusiness === "function") {
      const business = await createBusiness({ name, description, brandColor });
      return NextResponse.json({ business }, { status: 201 });
    }

    // ---- fallback implementation using pg when createBusiness doesn't exist ----
    // npm i pg  (run once in your project)
    // Make sure DATABASE_URL is set in your Next.js .env(.local) (pooler URL is OK)
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const { rows } = await pool.query(
      `INSERT INTO businesses (name, description, brand_color)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, brand_color`,
      [name, description, brandColor]
    );
    return NextResponse.json({ business: rows[0] }, { status: 201 });
  } catch (err) {
    console.error("create business error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
