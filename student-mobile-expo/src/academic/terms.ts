/** Calendar codes are opaque stored identifiers, never programme stages. */
export const REGULAR_TERM_PATTERN = /^[0-9]{4}[24]$/;
export const TERM_CODE_ERROR = "Academic Term Code must contain five digits and end in 2 or 4.";
export function isRegularAcademicTerm(code: string) { return REGULAR_TERM_PATTERN.test(code.trim()); }
export function formatAcademicTerm(code: string | null | undefined, academicYear: string) {
  return [code || "—", academicYear].filter(Boolean).join(" · ");
}
export function validateAcademicTermCode(code: string, academicYear: string, storedCode?: string) {
  const value = code.trim(), year = academicYear.trim();
  if (!isRegularAcademicTerm(value) && value !== storedCode) throw new Error(TERM_CODE_ERROR);
  if (!/^[0-9]{4}\/[0-9]{4}$/.test(year)) throw new Error("Academic year must contain two consecutive four-digit years.");
  const [start, end] = year.split("/").map(Number);
  if (end !== start + 1) throw new Error("Academic year must contain two consecutive four-digit years.");
  if (!year.split("/").includes(value.slice(0, 4))) throw new Error("Academic Term Code year must match the academic year.");
}
