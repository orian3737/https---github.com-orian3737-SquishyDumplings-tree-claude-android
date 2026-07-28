/**
 * Personality tags ported from the Android `PersonalityTag` reference. They are
 * persisted now so the identity contract is stable; the behavior that earns and
 * spends them is later work (FEATURE_AUDIT: "Persist now; deeper behavior
 * later").
 */
export const PERSONALITY_TAGS = [
  'spicy',
  'gentle',
  'grumpy',
  'playful',
  'sleepy',
  'chatty',
] as const;

export type PersonalityTag = (typeof PERSONALITY_TAGS)[number];

export function isPersonalityTag(value: unknown): value is PersonalityTag {
  return (
    typeof value === 'string' &&
    (PERSONALITY_TAGS as readonly string[]).includes(value)
  );
}

/**
 * Normalizes a tag collection into the canonical order with duplicates removed,
 * so two pets with the same tags always serialize identically.
 */
export function normalizePersonalityTags(
  tags: readonly PersonalityTag[],
): readonly PersonalityTag[] {
  return PERSONALITY_TAGS.filter((tag) => tags.includes(tag));
}
