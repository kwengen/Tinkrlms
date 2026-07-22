import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { guessContentType } from "@tinkr/shared";

export const runtime = "nodejs";

const STORAGE_BUCKET = "content-packages";

/**
 * Serves cmi5 package files out of the content-packages Storage bucket.
 * Player origin only ever holds SUPABASE_ANON_KEY (bestilling §11b) — this
 * works because of the public-read Storage policy on this one bucket
 * (see supabase/migrations/20260716231300_storage_content_packages_public_read.sql).
 * Long/immutable caching is correct because storage_path is immutable per
 * course version (bestilling §4/§9c: a version's package is never overwritten).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const storagePath = params.path.join("/");
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath);
  if (error || !data) {
    const details = error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : "no error object, but no data";
    console.error("[content proxy] download failed", { storagePath, details });
    return new NextResponse(`Not found: ${storagePath} — ${details}`, { status: 404 });
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": guessContentType(storagePath),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
