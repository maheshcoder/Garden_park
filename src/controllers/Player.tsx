import { useEffect, useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  RigidBody,
  CapsuleCollider,
  useRapier,
  useBeforePhysicsStep,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Group, Vector3 } from "three";
import { Avatar } from "../avatar/Avatar";
import { BENCHES, SIGNS, SPAWN, zoneAt } from "../config/park";
import { game, runtime, useGame } from "../state/game";
import { input, attachCamera, clearInput } from "./input";
import { inRange, movementVector, needsRespawn, smooth, turn } from "./math";
// Development-only inspection lets browser tests exercise the real physics body.
export const inspection: { body: RapierRigidBody | null } = { body: null };
export function Player() {
  const { world, rapier } = useRapier();
  const body = useRef<RapierRigidBody>(null!),
    visual = useRef<Group>(null!);
  const controller = useRef<ReturnType<
    typeof world.createCharacterController
  > | null>(null);
  const velocity = useRef({ x: 0, z: 0, y: 0 });
  const last = useRef({ respawn: 0, seat: null as string | null, wave: 0 });
  const { settings } = useGame();
  useEffect(() => {
    const c = world.createCharacterController(0.025);
    c.enableAutostep(0.45, 0.25, false);
    c.enableSnapToGround(0.25);
    c.setMaxSlopeClimbAngle(Math.PI / 4);
    c.setMinSlopeSlideAngle(Math.PI / 3);
    c.setSlideEnabled(true);
    controller.current = c;
    if (import.meta.env.DEV) inspection.body = body.current;
    game.set({ ready: true });
    return () => {
      inspection.body = null;
      controller.current = null;
      world.removeCharacterController(c);
    };
  }, [world]);
  useBeforePhysicsStep(() => {
    if (!body.current || !controller.current) return;
    const s = game.get();
    const b = body.current;
    const dt = Math.min(world.timestep, 1 / 30);
    let p = b.translation();
    function teleport(position: readonly number[]) {
      b.setTranslation(
        { x: position[0], y: position[1] + 0.92, z: position[2] },
        true,
      );
      b.setNextKinematicTranslation({
        x: position[0],
        y: position[1] + 0.92,
        z: position[2],
      });
      velocity.current = { x: 0, y: 0, z: 0 };
      p = b.translation();
    }
    if (s.respawn !== last.current.respawn || needsRespawn(p)) {
      teleport(SPAWN);
      last.current.seat = null;
      runtime.facing = Math.PI;
      input.yaw = 0;
      last.current.respawn = s.respawn;
      clearInput();
    }
    if (s.seat) {
      if (last.current.seat !== s.seat.id) {
        teleport([s.seat.seat[0], s.seat.seat[1] - 0.8, s.seat.seat[2]]);
        runtime.facing = s.seat.rotation;
        last.current.seat = s.seat.id;
      }
      runtime.speed = 0;
      runtime.animation = "sit";
    } else {
      if (last.current.seat) {
        const bench = BENCHES.find((item) => item.id === last.current.seat);
        if (bench) teleport(bench.stand);
        last.current.seat = null;
      }
      const active = s.entered && !s.paused && !s.sign && !s.hidden;
      const x = active
        ? Number(input.keys.has("d") || input.keys.has("arrowright")) -
          Number(input.keys.has("a") || input.keys.has("arrowleft")) +
          input.stick.x
        : 0;
      const z = active
        ? Number(input.keys.has("s") || input.keys.has("arrowdown")) -
          Number(input.keys.has("w") || input.keys.has("arrowup")) +
          input.stick.z
        : 0;
      const dir = movementVector(x, z, input.yaw);
      const speed = input.run || input.keys.has("shift") ? 5.3 : 2.9;
      velocity.current.x = smooth(velocity.current.x, dir.x * speed, 10, dt);
      velocity.current.z = smooth(velocity.current.z, dir.z * speed, 10, dt);
      velocity.current.y = Math.max(-15, velocity.current.y - 20 * dt);
      const c = controller.current;
      c.computeColliderMovement(
        b.collider(0),
        {
          x: velocity.current.x * dt,
          y: velocity.current.y * dt,
          z: velocity.current.z * dt,
        },
        rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      );
      const m = c.computedMovement();
      b.setNextKinematicTranslation({
        x: p.x + m.x,
        y: p.y + m.y,
        z: p.z + m.z,
      });
      runtime.grounded = c.computedGrounded();
      if (runtime.grounded) velocity.current.y = 0;
      runtime.speed = Math.hypot(m.x, m.z) / dt;
      if (runtime.speed > 0.12)
        runtime.facing = turn(runtime.facing, Math.atan2(m.x, m.z), dt);
      if (s.wave !== last.current.wave) {
        runtime.waveUntil = performance.now() + 2200;
        last.current.wave = s.wave;
      }
      runtime.animation =
        runtime.speed > 0.16
          ? runtime.speed > 3.5
            ? "run"
            : "walk"
          : performance.now() < runtime.waveUntil
            ? "wave"
            : "idle";
    }
    runtime.position.x = p.x;
    runtime.position.y = p.y - 0.92;
    runtime.position.z = p.z;
    const near =
      s.entered && !s.paused && !s.sign && !s.seat
        ? ([...BENCHES, ...SIGNS]
            .filter((item) => inRange(runtime.position, item.position))
            .sort(
              (a, b) =>
                Math.hypot(p.x - a.position[0], p.z - a.position[2]) -
                Math.hypot(p.x - b.position[0], p.z - b.position[2]),
            )[0]?.id ?? null)
        : null;
    const zone = zoneAt(p.x, p.z);
    if (near !== s.near || zone !== s.zone) game.set({ near, zone });
  });
  useFrame(() => {
    if (visual.current) visual.current.rotation.y = runtime.facing;
  });
  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={[SPAWN[0], SPAWN[1] + 0.92, SPAWN[2]]}
      enabledRotations={[false, false, false]}
      name="player"
    >
      <CapsuleCollider args={[0.55, 0.32]} />
      <group ref={visual} position={[0, -0.92, 0]}>
        <Avatar outfit={settings.outfit} motion={runtime} />
      </group>
      <FollowCamera body={body} />
    </RigidBody>
  );
}
function FollowCamera({ body }: { body: React.RefObject<RapierRigidBody> }) {
  const { camera, gl } = useThree();
  const { world, rapier } = useRapier();
  const ray = useMemo(
    () => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }),
    [rapier],
  );
  const target = useRef(new Vector3()),
    desired = useRef(new Vector3()),
    direction = useRef(new Vector3());
  useEffect(() => attachCamera(gl.domElement), [gl]);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const s = game.get();
    if (s.hidden) return;
    runtime.frames++;
    if (delta > 0 && delta < 0.25)
      runtime.frameMs = smooth(runtime.frameMs, delta * 1000, 2, dt);
    if (!s.entered) {
      desired.current.set(24, 17, 32);
      target.current.set(0, 1.4, 3);
      camera.position.lerp(desired.current, 1 - Math.exp(-3 * dt));
      camera.lookAt(target.current);
      return;
    }
    const p = body.current?.translation();
    if (!p) return;
    target.current.set(p.x, p.y + 0.5, p.z);
    const d = input.distance;
    desired.current.set(
      Math.sin(input.yaw) * Math.cos(input.pitch) * d,
      Math.sin(input.pitch) * d,
      Math.cos(input.yaw) * Math.cos(input.pitch) * d,
    );
    direction.current.copy(desired.current).normalize();
    ray.origin.x = target.current.x;
    ray.origin.y = target.current.y;
    ray.origin.z = target.current.z;
    ray.dir.x = direction.current.x;
    ray.dir.y = direction.current.y;
    ray.dir.z = direction.current.z;
    const hit = world.castRay(
      ray,
      d,
      true,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      body.current,
    );
    if (hit)
      desired.current.multiplyScalar(
        Math.max(0.65, hit.timeOfImpact - 0.3) / d,
      );
    desired.current.add(target.current);
    if (hit) camera.position.copy(desired.current);
    else camera.position.lerp(desired.current, 1 - Math.exp(-9 * dt));
    camera.lookAt(target.current);
  });
  return null;
}
