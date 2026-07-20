import { parseCmi5Xml } from "../cmi5/parse";
import { flattenCourseStructure } from "../cmi5/flatten";
import { safeExtractZip, type ZipLimits } from "./extract-zip";
import { sha256Hex } from "./hash";
import type { Json, LaunchMethodType, MoveOnType } from "../types/database";

export interface ImportCourseTarget {
  /** New course: provide title (+ optional description/publisher). Existing course: provide courseId. */
  courseId?: string;
  title?: string;
  description?: string | null;
  publisher?: string | null;
  versionLabel: string;
}

export interface ImportCourseInput {
  zipBuffer: Buffer;
  target: ImportCourseTarget;
  activityBase: string; // `${APP_ORIGIN}/xapi/activity`, no trailing slash
  zipLimits?: ZipLimits;
}

export interface ContentPackageInsert {
  storage_path: string;
  imsmanifest_or_cmi5_parsed: Json;
  package_sha256: string;
  size_bytes: number;
  file_count: number;
}

export interface CourseInsert {
  title: string;
  description: string | null;
  publisher: string | null;
}

export interface CourseVersionInsert {
  course_id: string;
  version_label: string;
  content_package_id: string;
}

export interface CourseBlockInsert {
  id: string;
  course_version_id: string;
  parent_block_id: string | null;
  block_index: number;
  publisher_block_id: string;
  activity_id: string;
  title: string | null;
  description: string | null;
}

export interface AssignableUnitInsert {
  id: string;
  course_version_id: string;
  block_id: string | null;
  au_index: number;
  publisher_id: string;
  activity_id: string;
  launch_url: string;
  move_on: MoveOnType;
  mastery_score: number | null;
  launch_method: LaunchMethodType;
}

/**
 * Side-effecting operations injected as a "ports" object so the import
 * orchestration itself (validate → parse → flatten → persist, in that order)
 * is unit-testable without a real Supabase project or Storage bucket —
 * neither is reachable from this environment. The real API route wires these
 * to the service-role client + Storage; tests wire in-memory fakes.
 */
export interface ImportCoursePorts {
  uploadFile(storagePath: string, content: Buffer): Promise<void>;
  insertContentPackage(row: ContentPackageInsert): Promise<{ id: string }>;
  insertCourse(row: CourseInsert): Promise<{ id: string }>;
  insertCourseVersion(row: CourseVersionInsert): Promise<{ id: string }>;
  insertCourseBlocks(rows: CourseBlockInsert[]): Promise<void>;
  insertAssignableUnits(rows: AssignableUnitInsert[]): Promise<void>;
  /** true if this course already has a version with this label (immutability guard, bestilling §9c). */
  versionLabelExists(courseId: string, versionLabel: string): Promise<boolean>;
}

export interface ImportCourseResult {
  ok: boolean;
  errors: string[];
  courseId?: string;
  courseVersionId?: string;
  auCount?: number;
  blockCount?: number;
}

export async function importCmi5Course(
  input: ImportCourseInput,
  ports: ImportCoursePorts,
): Promise<ImportCourseResult> {
  const { target } = input;

  if (!target.courseId && !target.title) {
    return { ok: false, errors: ["Either target.courseId (new version) or target.title (new course) is required"] };
  }

  const zipResult = safeExtractZip(input.zipBuffer, input.zipLimits);
  if (!zipResult.ok) {
    return { ok: false, errors: zipResult.errors };
  }

  const cmi5xmlFile = zipResult.files.find((f) => f.path === "cmi5.xml");
  if (!cmi5xmlFile) {
    return { ok: false, errors: ["Package has no cmi5.xml at its root"] };
  }

  const parseResult = parseCmi5Xml(cmi5xmlFile.content.toString("utf-8"));
  if (!parseResult.ok || !parseResult.course) {
    return { ok: false, errors: parseResult.errors };
  }

  let courseId = target.courseId;
  if (courseId) {
    if (await ports.versionLabelExists(courseId, target.versionLabel)) {
      // bestilling §9c/§4: immutable storage path per version — never overwrite.
      return {
        ok: false,
        errors: [`Course already has a version labeled "${target.versionLabel}"; versions are immutable`],
      };
    }
  } else {
    const course = await ports.insertCourse({
      title: target.title!,
      description: target.description ?? null,
      publisher: target.publisher ?? null,
    });
    courseId = course.id;
  }

  // Immutable per-version storage path (bestilling §4: "gammel pakke overskrives ALDRI").
  const storagePath = `${courseId}/${target.versionLabel}`;
  for (const file of zipResult.files) {
    await ports.uploadFile(`${storagePath}/${file.path}`, file.content);
  }

  const contentPackage = await ports.insertContentPackage({
    storage_path: storagePath,
    imsmanifest_or_cmi5_parsed: parseResult.course as unknown as Json,
    package_sha256: sha256Hex(input.zipBuffer),
    size_bytes: input.zipBuffer.length,
    file_count: zipResult.files.length,
  });

  const courseVersion = await ports.insertCourseVersion({
    course_id: courseId,
    version_label: target.versionLabel,
    content_package_id: contentPackage.id,
  });

  const { blocks, aus } = flattenCourseStructure(parseResult.course, {
    activityBase: input.activityBase,
  });

  if (blocks.length > 0) {
    await ports.insertCourseBlocks(
      blocks.map((b) => ({
        id: b.id,
        course_version_id: courseVersion.id,
        parent_block_id: b.parentBlockId,
        block_index: b.blockIndex,
        publisher_block_id: b.publisherBlockId,
        activity_id: b.activityId,
        title: b.title || null,
        description: b.description,
      })),
    );
  }

  await ports.insertAssignableUnits(
    aus.map((au) => ({
      id: au.id,
      course_version_id: courseVersion.id,
      block_id: au.blockId,
      au_index: au.auIndex,
      publisher_id: au.publisherId,
      activity_id: au.activityId,
      launch_url: au.launchUrl,
      move_on: au.moveOn,
      mastery_score: au.masteryScore,
      launch_method: au.launchMethod,
    })),
  );

  return {
    ok: true,
    errors: [],
    courseId,
    courseVersionId: courseVersion.id,
    auCount: aus.length,
    blockCount: blocks.length,
  };
}
