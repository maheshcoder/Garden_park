import { useGame } from "../state/game";
import { lazy, Suspense, useState } from "react";
const Scene = lazy(() =>
  import("./Scene").then((module) => ({ default: module.Scene })),
);
import { Interface } from "../ui/Interface";
import { useInput } from "../controllers/input";
import { useAudio } from "../audio/ambience";
export function App() {
  const { settings } = useGame();
  useInput();
  useAudio();
  const [webgl] = useState(() => {
    try {
      const gl = document.createElement("canvas").getContext("webgl2");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      return !!gl;
    } catch {
      return false;
    }
  });
  if (!webgl)
    return (
      <div className="webgl-error" role="alert">
        <h2>This park needs WebGL 2.</h2>
        <p>
          Enable hardware acceleration in your browser, or try a recent Chrome,
          Firefox or Safari.
        </p>
        <button onClick={() => location.reload()}>Try again</button>
      </div>
    );
  return (
    <div className="app" data-reduced-motion={settings.reducedMotion}>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <Interface />
    </div>
  );
}
