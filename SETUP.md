# Setup — manuelle steg

Denne koden gjør alt den kan i repoet (migrasjoner, RLS, edge-/API-ruter, Vercel-config,
`.env.example`). Noen steg krever en menneskelig konto-eier (Supabase/Vercel) og gjøres
manuelt. Følg dem i rekkefølge — steg 1 er ugjenkallelig.

## 1. Opprett Supabase-prosjekt i EU (gjør dette FØRST, kan ikke endres senere)

```
supabase projects create tinkrakademiet-lms --org-id <din-org-id> --region eu-central-1 --db-password <sterkt-passord>
```

Eller via dashboardet: **New project → Region: Frankfurt (eu-central-1)**. Verifiser regionen
i prosjektinnstillingene før noe annet gjøres. Regionen er den ene tingen i denne bestillingen
som ikke kan rettes i ettertid.

Noter ned:
- `SUPABASE_URL` / project ref
- `anon` og `service_role` API-nøkler (Project Settings → API)

## 2. Koble CLI-et og kjør migrasjonene

```
supabase link --project-ref <project-ref>
supabase db push          # kjører supabase/migrations/*.sql mot skyprosjektet
```

For lokal utvikling først (anbefalt før du treffer skyprosjektet):
```
supabase start             # lokal Postgres + Auth + Storage via Docker
supabase db reset          # kjører alle migrasjoner fra scratch lokalt
```

## 3. Auth-oppsett i Supabase-dashboardet

- Skru på **Email** provider med både magic link og passord (Authentication → Providers).
- SAML/SSO skal IKKE skrus på i v1 (eksplisitt ut av scope).
- Sett `Site URL` = `APP_ORIGIN`, og legg `PLAYER_ORIGIN` i tillatte redirect-URLer kun
  hvis/når player-appen selv trenger Supabase-sesjon (den skal i utgangspunktet ALDRI
  ha tilgang til brukerens innloggingssesjon — se arkitektur §3).

## 4. Storage buckets

- `content-packages` — importerte cmi5-zip-er og utpakket innhold som player-origin server.
- `certificates` — genererte PDF-diplomer.
Sett riktige tilgangspolicyer (privat by default; server-side-generert signerte URL-er der nødvendig).

## 5. Vercel-prosjekter (to separate deployments, én per origin)

Opprett to Vercel-prosjekter fra dette repoet:
- **app** → peker på `apps/app`, domene `app.tinkrakademiet.no`
- **player** → peker på `apps/player`, domene `player.tinkrakademiet.no`

For hvert prosjekt: sett `Root Directory` til hhv. `apps/app` / `apps/player`, og legg inn
miljøvariablene fra `.env.example` (se kommentarer der for hvilke som er server-only vs.
`NEXT_PUBLIC_*`). `SUPABASE_SERVICE_ROLE_KEY` og `LAUNCH_JWT_SECRET` skal KUN inn i
**app**-prosjektet (og eventuelt server-only i player der ingest-ruter bor — se arkitekturnotat
i `docs/`), ALDRI i noe som bygger til klientbundlen.

## 6. Domener og DNS

Pek `app.tinkrakademiet.no` og `player.tinkrakademiet.no` til de respektive Vercel-prosjektene.
De to origins er en sikkerhetsgrense (§3) — ikke server dem fra samme Vercel-prosjekt/domene.

## 7. CATAPULT (testing)

```
bash scripts/fetch-catapult.sh     # kloner github.com/adlnet/CATAPULT til .catapult/ (gitignored)
```
Brukes for LMS Test Suite (LTS) og `course_examples`. Et lite utvalg pakker er allerede
vendret inn i `test/fixtures/cmi5-packages/` for raske enhetstester av parser/import uten
nettverkstilgang — se `test/fixtures/cmi5-packages/ATTRIBUTION.md`.

## 8. Hva som IKKE er gjort automatisk

- Faktisk oppretting av Supabase-prosjekt og Vercel-prosjekter (steg 1 og 5).
- DNS for de to domenene (steg 6).
- GDPR-retensjonsperioder (bestilling §9) — juridisk fastsatt, ikke et teknisk valg. Kodebasen
  bruker konfigurerbare placeholder-verdier inntil dere gir oss de faktiske periodene.
