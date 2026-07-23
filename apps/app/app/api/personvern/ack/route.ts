import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CURRENT_PRIVACY_NOTICE_VERSION } from "@/lib/privacy";

export async function POST() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // profiles_update_own (RLS) already scopes this to the caller's own row.
  const { error } = await supabase
    .from("profiles")
    .update({
      privacy_notice_ack_at: new Date().toISOString(),
      privacy_notice_version: CURRENT_PRIVACY_NOTICE_VERSION,
    })
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
