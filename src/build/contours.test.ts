// src/build/contours.test.ts
//
// landing-craft T4: pure, dependency-free pieces of the Piura contour
// generator (PNG decode → Terrarium elevation → marching squares → SVG).

import { describe, expect, test } from "bun:test";
import { deflateSync } from "node:zlib";
import {
  contourLevels,
  contoursToSvg,
  joinSegments,
  marchingSquares,
  parsePng,
  simplify,
  terrariumElevation,
} from "./contours";

// Minimal 8-bit RGB PNG encoder for fixtures: one filter byte per row.
function encodePng(
  width: number,
  height: number,
  rows: { filter: number; bytes: number[] }[],
): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4);
    out.set(data, 8);
    // CRC is not validated by the decoder; zero is fine for fixtures.
    return out;
  };
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const raw = Uint8Array.from(rows.flatMap((row) => [row.filter, ...row.bytes]));
  const parts = [
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(deflateSync(raw))),
    chunk("IEND", new Uint8Array()),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

describe("terrariumElevation", () => {
  test("decodes (R * 256 + G + B / 256) - 32768 meters", () => {
    expect(terrariumElevation(128, 0, 0)).toBe(0);
    expect(terrariumElevation(0, 0, 0)).toBe(-32768);
    expect(terrariumElevation(131, 232, 128)).toBe(1000.5);
  });
});

describe("parsePng", () => {
  test("decodes an RGB PNG, undoing None/Sub/Up/Average/Paeth filters", () => {
    // Target pixels (2x5, RGB): row y has pixels [y*10, 1, 2] and [y*10+5, 3, 4].
    const target = [0, 1, 2, 3, 4].map((y) => [y * 10, 1, 2, y * 10 + 5, 3, 4]);
    const rows = [
      { filter: 0, bytes: target[0] },
      // Sub: second pixel stored as a difference from the first.
      { filter: 1, bytes: [10, 1, 2, 5, 2, 2] },
      // Up: stored as a difference from the row above.
      { filter: 2, bytes: [10, 0, 0, 10, 0, 0] },
      // Average of left and up (floor). First pixel: left = 0, so up / 2.
      {
        filter: 3,
        bytes: [30 - 10, 1 - 0, 2 - 1, 35 - 27, 3 - 2, 4 - 3],
      },
      // Paeth: first pixel predictor = up; second pixel picks among
      // left (40,1,2), up (35,3,4), upper-left (30,1,2) → p = 45,3,4.
      // |p-a|=5,2,2 |p-b|=10,0,0 |p-c|=15,2,2 → a, b, b.
      { filter: 4, bytes: [40 - 30, 1 - 1, 2 - 2, 45 - 40, 3 - 3, 4 - 4] },
    ];
    const png = parsePng(encodePng(2, 5, rows));
    expect(png.width).toBe(2);
    expect(png.height).toBe(5);
    expect(Array.from(png.pixels)).toEqual(target.flat());
  });

  test("rejects anything that is not 8-bit RGB", () => {
    const bad = encodePng(1, 1, [{ filter: 0, bytes: [0, 0, 0] }]);
    bad[8 + 8 + 9] = 6; // IHDR color type → RGBA
    expect(() => parsePng(bad)).toThrow(/8-bit RGB/);
  });
});

describe("marchingSquares + joinSegments", () => {
  // A single peak in the middle of a 3x3 grid.
  const grid = Float32Array.from([0, 0, 0, 0, 10, 0, 0, 0, 0]);

  test("a peak yields one closed ring around it", () => {
    const segments = marchingSquares(grid, 3, 3, 5);
    expect(segments.length).toBe(4);
    const lines = joinSegments(segments);
    expect(lines.length).toBe(1);
    const ring = lines[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    // Linear interpolation puts the level halfway between 0 and 10.
    for (const [x, y] of ring) {
      expect(Math.abs(x - 1) + Math.abs(y - 1)).toBeCloseTo(0.5, 5);
    }
  });

  test("a level above every sample yields nothing", () => {
    expect(marchingSquares(grid, 3, 3, 20)).toEqual([]);
  });

  test("an open line across a slope stays open", () => {
    // Elevation grows left → right; level 1.5 crosses every row once.
    const slope = Float32Array.from([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]);
    const lines = joinSegments(marchingSquares(slope, 4, 3, 1.5));
    expect(lines.length).toBe(1);
    expect(lines[0].length).toBe(3);
    expect(lines[0][0]).not.toEqual(lines[0][2]);
    for (const [x] of lines[0]) expect(x).toBeCloseTo(1.5, 5);
  });
});

describe("simplify", () => {
  test("drops points within tolerance of the chord, keeps endpoints", () => {
    const line: [number, number][] = [
      [0, 0],
      [1, 0.01],
      [2, 0],
      [3, 2],
    ];
    expect(simplify(line, 0.1)).toEqual([
      [0, 0],
      [2, 0],
      [3, 2],
    ]);
  });
});

describe("contourLevels", () => {
  test("returns multiples of the interval strictly inside the range", () => {
    expect(contourLevels(120, 480, 100)).toEqual([200, 300, 400]);
  });
});

describe("contoursToSvg", () => {
  const svg = contoursToSvg({
    width: 30,
    height: 20,
    layers: [
      { level: 100, index: false, lines: [[[0, 0], [10.26, 5]]] },
      { level: 500, index: true, lines: [[[1, 1], [2, 2], [1, 1]]] },
    ],
    comment: "test source",
  });

  test("is a standalone, stroke-only SVG sized to the grid", () => {
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 30 20"');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain("<!-- test source -->");
  });

  test("emits one path per layer, rounded, closing rings with Z", () => {
    expect(svg).toContain('<path d="M0 0L10.3 5"/>');
    expect(svg).toContain('<path class="i" d="M1 1L2 2Z"/>');
  });

  test("inherits its color from the page (currentColor), no hard-coded color", () => {
    expect(svg).toContain("currentColor");
    expect(svg).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
});

describe("committed public/piura-contours.svg", () => {
  const path = new URL("../../public/piura-contours.svg", import.meta.url);

  test("is a generated contour SVG that names its source", async () => {
    const svg = await Bun.file(path).text();
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("AWS Terrain Tiles");
    expect(svg).toContain("scripts/generate-contours.ts");
    expect(svg.split("<path").length - 1).toBeGreaterThan(5);
  });

  test("stays within a mobile-friendly budget (< 40 KB gzip)", async () => {
    const bytes = await Bun.file(path).bytes();
    expect(Bun.gzipSync(bytes).length).toBeLessThan(40 * 1024);
  });
});
