import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const CERTIFICATES_BUCKET = "certificates";

/**
 * Uses the caller's own session client throughout, not the service role —
 * both the certificates table and the certificates storage bucket already
 * have RLS policies scoping visibility to the certificate's own user, the
 * org's org_ansvarlig/kurs_ansvarlig, kundeadmin, and superadmin, so no
 * elevated privileges are needed to serve this download.
 */
export async function GET(_request: NextRequest, { params }: { params: { certUuid: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: cert } = await supabase
    .from("certificates")
    .select("pdf_storage_path")
    .eq("cert_uuid", params.certUuid)
    .maybeSingle();
  if (!cert) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(CERTIFICATES_BUCKET)
    .download(cert.pdf_storage_path);
  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="kursbevis-${params.certUuid}.pdf"`,
    },
  });
}
