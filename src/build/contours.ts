// src/build/contours.ts
//
// landing-craft T4: dependency-free contour generation. Pure functions
// only — `scripts/generate-contours.ts` does the network I/O (AWS
// Terrain Tiles, Terrarium encoding) and writes the committed SVG, so
// the site build never touches the network.
//
// Pipeline: parsePng (8-bit RGB) → terrariumElevation per pixel →
// marchingSquares per level → joinSegments → simplify → contoursToSvg.

import { inflateSync } from "node:zlib";

export type Point = [number, number];

export interface DecodedPng {
  width: number;
  height: number;
  /** Tightly packed RGB bytes, row-major. */
  pixels: Uint8Array;
}

/** Terrarium encoding: meters = (R * 256 + G + B / 256) - 32768. */
export function terrariumElevation(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/**
 * Decodes a non-interlaced 8-bit RGB PNG (the only format Terrarium tiles
 * use). CRCs are not checked: inputs come from a known source and a
 * corrupt stream still fails in inflate or on the size check below.
 */
export function parsePng(bytes: Uint8Array): DecodedPng {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8; // PNG signature
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      const [bitDepth, colorType, , , interlace] = data.subarray(8, 13);
      if (bitDepth !== 8 || colorType !== 2 || interlace !== 0) {
        throw new Error("parsePng: only non-interlaced 8-bit RGB is supported");
      }
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  const compressed = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const chunk of idat) {
    compressed.set(chunk, at);
    at += chunk.length;
  }
  const raw = new Uint8Array(inflateSync(compressed));
  const bpp = 3;
  const stride = width * bpp;
  if (raw.length !== height * (stride + 1)) {
    throw new Error("parsePng: unexpected image data length");
  }

  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? pixels[dst + i - bpp] : 0;
      const b = y > 0 ? pixels[dst + i - stride] : 0;
      const c = i >= bpp && y > 0 ? pixels[dst + i - stride - bpp] : 0;
      let predictor: number;
      switch (filter) {
        case 0:
          predictor = 0;
          break;
        case 1:
          predictor = a;
          break;
        case 2:
          predictor = b;
          break;
        case 3:
          predictor = (a + b) >> 1;
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default:
          throw new Error(`parsePng: unknown filter ${filter}`);
      }
      pixels[dst + i] = (raw[src + i] + predictor) & 0xff;
    }
  }
  return { width, height, pixels };
}

/** Multiples of `interval` strictly between `min` and `max`. */
export function contourLevels(min: number, max: number, interval: number): number[] {
  const levels: number[] = [];
  for (let level = Math.floor(min / interval + 1) * interval; level < max; level += interval) {
    levels.push(level);
  }
  return levels;
}

/** A segment between two grid-edge crossings, keyed by edge id for joining. */
export interface Segment {
  a: Point;
  b: Point;
  keyA: string;
  keyB: string;
}

/**
 * Marching squares over a row-major `width × height` grid. Saddles are
 * resolved with the cell-center average so rings never cross.
 */
export function marchingSquares(
  grid: ArrayLike<number>,
  width: number,
  height: number,
  level: number,
): Segment[] {
  const at = (x: number, y: number) => grid[y * width + x];
  const lerp = (v0: number, v1: number) => (level - v0) / (v1 - v0);
  // Edge crossings: top (x,y)-(x+1,y), left (x,y)-(x,y+1).
  const top = (x: number, y: number): [Point, string] => [
    [x + lerp(at(x, y), at(x + 1, y)), y],
    `h${x},${y}`,
  ];
  const left = (x: number, y: number): [Point, string] => [
    [x, y + lerp(at(x, y), at(x, y + 1))],
    `v${x},${y}`,
  ];

  const segments: Segment[] = [];
  const push = ([a, keyA]: [Point, string], [b, keyB]: [Point, string]) =>
    segments.push({ a, b, keyA, keyB });

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const tl = at(x, y);
      const tr = at(x + 1, y);
      const br = at(x + 1, y + 1);
      const bl = at(x, y + 1);
      const code =
        (tl >= level ? 8 : 0) | (tr >= level ? 4 : 0) | (br >= level ? 2 : 0) | (bl >= level ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const T = () => top(x, y);
      const B = () => top(x, y + 1);
      const L = () => left(x, y);
      const R = () => left(x + 1, y);
      switch (code) {
        case 1:
        case 14:
          push(L(), B());
          break;
        case 2:
        case 13:
          push(B(), R());
          break;
        case 3:
        case 12:
          push(L(), R());
          break;
        case 4:
        case 11:
          push(T(), R());
          break;
        case 6:
        case 9:
          push(T(), B());
          break;
        case 7:
        case 8:
          push(L(), T());
          break;
        case 5:
        case 10: {
          const centerHigh = (tl + tr + br + bl) / 4 >= level;
          // code 5: tr + bl high; code 10: tl + br high.
          if ((code === 5) === centerHigh) {
            push(L(), T());
            push(B(), R());
          } else {
            push(T(), R());
            push(L(), B());
          }
          break;
        }
      }
    }
  }
  return segments;
}

/** Chains segments sharing edge crossings into polylines; rings end on their start. */
export function joinSegments(segments: Segment[]): Point[][] {
  const byKey = new Map<string, number[]>();
  segments.forEach((s, i) => {
    for (const key of [s.keyA, s.keyB]) {
      const list = byKey.get(key);
      if (list) list.push(i);
      else byKey.set(key, [i]);
    }
  });
  const used = new Uint8Array(segments.length);

  const walk = (startKey: string, line: Point[], keys: string[]) => {
    let key = startKey;
    for (;;) {
      const next = (byKey.get(key) ?? []).find((i) => !used[i]);
      if (next === undefined) return;
      used[next] = 1;
      const s = segments[next];
      const [point, nextKey] = s.keyA === key ? [s.b, s.keyB] : [s.a, s.keyA];
      line.push(point);
      keys.push(nextKey);
      key = nextKey;
    }
  };

  const lines: Point[][] = [];
  segments.forEach((s, i) => {
    if (used[i]) return;
    used[i] = 1;
    const forward: Point[] = [s.a, s.b];
    const forwardKeys = [s.keyA, s.keyB];
    walk(s.keyB, forward, forwardKeys);
    if (forwardKeys[forwardKeys.length - 1] !== s.keyA) {
      const backward: Point[] = [];
      walk(s.keyA, backward, []);
      forward.unshift(...backward.reverse());
    }
    lines.push(forward);
  });
  return lines;
}

/** Ramer–Douglas–Peucker. Endpoints are always kept. */
export function simplify(line: Point[], tolerance: number): Point[] {
  if (line.length < 3) return line;
  const [x1, y1] = line[0];
  const [x2, y2] = line[line.length - 1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  let maxDistance = -1;
  let index = 0;
  for (let i = 1; i < line.length - 1; i++) {
    const [x, y] = line[i];
    const distance =
      length === 0
        ? Math.hypot(x - x1, y - y1)
        : Math.abs(dy * (x - x1) - dx * (y - y1)) / length;
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance <= tolerance) return [line[0], line[line.length - 1]];
  const head = simplify(line.slice(0, index + 1), tolerance);
  const tail = simplify(line.slice(index), tolerance);
  return [...head.slice(0, -1), ...tail];
}

export interface ContourLayer {
  level: number;
  /** Index contours (every Nth level) render heavier via class "i". */
  index: boolean;
  lines: Point[][];
}

const round = (n: number) => String(Math.round(n * 10) / 10);

function pathData(line: Point[]): string {
  const [first, ...rest] = line;
  const last = line[line.length - 1];
  const closed = line.length > 2 && first[0] === last[0] && first[1] === last[1];
  const body = (closed ? rest.slice(0, -1) : rest)
    .map(([x, y]) => `L${round(x)} ${round(y)}`)
    .join("");
  return `M${round(first[0])} ${round(first[1])}${body}${closed ? "Z" : ""}`;
}

/**
 * Stroke-only SVG. Color comes from `currentColor` so the page decides it
 * through its tokens; index contours carry class "i" (styled in-file).
 */
export function contoursToSvg({
  width,
  height,
  layers,
  comment,
}: {
  width: number;
  height: number;
  layers: ContourLayer[];
  comment: string;
}): string {
  const paths = layers
    .filter((layer) => layer.lines.length > 0)
    .map((layer) => {
      const d = layer.lines.map(pathData).join("");
      return layer.index ? `<path class="i" d="${d}"/>` : `<path d="${d}"/>`;
    })
    .join("\n");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" stroke-width="0.6" stroke-linejoin="round">`,
    `<!-- ${comment} -->`,
    `<style>.i{stroke-width:1.2}</style>`,
    paths,
    `</svg>`,
    "",
  ].join("\n");
}
