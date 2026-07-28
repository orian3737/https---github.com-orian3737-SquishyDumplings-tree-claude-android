import { describe, expect, it } from 'vitest';

import { createTestPet } from '@/domain/__fixtures__/pet';

import { petAfter, requiresPush, resolveSync } from './sync-policy';

const CARED_AT = Date.UTC(2026, 0, 2, 9, 0, 0);

const pet = (overrides: Parameters<typeof createTestPet>[0] = {}) =>
  createTestPet({ lastCaredAtMs: CARED_AT, ...overrides });

describe('resolveSync', () => {
  it('asks for onboarding when neither side has a dumpling', () => {
    expect(resolveSync(null, null)).toEqual({ kind: 'needs-hatch' });
  });

  it('adopts the server copy on a fresh install', () => {
    const remote = pet();
    const decision = resolveSync(null, remote);

    expect(decision).toEqual({ kind: 'adopt-remote', pet: remote });
  });

  it('pushes local when the server has nothing yet', () => {
    const local = pet();
    expect(resolveSync(local, null)).toEqual({
      kind: 'push-local',
      pet: local,
    });
  });

  it('pushes local when the device cared more recently', () => {
    const local = pet({ lastCaredAtMs: CARED_AT + 60_000 });
    const remote = { ...local, lastCaredAtMs: CARED_AT };

    expect(resolveSync(local, remote)).toEqual({
      kind: 'push-local',
      pet: local,
    });
  });

  it('adopts remote when another device cared more recently', () => {
    const local = pet();
    const remote = { ...local, lastCaredAtMs: CARED_AT + 60_000 };

    expect(resolveSync(local, remote)).toEqual({
      kind: 'adopt-remote',
      pet: remote,
    });
  });

  it('does nothing when both sides agree', () => {
    const local = pet();
    const remote = { ...local };

    const decision = resolveSync(local, remote);

    expect(decision.kind).toBe('in-sync');
    // The same object, so an in-sync result cannot re-render the habitat.
    expect(petAfter(decision)).toBe(local);
  });

  it('ignores revision, which orders writes rather than ranking states', () => {
    // The server bumps revision on every write, including a push of older state,
    // so a high revision does not mean a better snapshot.
    const local = pet({ lastCaredAtMs: CARED_AT + 60_000, revision: 2 });
    const remote = { ...local, lastCaredAtMs: CARED_AT, revision: 900 };

    expect(resolveSync(local, remote).kind).toBe('push-local');
  });

  it('takes the server dumpling when the two describe different pets', () => {
    // A cache that outlived its account. Adopting can never create a second pet;
    // pushing local could orphan the real one.
    const local = pet();
    const remote = { ...pet(), id: 'a-different-dumpling' };

    expect(resolveSync(local, remote)).toEqual({
      kind: 'adopt-remote-different-pet',
      pet: remote,
      discardedId: local.id,
    });
  });

  it('prefers identity over recency when the pets differ', () => {
    // Even a much fresher local copy loses, because it belongs to someone else.
    const local = pet({ lastCaredAtMs: CARED_AT + 86_400_000 });
    const remote = { ...pet(), id: 'a-different-dumpling' };

    expect(resolveSync(local, remote).kind).toBe('adopt-remote-different-pet');
  });
});

describe('requiresPush', () => {
  it('is true only for a local win', () => {
    const local = pet();
    const older = { ...local, lastCaredAtMs: CARED_AT - 1 };

    expect(requiresPush(resolveSync(local, older))).toBe(true);
    expect(requiresPush(resolveSync(local, null))).toBe(true);
    expect(requiresPush(resolveSync(local, { ...local }))).toBe(false);
    expect(requiresPush(resolveSync(null, local))).toBe(false);
    expect(requiresPush(resolveSync(null, null))).toBe(false);
  });
});

describe('petAfter', () => {
  it('is null only when onboarding is needed', () => {
    const local = pet();

    expect(petAfter(resolveSync(null, null))).toBeNull();
    expect(petAfter(resolveSync(local, null))).toBe(local);
    expect(petAfter(resolveSync(null, local))).toBe(local);
  });

  it('never returns a second dumpling for the same owner', () => {
    // The whole point: every branch resolves to at most one identity.
    const local = pet();
    const remote = { ...pet(), id: 'other' };

    for (const decision of [
      resolveSync(local, null),
      resolveSync(null, remote),
      resolveSync(local, remote),
      resolveSync(local, { ...local }),
    ]) {
      const resolved = petAfter(decision);
      expect(resolved).not.toBeNull();
    }
  });
});
