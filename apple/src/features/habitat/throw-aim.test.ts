import { describe, expect, it } from 'vitest';

import {
  boundsFor,
  DEFAULT_LANDING_MAX_Y,
  LANDING_MAX_X,
  LANDING_MIN_X,
  LANDING_MIN_Y,
  landingFor,
  randomFloorSpot,
  type ThrowAim,
} from './throw-aim';

const bounds = boundsFor(DEFAULT_LANDING_MAX_Y);
/** No scatter, so the aim itself is what is under test. */
const centred = () => 0.5;

const flick = (overrides: Partial<ThrowAim> = {}): ThrowAim => ({
  dx: 0,
  dy: -120,
  vx: 0,
  vy: -1.2,
  ...overrides,
});

describe('landingFor', () => {
  it('lands a straight-up flick in the middle of the room', () => {
    expect(landingFor(flick({ dx: 0 }), bounds, centred).x).toBeCloseTo(0.5, 5);
  });

  it('throws right when the flick goes right, and left when it goes left', () => {
    const right = landingFor(flick({ dx: 90 }), bounds, centred);
    const left = landingFor(flick({ dx: -90 }), bounds, centred);

    expect(right.x).toBeGreaterThan(0.5);
    expect(left.x).toBeLessThan(0.5);
    // Symmetric about the centre.
    expect(right.x - 0.5).toBeCloseTo(0.5 - left.x, 5);
  });

  it('throws further sideways the further the flick travels', () => {
    const gentle = landingFor(flick({ dx: 30 }), bounds, centred);
    const hard = landingFor(flick({ dx: 110 }), bounds, centred);

    expect(hard.x).toBeGreaterThan(gentle.x);
  });

  it('throws further back the harder the flick goes up', () => {
    // Depth runs from 0 at the wall to 1 at the player's feet, so further is less.
    const gentle = landingFor(flick({ dy: -40 }), bounds, centred);
    const hard = landingFor(flick({ dy: -200 }), bounds, centred);

    expect(hard.y).toBeLessThan(gentle.y);
  });

  it('is deterministic for the same flick, which is what "not random" means', () => {
    const first = landingFor(flick({ dx: 55, dy: -140 }), bounds, centred);
    const second = landingFor(flick({ dx: 55, dy: -140 }), bounds, centred);

    expect(first).toEqual(second);
  });

  it('never lands outside the usable floor however wild the flick', () => {
    const extremes = [-9999, -400, -1, 0, 1, 400, 9999];

    for (const dx of extremes) {
      for (const dy of extremes) {
        for (const roll of [0, 0.5, 1]) {
          const spot = landingFor(flick({ dx, dy }), bounds, () => roll);

          expect(spot.x).toBeGreaterThanOrEqual(bounds.minX);
          expect(spot.x).toBeLessThanOrEqual(bounds.maxX);
          expect(spot.y).toBeGreaterThanOrEqual(bounds.minY);
          expect(spot.y).toBeLessThanOrEqual(bounds.maxY);
        }
      }
    }
  });

  it('never lands under the action wheel, whatever depth the screen reports', () => {
    // The reported bug: food landing behind the menu. The band's near edge is the
    // screen's to set, and nothing may cross it.
    for (const maxY of [0.3, 0.45, 0.6, 0.75]) {
      const tight = boundsFor(maxY);
      const spot = landingFor(flick({ dy: -10 }), tight, () => 1);

      expect(spot.y).toBeLessThanOrEqual(maxY);
    }
  });

  it('centres the accessible tap path rather than faking an aim', () => {
    const spot = landingFor(null, bounds, centred);

    expect(spot.x).toBeCloseTo(0.5, 5);
    expect(spot.y).toBeCloseTo((bounds.minY + bounds.maxY) / 2, 5);
  });

  it('scatters, so repeated throws do not stack on one pixel', () => {
    const low = landingFor(flick(), bounds, () => 0);
    const high = landingFor(flick(), bounds, () => 1);

    expect(low.x).not.toBeCloseTo(high.x, 5);
  });

  it('lets aim dominate the scatter', () => {
    // Worst case: a left throw scattered as far right as possible must still land
    // left of a right throw scattered as far left as possible.
    const left = landingFor(flick({ dx: -110 }), bounds, () => 1);
    const right = landingFor(flick({ dx: 110 }), bounds, () => 0);

    expect(left.x).toBeLessThan(right.x);
  });
});

describe('boundsFor', () => {
  it('uses the shared horizontal band the dumpling can actually reach', () => {
    expect(boundsFor(0.6)).toEqual({
      minX: LANDING_MIN_X,
      maxX: LANDING_MAX_X,
      minY: LANDING_MIN_Y,
      maxY: 0.6,
    });
  });

  it('refuses to invert the band when handed a depth above the wall', () => {
    expect(boundsFor(0).maxY).toBe(LANDING_MIN_Y);
  });
});

describe('randomFloorSpot', () => {
  it('stays inside the usable floor at both ends of the roll', () => {
    for (const roll of [0, 0.5, 1]) {
      const spot = randomFloorSpot(bounds, () => roll);

      expect(spot.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(spot.x).toBeLessThanOrEqual(bounds.maxX);
      expect(spot.y).toBeGreaterThanOrEqual(bounds.minY);
      expect(spot.y).toBeLessThanOrEqual(bounds.maxY);
    }
  });
});
