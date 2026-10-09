import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Group,
  MathUtils,
  Shape,
  ExtrudeGeometry,
  SphereGeometry,
} from "three";
import { OUTFITS } from "../config/park";
import { game } from "../state/game";
import { Ink, inkRamp, limb, tailored } from "../world/art";
export type Motion = {
  speed: number;
  animation: "idle" | "walk" | "run" | "wave" | "sit";
};
const hair = new SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.43);
const backHair = new SphereGeometry(
  1,
  18,
  12,
  Math.PI,
  Math.PI,
  0,
  Math.PI * 0.8,
);
const lockShape = new Shape();
lockShape.moveTo(-0.45, 0.3);
lockShape.quadraticCurveTo(0, 0.65, 0.45, 0.3);
lockShape.lineTo(0.26, -0.3);
lockShape.lineTo(-0.2, -0.5);
lockShape.closePath();
const lock = new ExtrudeGeometry(lockShape, {
  depth: 0.45,
  bevelEnabled: true,
  bevelSize: 0.04,
  bevelThickness: 0.04,
  bevelSegments: 1,
  steps: 1,
});
lock.translate(0, 0, -0.225);
const skin = "#efc5a6",
  dark = "#303b3b",
  cream = "#f3eedb";
export function Avatar({
  outfit = 0,
  motion,
  preview = false,
}: {
  outfit?: number;
  motion?: Motion;
  preview?: boolean;
}) {
  const root = useRef<Group>(null!),
    head = useRef<Group>(null!),
    eyes = useRef<Group>(null!);
  const leftArm = useRef<Group>(null!),
    rightArm = useRef<Group>(null!),
    leftElbow = useRef<Group>(null!),
    rightElbow = useRef<Group>(null!);
  const leftLeg = useRef<Group>(null!),
    rightLeg = useRef<Group>(null!),
    leftKnee = useRef<Group>(null!),
    rightKnee = useRef<Group>(null!);
  const phase = useRef(0);
  const colors = OUTFITS[outfit] ?? OUTFITS[0];
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05),
      t = clock.elapsedTime;
    const state = motion?.animation ?? "idle",
      speed = motion?.speed ?? 0;
    const moving = state === "walk" || state === "run",
      sit = state === "sit",
      running = state === "run";
    phase.current += speed * dt * 3.1;
    const swing = Math.sin(phase.current) * Math.min(speed / 5, 0.9),
      rate = 1 - Math.exp(-14 * dt);
    const blend = (part: Group, axis: "x" | "z", target: number) => {
      part.rotation[axis] = MathUtils.lerp(part.rotation[axis], target, rate);
    };
    blend(leftLeg.current, "x", sit ? -1.5 : moving ? swing : 0);
    blend(rightLeg.current, "x", sit ? -1.5 : moving ? -swing : 0);
    blend(
      leftKnee.current,
      "x",
      sit ? 1.45 : moving ? Math.max(0, -swing) * 1.2 : 0,
    );
    blend(
      rightKnee.current,
      "x",
      sit ? 1.45 : moving ? Math.max(0, swing) * 1.2 : 0,
    );
    blend(leftArm.current, "x", sit ? -0.45 : moving ? -swing * 0.75 : 0.03);
    blend(
      rightArm.current,
      "x",
      state === "wave" ? -2.45 : sit ? -0.45 : moving ? swing * 0.75 : -0.04,
    );
    blend(leftElbow.current, "x", sit ? -0.4 : running ? -1 : -0.18);
    blend(
      rightElbow.current,
      "x",
      state === "wave" ? -0.35 : sit ? -0.4 : running ? -1 : -0.18,
    );
    blend(
      rightArm.current,
      "z",
      state === "wave" ? 0.25 + Math.sin(t * 9) * 0.2 : -0.06,
    );
    leftArm.current.rotation.z = 0.06;
    const still = game.get().settings.reducedMotion;
    root.current.position.y = moving
      ? Math.abs(Math.sin(phase.current)) * (running ? 0.045 : 0.025)
      : still
        ? 0
        : Math.sin(t * 1.8) * 0.005;
    root.current.rotation.x = running ? 0.08 : 0;
    head.current.rotation.y =
      state === "idle" && !still ? Math.sin(t * 0.65) * 0.09 : 0;
    const blink = t % 4.7;
    eyes.current.scale.y = !still && blink < 0.13 ? 0.12 : 1;
    if (preview) root.current.rotation.y = still ? 0 : Math.sin(t * 0.3) * 0.15;
  });
  return (
    <group ref={root}>
      <Ink
        geometry={tailored}
        position={[0, 0.88, 0]}
        scale={[0.43, 0.2, 0.35]}
        color={colors.trousers}
      />
      <Ink
        geometry={tailored}
        position={[0, 1.15, 0]}
        scale={[0.53, 0.56, 0.4]}
        color={colors.jacket}
      />
      <Ink
        geometry={limb}
        position={[0, 1.47, 0]}
        scale={[0.14, 0.1, 0.14]}
        color={skin}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Ink
            geometry={tailored}
            position={[side * 0.092, 1.37, 0.196]}
            rotation={[0, 0, side * 0.38]}
            scale={[0.14, 0.19, 0.045]}
            color={cream}
          />
          <Ink
            geometry={tailored}
            position={[side * 0.15, 1.13, 0.203]}
            scale={[0.14, 0.1, 0.025]}
            color={colors.jacket}
          />
          <Ink
            position={[side * 0.15, 1.14, 0.229]}
            scale={[0.014, 0.014, 0.007]}
            color={cream}
            outline={false}
          />
        </group>
      ))}
      {[1.29, 1.18, 1.05, 0.94].map((y) => (
        <Ink
          key={y}
          position={[0, y, 0.215]}
          scale={[0.018, 0.018, 0.01]}
          color={cream}
        />
      ))}
      <group position={[0, 1.19, 0.23]} rotation={[0, 0, -0.66]}>
        <Ink geometry={tailored} scale={[0.055, 0.67, 0.036]} color={dark} />
      </group>
      <Ink
        geometry={tailored}
        position={[-0.28, 0.94, 0.12]}
        rotation={[0, 0.2, -0.1]}
        scale={[0.25, 0.27, 0.16]}
        color="#c18b50"
      />
      <Ink
        geometry={tailored}
        position={[-0.28, 1.015, 0.2]}
        scale={[0.245, 0.11, 0.032]}
        color="#d9ad70"
      />
      <Ink
        position={[-0.28, 0.99, 0.219]}
        scale={[0.018, 0.023, 0.008]}
        color={dark}
        outline={false}
      />
      <group ref={head} position={[0, 1.72, 0]}>
        <Ink
          shadow={false}
          geometry={backHair}
          position={[0, 0.01, -0.022]}
          scale={[0.243, 0.285, 0.216]}
          color={dark}
        />
        <Ink shadow={false} scale={[0.225, 0.265, 0.195]} color={skin} />
        <Ink
          shadow={false}
          geometry={hair}
          position={[0, 0.01, -0.022]}
          scale={[0.243, 0.285, 0.216]}
          color={dark}
        />
        {[-1, 1].map((side) => (
          <group key={side}>
            <Ink
              shadow={false}
              position={[side * 0.224, -0.025, 0]}
              scale={[0.043, 0.065, 0.043]}
              color={skin}
            />
            <Ink
              shadow={false}
              geometry={lock}
              position={[side * 0.218, 0.035, 0.042]}
              rotation={[0, side * 0.45, side * 0.1]}
              scale={[0.078, 0.245, 0.15]}
              color={dark}
            />
            <Ink
              shadow={false}
              position={[side * 0.137, -0.079, 0.162]}
              scale={[0.045, 0.018, 0.009]}
              color="#dca48f"
              outline={false}
            />
            <Ink
              shadow={false}
              geometry={tailored}
              position={[side * 0.086, 0.075, 0.179]}
              rotation={[0, side * 0.12, side * 0.13]}
              scale={[0.095, 0.018, 0.018]}
              color={dark}
              outline={false}
            />
          </group>
        ))}
        <group ref={eyes} position={[0, 0.013, 0]}>
          {[-1, 1].map((side) => (
            <group
              key={side}
              position={[side * 0.085, 0, 0.189]}
              rotation={[0, side * 0.13, 0]}
            >
              <Ink
                shadow={false}
                scale={[0.052, 0.029, 0.013]}
                color="#fff9e9"
              />
              <Ink
                shadow={false}
                position={[0, -0.003, 0.013]}
                scale={[0.024, 0.028, 0.01]}
                color="#425651"
                outline={false}
              />
              <Ink
                shadow={false}
                position={[0, -0.003, 0.021]}
                scale={[0.012, 0.024, 0.006]}
                color="#283635"
                outline={false}
              />
              <Ink
                shadow={false}
                position={[-0.005, 0.009, 0.026]}
                scale={[0.007, 0.008, 0.003]}
                color="#ffffff"
                outline={false}
              />
            </group>
          ))}
        </group>
        <Ink
          shadow={false}
          position={[0, -0.038, 0.194]}
          scale={[0.026, 0.039, 0.029]}
          color="#e2ae91"
          outline={false}
        />
        <mesh position={[0, -0.11, 0.17]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.036, 0.005, 5, 14, Math.PI]} />
          <meshToonMaterial color="#885b53" gradientMap={inkRamp} />
        </mesh>
        {[-1, 0, 1].map((i) => (
          <Ink
            shadow={false}
            key={i}
            geometry={lock}
            position={[i * 0.12 - 0.02, 0.148 + Math.abs(i) * 0.01, 0.175]}
            rotation={[0.15, i * 0.2, -0.22 + i * 0.12]}
            scale={[0.15, 0.16, 0.13]}
            color={dark}
          />
        ))}
      </group>
      {[-1, 1].map((side) => (
        <group
          key={side}
          ref={side < 0 ? leftArm : rightArm}
          position={[side * 0.28, 1.37, 0]}
        >
          <Ink
            geometry={limb}
            position={[0, -0.135, 0]}
            scale={[0.19, 0.165, 0.19]}
            color={colors.jacket}
          />
          <group
            ref={side < 0 ? leftElbow : rightElbow}
            position={[0, -0.27, 0]}
          >
            <Ink
              geometry={limb}
              position={[0, -0.115, 0]}
              scale={[0.165, 0.15, 0.165]}
              color={colors.jacket}
            />
            <Ink
              geometry={tailored}
              position={[0, -0.228, 0]}
              scale={[0.18, 0.05, 0.18]}
              color={cream}
            />
            <Ink
              geometry={limb}
              position={[0, -0.295, 0.012]}
              scale={[0.13, 0.078, 0.095]}
              color={skin}
            />
            <Ink
              position={[-side * 0.052, -0.278, 0.039]}
              scale={[0.031, 0.052, 0.025]}
              color={skin}
              outline={false}
            />
          </group>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group
          key={side}
          ref={side < 0 ? leftLeg : rightLeg}
          position={[side * 0.13, 0.81, 0]}
        >
          <Ink
            geometry={limb}
            position={[0, -0.18, 0]}
            scale={[0.23, 0.2, 0.24]}
            color={colors.trousers}
          />
          <group ref={side < 0 ? leftKnee : rightKnee} position={[0, -0.36, 0]}>
            <Ink
              geometry={limb}
              position={[0, -0.16, 0]}
              scale={[0.205, 0.19, 0.21]}
              color={colors.trousers}
            />
            <Ink
              geometry={tailored}
              position={[0, -0.293, 0]}
              scale={[0.22, 0.066, 0.23]}
              color={cream}
            />
            <Ink
              geometry={tailored}
              position={[0, -0.363, 0.054]}
              scale={[0.23, 0.14, 0.36]}
              color={colors.shoes}
            />
            <Ink
              geometry={tailored}
              position={[0, -0.414, 0.055]}
              scale={[0.245, 0.036, 0.375]}
              color={cream}
            />
            {[0, 1, 2].map((i) => (
              <Ink
                key={i}
                geometry={tailored}
                position={[0, -0.315, 0.04 + i * 0.043]}
                rotation={[-0.2, 0, 0]}
                scale={[0.1, 0.015, 0.016]}
                color={cream}
                outline={false}
              />
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}
