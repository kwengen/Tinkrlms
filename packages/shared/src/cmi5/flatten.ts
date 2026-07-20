import type { FlatAu, FlatBlock, FlattenedCourseStructure, ParsedCourse, ParsedItem } from "./types";

export interface FlattenOptions {
  /** LMS activity base, e.g. `${APP_ORIGIN}/xapi/activity`. No trailing slash. */
  activityBase: string;
  /** Injectable for deterministic tests; defaults to crypto.randomUUID. */
  generateId?: () => string;
}

/**
 * Depth-first flatten of the parsed course tree into DB-ready rows, minting
 * an LMS-generated id/activityId per AU and block — this is the cmi5 §8.1
 * conformance requirement (bestilling §4): activityId must be unique and
 * MUST NOT equal the publisher_id/au@id used for import/version-pinning.
 * au_index/block_index are a single global counter per kind, in document
 * order, so course navigation can rely on them regardless of nesting depth.
 */
export function flattenCourseStructure(
  course: ParsedCourse,
  options: FlattenOptions,
): FlattenedCourseStructure {
  const generateId = options.generateId ?? (() => crypto.randomUUID());
  const blocks: FlatBlock[] = [];
  const aus: FlatAu[] = [];
  let auIndex = 0;
  let blockIndex = 0;

  function visit(items: ParsedItem[], parentBlockId: string | null) {
    for (const item of items) {
      if (item.kind === "au") {
        const id = generateId();
        aus.push({
          id,
          activityId: `${options.activityBase}/${id}`,
          blockId: parentBlockId,
          auIndex: auIndex++,
          publisherId: item.publisherId,
          launchUrl: item.launchUrl,
          moveOn: item.moveOn,
          masteryScore: item.masteryScore,
          launchMethod: item.launchMethod,
        });
      } else {
        const id = generateId();
        blocks.push({
          id,
          activityId: `${options.activityBase}/${id}`,
          parentBlockId,
          blockIndex: blockIndex++,
          publisherBlockId: item.publisherId,
          title: item.title,
          description: item.description,
        });
        visit(item.items, id);
      }
    }
  }

  visit(course.items, null);
  return { blocks, aus };
}
