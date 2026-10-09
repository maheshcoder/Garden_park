import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, BallCollider, CuboidCollider } from "@react-three/rapier";
import {
  Group,
  InstancedMesh,
  Object3D,
  Color,
  CylinderGeometry,
  Vector3,
  Quaternion,
  Matrix4,
  Shape,
  ShapeGeometry,
  IcosahedronGeometry,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { terrainHeight } from "../../config/terrain";
import { Ink, inkRamp } from "../art";
import { random, QUALITY, type Quality, type Bench } from "../../config/park";
import { game } from "../../state/game";
export function Box({
  position,
  scale,
  color,
  rotation = 0,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  rotation?: number;
}) {
  return (
    <mesh
      position={position}
      scale={scale}
      rotation={[0, rotation, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry />
      <meshToonMaterial color={color} gradientMap={inkRamp} />
    </mesh>
  );
}
export function Pebble({
  position,
  scale = [0.45, 0.25, 0.35],
  color = "#b5b9a3",
}: {
  position: [number, number, number];
  scale?: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position} scale={scale} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 1]} />
      <meshToonMaterial color={color} gradientMap={inkRamp} />
    </mesh>
  );
}
const flowerShape = new Shape();
for (let i = 0; i <= 40; i++) {
  const a = (i / 40) * Math.PI * 2,
    r = 0.82 + Math.cos(a * 5) * 0.18;
  if (!i) flowerShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  else flowerShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
}
const blossomGeometry = new ShapeGeometry(flowerShape);
const canopyGeometries = [0, 1, 2].map((detail) => {
  const geometry = new IcosahedronGeometry(1, detail),
    vertices = geometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i),
      y = vertices.getY(i),
      z = vertices.getZ(i),
      ripple = 1 + 0.08 * Math.sin(x * 19 + z * 7) * Math.cos(y * 17 - z * 13);
    vertices.setXYZ(i, x * ripple, y * ripple, z * ripple);
  }
  geometry.computeVertexNormals();
  return geometry;
});
function treeBranches(seed: number) {
  const rng = random(seed),
    shapes: CylinderGeometry[] = [];
  const segment = (from: Vector3, to: Vector3, radius: number, tip: number) => {
    const d = to.clone().sub(from),
      g = new CylinderGeometry(tip, radius, d.length(), 7);
    g.applyMatrix4(
      new Matrix4().compose(
        from.clone().add(to).multiplyScalar(0.5),
        new Quaternion().setFromUnitVectors(
          new Vector3(0, 1, 0),
          d.normalize(),
        ),
        new Vector3(1, 1, 1),
      ),
    );
    shapes.push(g);
  };
  segment(new Vector3(0, 0, 0), new Vector3(0.12, 1.65, -0.1), 0.3, 0.2);
  segment(
    new Vector3(0.12, 1.65, -0.1),
    new Vector3(-0.08, 2.85, 0.1),
    0.2,
    0.11,
  );
  segment(new Vector3(-0.08, 2.85, 0.1), new Vector3(0.25, 4.5, 0), 0.11, 0.02);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4 + rng() * 0.3,
      y = 1.9 + i * 0.2;
    const start = new Vector3(0.05, y, 0),
      joint = new Vector3(Math.cos(a) * 0.85, y + 0.65, Math.sin(a) * 0.85);
    segment(start, joint, 0.13 - i * 0.009, 0.07);
    segment(
      joint,
      new Vector3(Math.cos(a) * 1.75, y + 1.2, Math.sin(a) * 1.75),
      0.07,
      0.013,
    );
    segment(
      joint,
      new Vector3(Math.cos(a + 0.55) * 1.2, y + 1.6, Math.sin(a + 0.55) * 1.2),
      0.05,
      0.009,
    );
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    segment(
      new Vector3(Math.cos(a) * 0.65, 0.015, Math.sin(a) * 0.65),
      new Vector3(0, 0.5, 0),
      0.045,
      0.13,
    );
  }
  const merged = mergeGeometries(shapes)!;
  shapes.forEach((g) => g.dispose());
  return merged;
}
export function BlossomTree({
  x,
  z,
  size,
  pink,
  seed,
  quality,
}: {
  x: number;
  z: number;
  size: number;
  pink: boolean;
  seed: number;
  quality: Quality;
}) {
  const crown = useRef<Group>(null!);
  const branches = useMemo(() => treeBranches(seed), [seed]);
  const data = useMemo(() => {
    const rng = random(seed);
    const clusters = Array.from(
      { length: quality === "low" ? 40 : quality === "medium" ? 80 : 100 },
      (_, i) => {
        const a = rng() * Math.PI * 2,
          r = Math.sqrt(rng()) * 1.75;
        return {
          x: Math.cos(a) * r,
          y: 3.4 + rng() * 1.2 - r * 0.18,
          z: Math.sin(a) * r,
          s: 0.32 + rng() * 0.18,
          c: new Color(
            pink
              ? ["#66815b", "#c08092", "#8d9a67", "#d99aa8"][i % 4]
              : ["#658259", "#8b9b65", "#9ca87a", "#c2c89a"][i % 4],
          ),
        };
      },
    );
    const flowers = Array.from(
      { length: quality === "low" ? 200 : quality === "medium" ? 500 : 780 },
      (_, i) => {
        const cluster = clusters[i % clusters.length],
          a = rng() * 6.28,
          v = (rng() - 0.5) * Math.PI;
        const r = cluster.s * (0.7 + rng() * 0.5);
        return {
          x: cluster.x + Math.cos(a) * Math.cos(v) * r,
          y: cluster.y + Math.sin(v) * r * 0.75,
          z: cluster.z + Math.sin(a) * Math.cos(v) * r,
          s: 0.1 + rng() * 0.07,
          rx: rng() * Math.PI,
          ry: a,
          rz: rng() * 6.28,
          c: new Color(
            pink
              ? ["#f3bbc5", "#eaa4b9", "#f4d1cb", "#d47e9e"][i % 4]
              : ["#f9edcd", "#e9deba", "#fff1d9", "#d5d5a6"][i % 4],
          ),
        };
      },
    );
    return { clusters, flowers };
  }, [seed, pink, quality]);
  useFrame(({ clock }) => {
    if (crown.current)
      crown.current.rotation.z = game.get().settings.reducedMotion
        ? 0
        : Math.sin(clock.elapsedTime * 0.7 + seed) * 0.012;
  });
  return (
    <group position={[x, terrainHeight(x, z), z]} scale={size}>
      <RigidBody type="fixed" colliders={false}>
        <BallCollider args={[0.35]} position={[0, 0.35, 0]} />
        <CuboidCollider args={[0.24, 1.6, 0.24]} position={[0, 1.6, 0]} />
        <BallCollider args={[1.6]} position={[0, 3.7, 0]} />
      </RigidBody>
      <Ink geometry={branches} color="#7b6556" />
      <group ref={crown}>
        {[true, false].map((outline) => (
          <instancedMesh
            key={String(outline)}
            args={[
              canopyGeometries[QUALITY[quality].treeDetail],
              undefined,
              data.clusters.length,
            ]}
            castShadow={!outline}
            receiveShadow
            onUpdate={(m) => {
              const o = new Object3D();
              data.clusters.forEach((p, i) => {
                o.position.set(p.x, p.y, p.z);
                o.scale.set(p.s * 1.15, p.s * 0.8, p.s);
                if (outline) o.scale.multiplyScalar(1.035);
                o.rotation.set(i, 0, i * 0.2);
                o.updateMatrix();
                m.setMatrixAt(i, o.matrix);
                if (!outline) m.setColorAt(i, p.c);
              });
              m.instanceMatrix.needsUpdate = true;
              if (m.instanceColor) m.instanceColor.needsUpdate = true;
            }}
          >
            {outline ? (
              <meshBasicMaterial color="#4c6050" side={1} />
            ) : (
              <meshToonMaterial gradientMap={inkRamp} />
            )}
          </instancedMesh>
        ))}
        <instancedMesh
          args={[blossomGeometry, undefined, data.flowers.length]}
          onUpdate={(m) => {
            const o = new Object3D();
            data.flowers.forEach((p, i) => {
              o.position.set(p.x, p.y, p.z);
              o.scale.setScalar(p.s);
              o.rotation.set(p.rx, p.ry, p.rz);
              o.updateMatrix();
              m.setMatrixAt(i, o.matrix);
              m.setColorAt(i, p.c);
            });
            m.instanceMatrix.needsUpdate = true;
            if (m.instanceColor) m.instanceColor.needsUpdate = true;
          }}
        >
          <meshToonMaterial gradientMap={inkRamp} side={2} />
        </instancedMesh>
      </group>
    </group>
  );
}
export function ParkBench({ data }: { data: Bench }) {
  return (
    <group position={data.position} rotation={[0, data.rotation, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.16, 0.32, 0.39]} position={[0, 0.34, 0]} />
        <CuboidCollider args={[1.16, 0.48, 0.09]} position={[0, 0.95, -0.32]} />
      </RigidBody>
      {[-0.28, -0.08, 0.12, 0.32].map((z) => (
        <Box
          key={z}
          position={[0, 0.56, z]}
          scale={[2.25, 0.12, 0.15]}
          color="#ba8d61"
        />
      ))}
      {[0.82, 1.04, 1.26].map((y) => (
        <Box
          key={y}
          position={[0, y, -0.33]}
          scale={[2.25, 0.15, 0.09]}
          color="#bc946b"
        />
      ))}
      {[-0.9, 0.9].map((x) => (
        <group key={x}>
          <Box
            position={[x, 0.3, 0.02]}
            scale={[0.12, 0.58, 0.59]}
            color="#536c5a"
          />
          <Box
            position={[x, 0.91, -0.38]}
            scale={[0.12, 0.9, 0.12]}
            color="#536c5a"
          />
          <Box
            position={[x, 0.82, 0.03]}
            scale={[0.11, 0.1, 0.8]}
            color="#536c5a"
          />
        </group>
      ))}
    </group>
  );
}
export function Fence() {
  const mesh = useRef<InstancedMesh>(null!);
  const objects = useMemo(() => {
    const out: {
      x: number;
      z: number;
      y: number;
      sx: number;
      sy: number;
      sz: number;
    }[] = [];
    for (let i = -28; i <= 28; i += 2) {
      for (const sign of [-1, 1]) {
        if (!(sign === 1 && Math.abs(i) < 3))
          out.push({
            x: i,
            z: sign * 28,
            y: 0.65,
            sx: 0.13,
            sy: 1.3,
            sz: 0.13,
          });
        out.push({ x: sign * 28, z: i, y: 0.65, sx: 0.13, sy: 1.3, sz: 0.13 });
      }
    }
    for (const y of [0.48, 0.96])
      for (const sign of [-1, 1]) {
        out.push({ x: sign * 28, z: 0, y, sx: 0.08, sy: 0.1, sz: 56 });
        out.push({ x: 0, z: sign * 28, y, sx: 56, sy: 0.1, sz: 0.08 });
      }
    return out;
  }, []);
  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, objects.length]}
        castShadow
        onUpdate={(m) => {
          const obj = new Object3D();
          objects.forEach((p, i) => {
            obj.position.set(p.x, p.y + terrainHeight(p.x, p.z), p.z);
            obj.scale.set(p.sx, p.sy, p.sz);
            obj.updateMatrix();
            m.setMatrixAt(i, obj.matrix);
          });
          m.instanceMatrix.needsUpdate = true;
        }}
      >
        <boxGeometry />
        <meshStandardMaterial color="#787f68" />
      </instancedMesh>
      <RigidBody type="fixed" colliders={false}>
        {[-1, 1].map((s) => (
          <group key={s}>
            <CuboidCollider args={[0.3, 2, 28.5]} position={[s * 28.3, 1, 0]} />
            <CuboidCollider args={[28.5, 2, 0.3]} position={[0, 1, s * 28.3]} />
          </group>
        ))}
      </RigidBody>
    </>
  );
}
