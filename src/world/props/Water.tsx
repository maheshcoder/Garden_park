import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  RigidBody,
  CuboidCollider,
  CylinderCollider,
} from "@react-three/rapier";
import {
  Mesh,
  Group,
  CanvasTexture,
  SRGBColorSpace,
  RepeatWrapping,
} from "three";
import { inkRamp } from "../art";
import { Box, Pebble } from "./Scenery";
import { game } from "../../state/game";
import { PLAZA, POND_CENTER, LILY_PADS, POND_RIPPLES } from "../../config/park";
function WaterSurface({
  radius,
  y,
  scale = [1, 1, 1],
}: {
  radius: number;
  y: number;
  scale?: [number, number, number];
}) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#71ada4";
    ctx.fillRect(0, 0, 512, 512);
    ctx.lineWidth = 2;
    for (let row = -30; row < 550; row += 18) {
      ctx.strokeStyle = row % 3 ? "#b9d8bd55" : "#d9ebc577";
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 4) {
        const y =
          row + Math.sin(x * 0.025 + row) * 3 + Math.sin(x * 0.01 - row) * 5;
        if (!x) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const map = new CanvasTexture(c);
    map.colorSpace = SRGBColorSpace;
    map.wrapS = map.wrapT = RepeatWrapping;
    map.repeat.set(1.8, 1.8);
    return map;
  }, []);
  useFrame((_, dt) => {
    if (!game.get().settings.reducedMotion) {
      texture.offset.x += Math.min(dt, 0.05) * 0.008;
      texture.offset.y += Math.min(dt, 0.05) * 0.012;
    }
  });
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={scale}>
      <circleGeometry args={[radius, 64]} />
      <meshStandardMaterial
        map={texture}
        color="#e4f1dc"
        roughness={0.25}
        metalness={0.05}
      />
    </mesh>
  );
}
export function Fountain() {
  const rings = useRef<Group>(null!),
    water = useRef<Group>(null!);
  useFrame(({ clock }) => {
    if (game.get().settings.reducedMotion) return;
    const t = clock.elapsedTime;
    rings.current.children.forEach((child, i) => {
      child.position.y = 0.65 + ((t * 0.35 + i * 0.3) % 1.5);
      child.scale.setScalar(0.18 + (2.15 - child.position.y) * 0.27);
    });
    water.current.position.y = Math.sin(t * 1.5) * 0.006;
  });
  return (
    <group position={PLAZA}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.58, 1.95]} position={[0, 0.58, 0]} />
      </RigidBody>
      <mesh position={[0, 0.17, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[2.1, 2.24, 0.34, 48]} />
        <meshToonMaterial color="#c2c6ae" gradientMap={inkRamp} />
      </mesh>
      <mesh position={[0, 0.48, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[1.94, 0.19, 8, 48]} />
        <meshToonMaterial color="#e1deca" gradientMap={inkRamp} />
      </mesh>
      <group ref={water}>
        <WaterSurface radius={1.86} y={0.5} />
      </group>
      <mesh position={[0, 0.93, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.27, 1.5, 12]} />
        <meshToonMaterial color="#ccd0ba" gradientMap={inkRamp} />
      </mesh>
      <mesh position={[0, 1.48, 0]}>
        <cylinderGeometry args={[0.85, 0.55, 0.18, 24]} />
        <meshToonMaterial color="#e3dfc7" gradientMap={inkRamp} />
      </mesh>
      <mesh position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.16, 12, 8]} />
        <meshToonMaterial color="#ced0b2" gradientMap={inkRamp} />
      </mesh>
      <group ref={rings}>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1, 0.025, 5, 32]} />
            <meshStandardMaterial color="#d6efeb" transparent opacity={0.55} />
          </mesh>
        ))}
      </group>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.sin(a) * 0.52, 1.09, Math.cos(a) * 0.52]}
            rotation={[Math.cos(a) * 0.42, 0, -Math.sin(a) * 0.42]}
          >
            <cylinderGeometry args={[0.018, 0.035, 0.77, 5]} />
            <meshStandardMaterial color="#c6e5e1" transparent opacity={0.65} />
          </mesh>
        );
      })}
    </group>
  );
}
export function Pond() {
  const ripples = useRef<Group>(null!);
  const lilies = LILY_PADS;
  useFrame(({ clock }) => {
    if (game.get().settings.reducedMotion) return;
    ripples.current.children.forEach((m, i) => {
      const p = (clock.elapsedTime * 0.16 + i * 0.23) % 1;
      m.scale.setScalar(0.3 + p * 1.4);
      (m as Mesh).rotation.set(-Math.PI / 2, 0, p * 0.12);
    });
  });
  return (
    <group position={POND_CENTER}>
      <mesh
        position={[0, 0.035, 0]}
        scale={[7.3, 5.7, 1]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[1, 64]} />
        <meshToonMaterial color="#c6c8ac" gradientMap={inkRamp} />
      </mesh>
      <WaterSurface radius={1} y={0.055} scale={[6.85, 5.2, 1]} />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.7, 1, 4.6]} position={[-4.4, 0.3, 0]} />
        <CuboidCollider args={[2.7, 1, 4.6]} position={[4.4, 0.3, 0]} />
      </RigidBody>
      <group ref={ripples}>
        {POND_RIPPLES.map(([x, z], i) => (
          <mesh
            key={i}
            position={[x - POND_CENTER[0], 0.066, z - POND_CENTER[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.75, 0.78, 32]} />
            <meshBasicMaterial color="#c8e3d6" transparent opacity={0.36} />
          </mesh>
        ))}
      </group>
      {lilies.map(([x, z], i) => (
        <group
          key={i}
          position={[x - POND_CENTER[0], 0.072, z - POND_CENTER[2]]}
        >
          <mesh rotation={[-Math.PI / 2, 0, i]}>
            <circleGeometry args={[0.52, 20, 0, Math.PI * 1.83]} />
            <meshStandardMaterial color="#659875" side={2} />
          </mesh>
          <mesh position={[0.1, 0.08, 0.1]} scale={[0.2, 0.08, 0.2]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#f2cecf" />
          </mesh>
        </group>
      ))}
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        const x = Math.cos(a) * 7.1,
          z = Math.sin(a) * 5.5;
        if (Math.abs(x) < 1.9) return null;
        return (
          <group key={i}>
            <Pebble position={[x, 0.17, z]} scale={[0.38, 0.28, 0.44]} />
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider args={[0.4, 0.35, 0.45]} position={[x, 0.2, z]} />
            </RigidBody>
            {[0, 1, 2].map((j) => (
              <mesh
                key={j}
                position={[x + 0.13 * j, 0.45 + j * 0.06, z - 0.1 * j]}
                rotation={[0, 0, 0.12 - j * 0.1]}
              >
                <cylinderGeometry args={[0.035, 0.05, 0.8 + j * 0.12, 5]} />
                <meshStandardMaterial color="#6f9563" />
              </mesh>
            ))}
          </group>
        );
      })}
      <group position={[0, 0, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[1.5, 0.18, 7]} position={[0, 0.2, 0]} />
          {[-1, 1].map((s) => (
            <CuboidCollider
              key={s}
              args={[0.08, 0.63, 6.1]}
              position={[s * 1.47, 0.68, 0]}
            />
          ))}
        </RigidBody>
        {Array.from({ length: 35 }, (_, i) => (
          <Box
            key={i}
            position={[0, 0.31, -6.8 + i * 0.4]}
            scale={[3, 0.15, 0.37]}
            color={i % 2 ? "#b8946f" : "#c19e79"}
          />
        ))}
        {[-1, 1].map((s) => (
          <group key={s}>
            {[-5.6, -2.8, 0, 2.8, 5.6].map((z) => (
              <Box
                key={z}
                position={[s * 1.46, 0.83, z]}
                scale={[0.13, 1.25, 0.13]}
                color="#967657"
              />
            ))}
            {[0.75, 1.37].map((y) => (
              <Box
                key={y}
                position={[s * 1.46, y, 0]}
                scale={[0.11, 0.11, 11.5]}
                color="#a1805e"
              />
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}
