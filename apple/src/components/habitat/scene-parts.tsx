import {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Rect,
  type NumberProp,
} from 'react-native-svg';

import { sceneColors as c } from '@/theme/scene-colors';

/**
 * Reusable pieces of the habitat scene.
 *
 * Everything here is deterministic — no randomness — so the room does not shuffle
 * on re-render. Outlines are soft brown rather than black, and every corner is
 * rounded, which is what keeps the room reading as illustration rather than as UI.
 */

const STROKE = 2;

/** A puffy cloud built from overlapping circles with one soft underside. */
export function Cloud({
  x,
  y,
  scale = 1,
  opacity = 1,
}: {
  x: number;
  y: number;
  scale?: number;
  opacity?: number;
}) {
  return (
    <G opacity={opacity} transform={`translate(${x} ${y}) scale(${scale})`}>
      <Ellipse cx={0} cy={14} rx={54} ry={16} fill={c.cloudShade} />
      <Circle cx={-30} cy={6} r={18} fill={c.cloud} />
      <Circle cx={-8} cy={-6} r={24} fill={c.cloud} />
      <Circle cx={20} cy={2} r={19} fill={c.cloud} />
      <Circle cx={38} cy={10} r={13} fill={c.cloud} />
      <Rect x={-46} y={6} width={86} height={14} rx={7} fill={c.cloud} />
    </G>
  );
}

/** A four-point sparkle. Small enough to read as a twinkle, not a shape. */
export function Sparkle({
  x,
  y,
  size = 5,
}: {
  x: number;
  y: number;
  size?: number;
}) {
  return (
    <Path
      d={`M ${x} ${y - size} Q ${x + size * 0.2} ${y - size * 0.2} ${x + size} ${y} Q ${x + size * 0.2} ${y + size * 0.2} ${x} ${y + size} Q ${x - size * 0.2} ${y + size * 0.2} ${x - size} ${y} Q ${x - size * 0.2} ${y - size * 0.2} ${x} ${y - size} Z`}
      fill={c.star}
    />
  );
}

export function CrescentMoon({ x, y }: { x: number; y: number }) {
  return (
    <G transform={`translate(${x} ${y})`}>
      <Path
        d="M 0 -13 A 13 13 0 1 0 0 13 A 10 10 0 1 1 0 -13 Z"
        fill={c.moon}
      />
    </G>
  );
}

/** A trailing pothos-style vine. `flip` mirrors it for the other side of a pot. */
export function Vine({
  x,
  y,
  flip = false,
}: {
  x: number;
  y: number;
  flip?: boolean;
}) {
  const leaves: readonly { dx: number; dy: number; r: number }[] = [
    { dx: 2, dy: 6, r: 7 },
    { dx: -6, dy: 18, r: 6.5 },
    { dx: 6, dy: 28, r: 6 },
    { dx: -3, dy: 40, r: 5.5 },
    { dx: 5, dy: 50, r: 5 },
  ];

  return (
    <G transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      <Path
        d="M 0 0 Q 6 22 0 48"
        stroke={c.leafDark}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
      />
      {leaves.map((leaf, index) => (
        <Ellipse
          key={index}
          cx={leaf.dx}
          cy={leaf.dy}
          rx={leaf.r}
          ry={leaf.r * 0.78}
          fill={index % 2 === 0 ? c.leaf : c.leafDark}
        />
      ))}
    </G>
  );
}

/** A potted plant. `leafy` gives upright leaves, otherwise it trails vines. */
export function PottedPlant({
  x,
  y,
  scale = 1,
  leafy = true,
}: {
  x: number;
  y: number;
  scale?: number;
  leafy?: boolean;
}) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      {leafy ? (
        <G>
          <Ellipse cx={-11} cy={-26} rx={9} ry={13} fill={c.leaf} />
          <Ellipse cx={11} cy={-28} rx={8.5} ry={12} fill={c.leafDark} />
          <Ellipse cx={0} cy={-36} rx={9} ry={14} fill={c.leaf} />
        </G>
      ) : (
        <G>
          <Vine x={-9} y={-16} />
          <Vine x={9} y={-16} flip />
        </G>
      )}

      <Path
        d="M -15 -14 L -11 12 Q 0 16 11 12 L 15 -14 Z"
        fill={c.pot}
        stroke={c.outline}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Rect
        x={-17}
        y={-18}
        width={34}
        height={7}
        rx={3.5}
        fill={c.potShade}
        stroke={c.outline}
        strokeWidth={STROKE}
      />
    </G>
  );
}

/**
 * A stack of bamboo steamer baskets — the dumpling's home, and the reason the
 * room reads as a dumpling kitchen rather than a generic cozy interior.
 */
export function BambooSteamer({
  x,
  y,
  scale = 1,
}: {
  x: number;
  y: number;
  scale?: number;
}) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      {/* Two basket tiers, bottom first. */}
      <Rect
        x={-26}
        y={-14}
        width={52}
        height={15}
        rx={5}
        fill={c.bambooShade}
        stroke={c.outline}
        strokeWidth={STROKE}
      />
      <Rect
        x={-28}
        y={-27}
        width={56}
        height={15}
        rx={5}
        fill={c.bamboo}
        stroke={c.outline}
        strokeWidth={STROKE}
      />
      {/* Woven lid. */}
      <Path
        d="M -28 -27 Q 0 -40 28 -27 Z"
        fill={c.bamboo}
        stroke={c.outline}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Line
        x1={-18}
        y1={-31}
        x2={18}
        y2={-31}
        stroke={c.bambooShade}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {/* Steam wisps. */}
      <Path
        d="M -9 -44 Q -4 -50 -9 -56"
        stroke={c.cloud}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        opacity={0.9}
      />
      <Path
        d="M 8 -46 Q 13 -53 8 -60"
        stroke={c.cloud}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        opacity={0.75}
      />
    </G>
  );
}

export function Jar({
  x,
  y,
  height = 20,
  width = 15,
}: {
  x: number;
  y: number;
  height?: NumberProp;
  width?: number;
}) {
  return (
    <G transform={`translate(${x} ${y})`}>
      <Rect
        x={-width / 2}
        y={-Number(height)}
        width={width}
        height={Number(height)}
        rx={4}
        fill={c.jar}
        stroke={c.outline}
        strokeWidth={1.8}
      />
      <Rect
        x={-width / 2 - 1.5}
        y={-Number(height) - 5}
        width={width + 3}
        height={6}
        rx={3}
        fill={c.jarLid}
        stroke={c.outline}
        strokeWidth={1.8}
      />
    </G>
  );
}

/** A gingham valance: a scalloped band with a light check pattern. */
export function Curtain({
  x,
  y,
  width,
}: {
  x: number;
  y: number;
  width: number;
}) {
  const scallops = Math.max(3, Math.round(width / 16));
  const step = width / scallops;

  let scallop = `M 0 0 L ${width} 0 L ${width} 10`;
  for (let index = scallops; index > 0; index -= 1) {
    const from = index * step;
    const to = (index - 1) * step;
    scallop += ` Q ${(from + to) / 2} 20 ${to} 10`;
  }
  scallop += ' Z';

  return (
    <G transform={`translate(${x} ${y})`}>
      <Path
        d={scallop}
        fill={c.trim}
        stroke={c.outline}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      {Array.from({ length: scallops }, (_unused, index) => (
        <Line
          key={index}
          x1={index * step + step / 2}
          y1={1}
          x2={index * step + step / 2}
          y2={12}
          stroke={c.wallShade}
          strokeWidth={1.4}
        />
      ))}
      <Line
        x1={0}
        y1={5}
        x2={width}
        y2={5}
        stroke={c.wallShade}
        strokeWidth={1.4}
      />
    </G>
  );
}
