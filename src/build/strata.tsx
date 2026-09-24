// src/build/strata.tsx
//
// landing-craft T5: a geological cross-section between two home
// sections. The top of the SVG is transparent (the previous section
// shows through); four folded bands descend to the next section's
// surface color. Band colors come from CSS (`.strata--to-*` in
// app/globals.css), never from the markup, so they stay tokens.

export type StrataSurface = "paper" | "ink" | "cream" | "deep" | "sand";

// viewBox 1440 x 120, stretched. Each band runs from its folded top
// edge down to the bottom; later bands cover earlier ones.
const BANDS = [
  "0,34 360,20 720,36 1080,24 1440,12",
  "0,60 360,46 720,58 1080,52 1440,38",
  "0,66 360,51 720,62 1080,58 1440,44",
  "0,98 360,86 720,94 1080,82 1440,72",
].map((edge) => `${edge} 1440,120 0,120`);

export function Strata({ to }: { to: StrataSurface }) {
  return (
    <div className={`strata strata--to-${to}`} aria-hidden="true">
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
        {BANDS.map((points, i) => (
          <polygon className={`s${i + 1}`} points={points} />
        ))}
      </svg>
    </div>
  );
}
