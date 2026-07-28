import { createElement, useEffect, type ReactElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { vi } from 'vitest';

/**
 * Renders a hook on its own, with no DOM and no native runtime.
 *
 * Test-only. Nothing in the app imports this directory.
 *
 * `react-test-renderer` rather than a DOM or React Native testing library because
 * nothing under test here renders host components — the habitat loop is React state,
 * timers, and frame callbacks, and it returns a plain object. A DOM environment or an
 * RN preset would be setup cost with no coverage behind it, and it would drag the
 * whole suite out of vitest's default Node environment. The renderer version is
 * pinned to the React version, since the two share internals.
 *
 * Hooks that need props are called through a wrapper hook, so this deliberately has
 * no provider or wrapper option: compose what you need in the hook you pass in.
 */

// `act` refuses to run unless the environment opts in. Importing this helper is that
// opt-in, which keeps every test file from repeating the flag.
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

export { act } from 'react-test-renderer';

export type RenderedHook<TProps, TValue> = Readonly<{
  /** What the hook returned on its most recent render. */
  current: TValue;
  rerender: (props: TProps) => void;
  unmount: () => void;
}>;

export function renderHook<TProps, TValue>(
  useHookUnderTest: (props: TProps) => TValue,
  initialProps: TProps,
): RenderedHook<TProps, TValue> {
  const latest: { value: TValue; rendered: boolean } = {
    value: undefined as TValue,
    rendered: false,
  };

  function HookProbe({ hookProps }: { hookProps: TProps }): null {
    const value = useHookUnderTest(hookProps);

    // Captured in an effect rather than during render: writing to an outer binding
    // while rendering is exactly the side effect the React Compiler rules forbid.
    // Inside `act` the passive effects flush before it returns, so a read after any
    // `act` still sees the newest value.
    useEffect(() => {
      latest.value = value;
      latest.rendered = true;
    });

    return null;
  }

  const elementFor = (props: TProps): ReactElement =>
    createElement(HookProbe, { hookProps: props });

  let renderer: ReactTestRenderer | null = null;
  act(() => {
    renderer = create(elementFor(initialProps));
  });

  return {
    get current(): TValue {
      if (!latest.rendered) {
        throw new Error('renderHook: the hook has not rendered yet');
      }

      return latest.value;
    },

    rerender(props: TProps): void {
      act(() => {
        renderer?.update(elementFor(props));
      });
    },

    unmount(): void {
      act(() => {
        renderer?.unmount();
      });
    },
  };
}

/**
 * Moves the fake clock forward and lets everything it triggered settle.
 *
 * Timers and frame callbacks in the loop set React state, so the advance has to
 * happen inside `act` or the resulting renders land after the assertion.
 */
export function advanceBy(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}
