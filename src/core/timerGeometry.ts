export interface CircleGeometry {
  readonly centerX: number;
  readonly centerY: number;
  readonly radius: number;
}

const START_ANGLE_DEGREES = -90;
const FULL_CIRCLE_RATIO = 1;

function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) {
    return 0;
  }

  return Math.max(0, Math.min(FULL_CIRCLE_RATIO, ratio));
}

function polarToCartesian(geometry: CircleGeometry, angleDegrees: number): { readonly x: number; readonly y: number } {
  const angleRadians = (angleDegrees * Math.PI) / 180;

  return {
    x: geometry.centerX + geometry.radius * Math.cos(angleRadians),
    y: geometry.centerY + geometry.radius * Math.sin(angleRadians),
  };
}

export function createRemainingSectorPath(geometry: CircleGeometry, remainingRatio: number): string {
  const ratio = clampRatio(remainingRatio);

  if (ratio <= 0) {
    return "";
  }

  const start = polarToCartesian(geometry, START_ANGLE_DEGREES);

  if (ratio >= FULL_CIRCLE_RATIO) {
    const middle = polarToCartesian(geometry, START_ANGLE_DEGREES + 180);

    return [
      `M ${geometry.centerX} ${geometry.centerY}`,
      `L ${start.x} ${start.y}`,
      `A ${geometry.radius} ${geometry.radius} 0 1 1 ${middle.x} ${middle.y}`,
      `A ${geometry.radius} ${geometry.radius} 0 1 1 ${start.x} ${start.y}`,
      "Z",
    ].join(" ");
  }

  const end = polarToCartesian(geometry, START_ANGLE_DEGREES + 360 * ratio);
  const largeArcFlag = ratio > 0.5 ? 1 : 0;

  return [
    `M ${geometry.centerX} ${geometry.centerY}`,
    `L ${start.x} ${start.y}`,
    `A ${geometry.radius} ${geometry.radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}
