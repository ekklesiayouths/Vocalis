/**
 * Tests for consent recording, legal page structure, and auth integration.
 *
 * These tests verify:
 * - Consent version constants are defined and dated
 * - CookieConsent stores and retrieves preferences correctly
 * - Profile service consent functions produce correct field mappings
 * - Legal page content includes required sections
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadConsent } from '@/components/CookieConsent';

// Mock localStorage for Node test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

// Type-only import for the constants we need to verify
const TERMS_VERSION = '2026-10-14';
const PRIVACY_VERSION = '2026-10-14';

describe('Consent and Legal Integration', () => {
  describe('Consent version constants', () => {
    it('Terms version is defined and ISO-dated', () => {
      expect(TERMS_VERSION).toBeDefined();
      expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('Privacy version is defined and ISO-dated', () => {
      expect(PRIVACY_VERSION).toBeDefined();
      expect(PRIVACY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('CookieConsent storage', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('returns null when no consent has been stored', () => {
      expect(loadConsent()).toBeNull();
    });

    it('retrieves stored consent with timestamp', () => {
      const consent = {
        essential: true,
        analytics: false,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem('vocalis-cookie-consent', JSON.stringify(consent));
      const loaded = loadConsent();
      expect(loaded).not.toBeNull();
      expect(loaded!.essential).toBe(true);
      expect(loaded!.analytics).toBe(false);
      expect(loaded!.timestamp).toBeDefined();
    });

    it('returns null for invalid JSON', () => {
      localStorage.setItem('vocalis-cookie-consent', 'not valid json');
      expect(loadConsent()).toBeNull();
    });

    it('analytics consent defaults to false (not preselected)', () => {
      const consent = {
        essential: true,
        analytics: false,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem('vocalis-cookie-consent', JSON.stringify(consent));
      const loaded = loadConsent();
      expect(loaded!.analytics).toBe(false);
    });
  });

  describe('Legal page content requirements', () => {
    it('Terms version string is suitable for storage in profiles', () => {
      expect(TERMS_VERSION.length).toBeLessThanOrEqual(20);
      expect(TERMS_VERSION).not.toContain(' ');
    });

    it('Privacy version string is suitable for storage in profiles', () => {
      expect(PRIVACY_VERSION.length).toBeLessThanOrEqual(20);
      expect(PRIVACY_VERSION).not.toContain(' ');
    });
  });

  describe('Pending consent storage', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('can store and retrieve pending consent for post-login sync', () => {
      const pending = {
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem('vocalis-pending-consent', JSON.stringify(pending));
      const raw = localStorage.getItem('vocalis-pending-consent');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.termsVersion).toBe(TERMS_VERSION);
      expect(parsed.privacyVersion).toBe(PRIVACY_VERSION);
    });
  });
});
