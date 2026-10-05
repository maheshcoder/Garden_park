/* ===================================================================
   Trees - several procedural blossom-tree variations.
   Each tree is ONE merged trunk geometry (trunk + branches) plus one
   instanced canopy mesh per colour, so a garden of 10 trees costs
   ~20 draw calls for foliage + 10 for wood. Sway comes from the shared
   wind uniform; petals are emitted by the Effects system.
   =================================================================== */
import * as THREE from 'three';
import { swayMaterial } from '../materials.js';
import { clamp, rand, pick, TAU } from '../utils.js';

/* each variation: trunk colour, canopy shape, blossom mix */
const VARIANTS = [
  { name: 'sakura',   bark: 0x5b4632, leaf: 0xf7b8d4, leaf2: 0xffffff, blossom: 0xffd7e8, ratio: 0.9,  h: 5.5 },
  { name: 'cherry',   bark: 0x4e3b2a, leaf: 0xff9ec4, leaf2: 0xffd1e3, blossom: 0xffe4f0, ratio: 0.75, h: 6.4 },
  { name: 'crabapple',bark: 0x604a35, leaf: 0xd94f7e, leaf2: 0xff8fb0, blossom: 0xffc9dc, ratio: 0.6,  h: 5.0 },
  { name: 'magnolia', bark: 0x554436, leaf: 0xe8d9f5, leaf2: 0xffffff, blossom: 0xf3e6ff, ratio: 0.85, h: 4.6 },
  { name: 'maple',    bark: 0x4a3a2c, leaf: 0x8fd18a, leaf2: 0xbfe6a8, blossom: 0xd8f0c0, ratio: 0.15, h: 6.0 },
  { name: 'birch',    bark: 0xe8e4da, leaf: 0xa8e0a0, leaf2: 0xd4f0c8, blossom: 0xffffff, ratio: 0.1,  h: 6.8 }
];

export class Trees {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.trees = [];

    /* fixed grove layout: a loose ring plus two path-side singles.
       Positions avoid the path curve, pond and soil beds.           */
    this.slots = [
      { x: -24, z: 12, v: 0 }, { x: -19, z: -16, v: 1 }, { x: 6, z: -24, v: 2 },
      { x: 26, z: -18, v: 3 }, { x: 30, z: 6, v: 4 }, { x: 22, z: 24, v: 5 },
      { x: -4, z: 26, v: 1 }, { x: -30, z: -4, v: 3 }, { x: -14, z: 22, v: 2 },
      { x: 14, z: 18, v: 0 }
    ];

    for (const s of this.slots) this._buildTree(s);
  }

  _buildTree(slot) {
    const V = VARIANTS[slot.v];
    const g = new THREE.Group();
    const baseY = this.terrain.heightAt(slot.x, slot.z);
    g.position.set(slot.x, baseY, slot.z);
    g.rotation.y = rand(TAU);
    const h = V.h * rand(0.85, 1.15);

    /* ---- wood: trunk + branches, merged into one geometry ---- */
    const parts = [];
    const trunk = new THREE.CylinderGeometry(h * 0.055, h * 0.11, h * 0.62, 7, 3);
    trunk.translate(0, h * 0.31, 0);
    /* slight lean wobble so trunks aren't perfect cylinders */
    const tp = trunk.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const y = tp.getY(i);
      tp.setX(i, tp.getX(i) + Math.sin(y * 2.1 + slot.x) * 0.06 * (y / h));
    }
    trunk.computeVertexNormals();
    parts.push(trunk);

    const branchTips = [];
    const nb = 4 + Math.floor(rand(3));
    for (let i = 0; i < nb; i++) {
      const a = (i / nb) * TAU + rand(0.6);
      const startY = h * rand(0.4, 0.6);
      const len = h * rand(0.3, 0.45);
      const br = new THREE.CylinderGeometry(h * 0.018, h * 0.045, len, 5);
      br.translate(0, len / 2, 0);
      const tilt = rand(0.5, 0.95);
      const dir = new THREE.Vector3(
        Math.cos(a) * Math.sin(tilt + 0.5),
        Math.cos(tilt + 0.5),
        Math.sin(a) * Math.sin(tilt + 0.5)
      ).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const m = new THREE.Matrix4().makeRotationFromQuaternion(quat);
      m.setPosition(0, startY, 0);
      br.applyMatrix4(m);
      parts.push(br);
      branchTips.push(new THREE.Vector3(
        dir.x * len * 0.85, startY + dir.y * len * 0.85, dir.z * len * 0.85
      ));
    }

    const wood = mergeGeoms(parts);
    const barkMat = new THREE.MeshStandardMaterial({ color: V.bark, roughness: 1 });
    const trunkMesh = new THREE.Mesh(wood, barkMat);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    g.add(trunkMesh);


    /* ---- canopy: blobs at branch tips + crown, one InstancedMesh ---- */
    const blobGeo = new THREE.IcosahedronGeometry(1, 1);
    const bp = blobGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const n = 1 + (Math.sin(bp.getX(i) * 5 + bp.getY(i) * 3) * 0.14);
      bp.setXYZ(i, bp.getX(i) * n, bp.getY(i) * n * 0.82, bp.getZ(i) * n);
    }
    blobGeo.computeVertexNormals();

    const leafMat = swayMaterial(
      { color: V.leaf, roughness: 0.95 },
      { stiffness: 0.05, gust: 1.1 }
    );
    const blobs = [{ p: new THREE.Vector3(0, h * 0.78, 0), s: h * 0.3 }];
    for (const tip of branchTips) {
      blobs.push({ p: tip.clone().add(new THREE.Vector3(0, h * 0.04, 0)), s: h * rand(0.16, 0.24) });
    }
    const inst = new THREE.InstancedMesh(blobGeo, leafMat, blobs.length);
    inst.castShadow = true;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      dummy.position.copy(b.p);
      dummy.rotation.set(rand(0.4), rand(TAU), rand(0.4));
      dummy.scale.setScalar(b.s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      col.set(V.leaf).lerp(new THREE.Color(V.leaf2), rand());
      inst.setColorAt(i, col);
    }
    inst.instanceMatrix.needsUpdate = true;
    g.add(inst);

    /* ---- blossoms: small bright spheres nested in the canopy ---- */
    const blossomCount = Math.round(clamp(h * 6, 18, 46));
    const blGeo = new THREE.IcosahedronGeometry(0.16, 0);
    const blMat = swayMaterial(
      { color: V.blossom, roughness: 0.85, emissive: 0x1a0a12 },
      { stiffness: 0.06, gust: 1.35 }
    );
    const bl = new THREE.InstancedMesh(blGeo, blMat, blossomCount);
    for (let i = 0; i < blossomCount; i++) {
      const b = pick(blobs);
      const a = rand(TAU), e = rand(-0.6, 0.9);
      const rr = b.s * rand(0.75, 1.05);
      dummy.position.set(
        b.p.x + Math.cos(a) * Math.cos(e) * rr,
        b.p.y + Math.sin(e) * rr * 0.8,
        b.p.z + Math.sin(a) * Math.cos(e) * rr
      );
      dummy.rotation.set(rand(TAU), rand(TAU), 0);
      dummy.scale.setScalar(rand(0.5, 1.4));
      dummy.updateMatrix();
      bl.setMatrixAt(i, dummy.matrix);
    }
    bl.instanceMatrix.needsUpdate = true;
    g.add(bl);

    this.group.add(g);
    this.trees.push({
      group: g, variant: V, slot, h,
      canopy: blobs.map((b) => ({
        x: slot.x + b.p.x, y: baseY + b.p.y, z: slot.z + b.p.z, r: b.s
      })),
      nextPetal: rand(0.5, 3)
    });
  }

  /* pick a random world point on some canopy - birds land here */
  randomCanopyPoint() {
    const t = pick(this.trees);
    const c = pick(t.canopy);
    const a = rand(TAU), d = rand(0.2, c.r * 0.7);
    return new THREE.Vector3(c.x + Math.cos(a) * d, c.y + c.r * 0.4, c.z + Math.sin(a) * d);
  }

  /* points near blossoms where petals may spawn this frame */
  emitPetals(dt, cb) {
    for (const t of this.trees) {
      t.nextPetal -= dt;
      if (t.nextPetal <= 0) {
        t.nextPetal = rand(0.6, 2.4) * (t.variant.ratio > 0.5 ? 0.55 : 2.2);
        if (t.variant.ratio < rand(0.55)) continue; /* leafy trees drop fewer */
        const c = pick(t.canopy);
        const a = rand(TAU), d = rand(0, c.r * 0.8);
        cb({
          x: c.x + Math.cos(a) * d,
          y: c.y + rand(-c.r * 0.3, c.r * 0.5),
          z: c.z + Math.sin(a) * d,
          color: t.variant.blossom
        });
      }
    }
  }
}

/* minimal geometry merge (positions/normals only, non-indexed) */
function mergeGeoms(list) {
  let vCount = 0;
  const parts = list.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    vCount += ng.attributes.position.count;
    return ng;
  });
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}
