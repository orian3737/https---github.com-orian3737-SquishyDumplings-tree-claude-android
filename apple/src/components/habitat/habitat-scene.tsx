import { memo } from 'react';
import Svg, {
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { sceneColors as c } from '@/theme/scene-colors';

import {
  BambooSteamer,
  Cloud,
  CrescentMoon,
  Curtain,
  Jar,
  PottedPlant,
  Sparkle,
} from './scene-parts';

/**
 * The habitat background: a cozy dumpling kitchen under an open sky.
 *
 * The viewBox is phone-shaped rather than square. That matters: the scene is drawn
 * `slice` so it covers the screen with no letterboxing, and a square viewBox on a
 * tall phone gets scaled up to the height and then cropped horizontally, which
 * threw the window and shelf off screen entirely. Matching the aspect keeps the
 * whole room in frame on a normal iPhone and only trims a little at the extremes.
 *
 * Depth is built in bands back to front: sky, clouds, wall, fittings, counter,
 * floor, then foreground props. `FLOOR_TOP_RATIO` tells the habitat screen where
 * the boards start so the dumpling stands on them instead of hovering.
 */

const VIEW_W = 400;
const VIEW_H = 860;

const WALL_TOP = 262;
const COUNTER_TOP = 468;
const CABINET_TOP = 482;
const FLOOR_TOP = 558;

/** Where the floor begins, as a fraction of scene height. */
export const FLOOR_TOP_RATIO = FLOOR_TOP / VIEW_H;

export const HabitatScene = memo(function HabitatScene({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.skyTop} />
          <Stop offset="1" stopColor={c.skyBottom} />
        </LinearGradient>
        <LinearGradient id="windowSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#cfe0e8" />
          <Stop offset="1" stopColor="#e9f1f2" />
        </LinearGradient>
        <ClipPath id="windowClip">
          <Rect x={38} y={300} width={112} height={104} rx={9} />
        </ClipPath>
      </Defs>

      {/* Sky -------------------------------------------------------------- */}
      <Rect x={0} y={0} width={VIEW_W} height={WALL_TOP + 4} fill="url(#sky)" />

      <CrescentMoon x={322} y={78} />
      <Sparkle x={268} y={66} size={6} />
      <Sparkle x={358} y={120} size={4.5} />
      <Sparkle x={188} y={48} size={4.5} />
      <Sparkle x={78} y={92} size={6} />
      <Sparkle x={140} y={136} size={4} />
      <Sparkle x={300} y={172} size={4} />

      <Cloud x={78} y={158} scale={1.1} />
      <Cloud x={300} y={198} scale={1} opacity={0.95} />
      <Cloud x={196} y={122} scale={0.74} opacity={0.8} />
      <Cloud x={366} y={140} scale={0.8} opacity={0.7} />
      <Cloud x={44} y={232} scale={0.8} opacity={0.6} />

      {/* Back wall -------------------------------------------------------- */}
      <Rect
        x={0}
        y={WALL_TOP}
        width={VIEW_W}
        height={FLOOR_TOP - WALL_TOP + 2}
        fill={c.wall}
      />
      {/* No horizon stroke. The sky gradient resolves to the wall colour, so the
          two bands meet with no visible seam. */}

      {/* Window, left of centre so the dumpling never covers it ----------- */}
      <G>
        <Rect
          x={38}
          y={300}
          width={112}
          height={104}
          rx={9}
          fill="url(#windowSky)"
        />
        <G clipPath="url(#windowClip)">
          <Cloud x={72} y={528} scale={0.66} opacity={0.95} />
          <Cloud x={134} y={498} scale={0.52} opacity={0.85} />
        </G>
        <Rect
          x={38}
          y={300}
          width={112}
          height={104}
          rx={9}
          fill="none"
          stroke={c.outline}
          strokeWidth={2.4}
        />
        <Line
          x1={94}
          y1={300}
          x2={94}
          y2={404}
          stroke={c.outline}
          strokeWidth={2}
        />
        <Line
          x1={38}
          y1={352}
          x2={150}
          y2={352}
          stroke={c.outline}
          strokeWidth={2}
        />
        <Curtain x={32} y={292} width={124} />
      </G>

      {/* Shelf, right of centre ------------------------------------------- */}
      <G>
        <Jar x={288} y={396} height={22} width={16} />
        <Jar x={312} y={396} height={16} width={14} />
        <Ellipse
          cx={338}
          cy={387}
          rx={14}
          ry={8.5}
          fill={c.counter}
          stroke={c.outline}
          strokeWidth={1.8}
        />
        <PottedPlant x={262} y={392} scale={0.52} leafy={false} />
        <Rect
          x={248}
          y={396}
          width={112}
          height={8}
          rx={4}
          fill={c.bamboo}
          stroke={c.outline}
          strokeWidth={2}
        />
      </G>

      {/* Counter and cabinets --------------------------------------------- */}
      <G>
        <Rect
          x={0}
          y={CABINET_TOP}
          width={VIEW_W}
          height={FLOOR_TOP - CABINET_TOP + 2}
          fill={c.cabinet}
        />

        {/* Fixed door positions, left and right of where the dumpling stands. */}
        {[10, 86, 244, 320].map((doorX) => (
          <G key={doorX}>
            <Rect
              x={doorX}
              y={CABINET_TOP + 14}
              width={70}
              height={58}
              rx={8}
              fill={c.cabinetShade}
              stroke={c.outline}
              strokeWidth={1.8}
            />
            <Ellipse
              cx={doorX + 58}
              cy={CABINET_TOP + 43}
              rx={2.8}
              ry={2.8}
              fill={c.counter}
              stroke={c.outline}
              strokeWidth={1.2}
            />
          </G>
        ))}

        {/* Countertop last, so it caps the doors cleanly. */}
        <Rect
          x={-4}
          y={COUNTER_TOP}
          width={VIEW_W + 8}
          height={16}
          rx={7}
          fill={c.counter}
          stroke={c.outline}
          strokeWidth={2}
        />
      </G>

      {/* On the counter, clear of centre ---------------------------------- */}
      <BambooSteamer x={54} y={COUNTER_TOP} scale={0.95} />
      <PottedPlant x={356} y={COUNTER_TOP} scale={0.74} />

      {/* Floor ------------------------------------------------------------ */}
      <G>
        <Rect
          x={0}
          y={FLOOR_TOP}
          width={VIEW_W}
          height={VIEW_H - FLOOR_TOP}
          fill={c.floor}
        />
        <Line
          x1={0}
          y1={FLOOR_TOP}
          x2={VIEW_W}
          y2={FLOOR_TOP}
          stroke={c.outlineSoft}
          strokeWidth={2}
        />
        {/* Plank seams, fanning outward for a little perspective. */}
        {[24, 112, 200, 288, 376].map((seamX, index) => (
          <Line
            key={seamX}
            x1={seamX}
            y1={FLOOR_TOP}
            x2={seamX + (index - 2) * 40}
            y2={VIEW_H}
            stroke={c.floorLine}
            strokeWidth={1.8}
          />
        ))}
        <Ellipse cx={200} cy={742} rx={162} ry={62} fill={c.rug} />
      </G>

      {/* Foreground ------------------------------------------------------- */}
      <PottedPlant x={28} y={700} scale={0.86} leafy={false} />
      <PottedPlant x={374} y={828} scale={0.92} />
    </Svg>
  );
});
