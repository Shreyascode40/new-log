import * as fs from "node:fs";
import * as path from "node:path";

function inspectPdf(pdfPath: string) {
  console.log(`Inspecting PDF at: ${pdfPath}`);
  const buf = fs.readFileSync(pdfPath);
  console.log(`File size: ${buf.length} bytes (${(buf.length / 1024).toFixed(2)} KB)`);

  const str = buf.toString("latin1");
  const header = str.slice(0, 10).trim();
  console.log(`Header: ${header}`);

  const trailerIndex = str.lastIndexOf("%%EOF");
  console.log(`Trailer %%EOF present: ${trailerIndex !== -1} (at offset ${trailerIndex})`);

  const pageMatches = str.match(/\/Type\s*\/Page\b/g);
  console.log(`Total /Type /Page occurrences: ${pageMatches ? pageMatches.length : 0}`);

  const countMatches = str.match(/\/Count\s+(\d+)/g);
  console.log(`Catalog /Count entries:`, countMatches);

  const rootMatch = str.includes("/Root");
  console.log(`/Root object reference present: ${rootMatch}`);

  const pagesMatch = str.includes("/Pages");
  console.log(`/Pages reference present: ${pagesMatch}`);

  const xrefMatch = str.includes("xref") || str.includes("/XRef");
  console.log(`xref table/stream present: ${xrefMatch}`);
}

const targetPath = process.argv[2] || path.join(process.cwd(), "scripts", "sample-logbook.pdf");
inspectPdf(targetPath);
