import { XMLParser } from "fast-xml-parser";
import type { Cmi5ParseResult, ParsedAu, ParsedBlock, ParsedCourse, ParsedItem } from "./types";
import type { LaunchMethodType, MoveOnType } from "../types/database";

const CMI5_NAMESPACE = "https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd";
const MOVE_ON_VALUES: MoveOnType[] = [
  "Passed",
  "Completed",
  "CompletedOrPassed",
  "CompletedAndPassed",
  "NotApplicable",
];
const LAUNCH_METHOD_VALUES: LaunchMethodType[] = ["AnyWindow", "OwnWindow"];

// cmi5 spec default when moveOn is omitted.
const DEFAULT_MOVE_ON: MoveOnType = "CompletedAndPassed";
const DEFAULT_LAUNCH_METHOD: LaunchMethodType = "AnyWindow";

// Node shape produced by fast-xml-parser with preserveOrder: true — each
// element is `{ [tagName]: children[], ":@"?: attrs }`. Using `preserveOrder`
// (rather than the default grouped-by-tag-name mode) is deliberate: cmi5
// allows <au> and <block> to interleave as siblings, and that document order
// is what au_index/block_index must reflect for course navigation.
type XmlNode = Record<string, unknown> & { ":@"?: Record<string, string> };

function tagName(node: XmlNode): string | undefined {
  return Object.keys(node).find((k) => k !== ":@");
}

function attrs(node: XmlNode): Record<string, string> {
  return node[":@"] ?? {};
}

function children(node: XmlNode): XmlNode[] {
  const name = tagName(node);
  if (!name) return [];
  const value = node[name];
  return Array.isArray(value) ? (value as XmlNode[]) : [];
}

function findChildren(nodeChildren: XmlNode[], name: string): XmlNode[] {
  return nodeChildren.filter((c) => tagName(c) === name);
}

function textOf(nodeChildren: XmlNode[]): string {
  return nodeChildren
    .filter((c) => "#text" in c)
    .map((c) => String((c as Record<string, unknown>)["#text"]))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** First <langstring> child's text — see parse.ts module doc for the i18n caveat. */
function langString(elementChildren: XmlNode[], elementName: string): string | null {
  const el = findChildren(elementChildren, elementName)[0];
  if (!el) return null;
  const strings = findChildren(children(el), "langstring");
  if (strings.length === 0) return null;
  const text = textOf(children(strings[0]!));
  return text.length > 0 ? text : null;
}

const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:|^\/\//;

function parseAu(node: XmlNode, errors: string[], pathLabel: string): ParsedAu | null {
  const a = attrs(node);
  const nodeChildren = children(node);
  const publisherId = a["id"];
  if (!publisherId) {
    errors.push(`${pathLabel}: <au> is missing required "id" attribute`);
    return null;
  }

  const title = langString(nodeChildren, "title");
  if (!title) {
    errors.push(`${pathLabel} (${publisherId}): <au> is missing a <title><langstring> value`);
  }

  const urlEl = findChildren(nodeChildren, "url")[0];
  const launchUrl = urlEl ? textOf(children(urlEl)) : "";
  if (!launchUrl) {
    errors.push(`${pathLabel} (${publisherId}): <au> is missing required <url>`);
  } else if (ABSOLUTE_URL_PATTERN.test(launchUrl)) {
    // bestilling §9c: reject external absolute launch URLs — this LMS only hosts local content.
    errors.push(
      `${pathLabel} (${publisherId}): <url> "${launchUrl}" is an absolute/external URL, not permitted`,
    );
  }

  let moveOn: MoveOnType = DEFAULT_MOVE_ON;
  if (a["moveOn"] !== undefined) {
    if (!MOVE_ON_VALUES.includes(a["moveOn"] as MoveOnType)) {
      errors.push(`${pathLabel} (${publisherId}): invalid moveOn "${a["moveOn"]}"`);
    } else {
      moveOn = a["moveOn"] as MoveOnType;
    }
  }

  let masteryScore: number | null = null;
  if (a["masteryScore"] !== undefined) {
    const parsed = Number(a["masteryScore"]);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
      errors.push(`${pathLabel} (${publisherId}): masteryScore "${a["masteryScore"]}" must be a number in [0,1]`);
    } else {
      masteryScore = parsed;
    }
  }
  if (moveOn === "NotApplicable" && masteryScore !== null) {
    errors.push(`${pathLabel} (${publisherId}): masteryScore must be omitted when moveOn=NotApplicable`);
    masteryScore = null;
  }

  let launchMethod: LaunchMethodType = DEFAULT_LAUNCH_METHOD;
  if (a["launchMethod"] !== undefined) {
    if (!LAUNCH_METHOD_VALUES.includes(a["launchMethod"] as LaunchMethodType)) {
      errors.push(`${pathLabel} (${publisherId}): invalid launchMethod "${a["launchMethod"]}"`);
    } else {
      launchMethod = a["launchMethod"] as LaunchMethodType;
    }
  }

  return {
    kind: "au",
    publisherId,
    title: title ?? "",
    description: langString(nodeChildren, "description"),
    launchUrl,
    moveOn,
    masteryScore,
    launchMethod,
  };
}

function parseItems(nodeChildren: XmlNode[], errors: string[], pathLabel: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  // Encountered-order traversal, filtering to au/block; <requires>/<requires>/
  // <objectives>/anything else is silently ignored (bestilling §4: cmi5 has
  // no prerequisite mechanism, Studio never emits these, and the parser must
  // tolerate unknown/unused elements rather than fail on them).
  for (const child of nodeChildren) {
    const name = tagName(child);
    if (name === "au") {
      const au = parseAu(child, errors, pathLabel);
      if (au) items.push(au);
    } else if (name === "block") {
      const block = parseBlock(child, errors, pathLabel);
      if (block) items.push(block);
    }
  }
  return items;
}

function parseBlock(node: XmlNode, errors: string[], pathLabel: string): ParsedBlock | null {
  const a = attrs(node);
  const publisherId = a["id"];
  if (!publisherId) {
    errors.push(`${pathLabel}: <block> is missing required "id" attribute`);
    return null;
  }
  const nodeChildren = children(node);
  const nestedLabel = `${pathLabel} > block ${publisherId}`;
  return {
    kind: "block",
    publisherId,
    title: langString(nodeChildren, "title") ?? "",
    description: langString(nodeChildren, "description"),
    items: parseItems(nodeChildren, errors, nestedLabel),
  };
}

export function parseCmi5Xml(xml: string): Cmi5ParseResult {
  const errors: string[] = [];

  let root: XmlNode[];
  try {
    const parser = new XMLParser({
      preserveOrder: true,
      ignoreAttributes: false,
      attributeNamePrefix: "",
      textNodeName: "#text",
      trimValues: true,
    });
    root = parser.parse(xml) as XmlNode[];
  } catch (e) {
    return { ok: false, errors: [`cmi5.xml is not well-formed XML: ${(e as Error).message}`] };
  }

  const courseStructureNode = root.find((n) => tagName(n) === "courseStructure");
  if (!courseStructureNode) {
    return { ok: false, errors: ["cmi5.xml has no root <courseStructure> element"] };
  }

  const rootAttrs = attrs(courseStructureNode);
  if (rootAttrs["xmlns"] !== CMI5_NAMESPACE) {
    errors.push(
      `<courseStructure> xmlns must be "${CMI5_NAMESPACE}", got "${rootAttrs["xmlns"] ?? "(none)"}"`,
    );
  }

  const topChildren = children(courseStructureNode);
  const courseNodes = findChildren(topChildren, "course");
  if (courseNodes.length !== 1) {
    errors.push(`<courseStructure> must contain exactly one <course>, found ${courseNodes.length}`);
    return { ok: false, errors };
  }
  const courseNode = courseNodes[0]!;
  const courseAttrs = attrs(courseNode);
  const publisherCourseId = courseAttrs["id"];
  if (!publisherCourseId) {
    errors.push("<course> is missing required \"id\" attribute");
  }

  const courseChildren = children(courseNode);
  const title = langString(courseChildren, "title");
  if (!title) {
    errors.push("<course> is missing a <title><langstring> value");
  }

  const items = parseItems(topChildren, errors, "course");

  function countAus(list: ParsedItem[]): number {
    return list.reduce((sum, item) => sum + (item.kind === "au" ? 1 : countAus(item.items)), 0);
  }
  if (countAus(items) === 0) {
    errors.push("cmi5.xml contains no <au> elements (directly or nested in <block>)");
  }

  function collectIds(list: ParsedItem[], seen: Map<string, string>) {
    for (const item of list) {
      const kind = item.kind;
      if (seen.has(item.publisherId)) {
        errors.push(`duplicate id "${item.publisherId}" used by both a ${seen.get(item.publisherId)} and a ${kind}`);
      } else {
        seen.set(item.publisherId, kind);
      }
      if (item.kind === "block") collectIds(item.items, seen);
    }
  }
  collectIds(items, new Map());

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const course: ParsedCourse = {
    publisherCourseId: publisherCourseId!,
    title: title!,
    description: langString(courseChildren, "description"),
    items,
  };

  return { ok: true, course, errors: [] };
}
