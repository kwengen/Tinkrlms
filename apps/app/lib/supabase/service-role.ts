import "server-only";
import { createServiceRoleSupabaseClient } from "@tinkr/shared";

/**
 * Service-role client for API routes that must bypass RLS by design (user
 * invites, cmi5 import, xAPI ingest, certificate generation). `server-only`
 * guarantees a build-time error if this ever gets imported into client code.
 */
export function getServiceRoleSupabaseClient() {
  return createServiceRoleSupabaseClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
