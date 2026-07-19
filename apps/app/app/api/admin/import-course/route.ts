import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { importCmi5Course, type ImportCoursePorts } from "@tinkr/shared";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const STORAGE_BUCKET = "content-packages";

const fieldsSchema = z.object({
  versionLabel: z.string().min(1),
  courseId: z.string().uuid().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  publisher: z.string().optional(),
});

function contentTypeFor(path: string): string {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  const types: Record<string, string> = {
    ".html": "text/html",
    ".htm": "text/html",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".xml": "application/xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
  };
  return types[ext] ?? "application/octet-stream";
}

export async function POST(request: NextRequest) {
  const sessionClient = createServerSupabaseClient();
  const {
    data: { user: caller },
  } = await sessionClient.auth.getUser();
  if (!caller) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: callerRoles } = await sessionClient
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id);
  const isSuperadmin = (callerRoles ?? []).some((r) => r.role === "superadmin");
  if (!isSuperadmin) {
    // Kurskatalog is superadmin-write-only in v1 (bestilling §7).
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("package");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'package' file field" }, { status: 400 });
  }

  const parsedFields = fieldsSchema.safeParse({
    versionLabel: formData.get("versionLabel"),
    courseId: formData.get("courseId") || undefined,
    title: formData.get("title") || undefined,
    description: formData.get("description") || undefined,
    publisher: formData.get("publisher") || undefined,
  });
  if (!parsedFields.success) {
    return NextResponse.json({ error: parsedFields.error.flatten() }, { status: 400 });
  }
  const fields = parsedFields.data;
  if (!fields.courseId && !fields.title) {
    return NextResponse.json(
      { error: "Provide courseId (new version of an existing course) or title (new course)" },
      { status: 400 },
    );
  }

  const admin = getServiceRoleSupabaseClient();

  const ports: ImportCoursePorts = {
    async uploadFile(storagePath, content) {
      const { error } = await admin.storage.from(STORAGE_BUCKET).upload(storagePath, content, {
        contentType: contentTypeFor(storagePath),
        upsert: false, // immutable per-version path (bestilling §9c) — never overwrite
      });
      if (error) throw new Error(`Storage upload failed for ${storagePath}: ${error.message}`);
    },
    async insertContentPackage(row) {
      const { data, error } = await admin.from("content_packages").insert(row).select("id").single();
      if (error || !data) throw new Error(`insertContentPackage failed: ${error?.message}`);
      return data;
    },
    async insertCourse(row) {
      const { data, error } = await admin.from("courses").insert(row).select("id").single();
      if (error || !data) throw new Error(`insertCourse failed: ${error?.message}`);
      return data;
    },
    async insertCourseVersion(row) {
      const { data, error } = await admin.from("course_versions").insert(row).select("id").single();
      if (error || !data) throw new Error(`insertCourseVersion failed: ${error?.message}`);
      return data;
    },
    async insertCourseBlocks(rows) {
      const { error } = await admin.from("course_blocks").insert(rows);
      if (error) throw new Error(`insertCourseBlocks failed: ${error.message}`);
    },
    async insertAssignableUnits(rows) {
      const { error } = await admin.from("assignable_units").insert(rows);
      if (error) throw new Error(`insertAssignableUnits failed: ${error.message}`);
    },
    async versionLabelExists(courseId, versionLabel) {
      const { data } = await admin
        .from("course_versions")
        .select("id")
        .eq("course_id", courseId)
        .eq("version_label", versionLabel)
        .maybeSingle();
      return data !== null;
    },
  };

  const zipBuffer = Buffer.from(await file.arrayBuffer());

  let result;
  try {
    result = await importCmi5Course(
      {
        zipBuffer,
        target: {
          courseId: fields.courseId,
          title: fields.title,
          description: fields.description ?? null,
          publisher: fields.publisher ?? null,
          versionLabel: fields.versionLabel,
        },
        activityBase: `${process.env.APP_ORIGIN}/xapi/activity`,
      },
      ports,
    );
  } catch (e) {
    // A partial import (some files uploaded, DB insert failed) is a known
    // gap — see code comment at the bottom of this file.
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.errors.join("; "), errors: result.errors }, { status: 400 });
  }

  return NextResponse.json({
    courseId: result.courseId,
    courseVersionId: result.courseVersionId,
    auCount: result.auCount,
    blockCount: result.blockCount,
  });
}

// KNOWN GAP (flagging rather than guessing a fix): importCmi5Course() uploads
// files and inserts DB rows as separate sequential steps with no
// compensating rollback. If a DB insert fails after some Storage uploads
// already succeeded, or after content_packages/course inserted but
// course_versions fails, the import is left partially applied. Postgres rows
// within this route aren't wrapped in a single transaction (Supabase JS
// doesn't expose multi-statement transactions over PostgREST). Acceptable
// for v1 given superadmin-only + low import frequency, but a production
// hardening pass should either use an RPC (Postgres function) to make the DB
// side atomic, and/or add a cleanup job for orphaned storage paths.
