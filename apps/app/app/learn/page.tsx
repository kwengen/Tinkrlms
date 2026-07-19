import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export default async function LearnPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.roles.includes("bruker")) redirect("/no-access");

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mine kurs</h1>
        <SignOutButton />
      </div>
      <p className="mt-2 text-gray-600">
        Innlogget som {ctx.fullName ?? ctx.email}.
      </p>
      <p className="mt-6 text-sm text-gray-400">
        Innmeldte kurs, fremdrift og diplomer kommer i neste byggefase.
      </p>
    </main>
  );
}
