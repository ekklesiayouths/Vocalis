/**
 * Tests for auth validation utilities.
 */

import { describe, it, expect } from 'vitest';
import { validateEmail, validatePassword, validateAge, validateFullName } from './validation';

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com').valid).toBe(true);
    expect(validateEmail('test.user@domain.co.uk').valid).toBe(true);
  });

  it('rejects empty input', () => {
    expect(validateEmail('').valid).toBe(false);
  });

  it('rejects missing @', () => {
    expect(validateEmail('userexample.com').valid).toBe(false);
  });

  it('rejects missing domain', () => {
    expect(validateEmail('user@.com').valid).toBe(false);
  });

  it('lowercases and trims', () => {
    const result = validateEmail('  USER@Example.COM  ');
    expect(result.valid).toBe(true);
    expect(result.value).toBe('user@example.com');
  });
});

describe('validatePassword', () => {
  it('rejects short passwords', () => {
    const result = validatePassword('Ab1');
    expect(result.valid).toBe(false);
    expect(result.requirements).toContain('At least 8 characters');
  });

  it('rejects missing uppercase', () => {
    const result = validatePassword('abcdef123');
    expect(result.valid).toBe(false);
    expect(result.requirements).toContain('At least one uppercase letter');
  });

  it('rejects missing lowercase', () => {
    const result = validatePassword('ABCDEF123');
    expect(result.valid).toBe(false);
    expect(result.requirements).toContain('At least one lowercase letter');
  });

  it('rejects missing number', () => {
    const result = validatePassword('Abcdefgh');
    expect(result.valid).toBe(false);
    expect(result.requirements).toContain('At least one number');
  });

  it('accepts a strong password', () => {
    const result = validatePassword('StrongPass1!');
    expect(result.valid).toBe(true);
    expect(result.strength).toBeGreaterThanOrEqual(3);
  });

  it('reports strength correctly', () => {
    expect(validatePassword('aB1!').strength).toBeLessThan(validatePassword('VeryStrongPass1!xyz').strength);
  });
});

describe('validateAge', () => {
  it('accepts valid ages', () => {
    expect(validateAge(25).valid).toBe(true);
    expect(validateAge('30').valid).toBe(true);
    expect(validateAge(13).valid).toBe(true);
  });

  it('rejects non-integers', () => {
    expect(validateAge('abc').valid).toBe(false);
    expect(validateAge(25.5).valid).toBe(false);
  });

  it('rejects ages outside range', () => {
    expect(validateAge(4).valid).toBe(false);
    expect(validateAge(121).valid).toBe(false);
  });

  it('rejects empty', () => {
    expect(validateAge('').valid).toBe(false);
  });
});

describe('validateFullName', () => {
  it('accepts valid names', () => {
    expect(validateFullName('Jane Doe').valid).toBe(true);
    expect(validateFullName("O'Connor").valid).toBe(true);
  });

  it('rejects empty', () => {
    expect(validateFullName('').valid).toBe(false);
  });

  it('rejects single character', () => {
    expect(validateFullName('A').valid).toBe(false);
  });

  it('strips HTML tags', () => {
    const result = validateFullName('<script>alert(1)</script>John');
    expect(result.valid).toBe(true);
    expect(result.value).not.toContain('<script>');
  });
});
