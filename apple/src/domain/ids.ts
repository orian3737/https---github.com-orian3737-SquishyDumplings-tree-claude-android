import type { RandomSource } from './random';

/**
 * UUID v4 built from an injected randomness source.
 *
 * `crypto.randomUUID` is not dependably present across Hermes and the Expo web
 * target, and the domain already injects randomness for testability, so ids are
 * derived from the same source. Care-event ids double as the client-generated
 * idempotency keys described in BUILD_SPEC section 5.
 */
export function createUuidV4(random: RandomSource): string {
  const bytes = new Uint8Array(16);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(random.next() * 256) & 0xff;
  }

  // Version 4, RFC 4122 variant.
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let index = 0; index < bytes.length; index += 1) {
    hex.push((bytes[index] as number).toString(16).padStart(2, '0'));
  }

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
