import { test, expect } from 'vitest';
import { FillWindow, SIGNING_IN } from '../src/vault-privacy';
import { vaultCapabilities } from '../src/vault-guard';

test('capabilities advertise the v2 fill window', () => {
  expect(vaultCapabilities()).toEqual({ capability: 'vault.fill_login_guarded.v2', implementation: 'galera-vault-2026-11-12.1', privacy: 'fill-window' });
  expect(SIGNING_IN).toBe('Signing in, try again in a moment.');
});

test('a prepared window ends at expiry, close or a completed fill', () => {
  let now = 1_000;
  const window = new FillWindow(() => now);
  expect(window.active).toBe(false);
  window.open(now + 60_000);
  expect(window.active).toBe(true);
  now += 60_000;
  expect(window.active).toBe(false);
  window.open(now + 60_000);
  window.close();
  expect(window.active).toBe(false);
  window.open(now + 60_000);
  window.begin();
  window.end();
  expect(window.active).toBe(false);
});

test('an in-flight fill holds the window past expiry and close, never past end', () => {
  let now = 0;
  const window = new FillWindow(() => now);
  window.open(10);
  window.begin();
  now = 1_000;
  window.close();
  expect(window.active).toBe(true);
  window.end();
  expect(window.active).toBe(false);
  window.end();
  expect(window.active).toBe(false);
});

test('a fresh instance (cold start) is never blocked', () => {
  expect(new FillWindow().active).toBe(false);
});
