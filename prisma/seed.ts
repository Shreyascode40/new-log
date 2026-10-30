/**
 * Seed: 1 HOD, 3 guides, 8 students, 2 fully completed groups with 100% completion
 * across all 17 logbook sections, demonstrating both:
 *   - Group 1: PDF_ALLOWED (pdfPermission: true) -> Student can generate and download PDF immediately
 *   - Group 2: READY_FOR_PDF (pdfPermission: false) -> HOD can test the Allow/Revoke PDF permission toggle
 *
 * Run with: npm run db:seed
 */
import "../scripts/seed-complete-workflow";
