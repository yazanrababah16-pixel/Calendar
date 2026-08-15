/**
 * Normalize a phone number to E.164 format.
 *
 * Handles Jordanian phone numbers by default:
 *   - 07XXXXXXXX → +9627XXXXXXXX
 *   - 9627XXXXXXXX → +9627XXXXXXXX
 *   - 7XXXXXXXX → +9627XXXXXXXX
 *   - 009627XXXXXXXX → +9627XXXXXXXX
 *
 * For international numbers, ensures the leading "+" is present.
 *
 * @param raw - The raw phone number string from user input
 * @returns Normalized phone number in E.164 format
 */
export function normalizePhone(raw: string): string {
  let p = String(raw || "").replace(/[\s\-()]/g, "");

  // Handle double-zero international prefix
  if (p.startsWith("00")) {
    p = "+" + p.slice(2);
  }

  // Ensure + prefix
  if (!p.startsWith("+")) {
    if (p.startsWith("0")) {
      // Local Jordanian: 07X... → +9627X...
      p = "+962" + p.slice(1);
    } else if (p.startsWith("962")) {
      p = "+" + p;
    } else if (p.startsWith("7") && p.length >= 9) {
      // Bare Jordanian number: 7X... → +9627X...
      p = "+962" + p;
    } else {
      p = "+" + p;
    }
  }

  return p;
}
