// Server-only text extraction for uploaded resumes.
//
// PDF, DOCX, and plain text are the accepted shapes. The paste-as-text
// escape hatch is handled by the caller (it never reaches this function).
//
// pdf-parse is imported via its inner module path — the package's index.js
// runs a self-test read on import that breaks in bundled Node runtimes.

import "server-only";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — resumes are small.

export interface ExtractedResume {
  text: string;
  mimeType: string;
  byteLength: number;
}

export async function extractResumeText(file: File): Promise<ExtractedResume> {
  if (file.size === 0) {
    throw new Error("The uploaded file is empty.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error(
      `The uploaded file is ${(file.size / 1_000_000).toFixed(1)} MB — please upload something under 10 MB.`,
    );
  }

  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    const text = await extractPdf(buf);
    return { text, mimeType: "application/pdf", byteLength: file.size };
  }

  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const text = await extractDocx(buf);
    return {
      text,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      byteLength: file.size,
    };
  }

  if (mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) {
    return {
      text: buf.toString("utf-8"),
      mimeType: mime || "text/plain",
      byteLength: file.size,
    };
  }

  throw new Error(
    `Unsupported file type: ${mime || "unknown"}. Upload a PDF, DOCX, or paste the text.`,
  );
}

async function extractPdf(buf: Buffer): Promise<string> {
  // Import the inner module to skip pdf-parse/index.js's self-test.
  const mod = (await import("pdf-parse/lib/pdf-parse.js")) as unknown as {
    default: (data: Buffer) => Promise<{ text: string }>;
  };
  const result = await mod.default(buf);
  const text = (result.text ?? "").trim();
  if (!text) {
    throw new Error(
      "We couldn't extract any text from that PDF — it may be a scanned image. Paste your resume as text instead.",
    );
  }
  return text;
}

async function extractDocx(buf: Buffer): Promise<string> {
  const mammoth = (await import("mammoth")) as unknown as {
    extractRawText: (input: {
      buffer: Buffer;
    }) => Promise<{ value: string }>;
  };
  const result = await mammoth.extractRawText({ buffer: buf });
  const text = (result.value ?? "").trim();
  if (!text) {
    throw new Error("We couldn't extract any text from that DOCX.");
  }
  return text;
}
