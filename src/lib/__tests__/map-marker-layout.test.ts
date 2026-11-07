import { describe, expect, it } from 'vitest';
import { separateMapMarkers } from '../map-marker-layout';

describe('map marker collision layout', () => {
  it('keeps every worker accessible when approximate locations coincide', () => {
    const points = Array.from({ length: 7 }, (_, i) => ({ id: String(i), x: 100, y: 100 }));
    const result = separateMapMarkers(points);
    expect(result.map(p => p.id)).toEqual(points.map(p => p.id));
    result.forEach((a, i) => result.slice(i + 1).forEach(b => expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(54)));
    expect(points.every(p => p.x === 100 && p.y === 100)).toBe(true);
  });
  it('leaves isolated locations unchanged and is stable across input ordering', () => {
    const points = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 300, y: 300 }];
    expect(separateMapMarkers(points)).toEqual(points);
    expect(separateMapMarkers([...points].reverse())).toEqual(points);
  });
});