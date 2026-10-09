import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, InstancedMesh, Object3D, Color } from "three";
import {
  random,
  QUALITY,
  LOOP,
  BEDS,
  BIRDHOUSES,
  PLAZA,
  POND_CENTER,
  type Quality,
} from "../../config/park";
import { game } from "../../state/game";
import { terrainHeight } from "../../config/terrain";
import { Ink, inkRamp, tailored, limb } from "../art";
export function Petals({ quality }: { quality: Quality }) {
  const mesh = useRef<InstancedMesh>(null!);
  const data = useMemo(() => {
    const rng = random(877);
    return Array.from({ length: QUALITY[quality].petals }, () => ({
      x: (rng() - 0.5) * 48,
      z: (rng() - 0.5) * 48,
      y: rng() * 5,
      s: rng() * 0.045 + 0.045,
      phase: rng() * 6.28,
    }));
  }, [quality]);
  const object = useMemo(() => new Object3D(), []);
  useFrame(({ clock }) => {
    const time = game.get().settings.reducedMotion ? 0 : clock.elapsedTime;
    data.forEach((p, i) => {
      object.position.set(
        p.x + Math.sin(time * 0.3 + p.phase) * 0.7,
        0.15 + ((((p.y - time * 0.27) % 5) + 5) % 5),
        p.z + Math.cos(time * 0.25 + p.phase) * 0.45,
      );
      object.rotation.set(time + p.phase, p.phase, time * 0.4);
      object.scale.set(p.s, p.s * 0.7, p.s);
      object.updateMatrix();
      mesh.current.setMatrixAt(i, object.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, data.length]}
      frustumCulled={false}
    >
      <circleGeometry args={[1, 5]} />
      <meshStandardMaterial color="#f5c4d3" side={2} roughness={0.9} />
    </instancedMesh>
  );
}
function Bird({ index }: { index: number }) {
  const root = useRef<Group>(null!),
    left = useRef<Group>(null!),
    right = useRef<Group>(null!),
    head = useRef<Group>(null!);
  const perched = index % 3 === 0;
  useFrame(({ clock }) => {
    const still = game.get().settings.reducedMotion,
      time = still ? 0 : clock.elapsedTime;
    const t = time * 0.28 + index * 1.7,
      perch = BIRDHOUSES[Math.floor(index / 3) % 3];
    if (perched) {
      root.current.position.set(
        perch[0],
        terrainHeight(perch[0], perch[1]) + 3.45,
        perch[1],
      );
      root.current.rotation.set(0, 0.7 + index, 0);
      head.current.rotation.y = still ? 0 : Math.sin(time * 0.8 + index) * 0.35;
    } else {
      const radius = 6 + index * 0.6,
        cx = index % 2 ? -4 : 10,
        cz = index % 2 ? -16 : -7;
      root.current.position.set(
        cx + Math.sin(t) * radius,
        3.1 + Math.sin(t * 2 + index) * 0.65,
        cz + Math.cos(t) * radius * 0.72,
      );
      root.current.rotation.set(
        Math.cos(t * 2 + index) * 0.1,
        Math.atan2(Math.cos(t), -Math.sin(t) * 0.72),
        -0.13,
      );
    }
    const gliding = Math.sin(time * 0.85 + index) > 0.45;
    const flap = still
      ? 0
      : perched
        ? 0
        : gliding
          ? Math.sin(time * 1.8) * 0.07
          : Math.sin(time * 13 + index) * 0.65;
    left.current.rotation.z = perched ? 0.45 : flap;
    right.current.rotation.z = perched ? -0.45 : -flap;
    left.current.rotation.y = perched ? -1.1 : 0.2;
    right.current.rotation.y = perched ? 1.1 : -0.2;
  });
  const body = index % 2 ? "#a46c46" : "#597e96",
    wing = index % 2 ? "#645145" : "#3f5864";
  return (
    <group ref={root} scale={1.15}>
      <Ink scale={[0.14, 0.16, 0.24]} color={body} />
      <Ink
        position={[0, -0.02, 0.15]}
        scale={[0.113, 0.127, 0.14]}
        color={index % 2 ? "#e9b878" : "#eedabc"}
        outline={false}
      />
      <group ref={head} position={[0, 0.16, 0.16]}>
        <Ink scale={[0.105, 0.11, 0.112]} color={body} />
        <Ink
          position={[0, -0.023, 0.09]}
          scale={[0.072, 0.064, 0.047]}
          color="#f1e2bf"
          outline={false}
        />
        <mesh position={[0, -0.018, 0.165]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.035, 0.115, 6]} />
          <meshToonMaterial color="#d4a04d" gradientMap={inkRamp} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <Ink
              position={[side * 0.09, 0.02, 0.046]}
              scale={[0.018, 0.022, 0.012]}
              color="#263837"
            />
            <Ink
              position={[side * 0.093, 0.027, 0.055]}
              scale={[0.006, 0.007, 0.005]}
              color="#ffffff"
              outline={false}
            />
          </group>
        ))}
      </group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <group
            ref={side < 0 ? left : right}
            position={[side * 0.1, 0.06, 0]}
            rotation={[0, -side * 0.2, 0]}
          >
            <Ink
              position={[side * 0.13, 0, -0.065]}
              scale={[0.21, 0.035, 0.14]}
              color={wing}
              outline={false}
            />
            {[0, 1, 2, 3].map((i) => (
              <Ink
                key={i}
                geometry={tailored}
                position={[side * (0.24 + i * 0.035), 0, -0.085 - i * 0.035]}
                rotation={[0, side * (0.25 + i * 0.1), 0]}
                scale={[0.075, 0.018, 0.22 - i * 0.025]}
                color={i % 2 ? body : wing}
                outline={false}
              />
            ))}
          </group>
          <Ink
            geometry={limb}
            position={[side * 0.06, -0.19, 0.055]}
            scale={[0.025, perched ? 0.038 : 0.018, 0.025]}
            color="#9c7951"
            outline={false}
          />
          <Ink
            geometry={tailored}
            position={[side * 0.06, -0.235, 0.09]}
            scale={[0.067, 0.018, 0.09]}
            color="#9c7951"
            outline={false}
          />
          <Ink
            geometry={tailored}
            position={[side * 0.045, 0, -0.28]}
            rotation={[-0.25, side * 0.13, 0]}
            scale={[0.08, 0.028, 0.21]}
            color={wing}
            outline={false}
          />
        </group>
      ))}
    </group>
  );
}
function Butterfly({ index }: { index: number }) {
  const root = useRef<Group>(null!),
    wings = useRef<Group>(null!);
  useFrame(({ clock }) => {
    const t = game.get().settings.reducedMotion
      ? index
      : clock.elapsedTime * 0.6 + index;
    root.current.position.set(
      14 + Math.sin(t * 0.8 + index) * 4,
      1.1 + Math.sin(t * 1.3) * 0.5,
      9 + Math.cos(t * 0.9) * 4,
    );
    root.current.rotation.y = t;
    wings.current.scale.x = game.get().settings.reducedMotion
      ? 0.8
      : 0.35 + Math.abs(Math.sin(clock.elapsedTime * 12 + index)) * 0.65;
  });
  return (
    <group ref={root}>
      <group ref={wings}>
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[s * 0.12, 0, 0]}
            scale={[0.12, 0.022, 0.16]}
            rotation={[0, 0, s * 0.2]}
          >
            <sphereGeometry args={[1, 7, 5]} />
            <meshStandardMaterial
              color={index % 2 ? "#ebbc7a" : "#cf98bf"}
              side={2}
            />
          </mesh>
        ))}
      </group>
      <mesh scale={[0.025, 0.025, 0.12]}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshStandardMaterial color="#715d52" />
      </mesh>
    </group>
  );
}
export function Wildlife({ quality }: { quality: Quality }) {
  return (
    <>
      {Array.from({ length: QUALITY[quality].birds }, (_, i) => (
        <Bird key={i} index={i} />
      ))}
      {Array.from({ length: quality === "low" ? 3 : 6 }, (_, i) => (
        <Butterfly key={i} index={i} />
      ))}
    </>
  );
}
export function Grass() {
  const data = useMemo(() => {
    const rng = random(300);
    return Array.from({ length: 1300 }, () => ({
      x: (rng() - 0.5) * 53,
      z: (rng() - 0.5) * 53,
      s: 0.12 + rng() * 0.2,
    })).filter((p) => {
      if (
        (Math.abs(p.x) < 2.2 && p.z > 13) ||
        Math.hypot(p.x - PLAZA[0], p.z - PLAZA[2]) < 6.8 ||
        Math.hypot((p.x - POND_CENTER[0]) / 7.5, (p.z - POND_CENTER[2]) / 6) < 1
      )
        return false;
      if (
        BEDS.some(
          (b) =>
            Math.hypot((p.x - b.x) / (b.rx + 0.3), (p.z - b.z) / (b.rz + 0.3)) <
            1,
        )
      )
        return false;
      return !LOOP.some((a, i) => {
        const b = LOOP[(i + 1) % LOOP.length],
          dx = b[0] - a[0],
          dz = b[2] - a[2],
          t = Math.max(
            0,
            Math.min(
              1,
              ((p.x - a[0]) * dx + (p.z - a[2]) * dz) / (dx * dx + dz * dz),
            ),
          );
        return Math.hypot(p.x - a[0] - dx * t, p.z - a[2] - dz * t) < 3;
      });
    });
  }, []);
  return (
    <instancedMesh
      args={[undefined, undefined, data.length]}
      onUpdate={(m) => {
        const o = new Object3D();
        data.forEach((p, i) => {
          o.position.set(p.x, terrainHeight(p.x, p.z) + p.s / 2, p.z);
          o.scale.set(p.s * 0.4, p.s, p.s * 0.4);
          o.updateMatrix();
          m.setMatrixAt(i, o.matrix);
          m.setColorAt(i, new Color(i % 2 ? "#64804f" : "#91a160"));
        });
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }}
    >
      <coneGeometry args={[1, 1, 3]} />
      <meshToonMaterial gradientMap={inkRamp} />
    </instancedMesh>
  );
}
