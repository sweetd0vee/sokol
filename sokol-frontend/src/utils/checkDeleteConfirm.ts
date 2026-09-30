export function checkDeleteConfirmToken(check: {
  serial_number: string;
  check_name: string;
}): string {
  return check.serial_number.trim() || check.check_name.trim();
}

export function typedCheckKeyMatches(expected: string, typed: string): boolean {
  const token = expected.trim();
  if (!token) {
    return false;
  }
  return token.toUpperCase() === typed.trim().toUpperCase();
}
