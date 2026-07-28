import { describe, expect, it, vi } from 'vitest';

import { createTestPet } from '@/domain/__fixtures__/pet';
import type { Pet, PetRepository } from '@/domain';
import type { RemotePetRepository } from '@/services/pet/remote-pet-repository';

import { syncPet } from './pet-sync';

const CARED_AT = Date.UTC(2026, 0, 2, 9, 0, 0);

function fakeLocal(pet: Pet | null): PetRepository & { saved: Pet[] } {
  const saved: Pet[] = [];

  return {
    saved,
    loadPet: async () => pet,
    savePet: async (next) => {
      saved.push(next);
    },
    clearPet: async () => {},
  };
}

function fakeRemote(pet: Pet | null): RemotePetRepository & { saved: Pet[] } {
  const saved: Pet[] = [];

  return {
    saved,
    loadRemote: async () => pet,
    loadPet: async () => pet,
    savePet: async (next) => {
      saved.push(next);
    },
    clearPet: async () => {
      throw new Error('not supported');
    },
  };
}

const pet = (overrides: Parameters<typeof createTestPet>[0] = {}) =>
  createTestPet({ lastCaredAtMs: CARED_AT, ...overrides });

describe('syncPet', () => {
  it('reports nothing to do when neither side has a dumpling', async () => {
    const result = await syncPet({
      local: fakeLocal(null),
      remote: fakeRemote(null),
    });

    expect(result).toEqual({
      status: 'synced',
      decision: { kind: 'needs-hatch' },
      pet: null,
    });
  });

  it('writes the server copy into the cache on a fresh install', async () => {
    // So a later offline launch opens on the right dumpling.
    const remotePet = pet();
    const local = fakeLocal(null);

    const result = await syncPet({ local, remote: fakeRemote(remotePet) });

    expect(result.status).toBe('synced');
    expect(local.saved).toEqual([remotePet]);
  });

  it('pushes local care up when the device is ahead', async () => {
    const localPet = pet({ lastCaredAtMs: CARED_AT + 60_000 });
    const remote = fakeRemote({ ...localPet, lastCaredAtMs: CARED_AT });

    const result = await syncPet({ local: fakeLocal(localPet), remote });

    expect(result.status).toBe('synced');
    expect(remote.saved).toEqual([localPet]);
  });

  it('writes nothing at all when both sides agree', async () => {
    const localPet = pet();
    const local = fakeLocal(localPet);
    const remote = fakeRemote({ ...localPet });

    await syncPet({ local, remote });

    expect(local.saved).toEqual([]);
    expect(remote.saved).toEqual([]);
  });

  it('waits for hatch rather than failing when the server row does not exist', async () => {
    // Only hatch_pet may create the row, so this is the normal state between
    // signing up and hatching.
    const localPet = pet();
    const remote = fakeRemote(null);

    const result = await syncPet({ local: fakeLocal(localPet), remote });

    expect(result).toEqual({ status: 'awaiting-hatch', pet: localPet });
    expect(remote.saved).toEqual([]);
  });

  it('reports offline rather than throwing when the server cannot be reached', async () => {
    const remote = fakeRemote(null);
    remote.loadRemote = async () => {
      throw new Error('network request failed');
    };

    const result = await syncPet({ local: fakeLocal(pet()), remote });

    expect(result.status).toBe('offline');
  });

  it('never lets a remote failure hide the local dumpling', async () => {
    // The device must keep playing. A sync failure is a retry, not a data loss.
    const localPet = pet();
    const local = fakeLocal(localPet);
    const remote = fakeRemote(localPet);
    remote.savePet = async () => {
      throw new Error('503');
    };

    const result = await syncPet({
      local,
      remote: {
        ...remote,
        loadRemote: async () => ({ ...localPet, lastCaredAtMs: CARED_AT - 1 }),
      },
    });

    expect(result.status).toBe('offline');
    // The cache was not touched, so the next launch still has the dumpling.
    expect(local.saved).toEqual([]);
  });

  it('adopts the server dumpling when the cache belongs to someone else', async () => {
    const localPet = pet();
    const remotePet = { ...pet(), id: 'someone-elses-dumpling' };
    const local = fakeLocal(localPet);

    const result = await syncPet({ local, remote: fakeRemote(remotePet) });

    expect(result.status).toBe('synced');
    expect(local.saved).toEqual([remotePet]);
  });

  it('does not push when it has just adopted', async () => {
    // Otherwise every restore immediately writes back what it just read.
    const remotePet = pet({ lastCaredAtMs: CARED_AT + 60_000 });
    const remote = fakeRemote(remotePet);

    await syncPet({ local: fakeLocal(pet()), remote });

    expect(remote.saved).toEqual([]);
  });

  it('reads local before remote, so an unreachable server is cheap to detect', async () => {
    const order: string[] = [];
    const localPet = pet();
    const local = fakeLocal(localPet);
    const remote = fakeRemote(localPet);

    local.loadPet = vi.fn(async () => {
      order.push('local');
      return localPet;
    });
    remote.loadRemote = vi.fn(async () => {
      order.push('remote');
      return localPet;
    });

    await syncPet({ local, remote });

    expect(order).toEqual(['local', 'remote']);
  });
});
