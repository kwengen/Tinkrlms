import { redirect } from "next/navigation";

export default function HomePage() {
  // Middleware already ensures only an authenticated session reaches here;
  // hand off to /post-login for role-based landing (/admin, /org, /learn).
  redirect("/post-login");
}
