import { describe, expect, it } from 'vitest';

import { createTestPet } from './__fixtures__/pet';
import { isUuid } from './ids';
import { createSeededRandom } from './random';
import { createCareEvent } from './repository';

describe('createCareEvent', () => {
  it('records the action against the existing pet', () => {
    const pet = createTestPet();

    const event = createCareEvent({
      petId: pet.id,
      action: 'feed',
      occurredAtMs: 1_700_000,
      random: createSeededRandom(3),
    });

    expect(event.petId).toBe(pet.id);
    expect(event.action).toBe('feed');
    expect(event.occurredAtMs).toBe(1_700_000);
  });

  it('generates a uuid idempotency key', () => {
    const event = createCareEvent({
      petId: 'pet-1',
      action: 'clean',
      occurredAtMs: 1,
      random: createSeededRandom(3),
    });

    expect(isUuid(event.id)).toBe(true);
  });

  it('gives distinct keys to repeated actions so neither is dropped as a duplicate', () => {
    const random = createSeededRandom(3);
    const base = { petId: 'pet-1', action: 'feed', occurredAtMs: 1 } as const;

    const first = createCareEvent({ ...base, random });
    const second = createCareEvent({ ...base, random });

    expect(first.id).not.toBe(second.id);
  });
});
