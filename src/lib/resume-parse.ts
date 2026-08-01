/**
 * Browser-side document text extraction for PDF and DOCX resumes.
 * Runs in the browser so the Worker runtime never needs native parsers.
 */

export const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function validateResumeFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const extOk = /\.(pdf|docx|txt)$/.test(name);
  if (!extOk) return "Only PDF, DOCX and TXT files are supported.";
  if (file.size > MAX_FILE_BYTES) return "File is larger than 10 MB.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

function cleanup(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ");
    pages.push(line);
  }
  doc.cleanup();
  return cleanup(pages.join("\n\n"));
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = (await import("mammoth/mammoth.browser")) as typeof import("mammoth");
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return cleanup(result.value);
}

export async function extractDocumentText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return extractPdf(file);
  if (name.endsWith(".docx")) return extractDocx(file);
  return cleanup(await file.text());
}

/** Fast local signals shown while the AI parser runs. */
export function quickScan(text: string) {
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/)?.[0];
  const phone = text.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[0];
  const words = text.split(/\s+/).filter(Boolean).length;
  return { email, phone, words };
}
