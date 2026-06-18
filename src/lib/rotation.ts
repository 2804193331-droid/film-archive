export type Rotation = 0 | 90 | 180 | 270;

export const allowedRotations: Rotation[] = [0, 90, 180, 270];

export function normalizeRotation(value: unknown): Rotation {
  const number = typeof value === "number" ? value : Number(value);
  const normalized = ((Math.round(number / 90) * 90) % 360 + 360) % 360;
  return allowedRotations.includes(normalized as Rotation) ? (normalized as Rotation) : 0;
}

export function rotateBy(value: unknown, delta: 90 | -90): Rotation {
  return normalizeRotation(normalizeRotation(value) + delta);
}

export function isRightAngleRotation(value: unknown) {
  const rotation = normalizeRotation(value);
  return rotation === 90 || rotation === 270;
}

export function rotatedAspectRatio(width: number, height: number, rotation: unknown) {
  return isRightAngleRotation(rotation) ? { width: height, height: width } : { width, height };
}
