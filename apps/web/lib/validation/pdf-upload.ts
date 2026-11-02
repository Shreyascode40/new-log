export const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB
export const MIN_PDF_BYTES = 300; // Minimum valid PDF with header, catalog, page & trailer

export interface PdfValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates lightweight PDF binary structure without heavy server-side rendering.
 * Checks header magic bytes, EOF marker, catalog dictionary, pages tree, and xref table/stream.
 */
export function validatePdfStructure(bytes: Buffer): PdfValidationResult {
  if (bytes.length < MIN_PDF_BYTES) {
    return {
      valid: false,
      error: `File is too small (${bytes.length} bytes) to be a valid PDF document.`,
    };
  }

  // 1. Header: Must contain %PDF- within the first 1024 bytes
  const headerSlice = bytes.subarray(0, Math.min(1024, bytes.length)).toString("ascii");
  if (!headerSlice.includes("%PDF-")) {
    return {
      valid: false,
      error: "Invalid PDF format: missing '%PDF-' header signature.",
    };
  }

  // 2. Trailer: Must contain %%EOF marker within the last 1024 bytes
  const trailerSlice = bytes
    .subarray(Math.max(0, bytes.length - 1024), bytes.length)
    .toString("ascii");
  if (!trailerSlice.includes("%%EOF")) {
    return {
      valid: false,
      error: "Invalid PDF structure: missing '%%EOF' trailer. Document appears truncated.",
    };
  }

  // 3. Document Catalog: Must contain /Root object reference
  const fullContent = bytes.toString("ascii");
  if (!fullContent.includes("/Root")) {
    return {
      valid: false,
      error: "Invalid PDF structure: missing document catalog dictionary (/Root).",
    };
  }

  // 4. Page Tree: Must contain /Pages or /Page dictionary
  if (!fullContent.includes("/Pages") && !fullContent.includes("/Page")) {
    return {
      valid: false,
      error: "Invalid PDF structure: missing page tree nodes (/Pages or /Page).",
    };
  }

  // 5. Cross-reference: Must contain cross-reference table (xref) or stream (/XRef)
  if (!fullContent.includes("xref") && !fullContent.includes("/XRef")) {
    return {
      valid: false,
      error: "Invalid PDF structure: missing cross-reference table or stream (xref / /XRef).",
    };
  }

  return { valid: true };
}
