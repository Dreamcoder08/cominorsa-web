// WCAG 2.x relative-luminance contrast ratio calculator.
// Use this instead of eyeballing a color pair or trusting a pasted critique's
// contrast claim — compute it against the actual token values in
// app/globals.css :root.
//
// Usage: edit fg/bg/alpha below and run `node contrast-check.mjs`.

function srgbToLin(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map(srgbToLin);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function contrast(c1, c2) {
  const L1 = luminance(c1);
  const L2 = luminance(c2);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}
function blend(fg, bg, alpha) {
  return fg.map((c, i) => alpha * c + (1 - alpha) * bg[i]);
}
function hexToRgb(hex) {
  const n = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}

// --- edit below ---
const fg = hexToRgb("#fffdf7"); // text color, or hexToRgb of the token
const bg = hexToRgb("#123322"); // background color/approximate gradient stop
const alpha = 1; // 1 if fg is opaque; <1 if using rgba(...) text like the hero copy

const effective = alpha < 1 ? blend(fg, bg, alpha) : fg;
const ratio = contrast(effective, bg);

console.log("effective color:", effective.map(Math.round));
console.log("contrast ratio:", ratio.toFixed(2));
console.log("AA normal text (4.5):", ratio >= 4.5 ? "pass" : "FAIL");
console.log("AA large text/UI (3.0):", ratio >= 3.0 ? "pass" : "FAIL");
console.log("AAA normal text (7.0):", ratio >= 7.0 ? "pass" : "FAIL");
