import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the system asks us to reduce motion.
 *
 * Read from `AccessibilityInfo` rather than an animation library so the answer is
 * the same for every kind of motion in the app, and so it keeps working if the
 * animation stack is swapped.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReduced(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
