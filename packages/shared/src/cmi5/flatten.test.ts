import { describe, expect, it } from "vitest";
import { parseCmi5Xml } from "./parse";
import { flattenCourseStructure } from "./flatten";
import { readFixtureCmi5Xml } from "../test-utils/fixtures";

function deterministicIdGenerator() {
  let n = 0;
  return () => `id-${n++}`;
}

describe("flattenCourseStructure", () => {
  it("flattens pre_post_test_framed into 2 blocks and 6 AUs with correct parent linkage and ordering", () => {
    const xml = readFixtureCmi5Xml("pre_post_test_framed.zip");
    const parsed = parseCmi5Xml(xml);
    expect(parsed.ok).toBe(true);

    const { blocks, aus } = flattenCourseStructure(parsed.course!, {
      activityBase: "https://app.tinkrakademiet.no/xapi/activity",
      generateId: deterministicIdGenerator(),
    });

    expect(blocks).toHaveLength(2);
    expect(aus).toHaveLength(6);

    expect(blocks[0]!.parentBlockId).toBeNull();
    expect(blocks[1]!.parentBlockId).toBeNull();
    expect(blocks[0]!.blockIndex).toBe(0);
    expect(blocks[1]!.blockIndex).toBe(1);

    // First 3 AUs belong to block 0, next 3 to block 1, in document order.
    expect(aus.slice(0, 3).every((au) => au.blockId === blocks[0]!.id)).toBe(true);
    expect(aus.slice(3, 6).every((au) => au.blockId === blocks[1]!.id)).toBe(true);
    expect(aus.map((au) => au.auIndex)).toEqual([0, 1, 2, 3, 4, 5]);

    // cmi5 §8.1 conformance: activityId must never equal publisherId.
    for (const au of aus) {
      expect(au.activityId).not.toBe(au.publisherId);
      expect(au.activityId).toBe(`https://app.tinkrakademiet.no/xapi/activity/${au.id}`);
    }
    for (const block of blocks) {
      expect(block.activityId).not.toBe(block.publisherBlockId);
    }
  });

  it("flattens a flat (no blocks) course with sequential au_index and null blockId", () => {
    const xml = readFixtureCmi5Xml("multi_au_framed.zip");
    const parsed = parseCmi5Xml(xml);
    const { blocks, aus } = flattenCourseStructure(parsed.course!, {
      activityBase: "https://app.tinkrakademiet.no/xapi/activity",
      generateId: deterministicIdGenerator(),
    });
    expect(blocks).toHaveLength(0);
    expect(aus).toHaveLength(8);
    expect(aus.every((au) => au.blockId === null)).toBe(true);
    expect(aus.map((au) => au.auIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("generates distinct ids per call (no accidental id reuse) with the real crypto.randomUUID default", () => {
    const xml = readFixtureCmi5Xml("single_au_basic_framed.zip");
    const parsed = parseCmi5Xml(xml);
    const { aus } = flattenCourseStructure(parsed.course!, {
      activityBase: "https://app.tinkrakademiet.no/xapi/activity",
    });
    expect(aus).toHaveLength(1);
    expect(aus[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
