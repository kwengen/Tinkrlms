export default function NoAccessPage() {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">Ingen tilgang ennå</h1>
      <p className="mt-2 text-gray-600">
        Kontoen din er opprettet, men har ikke fått noen rolle tildelt ennå.
        Ta kontakt med administratoren i din organisasjon.
      </p>
      <form action="/auth/signout" method="post" className="mt-6">
        <button type="submit" className="rounded bg-gray-900 px-3 py-2 text-white">
          Logg ut
        </button>
      </form>
    </main>
  );
}
