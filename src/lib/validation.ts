/**
 * Input validation and sanitization utilities.
 *
 * SECURITY: All user-supplied text (choir names, display names, module names)
 * passes through these functions before being rendered or sent to the
 * database. This prevents XSS by stripping HTML tags and controlling the
 * character set, and prevents injection by enforcing length / format limits.
 *
 * These are defense-in-depth measures — React already escapes content in
 * JSX expressions, and Supabase parameterized queries prevent SQL injection.
 * But explicit validation at the boundary is the correct security posture.
 */

/**
 * Strip HTML tags and dangerous characters from a string.
 * Also trims whitespace and collapses internal whitespace.
 */
export function sanitizeText(input: string, maxLength: number = 200): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim().slice(0, maxLength);
  // Remove any HTML-like tags <...>
  const noTags = trimmed.replace(/<[^>]*>/g, '');
  // Collapse whitespace
  return noTags.replace(/\s+/g, ' ').trim();
}

/**
 * Validate and sanitize a display name.
 * Allows letters, numbers, spaces, hyphens, apostrophes — nothing else.
 */
export function validateDisplayName(input: string): { valid: boolean; value: string; error?: string } {
  const sanitized = sanitizeText(input, 80);
  if (sanitized.length === 0) {
    return { valid: false, value: '', error: 'Display name is required' };
  }
  if (sanitized.length < 1) {
    return { valid: false, value: sanitized, error: 'Display name must be at least 1 character' };
  }
  // Allow unicode letters, numbers, spaces, hyphens, apostrophes
  if (!/^[\p{L}\p{N}'\-\s]+$/u.test(sanitized)) {
    return { valid: false, value: sanitized, error: 'Display name contains invalid characters' };
  }
  return { valid: true, value: sanitized };
}

/**
 * Validate and sanitize a choir name.
 */
export function validateChoirName(input: string): { valid: boolean; value: string; error?: string } {
  const sanitized = sanitizeText(input, 120);
  if (sanitized.length === 0) {
    return { valid: false, value: '', error: 'Choir name is required' };
  }
  return { valid: true, value: sanitized };
}

/**
 * Validate a choir invite code (hex string from the database).
 */
export function validateInviteCode(input: string): { valid: boolean; value: string; error?: string } {
  const trimmed = input.trim();
  if (!/^[a-f0-9]+$/i.test(trimmed)) {
    return { valid: false, value: '', error: 'Invite code must contain only letters and numbers' };
  }
  if (trimmed.length < 6 || trimmed.length > 64) {
    return { valid: false, value: '', error: 'Invite code is the wrong length' };
  }
  return { valid: true, value: trimmed.toLowerCase() };
}

/**
 * Validate a score accuracy value (0–100 integer).
 */
export function validateAccuracy(value: number): { valid: boolean; value: number; error?: string } {
  if (!Number.isFinite(value)) {
    return { valid: false, value: 0, error: 'Accuracy must be a number' };
  }
  const clamped = Math.round(value);
  if (clamped < 0 || clamped > 100) {
    return { valid: false, value: Math.max(0, Math.min(100, clamped)), error: 'Accuracy must be between 0 and 100' };
  }
  return { valid: true, value: clamped };
}

/**
 * Validate a time-elapsed value in seconds (must be positive).
 */
export function validateTimeElapsed(value: number): { valid: boolean; value: number; error?: string } {
  if (!Number.isFinite(value) || value <= 0) {
    return { valid: false, value: 0, error: 'Time elapsed must be a positive number' };
  }
  return { valid: true, value: Math.round(value) };
}

/**
 * Validate a module name string.
 */
export function validateModuleName(input: string): { valid: boolean; value: string; error?: string } {
  const sanitized = sanitizeText(input, 200);
  if (sanitized.length === 0) {
    return { valid: false, value: '', error: 'Module name is required' };
  }
  return { valid: true, value: sanitized };
}
