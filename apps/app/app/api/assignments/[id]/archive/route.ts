import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Terminal — no unarchive route exists (tillegg v2 §1, deliberate).
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: existing } = await supabase
    .from("assignments")
    .select("archived_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.archived_at) {
    return NextResponse.json({ error: "Already archived" }, { status: 409 });
  }

  const { data: updated, error } = await supabase
    .from("assignments")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("*")
    .maybeSingle();
  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? "Failed to archive" }, { status: 500 });
  }

  return NextResponse.json(updated);
}
