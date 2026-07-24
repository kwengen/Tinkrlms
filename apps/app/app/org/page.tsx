import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export default async function OrgPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");

  const isOrgAnsvarlig = ctx.roles.includes("org_ansvarlig");
  const isKursAnsvarlig = ctx.roles.includes("kurs_ansvarlig");
  if (!isOrgAnsvarlig && !isKursAnsvarlig) redirect("/no-access");

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Min organisasjon</h1>
        <SignOutButton />
      </div>
      <p className="mt-2 text-gray-600">
        Innlogget som {ctx.fullName ?? ctx.email} ({ctx.roles.join(", ")}).
      </p>

      <ul className="mt-6 flex flex-col gap-2 text-sm">
        {isOrgAnsvarlig && (
          <li>
            <Link href="/admin/users/invite" className="text-blue-700 underline">
              Inviter bruker til organisasjonen
            </Link>
          </li>
        )}
        {isOrgAnsvarlig && (
          <li>
            <Link href="/org/enroll" className="text-blue-700 underline">
              Meld på kurs
            </Link>
          </li>
        )}
        {(isOrgAnsvarlig || isKursAnsvarlig) && (
          <li>
            <Link href="/org/assignments" className="text-blue-700 underline">
              Tildelinger
            </Link>
          </li>
        )}
        {isOrgAnsvarlig && (
          <li>
            <Link href="/org/catalog" className="text-blue-700 underline">
              Kurskatalog (selvpåmelding)
            </Link>
          </li>
        )}
        <li className="text-gray-400">Resultater og fremdrift kommer i neste byggefase.</li>
      </ul>
    </main>
  );
}
