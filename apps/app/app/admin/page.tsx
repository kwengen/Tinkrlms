import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserContext } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export default async function AdminPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");

  const isSuperadmin = ctx.roles.includes("superadmin");
  const isKundeadmin = ctx.roles.includes("kundeadmin");
  if (!isSuperadmin && !isKundeadmin) redirect("/no-access");

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Plattformadmin</h1>
        <SignOutButton />
      </div>
      <p className="mt-2 text-gray-600">
        Innlogget som {ctx.fullName ?? ctx.email} ({ctx.roles.join(", ")}).
      </p>

      <ul className="mt-6 flex flex-col gap-2 text-sm">
        {isSuperadmin && (
          <>
            <li>
              <Link href="/admin/users/invite" className="text-blue-700 underline">
                Inviter ny bruker
              </Link>
            </li>
            <li>
              <Link href="/admin/courses/import" className="text-blue-700 underline">
                Importer cmi5-kurs
              </Link>
            </li>
            <li>
              <Link href="/admin/users" className="text-blue-700 underline">
                Brukere
              </Link>
            </li>
          </>
        )}
        <li className="text-gray-400">
          Organisasjoner og kundeadmin-tildeling kommer i neste byggefase.
        </li>
      </ul>
    </main>
  );
}
