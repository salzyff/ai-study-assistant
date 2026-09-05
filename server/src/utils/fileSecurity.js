import { extname } from "node:path";

const mimeExtensions = {
  "application/pdf": new Set([".pdf"]),
  "text/plain": new Set([".txt"]),
  "text/markdown": new Set([".md", ".markdown"]),
};

const dangerousPdfTokens = [
  "/javascript",
  "/js",
  "/openaction",
  "/launch",
  "/embeddedfile",
  "/richmedia",
];

export function inspectStudyUpload(file) {
  if (!file?.buffer?.length) return { safe: false, reason: "The uploaded file is empty" };

  const extension = extname(file.originalname || "").toLowerCase();
  const allowedExtensions = mimeExtensions[file.mimetype];
  if (!allowedExtensions?.has(extension)) {
    return { safe: false, reason: "The filename extension does not match the file type" };
  }

  if (file.mimetype === "application/pdf") {
    const header = file.buffer.subarray(0, 5).toString("ascii");
    if (header !== "%PDF-") return { safe: false, reason: "The file is not a valid PDF" };

    const searchable = file.buffer.toString("latin1").toLowerCase();
    if (searchable.includes("/encrypt")) {
      return { safe: false, reason: "Password-protected PDFs are not supported" };
    }
    if (dangerousPdfTokens.some((token) => searchable.includes(token))) {
      return { safe: false, reason: "PDFs containing scripts, attachments, or automatic actions are not accepted" };
    }
  } else {
    const sample = file.buffer.subarray(0, Math.min(file.buffer.length, 8192));
    let suspiciousBytes = 0;
    for (const byte of sample) {
      if (byte === 0 || (byte < 9 || (byte > 13 && byte < 32))) suspiciousBytes += 1;
    }
    if (suspiciousBytes / sample.length > 0.02) {
      return { safe: false, reason: "The uploaded text file appears to contain binary data" };
    }
  }

  return { safe: true };
}
