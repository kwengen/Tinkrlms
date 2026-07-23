import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildCertificatePdf } from "./build-certificate-pdf";

describe("buildCertificatePdf", () => {
  it("produces a valid single-page PDF", async () => {
    const bytes = await buildCertificatePdf({
      certUuid: "11111111-1111-1111-1111-111111111111",
      learnerName: "Kari Nordmann",
      courseTitle: "Brannvern grunnkurs",
      orgName: "Tinkr AS",
      completedAt: "2026-03-15T10:00:00.000Z",
      verifyUrl: "https://tinkrlms.vercel.app/verify/11111111-1111-1111-1111-111111111111",
    });

    expect(Buffer.from(bytes.slice(0, 5)).toString("utf-8")).toBe("%PDF-");

    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });
});
