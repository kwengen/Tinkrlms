import type { LaunchMethodType, MoveOnType } from "../types/database";

export interface ParsedAu {
  kind: "au";
  publisherId: string; // au@id — import/version-pinning only, never runtime activityId
  title: string;
  description: string | null;
  launchUrl: string; // relative, as authored in <url>
  moveOn: MoveOnType;
  masteryScore: number | null;
  launchMethod: LaunchMethodType;
}

export interface ParsedBlock {
  kind: "block";
  publisherId: string; // block@id
  title: string;
  description: string | null;
  items: ParsedItem[];
}

export type ParsedItem = ParsedAu | ParsedBlock;

export interface ParsedCourse {
  publisherCourseId: string; // course@id
  title: string;
  description: string | null;
  items: ParsedItem[];
}

export interface Cmi5ParseResult {
  ok: boolean;
  course?: ParsedCourse;
  errors: string[];
}

/** Flattened, DB-ready shape produced by flattenCourseStructure(). */
export interface FlatBlock {
  id: string; // LMS-generated, embedded verbatim in activityId
  activityId: string;
  parentBlockId: string | null;
  blockIndex: number;
  publisherBlockId: string;
  title: string;
  description: string | null;
}

export interface FlatAu {
  id: string;
  activityId: string;
  blockId: string | null;
  auIndex: number;
  publisherId: string;
  launchUrl: string;
  moveOn: MoveOnType;
  masteryScore: number | null;
  launchMethod: LaunchMethodType;
}

export interface FlattenedCourseStructure {
  blocks: FlatBlock[];
  aus: FlatAu[];
}
