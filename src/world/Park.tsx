import { useMemo } from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import {
  BufferGeometry,
  Float32BufferAttribute,
  CatmullRomCurve3,
  Vector3,
  PlaneGeometry,
  CanvasTexture,
  SRGBColorSpace,
  Color,
  RepeatWrapping,
  Object3D,
} from "three";
import {
  LOOP,
  TREES,
  BENCHES,
  SIGNS,
  ARCH,
  PLAZA,
  BIRDHOUSES,
  SHRUBS,
  type Sign,
  type Quality,
} from "../config/park";
import { Box, BlossomTree, ParkBench, Fence, Pebble } from "./props/Scenery";
import { FlowerBeds } from "./props/Flowers";
import { Fountain, Pond } from "./props/Water";
import { Petals, Wildlife, Grass } from "./effects/Environment";
import { terrainHeight } from "../config/terrain";
import { inkRamp } from "./art";
function surfaceTexture(path: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = path ? "#e7d7b2" : "#ffffff";
  ctx.fillRect(0, 0, 256, 256);
  let seed = 417;
  const rng = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = path
      ? i % 3
        ? "#b5a58544"
        : "#fff7dc88"
      : i % 3
        ? "#61755720"
        : "#e4edc320";
    ctx.beginPath();
    ctx.ellipse(
      rng() * 256,
      rng() * 256,
      path ? 0.5 + rng() * 1.4 : 0.5,
      path ? 0.5 + rng() : 1 + rng() * 2,
      rng() * 3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(path ? 1 : 32, path ? 48 : 32);
  texture.anisotropy = 4;
  return texture;
}
function Ground() {
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(160, 160, 160, 160);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position,
      colors: number[] = [];
    const base = new Color("#839b60"),
      light = new Color("#b4ba79");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i),
        outside = Math.max(0, Math.max(Math.abs(x), Math.abs(z)) - 29);
      pos.setY(
        i,
        terrainHeight(x, z) +
          (1 - Math.exp(-outside / 12)) *
            (2.4 + Math.sin(x * 0.08) * Math.cos(z * 0.06) * 1.6),
      );
      const noise =
        (Math.sin(x * 0.2 + Math.cos(z * 0.17)) * Math.cos(z * 0.14) + 1) * 0.5;
      const c = base.clone().lerp(light, noise * 0.55);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const texture = useMemo(() => surfaceTexture(false), []);
  return (
    <RigidBody type="fixed" colliders="trimesh">
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors map={texture} roughness={1} />
      </mesh>
    </RigidBody>
  );
}
function Path({
  width,
  color,
  height,
}: {
  width: number;
  color: string;
  height: number;
}) {
  const geometry = useMemo(() => {
    const curve = new CatmullRomCurve3(
      LOOP.map((p) => new Vector3(...p)),
      true,
      "catmullrom",
      0.3,
    );
    const vertices: number[] = [],
      indices: number[] = [],
      uv: number[] = [];
    const columns = 6;
    for (let i = 0; i <= 320; i++) {
      const t = i / 320,
        p = curve.getPoint(t),
        d = curve.getTangent(t),
        normal = new Vector3(-d.z, 0, d.x).normalize();
      for (let j = 0; j <= columns; j++) {
        const offset = (j / columns - 0.5) * width,
          x = p.x + normal.x * offset,
          z = p.z + normal.z * offset;
        vertices.push(x, terrainHeight(x, z) + height, z);
        uv.push(j / columns, t);
        if (i < 320 && j < columns) {
          const k = i * (columns + 1) + j;
          indices.push(
            k,
            k + columns + 1,
            k + 1,
            k + 1,
            k + columns + 1,
            k + columns + 2,
          );
        }
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [width, height]);
  const texture = useMemo(() => surfaceTexture(true), []);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color={color}
        map={width < 3.5 ? texture : null}
        side={2}
        roughness={1}
      />
    </mesh>
  );
}
function Label({
  text,
  width = 2,
  height = 0.6,
}: {
  text: string;
  width?: number;
  height?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 192;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f2e8cf";
    ctx.fillRect(0, 0, 768, 192);
    ctx.strokeStyle = "#b8ba9b";
    ctx.lineWidth = 5;
    ctx.strokeRect(12, 12, 744, 168);
    ctx.fillStyle = "#53694f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 40px Georgia";
    ctx.fillText(text, 384, 98, 710);
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [text]);
  return (
    <mesh position={[0, 0, 0.012]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}
function ParkSign({ sign }: { sign: Sign }) {
  return (
    <group
      position={[
        sign.position[0],
        terrainHeight(sign.position[0], sign.position[2]),
        sign.position[2],
      ]}
      rotation={[0, sign.rotation, 0]}
    >
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.53, 0.7, 0.13]} position={[0, 0.72, 0]} />
      </RigidBody>
      <Box position={[0, 0.57, 0]} scale={[0.1, 1.15, 0.1]} color="#a38d6a" />
      <group position={[0, 1.32, 0]}>
        <Box position={[0, 0, 0]} scale={[1.65, 0.48, 0.09]} color="#967d5e" />
        <group position={[0, 0, 0.048]}>
          <Label text={sign.tag.split("/ ")[1]} width={1.62} height={0.46} />
        </group>
      </group>
    </group>
  );
}
function Entrance() {
  return (
    <group position={ARCH}>
      <RigidBody type="fixed" colliders={false}>
        {[-1, 1].map((s) => (
          <CuboidCollider
            key={s}
            args={[0.21, 1.5, 0.21]}
            position={[s * 2.15, 1.5, 0]}
          />
        ))}
        <CuboidCollider args={[2.3, 1.1, 0.35]} position={[0, 3.8, 0]} />
      </RigidBody>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box
            position={[s * 2.15, 1.5, 0]}
            scale={[0.28, 3, 0.28]}
            color="#f1e8d0"
          />
          <Pebble
            position={[s * 2.15, 0.12, 0]}
            scale={[0.5, 0.2, 0.45]}
            color="#c9c5ac"
          />
        </group>
      ))}
      <mesh position={[0, 2.9, 0]} castShadow>
        <torusGeometry args={[2.15, 0.16, 8, 40, Math.PI]} />
        <meshToonMaterial color="#e9dcc0" gradientMap={inkRamp} />
      </mesh>
      <group position={[0, 3.25, 0.1]}>
        <Box position={[0, 0, 0]} scale={[2.7, 0.72, 0.12]} color="#a5ac83" />
        <group position={[0, 0, 0.067]}>
          <Label text="BLOSSOM PARK" width={2.65} height={0.67} />
        </group>
      </group>
      {Array.from({ length: 17 }, (_, i) => {
        const a = (i / 16) * Math.PI;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 2.16, 2.85 + Math.sin(a) * 2.16, 0.02]}
            scale={[0.31, 0.23, 0.35]}
            castShadow
          >
            <icosahedronGeometry args={[1, 1]} />
            <meshToonMaterial
              color={i % 3 ? "#d992a8" : "#efd4bc"}
              gradientMap={inkRamp}
            />
          </mesh>
        );
      })}
    </group>
  );
}
function BirdHouses() {
  return (
    <>
      {BIRDHOUSES.map(([x, z], i) => (
        <group key={i} position={[x, terrainHeight(x, z), z]}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[0.2, 1.6, 0.2]} position={[0, 1.6, 0]} />
          </RigidBody>
          <Box
            position={[0, 1.1, 0]}
            scale={[0.13, 2.2, 0.13]}
            color="#a98b67"
          />
          <Box
            position={[0, 2.45, 0]}
            scale={[0.7, 0.7, 0.6]}
            color={i % 2 ? "#e5cba1" : "#d9b69a"}
          />
          <mesh
            position={[0, 2.99, 0]}
            rotation={[0, Math.PI / 4, 0]}
            scale={[1, 0.6, 1]}
            castShadow
          >
            <coneGeometry args={[0.65, 0.55, 4]} />
            <meshStandardMaterial color="#809277" />
          </mesh>
          <mesh position={[0, 2.46, 0.306]}>
            <circleGeometry args={[0.13, 16]} />
            <meshStandardMaterial color="#66594b" />
          </mesh>
          <Box
            position={[0, 2.16, 0.42]}
            scale={[0.035, 0.035, 0.25]}
            color="#90775c"
          />
          <mesh position={[0.25, 2.82, 0.08]} scale={[0.12, 0.1, 0.2]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#7e9290" />
          </mesh>
        </group>
      ))}
    </>
  );
}
function DistantScenery() {
  return (
    <>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 69, -5, Math.sin(a) * 69]}
            scale={[17, 10 + (i % 3) * 3, 18]}
          >
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color={i % 2 ? "#769384" : "#91a594"} />
          </mesh>
        );
      })}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 26, 18, -44]}>
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              position={[i * 2, Math.sin(i) * 0.8, 0]}
              scale={[3.8, 1.1, 1.4]}
            >
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color="#f9f7e9" />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}
function Forest() {
  const data = useMemo(
    () =>
      Array.from({ length: 210 }, (_, i) => {
        const a = i * 2.39996,
          r = 34 + (i % 13) * 1.7;
        return { x: Math.cos(a) * r, z: Math.sin(a) * r, h: 3 + (i % 7) * 0.6 };
      }),
    [],
  );
  return (
    <instancedMesh
      args={[undefined, undefined, data.length]}
      onUpdate={(m) => {
        const o = new Object3D();
        data.forEach((p, i) => {
          o.position.set(p.x, p.h * 0.55 + 1.2, p.z);
          o.scale.set(2 + (i % 4) * 0.35, p.h * 0.45, 2 + (i % 4) * 0.35);
          o.rotation.y = i;
          o.updateMatrix();
          m.setMatrixAt(i, o.matrix);
          m.setColorAt(i, new Color(["#6b8974", "#7c967a", "#8d9d78"][i % 3]));
        });
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }}
    >
      <icosahedronGeometry args={[1, 1]} />
      <meshToonMaterial gradientMap={inkRamp} />
    </instancedMesh>
  );
}
export function Park({ quality }: { quality: Quality }) {
  return (
    <>
      <Ground />
      <Path width={3.65} color="#758466" height={0.04} />
      <Path width={3.35} color="#ffffff" height={0.055} />
      <mesh
        position={[0, 0.04, 20]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[3.9, 14]} />
        <meshStandardMaterial color="#758466" />
      </mesh>
      <mesh
        position={[0, 0.044, 20]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[3.35, 14]} />
        <meshStandardMaterial color="#e7d7b2" />
      </mesh>
      <mesh
        position={[PLAZA[0], 0.038, PLAZA[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[6.3, 64]} />
        <meshStandardMaterial color="#758466" />
      </mesh>
      <mesh
        position={[PLAZA[0], 0.06, PLAZA[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[6.1, 64]} />
        <meshStandardMaterial color="#e7d7b2" />
      </mesh>
      <mesh
        position={[PLAZA[0], 0.065, PLAZA[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[4.45, 4.5, 64]} />
        <meshStandardMaterial color="#b3a387" />
      </mesh>
      <Fountain />
      <Pond />
      <Entrance />
      <Fence />
      <FlowerBeds quality={quality} />
      <BirdHouses />
      {TREES.map(([x, z, size, pink], i) => (
        <BlossomTree
          key={i}
          x={x}
          z={z}
          size={size}
          pink={pink === 0}
          seed={i * 17 + 9}
          quality={quality}
        />
      ))}
      {BENCHES.map((b) => (
        <ParkBench key={b.id} data={b} />
      ))}
      {SIGNS.map((s) => (
        <ParkSign key={s.id} sign={s} />
      ))}
      <Grass />
      <Petals quality={quality} />
      <Wildlife quality={quality} />
      <DistantScenery />
      <Forest />
      {SHRUBS.map(([x, z], i) => (
        <group key={i} position={[x, terrainHeight(x, z), z]}>
          <mesh position={[0, 0.35, 0]} scale={[1.8, 0.6, 1.6]} castShadow>
            <icosahedronGeometry args={[1, 2]} />
            <meshStandardMaterial color="#87a170" />
          </mesh>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[1.2, 0.45, 1.2]} position={[0, 0.35, 0]} />
          </RigidBody>
        </group>
      ))}
    </>
  );
}
