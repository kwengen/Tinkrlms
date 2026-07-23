import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface CertificateContent {
  certUuid: string;
  learnerName: string;
  courseTitle: string;
  orgName: string;
  /** ISO 8601 timestamp of course completion. */
  completedAt: string;
  verifyUrl: string;
}

/**
 * Plain, functional one-page A4 certificate (bestilling §8) — deliberately
 * unstyled beyond basic layout; visual design is a later pass (per user
 * instruction, this UI/document layer stays functional-not-designed for
 * now). Pure function: no DB/Storage access, so it's unit-testable without
 * a live Supabase project.
 */
export async function buildCertificatePdf(content: CertificateContent): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 in points
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 60;
  let y = height - margin;

  const drawLine = (text: string, size: number, useFont = font, gap = size * 1.6) => {
    page.drawText(text, { x: margin, y, size, font: useFont, color: rgb(0, 0, 0) });
    y -= gap;
  };

  drawLine("Kursbevis", 28, boldFont, 50);
  drawLine(`Dette bekrefter at`, 12);
  drawLine(content.learnerName, 20, boldFont, 36);
  drawLine(`har fullført kurset`, 12);
  drawLine(content.courseTitle, 18, boldFont, 32);
  drawLine(`Organisasjon: ${content.orgName}`, 12);
  drawLine(`Fullført: ${new Date(content.completedAt).toISOString().slice(0, 10)}`, 12);
  y -= 20;
  drawLine(`Sertifikat-ID: ${content.certUuid}`, 10);
  drawLine(`Verifiser: ${content.verifyUrl}`, 10);

  return doc.save();
}
