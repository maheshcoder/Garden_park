import { terrainHeight } from "../../config/terrain";
import { inkRamp } from "../art";
import { useMemo } from "react";
import { Object3D, Color, CircleGeometry } from "three";
import { BEDS, random, QUALITY, type Quality } from "../../config/park";

type FlowerPart = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rx: number;
  rz: number;
  color: string;
};
function Instances({
  parts,
  shape,
}: {
  parts: FlowerPart[];
  shape: "sphere" | "stone" | "stem";
}) {
  return (
    <instancedMesh
      args={[undefined, undefined, parts.length]}
      castShadow
      onUpdate={(m) => {
        const o = new Object3D();
        parts.forEach((p, i) => {
          o.position.set(p.x, p.y + terrainHeight(p.x, p.z), p.z);
          o.scale.set(p.sx, p.sy, p.sz);
          o.rotation.set(p.rx, 0, p.rz);
          o.updateMatrix();
          m.setMatrixAt(i, o.matrix);
          m.setColorAt(i, new Color(p.color));
        });
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }}
    >
      {shape === "sphere" ? (
        <sphereGeometry args={[1, 7, 6]} />
      ) : shape === "stone" ? (
        <icosahedronGeometry args={[1, 1]} />
      ) : (
        <cylinderGeometry args={[1, 1, 1, 5]} />
      )}
      <meshToonMaterial gradientMap={inkRamp} />
    </instancedMesh>
  );
}
function BedSoil({ bed }: { bed: (typeof BEDS)[number] }) {
  const geometry = useMemo(() => {
    const g = new CircleGeometry(1, 40);
    g.rotateX(-Math.PI / 2);
    g.scale(bed.rx, 1, bed.rz);
    g.translate(bed.x, 0, bed.z);
    const vertices = g.attributes.position;
    for (let i = 0; i < vertices.count; i++)
      vertices.setY(
        i,
        terrainHeight(vertices.getX(i), vertices.getZ(i)) + 0.026,
      );
    g.computeVertexNormals();
    return g;
  }, [bed]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshToonMaterial color="#6b7854" gradientMap={inkRamp} />
    </mesh>
  );
}
export function FlowerBeds({ quality }: { quality: Quality }) {
  const borders = useMemo(
    () =>
      BEDS.flatMap((b) =>
        Array.from({ length: 28 }, (_, j) => {
          const a = (j / 28) * Math.PI * 2;
          return {
            x: b.x + Math.cos(a) * b.rx,
            y: 0.08,
            z: b.z + Math.sin(a) * b.rz,
            sx: 0.25,
            sy: 0.13,
            sz: 0.19,
            rx: 0,
            rz: 0,
            color: "#d0c7ad",
          };
        }),
      ),
    [],
  );
  const parts = useMemo(() => {
    const stems: FlowerPart[] = [],
      petals: FlowerPart[] = [],
      tulips: FlowerPart[] = [];
    const rng = random(447);
    const add = (
      list: FlowerPart[],
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      color: string,
      rz = 0,
    ) => list.push({ x, y, z, sx, sy, sz, rx: 0, rz, color });
    BEDS.forEach((b, bi) => {
      const n = QUALITY[quality].flowers * 12;
      for (let i = 0; i < n; i++) {
        const angle = rng() * Math.PI * 2,
          r = Math.sqrt(rng()) * 0.89,
          x = b.x + Math.cos(angle) * r * b.rx,
          z = b.z + Math.sin(angle) * r * b.rz,
          h = 0.3 + rng() * 0.38;
        add(stems, x, h / 2 + 0.05, z, 0.021, h, 0.021, "#5e8957");
        add(petals, x + 0.06, h * 0.5, z, 0.12, 0.03, 0.05, "#789859", 0.5);
        if (bi % 3 === 0) {
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3;
            add(
              petals,
              x + Math.cos(a) * 0.105,
              h,
              z + Math.sin(a) * 0.105,
              0.09,
              0.037,
              0.09,
              i % 3 ? "#fff3db" : "#f7d390",
            );
          }
          add(petals, x, h + 0.035, z, 0.06, 0.045, 0.06, "#e6b84f");
        } else if (bi % 3 === 1) {
          add(tulips, x, h, z, 0.12, 0.14, 0.12, i % 3 ? "#d888a9" : "#eab0bb");
        } else {
          for (let k = 0; k < 4; k++)
            add(
              petals,
              x,
              h + k * 0.055,
              z,
              0.075 - k * 0.009,
              0.06,
              0.075,
              i % 3 ? "#ab99c6" : "#cebce0",
            );
        }
      }
    });
    return { stems, petals, tulips };
  }, [quality]);
  return (
    <>
      <Instances parts={borders} shape="stone" />
      <Instances parts={parts.stems} shape="stem" />
      <Instances parts={parts.petals} shape="sphere" />
      <Instances parts={parts.tulips} shape="sphere" />
      {BEDS.map((b, i) => (
        <BedSoil key={i} bed={b} />
      ))}
    </>
  );
}
