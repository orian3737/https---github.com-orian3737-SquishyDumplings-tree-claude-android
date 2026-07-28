/**
 * The platform-neutral one-dumpling domain engine.
 *
 * Everything here is pure TypeScript with injected time and randomness: no
 * React, no Expo, no storage, no network. Screens and hooks should import from
 * this barrel rather than reaching into individual modules.
 */
export * from './animation-state';
export * from './behavior';
export * from './care';
export * from './clock';
export * from './decay';
export * from './diet';
export * from './evolution';
export * from './food';
export * from './hygiene';
export * from './ids';
export * from './lifecycle';
export * from './messes';
export * from './needs';
export * from './personality';
export * from './pet';
export * from './random';
export * from './rarity';
export * from './repository';
export * from './serialization';
export * from './sleep-schedule';
