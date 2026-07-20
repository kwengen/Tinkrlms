export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className="rounded border px-3 py-1 text-sm">
        Logg ut
      </button>
    </form>
  );
}
