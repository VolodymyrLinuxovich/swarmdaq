export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function weightedSum(
  components: Array<{ weight: number; value: number }>
): number {
  return clamp01(
    components.reduce((sum, c) => sum + c.weight * clamp01(c.value), 0)
  );
}
