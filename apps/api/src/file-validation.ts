import { ApiDomainError } from "./errors.js";

/**
 * Validates actual binary content against expected MIME type.
 * Protects against Content-Type spoofing and arbitrary file uploads.
 */
export function validateImageBytes(bytes: Buffer): "image/jpeg" | "image/png" {
  if (bytes.length < 8) {
    throw new ApiDomainError("INVALID_FILE", "Image file is too small or corrupted", 400);
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  throw new ApiDomainError(
    "INVALID_FILE",
    "Invalid image format: file contents do not match JPG or PNG image signatures",
    400,
  );
}

/**
 * Validates document bytes (PDF, JPEG, or PNG).
 */
export function validateDocumentBytes(
  bytes: Buffer,
): "application/pdf" | "image/jpeg" | "image/png" {
  if (bytes.length < 8) {
    throw new ApiDomainError("INVALID_FILE", "Document file is too small or corrupted", 400);
  }

  // Check PDF: Starts with %PDF-
  const headerSlice = bytes.subarray(0, Math.min(1024, bytes.length)).toString("ascii");
  if (headerSlice.includes("%PDF-")) {
    const trailerSlice = bytes
      .subarray(Math.max(0, bytes.length - 1024), bytes.length)
      .toString("ascii");
    if (!trailerSlice.includes("%%EOF")) {
      throw new ApiDomainError("INVALID_FILE", "Truncated PDF file: missing %%EOF trailer", 400);
    }
    return "application/pdf";
  }

  // Check JPEG or PNG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  throw new ApiDomainError(
    "INVALID_FILE",
    "Invalid document format: file contents must be a valid PDF, JPG, or PNG",
    400,
  );
}
