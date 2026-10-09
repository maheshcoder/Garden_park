import {
  BackSide,
  CapsuleGeometry,
  DataTexture,
  ExtrudeGeometry,
  NearestFilter,
  RedFormat,
  Shape,
  SphereGeometry,
  type BufferGeometry,
} from "three";
import type { ThreeElements } from "@react-three/fiber";

// A shared three-tone ramp keeps the illustrated lighting consistent across assets.
export const inkRamp = new DataTexture(
  new Uint8Array([85, 170, 255]),
  3,
  1,
  RedFormat,
);
inkRamp.minFilter = inkRamp.magFilter = NearestFilter;
inkRamp.needsUpdate = true;
export const oval = new SphereGeometry(1, 16, 12);
export const limb = new CapsuleGeometry(0.5, 1, 4, 10);
const jacketShape = new Shape();
jacketShape.moveTo(-0.4, -0.5);
jacketShape.lineTo(0.4, -0.5);
jacketShape.lineTo(0.5, 0.32);
jacketShape.lineTo(0.32, 0.5);
jacketShape.lineTo(-0.32, 0.5);
jacketShape.lineTo(-0.5, 0.32);
jacketShape.closePath();
export const tailored = new ExtrudeGeometry(jacketShape, {
  depth: 0.8,
  bevelEnabled: true,
  bevelSize: 0.07,
  bevelThickness: 0.07,
  bevelSegments: 2,
  steps: 1,
});
tailored.translate(0, 0, -0.4);
export function Ink({
  geometry = oval,
  color,
  outline = true,
  shadow = true,
  ...props
}: Omit<ThreeElements["group"], "ref"> & {
  geometry?: BufferGeometry;
  color: string;
  outline?: boolean;
  shadow?: boolean;
}) {
  return (
    <group {...props} dispose={null}>
      {outline && (
        <mesh geometry={geometry} scale={1.035}>
          <meshBasicMaterial color="#35413e" side={BackSide} />
        </mesh>
      )}
      <mesh
        geometry={geometry}
        castShadow={outline && shadow}
        receiveShadow={shadow}
      >
        <meshToonMaterial color={color} gradientMap={inkRamp} />
      </mesh>
    </group>
  );
}
