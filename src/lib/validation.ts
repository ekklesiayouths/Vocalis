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

/**
 * Validate an email address format.
 */
export function validateEmail(input: string): { valid: boolean; value: string; error?: string } {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length === 0) return { valid: false, value: '', error: 'Email is required' };
  if (trimmed.length > 254) return { valid: false, value: '', error: 'Email is too long' };
  // RFC 5322 simplified pattern
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: false, value: trimmed, error: 'Please enter a valid email address' };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validate a password against minimum security requirements.
 * Returns a strength score (0–4) and list of unmet requirements.
 */
export function validatePassword(input: string): {
  valid: boolean;
  value: string;
  error?: string;
  strength: number;
  requirements: string[];
} {
  const requirements: string[] = [];
  if (input.length < 8) requirements.push('At least 8 characters');
  if (!/[a-z]/.test(input)) requirements.push('At least one lowercase letter');
  if (!/[A-Z]/.test(input)) requirements.push('At least one uppercase letter');
  if (!/[0-9]/.test(input)) requirements.push('At least one number');

  let strength = 0;
  if (input.length >= 8) strength++;
  if (input.length >= 12) strength++;
  if (/[a-z]/.test(input) && /[A-Z]/.test(input)) strength++;
  if (/[0-9]/.test(input)) strength++;
  if (/[^a-zA-Z0-9]/.test(input)) strength++;
  strength = Math.min(strength, 4);

  if (requirements.length > 0) {
    return { valid: false, value: input, error: requirements[0], strength, requirements };
  }
  return { valid: true, value: input, strength, requirements: [] };
}

/**
 * Validate an age value (integer, reasonable range).
 */
export function validateAge(input: number | string): { valid: boolean; value: number; error?: string } {
  const num = typeof input === 'string' ? parseInt(input, 10) : input;
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    return { valid: false, value: 0, error: 'Age must be a whole number' };
  }
  if (num < 5 || num > 120) {
    return { valid: false, value: num, error: 'Please enter an age between 5 and 120' };
  }
  return { valid: true, value: num };
}

/**
 * Validate a full name.
 */
export function validateFullName(input: string): { valid: boolean; value: string; error?: string } {
  const sanitized = sanitizeText(input, 120);
  if (sanitized.length === 0) {
    return { valid: false, value: '', error: 'Full name is required' };
  }
  if (sanitized.length < 2) {
    return { valid: false, value: sanitized, error: 'Name must be at least 2 characters' };
  }
  return { valid: true, value: sanitized };
}
