import { describe, expect, it } from "vitest";
import AdmZip from "adm-zip";
import { importCmi5Course, type ImportCoursePorts } from "./import-course";
import { readFixtureZip } from "../test-utils/fixtures";

function fakePorts() {
  const uploads: { path: string; size: number }[] = [];
  const courses: Record<string, unknown>[] = [];
  const contentPackages: Record<string, unknown>[] = [];
  const courseVersions: { id: string; course_id: string; version_label: string }[] = [];
  const courseBlocks: unknown[] = [];
  const assignableUnits: unknown[] = [];
  let idCounter = 0;
  const nextId = () => `fake-id-${idCounter++}`;

  const ports: ImportCoursePorts = {
    async uploadFile(path, content) {
      uploads.push({ path, size: content.length });
    },
    async insertContentPackage(row) {
      const id = nextId();
      contentPackages.push({ id, ...row });
      return { id };
    },
    async insertCourse(row) {
      const id = nextId();
      courses.push({ id, ...row });
      return { id };
    },
    async insertCourseVersion(row) {
      const id = nextId();
      courseVersions.push({ id, ...row });
      return { id };
    },
    async insertCourseBlocks(rows) {
      courseBlocks.push(...rows);
    },
    async insertAssignableUnits(rows) {
      assignableUnits.push(...rows);
    },
    async versionLabelExists(courseId, versionLabel) {
      return courseVersions.some((v) => v.course_id === courseId && v.version_label === versionLabel);
    },
  };

  return { ports, uploads, courses, contentPackages, courseVersions, courseBlocks, assignableUnits };
}

describe("importCmi5Course", () => {
  it("imports single_au_basic_framed.zip as a brand new course", async () => {
    const state = fakePorts();
    const zipBuffer = readFixtureZip("single_au_basic_framed.zip");

    const result = await importCmi5Course(
      {
        zipBuffer,
        target: { title: "Geology intro", versionLabel: "v1" },
        activityBase: "https://app.tinkrakademiet.no/xapi/activity",
      },
      state.ports,
    );

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.auCount).toBe(1);
    expect(result.blockCount).toBe(0);
    expect(state.courses).toHaveLength(1);
    expect(state.courseVersions).toHaveLength(1);
    expect(state.contentPackages).toHaveLength(1);
    expect(state.assignableUnits).toHaveLength(1);
    // Every extracted file got uploaded under the immutable per-version path.
    expect(state.uploads.every((u) => u.path.startsWith(`${result.courseId}/v1/`))).toBe(true);
    expect(state.uploads.some((u) => u.path.endsWith("/cmi5.xml"))).toBe(true);
  });

  it("imports pre_post_test_framed.zip as a new version of an existing course, with blocks", async () => {
    const state = fakePorts();
    const zipBuffer = readFixtureZip("pre_post_test_framed.zip");

    const result = await importCmi5Course(
      {
        zipBuffer,
        target: { courseId: "existing-course-1", versionLabel: "v2" },
        activityBase: "https://app.tinkrakademiet.no/xapi/activity",
      },
      state.ports,
    );

    expect(result.ok).toBe(true);
    expect(result.courseId).toBe("existing-course-1");
    expect(result.blockCount).toBe(2);
    expect(result.auCount).toBe(6);
    expect(state.courses).toHaveLength(0); // no NEW course row — reused existing courseId
    expect(state.courseBlocks).toHaveLength(2);
    expect(state.assignableUnits).toHaveLength(6);
  });

  it("rejects re-importing the same version label (immutable storage path, bestilling §9c)", async () => {
    const state = fakePorts();
    const zipBuffer = readFixtureZip("single_au_basic_framed.zip");
    const first = await importCmi5Course(
      { zipBuffer, target: { title: "Course", versionLabel: "v1" }, activityBase: "https://x/xapi/activity" },
      state.ports,
    );
    expect(first.ok).toBe(true);

    const second = await importCmi5Course(
      {
        zipBuffer,
        target: { courseId: first.courseId, versionLabel: "v1" },
        activityBase: "https://x/xapi/activity",
      },
      state.ports,
    );
    expect(second.ok).toBe(false);
    expect(second.errors.some((e) => e.includes("immutable"))).toBe(true);
    // Nothing new was written on the rejected attempt.
    expect(state.courseVersions).toHaveLength(1);
    expect(state.contentPackages).toHaveLength(1);
  });

  it("rejects a package with no cmi5.xml before touching storage/DB", async () => {
    const state = fakePorts();
    const zip = new AdmZip();
    zip.addFile("index.html", Buffer.from("<html></html>"));
    const result = await importCmi5Course(
      { zipBuffer: zip.toBuffer(), target: { title: "Bad", versionLabel: "v1" }, activityBase: "https://x/xapi/activity" },
      state.ports,
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("cmi5.xml"))).toBe(true);
    expect(state.uploads).toHaveLength(0);
    expect(state.courses).toHaveLength(0);
  });

  it("rejects an invalid cmi5.xml (e.g. external launch URL) before touching storage/DB", async () => {
    const state = fakePorts();
    const zip = new AdmZip();
    zip.addFile(
      "cmi5.xml",
      Buffer.from(`<?xml version="1.0"?>
<courseStructure xmlns="https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd">
  <course id="c1"><title><langstring lang="en">T</langstring></title></course>
  <au id="au1" moveOn="Passed"><title><langstring lang="en">A</langstring></title><url>https://evil.example.com/x.html</url></au>
</courseStructure>`),
    );
    const result = await importCmi5Course(
      { zipBuffer: zip.toBuffer(), target: { title: "Bad", versionLabel: "v1" }, activityBase: "https://x/xapi/activity" },
      state.ports,
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("absolute/external"))).toBe(true);
    expect(state.uploads).toHaveLength(0);
  });
});
