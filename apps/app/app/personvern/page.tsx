import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { AckButton } from "./AckButton";

// TEMPLATE TEXT — needs legal/customer review before real production use.
// This codebase cannot know the actual data controller's identity, DPO
// contact, or exact retention period; those are customer-specific facts.
export default async function PersonvernPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");

  const next = searchParams.next && searchParams.next.startsWith("/") ? searchParams.next : "/post-login";

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Personvernerklæring</h1>
      <div className="mt-4 flex flex-col gap-3 text-sm text-gray-700">
        <p>
          Denne plattformen registrerer opplysninger om deg for å dokumentere gjennomføring av
          obligatorisk opplæring pålagt av din arbeidsgiver.
        </p>
        <p>
          <strong>Hvilke opplysninger:</strong> navn, hvilken organisasjon du tilhører, hvilke kurs du er
          meldt på, og resultater/fremdrift for disse kursene (starttidspunkt, fullføring, bestått/ikke
          bestått, poengsum).
        </p>
        <p>
          <strong>Behandlingsgrunnlag:</strong> rettslig forpliktelse/berettiget interesse — ikke
          samtykke. Ettersom opplæringen er obligatorisk fra arbeidsgiver, kan du ikke fritt velge bort
          behandlingen; denne siden er derfor en informasjonsside, ikke en samtykkeforespørsel.
        </p>
        <p>
          <strong>Hvem har tilgang:</strong> ansvarlige personer i din egen organisasjon, samt
          plattformadministrator. Opplysningene deles ikke med andre organisasjoner.
        </p>
        <p>
          <strong>Lagringstid:</strong> så lenge arbeidsgiver har behov for å dokumentere gjennomført
          opplæring.
        </p>
        <p>
          <strong>Dine rettigheter:</strong> du kan be om innsyn i og retting av opplysningene om deg.
          Fordi opplæringshistorikk må kunne dokumenteres i ettertid, kan den ikke slettes fritt, men du
          kan be om at direkte identifiserende opplysninger (navn, innloggingstilgang) fjernes
          (pseudonymisering) mens selve opplæringshistorikken beholdes.
        </p>
        <p>Ta kontakt med din organisasjons ansvarlige hvis du har spørsmål.</p>
      </div>
      <AckButton next={next} />
    </main>
  );
}
