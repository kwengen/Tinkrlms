import { describe, expect, it } from "vitest";
import { parseCmi5Xml } from "./parse";
import { readFixtureCmi5Xml } from "../test-utils/fixtures";

describe("parseCmi5Xml against real CATAPULT fixtures", () => {
  it("parses single_au_basic_framed as one AU, no masteryScore, default launchMethod", () => {
    const xml = readFixtureCmi5Xml("single_au_basic_framed.zip");
    const result = parseCmi5Xml(xml);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    const course = result.course!;
    expect(course.publisherCourseId).toBe(
      "https://w3id.org/xapi/cmi5/catapult/lts/course/geology-intro-single-au-basic",
    );
    expect(course.items).toHaveLength(1);
    const au = course.items[0]!;
    expect(au.kind).toBe("au");
    if (au.kind !== "au") throw new Error("unreachable");
    expect(au.moveOn).toBe("CompletedOrPassed");
    expect(au.masteryScore).toBeNull();
    expect(au.launchMethod).toBe("AnyWindow");
    expect(au.launchUrl).toBe("index.html");
  });

  it("parses multi_au_framed as 8 top-level AUs with the quiz requiring CompletedAndPassed", () => {
    const xml = readFixtureCmi5Xml("multi_au_framed.zip");
    const result = parseCmi5Xml(xml);
    expect(result.ok).toBe(true);
    const course = result.course!;
    expect(course.items).toHaveLength(8);
    expect(course.items.every((i) => i.kind === "au")).toBe(true);
    const quiz = course.items[7]!;
    if (quiz.kind !== "au") throw new Error("unreachable");
    expect(quiz.moveOn).toBe("CompletedAndPassed");
    expect(quiz.launchUrl).toBe("index.html?pages=quiz&complete=quiz");
  });

  it("parses pre_post_test_framed as 2 blocks with 3 AUs each, <requires> ignored", () => {
    const xml = readFixtureCmi5Xml("pre_post_test_framed.zip");
    const result = parseCmi5Xml(xml);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    const course = result.course!;
    expect(course.items).toHaveLength(2);
    expect(course.items.every((i) => i.kind === "block")).toBe(true);

    const block1 = course.items[0]!;
    if (block1.kind !== "block") throw new Error("unreachable");
    expect(block1.items).toHaveLength(3);
    const [pre, content, post] = block1.items;
    expect(pre!.kind === "au" && pre!.moveOn).toBe("Passed");
    expect(content!.kind === "au" && content!.moveOn).toBe("CompletedOrPassed");
    expect(post!.kind === "au" && post!.moveOn).toBe("Passed");

    const block2 = course.items[1]!;
    if (block2.kind !== "block") throw new Error("unreachable");
    expect(block2.items).toHaveLength(3);
  });

  it("parses masteryscore_framed with masteryScore=0.3 and launchMethod=OwnWindow", () => {
    const xml = readFixtureCmi5Xml("masteryscore_framed.zip");
    const result = parseCmi5Xml(xml);
    expect(result.ok).toBe(true);
    const au = result.course!.items[0]!;
    if (au.kind !== "au") throw new Error("unreachable");
    expect(au.masteryScore).toBe(0.3);
    expect(au.launchMethod).toBe("OwnWindow");
  });
});

describe("parseCmi5Xml validation", () => {
  const VALID_HEADER = `<?xml version="1.0" encoding="utf-8"?>
<courseStructure xmlns="https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd">
  <course id="https://example.com/course/1">
    <title><langstring lang="en-US">Test</langstring></title>
  </course>`;

  it("rejects a missing/wrong xmlns", () => {
    const xml = `<courseStructure xmlns="https://example.com/wrong">
      <course id="c1"><title><langstring lang="en">T</langstring></title></course>
      <au id="au1" moveOn="Passed"><title><langstring lang="en">A</langstring></title><url>index.html</url></au>
    </courseStructure>`;
    const result = parseCmi5Xml(xml);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("xmlns"))).toBe(true);
  });

  it("rejects an external absolute launch URL (bestilling §9c)", () => {
    const xml = `${VALID_HEADER}
  <au id="https://example.com/au/1" moveOn="Passed">
    <title><langstring lang="en-US">A</langstring></title>
    <url>https://evil.example.com/payload.html</url>
  </au>
</courseStructure>`;
    const result = parseCmi5Xml(xml);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("absolute/external"))).toBe(true);
  });

  it("rejects an invalid moveOn enum value", () => {
    const xml = `${VALID_HEADER}
  <au id="https://example.com/au/1" moveOn="Bogus">
    <title><langstring lang="en-US">A</langstring></title>
    <url>index.html</url>
  </au>
</courseStructure>`;
    const result = parseCmi5Xml(xml);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("invalid moveOn"))).toBe(true);
  });

  it("rejects duplicate ids across au/block", () => {
    const xml = `${VALID_HEADER}
  <block id="dup">
    <title><langstring lang="en-US">B</langstring></title>
    <au id="au1" moveOn="Passed"><title><langstring lang="en">A1</langstring></title><url>a.html</url></au>
  </block>
  <au id="dup" moveOn="Passed"><title><langstring lang="en">A2</langstring></title><url>b.html</url></au>
</courseStructure>`;
    const result = parseCmi5Xml(xml);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('duplicate id "dup"'))).toBe(true);
  });

  it("rejects masteryScore outside [0,1]", () => {
    const xml = `${VALID_HEADER}
  <au id="https://example.com/au/1" moveOn="Passed" masteryScore="1.5">
    <title><langstring lang="en-US">A</langstring></title>
    <url>index.html</url>
  </au>
</courseStructure>`;
    const result = parseCmi5Xml(xml);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("masteryScore"))).toBe(true);
  });

  it("silently ignores commented-out <requires> and unknown elements", () => {
    const xml = `${VALID_HEADER}
  <au id="https://example.com/au/1" moveOn="Passed">
    <title><langstring lang="en-US">A</langstring></title>
    <!-- <requires><require idref="x"/></requires> -->
    <objectives><objective id="o1"/></objectives>
    <url>index.html</url>
  </au>
</courseStructure>`;
    const result = parseCmi5Xml(xml);
    expect(result.ok).toBe(true);
  });

  it("defaults moveOn to CompletedAndPassed and launchMethod to AnyWindow when omitted", () => {
    const xml = `${VALID_HEADER}
  <au id="https://example.com/au/1">
    <title><langstring lang="en-US">A</langstring></title>
    <url>index.html</url>
  </au>
</courseStructure>`;
    const result = parseCmi5Xml(xml);
    expect(result.ok).toBe(true);
    const au = result.course!.items[0]!;
    if (au.kind !== "au") throw new Error("unreachable");
    expect(au.moveOn).toBe("CompletedAndPassed");
    expect(au.launchMethod).toBe("AnyWindow");
  });
});
