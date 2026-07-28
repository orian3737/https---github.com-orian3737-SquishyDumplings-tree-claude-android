/**
 * A deterministic `requestAnimationFrame` pair for Node.
 *
 * Test-only. Nothing in the app imports this directory.
 *
 * React Native supplies these globals at runtime and Node does not, so a hook that
 * animates with frame callbacks cannot be exercised in a test without them. Vitest's
 * fake timers only replace globals that already exist, which is why this installs the
 * pair rather than expecting `vi.useFakeTimers()` to provide it.
 *
 * The shim resolves `setTimeout` at call time rather than capturing it, so once fake
 * timers are installed the frames run off the fake clock and `vi.advanceTimersByTime`
 * drives a walk animation exactly as it drives a timeout. Install before the fake
 * timers, uninstall after restoring the real ones.
 */

/** Frame interval the shim reports. Close enough to a 60Hz display. */
export const FRAME_MS = 16;

type FrameCallback = (timestampMs: number) => void;

/**
 * Optional on purpose. React Native's ambient types declare both as always present,
 * which is exactly what is not true here — uninstalling has to be able to remove them.
 */
type FrameGlobals = {
  requestAnimationFrame?: (callback: FrameCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
};

const frameGlobals = globalThis as unknown as FrameGlobals;

export function installAnimationFrames(): void {
  frameGlobals.requestAnimationFrame = (callback) =>
    setTimeout(() => callback(Date.now()), FRAME_MS) as unknown as number;

  frameGlobals.cancelAnimationFrame = (handle) => {
    clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
  };
}

export function uninstallAnimationFrames(): void {
  delete frameGlobals.requestAnimationFrame;
  delete frameGlobals.cancelAnimationFrame;
}
