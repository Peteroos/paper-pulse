export const ACCESS_CODE = "paperpulse2026";

export function isAccessCodeValid(value) {
  return String(value || "").trim() === ACCESS_CODE;
}
