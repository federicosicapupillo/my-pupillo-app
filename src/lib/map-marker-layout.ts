/** Separate overlapping marker images in screen pixels without changing stored locations. */
export function separateMapMarkers<T extends { id: string; x: number; y: number }>(points: T[], spacing = 54): T[] {
  const placed: T[] = [];
  for (const point of [...points].sort((a, b) => a.id.localeCompare(b.id))) {
    let x = point.x;
    let y = point.y;
    let attempt = 0;
    while (placed.some(p => Math.hypot(p.x - x, p.y - y) < spacing)) {
      attempt += 1;
      const angle = attempt * 2.399963229728653;
      const radius = spacing * Math.sqrt(attempt);
      x = point.x + Math.cos(angle) * radius;
      y = point.y + Math.sin(angle) * radius;
    }
    placed.push({ ...point, x, y });
  }
  return placed;
}