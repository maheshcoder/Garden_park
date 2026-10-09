import { Suspense, Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Park } from "../world/Park";
import { Player } from "../controllers/Player";
import { QUALITY } from "../config/park";
import { useGame } from "../state/game";
class SceneBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="webgl-error" role="alert">
        <h2>A little trouble opening the park.</h2>
        <p>
          Your browser needs WebGL 2 and hardware acceleration. Try enabling it
          in browser settings, or open the park in a recent Chrome, Firefox or
          Safari.
        </p>
        <button onClick={() => location.reload()}>Try again</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function Scene() {
  const s = useGame();
  const q = QUALITY[s.settings.quality];
  return (
    <SceneBoundary>
      <Canvas
        className="park-canvas"
        shadows={q.shadows ? "percentage" : false}
        dpr={[1, q.dpr]}
        frameloop={s.hidden ? "never" : "always"}
        camera={{ position: [26, 22, 34], fov: 47, near: 0.1, far: 180 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        fallback={
          <div className="webgl-error" role="alert">
            <h2>This park needs WebGL.</h2>
            <p>Please use a browser with hardware acceleration enabled.</p>
          </div>
        }
        onCreated={({ gl }) => {
          gl.setClearColor("#b9d9ce");
          gl.toneMappingExposure = 1;
        }}
      >
        <color attach="background" args={["#b9d9ce"]} />
        <fog attach="fog" args={["#b9d9ce", 48, 135]} />
        <ambientLight intensity={0.25} />
        <hemisphereLight args={["#dcebd9", "#526144", 0.8]} />
        <directionalLight
          position={[-18, 32, 20]}
          intensity={2.3}
          color="#fff0cf"
          castShadow={q.shadows}
          shadow-mapSize={[q.shadowSize, q.shadowSize]}
          shadow-camera-left={-35}
          shadow-camera-right={35}
          shadow-camera-top={35}
          shadow-camera-bottom={-35}
          shadow-camera-near={1}
          shadow-camera-far={100}
          shadow-normalBias={0.04}
          shadow-bias={-0.0002}
        />
        <Suspense fallback={null}>
          <Physics
            gravity={[0, -20, 0]}
            timeStep={1 / 60}
            paused={s.hidden || s.paused || !!s.sign || !s.entered}
          >
            <Park quality={s.settings.quality} />
            <Player />
          </Physics>
        </Suspense>
      </Canvas>
    </SceneBoundary>
  );
}
