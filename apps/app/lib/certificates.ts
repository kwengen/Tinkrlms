import { buildCertificatePdf } from "@tinkr/shared";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

const CERTIFICATES_BUCKET = "certificates";

/**
 * Called after every xAPI ingest (bestilling §8): issues a certificate the
 * first time an enrollment becomes course-satisfied. Cheap no-op otherwise
 * (one SELECT). PDF generation + Storage upload happen here BEFORE the
 * atomic DB claim (issue_certificate RPC) — see the KNOWN GAP comment on
 * that function for the narrow, harmless race this implies.
 */
export async function maybeIssueCertificate(enrollmentId: string): Promise<void> {
  const admin = getServiceRoleSupabaseClient();

  const { data: cc } = await admin
    .from("course_completion")
    .select("satisfied, certificate_id, user_id, org_id, course_version_id, completed_at")
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();
  if (!cc || !cc.satisfied || cc.certificate_id) return;

  const [{ data: profile }, { data: courseVersion }, { data: org }] = await Promise.all([
    admin.from("profiles").select("full_name").eq("user_id", cc.user_id).maybeSingle(),
    admin.from("course_versions").select("courses(title)").eq("id", cc.course_version_id).single(),
    admin.from("organizations").select("name").eq("id", cc.org_id).single(),
  ]);
  const courseTitle =
    (courseVersion?.courses as unknown as { title: string } | null)?.title ?? "Ukjent kurs";

  const certUuid = crypto.randomUUID();
  const storagePath = `${cc.org_id}/${certUuid}.pdf`;

  const pdfBytes = await buildCertificatePdf({
    certUuid,
    learnerName: profile?.full_name ?? "Ukjent",
    courseTitle,
    orgName: org?.name ?? "Ukjent organisasjon",
    completedAt: cc.completed_at ?? new Date().toISOString(),
    verifyUrl: `${process.env.APP_ORIGIN}/verify/${certUuid}`,
  });

  const { error: uploadError } = await admin.storage
    .from(CERTIFICATES_BUCKET)
    .upload(storagePath, Buffer.from(pdfBytes), { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    console.error("[certificates] Storage upload failed", { enrollmentId, storagePath, uploadError });
    return;
  }

  const { error: rpcError } = await admin.rpc("issue_certificate", {
    p_enrollment_id: enrollmentId,
    p_cert_uuid: certUuid,
    p_pdf_storage_path: storagePath,
  });
  if (rpcError) {
    console.error("[certificates] issue_certificate RPC failed", { enrollmentId, rpcError });
  }
}
