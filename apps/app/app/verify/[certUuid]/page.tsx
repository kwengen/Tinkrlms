import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

/**
 * Public, no-login page (bestilling §8; /verify/* is exempted in
 * middleware.ts). Uses the service role deliberately and narrowly: this is
 * the one place cross-tenant certificate data is INTENDED to be readable by
 * anyone with the link, but only the PII-approved fields (bestilling §8:
 * full name, course name, date, status — not email, not org unless the
 * customer requires it) are ever selected or rendered; see the "no anon
 * policy" comment on the certificates table RLS for why this isn't just a
 * public SELECT policy instead.
 */
export default async function VerifyPage({ params }: { params: { certUuid: string } }) {
  const admin = getServiceRoleSupabaseClient();

  const { data: cert } = await admin
    .from("certificates")
    .select("issued_at, revoked, user_id, course_version_id")
    .eq("cert_uuid", params.certUuid)
    .maybeSingle();

  if (!cert) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold text-red-700">Ugyldig sertifikat</h1>
        <p className="mt-2 text-sm text-gray-600">
          Fant ingen kursbevis med denne IDen.
        </p>
      </main>
    );
  }

  const [{ data: profile }, { data: courseVersion }] = await Promise.all([
    admin.from("profiles").select("full_name").eq("user_id", cert.user_id).maybeSingle(),
    admin
      .from("course_versions")
      .select("version_label, courses(title)")
      .eq("id", cert.course_version_id)
      .maybeSingle(),
  ]);
  const courseTitle = (courseVersion?.courses as unknown as { title: string } | null)?.title ?? "Ukjent kurs";

  return (
    <main className="mx-auto max-w-md p-8 text-center">
      {cert.revoked ? (
        <h1 className="text-xl font-semibold text-red-700">Kursbeviset er trukket tilbake</h1>
      ) : (
        <h1 className="text-xl font-semibold text-green-700">Gyldig kursbevis ✓</h1>
      )}
      <dl className="mt-6 flex flex-col gap-2 text-left text-sm">
        <div>
          <dt className="text-gray-500">Navn</dt>
          <dd className="font-medium">{profile?.full_name ?? "Ukjent"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Kurs</dt>
          <dd className="font-medium">
            {courseTitle} ({courseVersion?.version_label})
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Utstedt</dt>
          <dd className="font-medium">{new Date(cert.issued_at).toISOString().slice(0, 10)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Sertifikat-ID</dt>
          <dd className="font-mono text-xs">{params.certUuid}</dd>
        </div>
      </dl>
    </main>
  );
}
