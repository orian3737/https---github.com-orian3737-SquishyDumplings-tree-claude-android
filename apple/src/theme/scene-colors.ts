/**
 * Palette for the habitat scene.
 *
 * Deliberately separate from `colors.ts`, which still holds the Android-derived
 * app chrome tokens. The scene is muted sage, cream, and warm wood — low
 * saturation, low contrast, soft brown outlines instead of black — so it reads as
 * a cozy illustrated room rather than as UI.
 *
 * If the app chrome is ever retuned to match, these become the source and
 * `colors.ts` should be reconciled against them rather than the reverse.
 */
export const sceneColors = {
  skyTop: '#b9c9b4',
  skyBottom: '#f3ecdd',
  cloud: '#fbf8f1',
  cloudShade: '#efe9dc',
  moon: '#f0dfae',
  star: '#fdfbf4',

  wall: '#f3ecdd',
  wallShade: '#e8dfcb',
  trim: '#e0d3ba',

  outline: '#9c8674',
  outlineSoft: '#bcab99',

  cabinet: '#a9b896',
  cabinetShade: '#93a380',
  counter: '#efe6d3',

  floor: '#ddc9ab',
  floorLine: '#cdb494',
  rug: '#ece1cb',

  bamboo: '#ddc59c',
  bambooShade: '#c5aa7d',

  leaf: '#8fa87f',
  leafDark: '#79916a',
  pot: '#d3b294',
  potShade: '#c09c7c',

  jar: '#e9d9bd',
  jarLid: '#c7a982',
} as const;
