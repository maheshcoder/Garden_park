/* ===================================================================
   Terrain - the physical garden: lawn, soil beds, stone path, pond,
   rocks and decorations (bench, birdhouse, fence).
   Also owns heightAt(): every other system asks the terrain where
   the ground is instead of assuming y = 0.
   =================================================================== */
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { swayMaterial } from '../materials.js';
import { clamp, rand, pick, TAU } from '../utils.js';

export class Terrain {
  constructor(scene, tier) {
    this.scene = scene;
    this.tier = tier;
    this.group = new THREE.Group();
    scene.add(this.group);

    /* feature anchors - the feeding / watering / interaction systems
       read these instead of hardcoding positions                    */
    this.pondCenter = new THREE.Vector3(16, 0, -11);
    this.pondRadius = 6.5;
    this.soilBeds = [
      { x: -9, z: 6, w: 8, d: 5 },
      { x: 7, z: 9, w: 7, d: 4.5 },
      { x: -4, z: -9, w: 6, d: 4 }
    ];

    this._buildLawn();
    this._buildSoil();
    this._buildPath();
    this._buildPond();
    this._buildRocks();
    this._buildDecor();
  }

  /* height of the lawn at world (x, z): two gentle sine ridges, the
     same flavour as the classic groundAt() but in 3 dimensions      */
  heightAt(x, z) {
    let h = Math.sin(x * 0.045 + 0.8) * 0.55 + Math.sin(z * 0.06 + 2.1) * 0.4;
    /* flatten around the pond so water sits level */
    const d = Math.hypot(x - this.pondCenter.x, z - this.pondCenter.z);
    if (d < this.pondRadius + 3) h *= clamp((d - this.pondRadius) / 3, 0, 1);
    return h;
  }

  /* ------------------------------------------------------------- lawn */
  _buildLawn() {
    const R = 70, seg = 72;
    const geo = new THREE.CircleGeometry(R, seg, 0, TAU);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setY(i, this.heightAt(p.getX(i), p.getZ(i)));
    }
    geo.computeVertexNormals();
    this.lawnMat = new THREE.MeshStandardMaterial({
      color: 0x3e8a44, roughness: 1, metalness: 0
    });
    this.lawn = new THREE.Mesh(geo, this.lawnMat);
    this.lawn.receiveShadow = true;
    this.group.add(this.lawn);

    /* grass blades: one InstancedMesh, sway done in the vertex stage */
    const n = this.tier.grass;
    const blade = new THREE.ConeGeometry(0.045, 0.5, 3, 1, true);
    blade.translate(0, 0.25, 0);
    const grassMat = swayMaterial(
      { color: 0x4da75c, roughness: 1, side: THREE.DoubleSide },
      { stiffness: 0.34, gust: 1.35 }
    );
    this.grass = new THREE.InstancedMesh(blade, grassMat, n);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), r = Math.sqrt(Math.random()) * 62;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      dummy.position.set(x, this.heightAt(x, z), z);
      dummy.rotation.y = rand(TAU);
      const s = rand(0.6, 1.5);
      dummy.scale.set(s, s * rand(0.7, 1.6), s);
      dummy.updateMatrix();
      this.grass.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.33 + rand(-0.03, 0.03), 0.5 + rand(-0.1, 0.12), 0.34 + rand(-0.08, 0.12));
      this.grass.setColorAt(i, col);
    }
    this.grass.instanceMatrix.needsUpdate = true;
    this.grass.frustumCulled = false;
    this.group.add(this.grass);
  }

  /* ----------------------------------------------------------- soil  */
  _buildSoil() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a4026, roughness: 1 });
    const rim = new THREE.MeshStandardMaterial({ color: 0x6f5638, roughness: 1 });
    for (const b of this.soilBeds) {
      const geo = new THREE.BoxGeometry(b.w, 0.3, b.d);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(b.x, this.heightAt(b.x, b.z) + 0.1, b.z);
      m.receiveShadow = true;
      m.castShadow = false;
      this.group.add(m);
      /* timber frame so beds read as built, not painted */
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(b.w + 0.5, 0.36, b.d + 0.5), rim
      );
      frame.position.copy(m.position);
      frame.position.y -= 0.04;
      frame.receiveShadow = true;
      this.group.add(frame);
    }
  }

  isOnSoil(x, z, pad = 0) {
    for (const b of this.soilBeds) {
      if (Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) return true;
    }
    return false;
  }

  isOnPath(x, z) {
    if (!this.pathCurve) return false;
    const p = this.pathCurve.getPoints(80);
    for (const q of p) {
      if ((q.x - x) * (q.x - x) + (q.z - z) * (q.z - z) < 1.7) return true;
    }
    return false;
  }

  inPond(x, z) {
    return Math.hypot(x - this.pondCenter.x, z - this.pondCenter.z) < this.pondRadius;
  }

  /* ------------------------------------------------------------ path */
  /* one winding curve of flat stones from the south edge to the pond  */
  _buildPath() {
    this.pathCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 34),
      new THREE.Vector3(-4, 0, 20),
      new THREE.Vector3(2, 0, 8),
      new THREE.Vector3(-2, 0, -2),
      new THREE.Vector3(6, 0, -8),
      new THREE.Vector3(12, 0, -9)
    ]);
    const stone = new THREE.CylinderGeometry(1, 1, 0.16, 7);
    const mat = new THREE.MeshStandardMaterial({ color: 0xa9a094, roughness: 0.95 });
    const n = 34;
    this.pathStones = new THREE.InstancedMesh(stone, mat, n);
    this.pathStones.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const p = this.pathCurve.getPoint(t);
      const jitter = 0.6;
      const x = p.x + rand(-jitter, jitter), z = p.z + rand(-jitter, jitter);
      dummy.position.set(x, this.heightAt(x, z) + 0.05, z);
      dummy.rotation.y = rand(TAU);
      dummy.scale.set(rand(0.7, 1.15), 1, rand(0.7, 1.15));
      dummy.updateMatrix();
      this.pathStones.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.09, 0.08, 0.58 + rand(-0.1, 0.1));
      this.pathStones.setColorAt(i, col);
    }
    this.pathStones.instanceMatrix.needsUpdate = true;
    this.group.add(this.pathStones);
  }

  /* ------------------------------------------------------------ pond */
  _buildPond() {
    const c = this.pondCenter, r = this.pondRadius;
    /* dug-out basin */
    const bank = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.4, r + 1.6, 40),
      new THREE.MeshStandardMaterial({ color: 0x6b563a, roughness: 1 })
    );
    bank.rotation.x = -Math.PI / 2;
    bank.position.set(c.x, this.heightAt(c.x, c.z) + 0.06, c.z);
    bank.receiveShadow = true;
    this.group.add(bank);

    const bed = new THREE.Mesh(
      new THREE.CircleGeometry(r, 40),
      new THREE.MeshStandardMaterial({ color: 0x2c4a5a, roughness: 1 })
    );
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(c.x, bank.position.y - 0.35, c.z);
    this.group.add(bed);

    /* water: transparent plane with a light vertex wobble in update() */
    this.waterGeo = new THREE.CircleGeometry(r - 0.3, 40, 0, TAU);
    this.waterGeo.rotateX(-Math.PI / 2);
    this.waterBase = this.waterGeo.attributes.position.array.slice();
    this.waterMat = new THREE.MeshStandardMaterial({
      color: 0x3f8fbf, transparent: true, opacity: 0.82,
      roughness: 0.15, metalness: 0.1
    });
    this.water = new THREE.Mesh(this.waterGeo, this.waterMat);
    this.water.position.set(c.x, bank.position.y - 0.12, c.z);
    this.group.add(this.water);

    /* lily pads */
    const padGeo = new THREE.CircleGeometry(0.55, 12);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4a, roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const a = rand(TAU), d = rand(1.5, r - 1.6);
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(c.x + Math.cos(a) * d, waterLevel(bank) + 0.02, c.z + Math.sin(a) * d);
      pad.rotation.z = rand(TAU);
      pad.receiveShadow = true;
      this.group.add(pad);
    }
    function waterLevel(b) { return b.position.y - 0.12; }
    this.waterY = bank.position.y - 0.12;

    /* reeds around the rim */
    const reed = swayMaterial(
      { color: 0x2f7a3f, roughness: 1 }, { stiffness: 0.5, gust: 1.6 }
    );
    const reedGeo = new THREE.CylinderGeometry(0.03, 0.05, 1.6, 4, 1, false);
    reedGeo.translate(0, 0.8, 0);
    const reeds = new THREE.InstancedMesh(reedGeo, reed, 26);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 26; i++) {
      const a = rand(TAU);
      const d = r + rand(-0.3, 0.9);
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      dummy.position.set(x, this.heightAt(x, z), z);
      dummy.rotation.y = rand(TAU);
      dummy.rotation.z = rand(-0.14, 0.14);
      dummy.scale.set(1, rand(0.7, 1.4), 1);
      dummy.updateMatrix();
      reeds.setMatrixAt(i, dummy.matrix);
    }
    reeds.instanceMatrix.needsUpdate = true;
    this.group.add(reeds);
  }

  updateWater(t) {
    const p = this.waterGeo.attributes.position;
    const base = this.waterBase;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      p.setY(i, Math.sin(t * 1.6 + x * 0.9) * 0.03 + Math.cos(t * 1.1 + z * 1.2) * 0.03);
    }
    p.needsUpdate = true;
  }

  /* ------------------------------------------------------------ rocks */
  _buildRocks() {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8d8d92, roughness: 0.95, flatShading: true });
    const n = 16;
    this.rocks = new THREE.InstancedMesh(geo, mat, n);
    this.rocks.castShadow = true;
    this.rocks.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      /* cluster some rocks near the pond, scatter the rest */
      let x, z;
      if (i < 6) {
        const a = (i / 6) * TAU + 0.4;
        x = this.pondCenter.x + Math.cos(a) * (this.pondRadius + rand(0.5, 1.4));
        z = this.pondCenter.z + Math.sin(a) * (this.pondRadius + rand(0.5, 1.4));
      } else {
        const a = rand(TAU), d = rand(14, 46);
        x = Math.cos(a) * d; z = Math.sin(a) * d;
      }
      dummy.position.set(x, this.heightAt(x, z) + rand(0, 0.15), z);
      dummy.rotation.set(rand(TAU), rand(TAU), rand(TAU));
      const s = rand(0.3, 1.25);
      dummy.scale.set(s * rand(0.8, 1.3), s * rand(0.5, 0.9), s * rand(0.8, 1.3));
      dummy.updateMatrix();
      this.rocks.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.62, 0.04, rand(0.42, 0.66));
      this.rocks.setColorAt(i, col);
    }
    this.rocks.instanceMatrix.needsUpdate = true;
    this.group.add(this.rocks);
  }

  /* ----------------------------------------------------------- decor */
  /* bench, birdhouse and a low fence around the whole garden         */
  _buildDecor() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.9 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x6d4526, roughness: 0.9 });

    /* --- bench facing the pond --- */
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 0.9), wood);
    seat.position.y = 0.85;
    seat.castShadow = true;
    bench.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.12), wood);
    back.position.set(0, 1.3, -0.4);
    back.castShadow = true;
    bench.add(back);
    for (const sx of [-1.35, 1.35]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.85, 0.8), woodDark);
      leg.position.set(sx, 0.42, 0);
      leg.castShadow = true;
      bench.add(leg);
    }
    const bx = 8, bz = 16;
    bench.position.set(bx, this.heightAt(bx, bz), bz);
    bench.rotation.y = Math.atan2(this.pondCenter.x - bx, this.pondCenter.z - bz);
    this.group.add(bench);
    this.benchPos = bench.position.clone();
    this.benchTop = bench.position.y + 1.0;

    /* --- birdhouse on a pole --- */
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.2, 6), woodDark);
    const hx = -14, hz = -4;
    pole.position.set(hx, this.heightAt(hx, hz) + 2.1, hz);
    pole.castShadow = true;
    this.group.add(pole);
    const house = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.7), wood);
    box.castShadow = true;
    house.add(box);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.5, 4), woodDark);
    roof.position.y = 0.62;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    house.add(roof);
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 16),
      new THREE.MeshStandardMaterial({ color: 0x1a120b, roughness: 1 })
    );
    hole.position.set(0, 0.1, 0.36);
    house.add(hole);
    house.position.set(hx, this.heightAt(hx, hz) + 4.5, hz);
    this.group.add(house);
    this.birdhousePos = house.position.clone().add(new THREE.Vector3(0, -0.3, 0.6));

    /* --- low picket fence on a circle around the garden --- */
    const picket = new THREE.BoxGeometry(0.14, 1.1, 0.05);
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.9 });
    const count = 88;
    this.fence = new THREE.InstancedMesh(picket, fenceMat, count);
    this.fence.receiveShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      const x = Math.cos(a) * 52, z = Math.sin(a) * 52;
      dummy.position.set(x, this.heightAt(x, z) + 0.55, z);
      dummy.rotation.y = -a;
      dummy.updateMatrix();
      this.fence.setMatrixAt(i, dummy.matrix);
    }
    this.fence.instanceMatrix.needsUpdate = true;
    this.group.add(this.fence);

    /* two horizontal rails following the same circle */
    for (const ry of [0.45, 0.95]) {
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * TAU;
        const x = Math.cos(a) * 52, z = Math.sin(a) * 52;
        pts.push(new THREE.Vector3(x, this.heightAt(x, z) + ry, z));
      }
      const rail = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 128, 0.05, 5, true),
        wood
      );
      this.group.add(rail);
    }

    /* --- feeding station: a small platform near the birdhouse --- */
    const feeder = new THREE.Group();
    const tray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0xc47a3a, roughness: 0.85 })
    );
    tray.castShadow = true;
    tray.receiveShadow = true;
    feeder.add(tray);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), woodDark);
    stand.position.y = -0.5;
    feeder.add(stand);
    const fx = -11, fz = -1;
    feeder.position.set(fx, this.heightAt(fx, fz) + 1.35, fz);
    this.group.add(feeder);
    this.feederPos = feeder.position.clone();
  }

  /* true when a world position is inside the walkable garden         */
  inBounds(x, z, pad = 1.5) {
    return Math.hypot(x, z) < 50 - pad;
  }
}

