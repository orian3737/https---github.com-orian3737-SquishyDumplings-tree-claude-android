import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { AppState } from 'react-native';

import {
  advancePet,
  hatchPet,
  PROVISIONAL_DECAY_CONFIG,
  PROVISIONAL_HYGIENE_CONFIG,
  PROVISIONAL_MESS_CONFIG,
  systemClock,
  systemLocalTime,
  systemRandom,
  type AdvanceConfig,
  type Diet,
  type Pet,
} from '@/domain';
import type { LocalPetRepository } from '@/services/pet/pet-repository';
import {
  hatchRemotePet,
  type RemotePetRepository,
} from '@/services/pet/remote-pet-repository';
import type { AppSupabaseClient } from '@/services/supabase/client';
import { rollFirstSkin, type FirstSkinRoll } from '@/services/pet/skin-catalog';
import type { TutorialProgressRepository } from '@/services/tutorial/tutorial-progress';

import { syncPet } from '@/features/sync/pet-sync';

import {
  LOADING_SESSION,
  sessionStateFrom,
  type SessionState,
} from './session-state';

export type HatchOutcome =
  | Readonly<{ outcome: 'hatched'; pet: Pet; roll: FirstSkinRoll }>
  /** A dumpling already existed. The existing one is adopted, not replaced. */
  | Readonly<{ outcome: 'already-hatched'; pet: Pet }>
  | Readonly<{ outcome: 'invalid-name' }>
  /** A hatch is already running. The caller should ignore the extra tap. */
  | Readonly<{ outcome: 'busy' }>
  | Readonly<{ outcome: 'failed'; error: string }>;

type SessionContextValue = Readonly<{
  state: SessionState;
  tutorialStatus: 'loading' | 'pending' | 'complete';
  completeTutorial(): Promise<void>;
  hatch(input: { name: string; diet: Diet }): Promise<HatchOutcome>;
  persist(pet: Pet): Promise<void>;
  reload(): Promise<void>;
  /** Reconcile with the cloud now. Safe to call when signed out; it no-ops. */
  syncNow(): Promise<void>;
  /** Drops the device's copy. Sign-out, not account deletion. */
  clearLocal(): Promise<void>;
}>;

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * PROVISIONAL tuning for what elapsed time does to the dumpling. Every value is
 * still an open product decision (BUILD_SPEC section 14).
 */
const ADVANCE_CONFIG: AdvanceConfig = {
  decay: PROVISIONAL_DECAY_CONFIG,
  hygiene: PROVISIONAL_HYGIENE_CONFIG,
  mess: PROVISIONAL_MESS_CONFIG,
  localTime: systemLocalTime,
};

/**
 * How often the open app re-bills elapsed time.
 *
 * Decay has whole-minute granularity, so a faster tick would compute the same
 * answer repeatedly. Half a minute keeps the crossing of each minute boundary
 * visible without the needs appearing to jump.
 */
const CATCH_UP_INTERVAL_MS = 30_000;

/**
 * How often the cloud backup is refreshed while the app is open.
 *
 * Care is local-first, so this is a backup cadence rather than a consistency
 * requirement — nothing the player does waits on it. Deliberately far slower than
 * the decay tick: a write every thirty seconds would be a lot of traffic to
 * protect against a crash the local cache already survives.
 */
const SYNC_INTERVAL_MS = 5 * 60_000;

export function SessionProvider({
  repository,
  tutorialRepository,
  remote = null,
  client = null,
  children,
}: {
  repository: LocalPetRepository;
  tutorialRepository: TutorialProgressRepository;
  /**
   * The cloud half. Null keeps the app fully local, which is what the offline
   * path and every test rely on — nothing below this line may assume a network.
   */
  remote?: RemotePetRepository | null;
  client?: AppSupabaseClient | null;
  children: ReactNode;
}) {
  const [state, setState] = useState<SessionState>(LOADING_SESSION);
  const [tutorialStatus, setTutorialStatus] =
    useState<SessionContextValue['tutorialStatus']>('loading');

  /**
   * Guards the one-dumpling invariant against the UI. Two rapid taps on the
   * steam box must not both run a hatch (FR-3), and a ref is checked
   * synchronously where a state flag would not be.
   */
  const hatchInFlight = useRef(false);

  /**
   * Bring a dumpling up to date with the wall clock, saving only if it moved.
   *
   * This is the one place elapsed time is billed. Hunger and happiness fall,
   * stamina comes back, and any mess a meal scheduled lands — including messes that
   * came due while the app was closed, which is why the schedule lives on the `Pet`
   * and not in a timer.
   */
  const catchUp = useCallback(
    async (pet: Pet): Promise<Pet> => {
      const advanced = advancePet(pet, systemClock.now(), ADVANCE_CONFIG).pet;
      if (advanced === pet) {
        return pet;
      }

      // Save before returning: a catch-up the player can see must survive a crash,
      // or reopening would bill the same span again.
      await repository.savePet(advanced);
      return advanced;
    },
    [repository],
  );

  const reload = useCallback(async () => {
    const outcome = await repository.loadPetOutcome();
    if (outcome.status !== 'loaded') {
      setState(sessionStateFrom(outcome));
      return;
    }

    setState({ status: 'ready', pet: await catchUp(outcome.pet) });
  }, [catchUp, repository]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const outcome = await repository.loadPetOutcome();
      if (!active) {
        return;
      }

      if (outcome.status !== 'loaded') {
        setState(sessionStateFrom(outcome));
        return;
      }

      // Caught up before the habitat ever renders, so the player never sees the
      // needs they left behind and then watches them snap.
      const pet = await catchUp(outcome.pet);
      if (active) {
        setState({ status: 'ready', pet });
      }
    })();

    return () => {
      active = false;
    };
  }, [catchUp, repository]);

  useEffect(() => {
    let active = true;

    void tutorialRepository
      .isComplete()
      .then((complete) => {
        if (active) {
          setTutorialStatus(complete ? 'complete' : 'pending');
        }
      })
      // A tutorial storage failure should never block care. Keep it available for
      // this session and let completion try the write again.
      .catch(() => {
        if (active) {
          setTutorialStatus('pending');
        }
      });

    return () => {
      active = false;
    };
  }, [tutorialRepository]);

  const completeTutorial = useCallback(async () => {
    // Close immediately so a slow device never makes Skip or Done feel broken.
    setTutorialStatus('complete');
    try {
      await tutorialRepository.complete();
    } catch {
      // Persistence is best-effort; the care loop remains fully usable.
    }
  }, [tutorialRepository]);

  const persist = useCallback(
    async (pet: Pet) => {
      await repository.savePet(pet);
      setState({ status: 'ready', pet });
    },
    [repository],
  );

  /**
   * The live dumpling, for the async catch-up.
   *
   * Mirrored in an effect rather than closed over, so the interval and the
   * foreground listener always bill against the current pet instead of whichever
   * one existed when they were registered.
   */
  const petRef = useRef<Pet | null>(null);

  useEffect(() => {
    petRef.current = state.status === 'ready' ? state.pet : null;
  }, [state]);

  /**
   * Keep billing time while the app is open, and again the moment it comes back to
   * the foreground.
   *
   * Both paths matter. Without the interval the needs freeze while the player
   * watches them; without the foreground listener a phone that sat locked for an
   * hour would not settle up until the next tick.
   */
  useEffect(() => {
    let active = true;

    const tick = () => {
      const pet = petRef.current;
      if (pet === null) {
        return;
      }

      void catchUp(pet).then((advanced) => {
        if (active && advanced !== pet) {
          setState({ status: 'ready', pet: advanced });
        }
      });
    };

    const interval = setInterval(tick, CATCH_UP_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        tick();
      }
    });

    return () => {
      active = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, [catchUp]);

  /**
   * Reconcile with the cloud.
   *
   * Never on the care path: a failure is a retry later, never a blocked action,
   * which is what keeps the app playable on a plane. The decision itself lives in
   * `syncPet` so the whole policy is testable without a network.
   */
  const syncNow = useCallback(async () => {
    if (remote === null) {
      return;
    }

    const outcome = await syncPet({ local: repository, remote });

    if (outcome.status === 'synced' && outcome.pet !== null) {
      setState({ status: 'ready', pet: outcome.pet });
    }
  }, [remote, repository]);

  const clearLocal = useCallback(async () => {
    await repository.clearPet();
    setState({ status: 'needs-onboarding' });
  }, [repository]);

  const syncRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    syncRef.current = syncNow;
  }, [syncNow]);

  /**
   * Back the dumpling up on a slow cadence, and again whenever the app returns to
   * the foreground — which is the moment most likely to precede the player putting
   * the phone down for a day.
   */
  useEffect(() => {
    if (remote === null) {
      return;
    }

    void syncRef.current();

    const interval = setInterval(
      () => void syncRef.current(),
      SYNC_INTERVAL_MS,
    );
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void syncRef.current();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [remote]);

  const hatch = useCallback(
    async (input: { name: string; diet: Diet }): Promise<HatchOutcome> => {
      if (hatchInFlight.current) {
        return { outcome: 'busy' };
      }
      hatchInFlight.current = true;

      try {
        // Re-read rather than trusting the render-time state. If a pet exists for
        // any reason, adopt it instead of creating a second identity.
        const existing = await repository.loadPetOutcome();
        if (existing.status === 'loaded') {
          setState({ status: 'ready', pet: existing.pet });
          return { outcome: 'already-hatched', pet: existing.pet };
        }
        if (existing.status === 'corrupt') {
          setState({ status: 'unreadable', error: existing.error });
          return { outcome: 'failed', error: existing.error };
        }

        const roll = rollFirstSkin(systemRandom);

        /**
         * The server hatches when it can.
         *
         * `hatch_pet` rolls rarity with the documented weights and is idempotent,
         * so a retry or a reinstall cannot re-roll for a better dumpling. The
         * client roll below is the offline fallback only, and its rarity is
         * overwritten by the server's the first time this device syncs.
         */
        if (client !== null) {
          const pet = await hatchRemotePet(client, {
            name: input.name,
            skinId: roll.skin.id,
            diet: input.diet,
          });

          await repository.savePet(pet);
          setState({ status: 'ready', pet });

          return {
            outcome: 'hatched',
            pet,
            roll: { ...roll, rarity: pet.rarity },
          };
        }

        const result = hatchPet({
          existingPet: null,
          name: input.name,
          rarity: roll.rarity,
          skinId: roll.skin.id,
          diet: input.diet,
          clock: systemClock,
          random: systemRandom,
        });

        if (result.outcome === 'invalid-name') {
          return { outcome: 'invalid-name' };
        }
        if (result.outcome === 'already-hatched') {
          setState({ status: 'ready', pet: result.pet });
          return { outcome: 'already-hatched', pet: result.pet };
        }

        // Save before the caller navigates, so a crash between reveal and habitat
        // cannot lose the dumpling (FR-3).
        await repository.savePet(result.pet);
        setState({ status: 'ready', pet: result.pet });

        return { outcome: 'hatched', pet: result.pet, roll };
      } catch (error: unknown) {
        return {
          outcome: 'failed',
          error: error instanceof Error ? error.message : String(error),
        };
      } finally {
        hatchInFlight.current = false;
      }
    },
    [client, repository],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      tutorialStatus,
      completeTutorial,
      hatch,
      persist,
      reload,
      syncNow,
      clearLocal,
    }),
    [
      state,
      tutorialStatus,
      completeTutorial,
      hatch,
      persist,
      reload,
      syncNow,
      clearLocal,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);

  if (value === null) {
    throw new Error('useSession must be used inside a SessionProvider');
  }

  return value;
}

/**
 * The dumpling, for screens that only render inside a ready session. Throws rather
 * than returning a placeholder pet, because a placeholder would look like a real
 * second dumpling.
 */
export function usePet(): Pet {
  const { state } = useSession();

  if (state.status !== 'ready') {
    throw new Error(`usePet requires a ready session, got ${state.status}`);
  }

  return state.pet;
}
