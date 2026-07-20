import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { PlayerFrame } from "./PlayerFrame";

export default async function PlayPage({ params }: { params: { auId: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect("/login");
  if (!ctx.roles.includes("bruker")) redirect("/no-access");

  return <PlayerFrame auId={params.auId} />;
}
