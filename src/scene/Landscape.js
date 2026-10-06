import * as THREE from 'three';
import { swayMaterial } from '../materials.js';
import { rand, pick, TAU, withSeed } from '../utils.js';

/** Decorative planting uses a handful of draw calls, independent of gameplay plants. */
export class Landscape {
  constructor(scene, terrain, tier) {
    this.group = new THREE.Group();
    scene.add(this.group);
    withSeed(7219, () => {
      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
      const populate = (geometry, material, count, placement) => {
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        for (let i = 0; i < count; i++) {
          dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1);
          placement(dummy, i, color);
          dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);
        return mesh;
      };
      populate(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({roughness:1}), 22, (d,i,c) => {
        const a = i / 22 * TAU, r = rand(95,125);
        d.position.set(Math.cos(a)*r, -6, Math.sin(a)*r);
        d.scale.set(rand(17,30),rand(9,17),rand(17,29));
        c.set(pick([0x839f8c,0x92ac91,0x8fa5a0]));
      });
      const bushes = populate(new THREE.IcosahedronGeometry(1, 2), swayMaterial({roughness:1},{stiffness:0.025}), 145, (d,i,c) => {
        const a = rand(TAU), r = i < 100 ? rand(36,49) : rand(15,32);
        let x = Math.cos(a)*r, z = Math.sin(a)*r;
        if (terrain.inPond(x,z) || terrain.isOnSoil(x,z,2) || terrain.isOnPath(x,z)) { x=-32+rand(-3,3); z=rand(-25,25); }
        const s = rand(0.65,2.1);
        d.position.set(x,terrain.heightAt(x,z)+s*0.4,z);
        d.scale.set(s,s*rand(0.6,0.9),s); d.rotation.y=rand(TAU);
        c.set(pick([0x637c47,0x839955,0x96a460,0x688761,0xa4ad6d]));
      });
      bushes.castShadow = false;
      const flowers = tier.shadows ? 850 : 420;
      const anchors = [[-8,21],[9,19],[-15,8],[8,3],[-6,-15],[26,-4],[-25,-12],[22,25]];
      const positions = [];
      for(let i=0;i<flowers;i++){
        const center=pick(anchors), a=rand(TAU), r=Math.sqrt(rand())*5;
        const x=center[0]+Math.cos(a)*r,z=center[1]+Math.sin(a)*r;
        if(terrain.inPond(x,z)||terrain.isOnSoil(x,z,0.5)||terrain.isOnPath(x,z)){i--;continue;}
        positions.push({x,z,y:terrain.heightAt(x,z),height:rand(0.25,0.7),color:pick([0xf6e8b4,0xf4c772,0xeec5d3,0xfaf2dc,0xb6a5c9])});
      }
      const stem = new THREE.CylinderGeometry(0.015,0.022,1,3); stem.translate(0,0.5,0);
      populate(stem,swayMaterial({roughness:1},{stiffness:0.15}),flowers,(d,i,c)=>{
        const p=positions[i];d.position.set(p.x,p.y,p.z);d.scale.y=p.height;c.set(0x657f44);
      });
      populate(new THREE.IcosahedronGeometry(0.11,1),swayMaterial({roughness:0.95},{stiffness:0.09}),flowers,(d,i,c)=>{
        const p=positions[i];d.position.set(p.x,p.y+p.height,p.z);d.scale.set(1,0.45,1);c.set(p.color);
      });
      // Broad leaves give the small meadow flowers a softer silhouette.
      populate(new THREE.SphereGeometry(0.13,5,3),swayMaterial({roughness:1},{stiffness:0.12}),flowers,(d,i,c)=>{
        const p=positions[i];d.position.set(p.x+0.05,p.y+p.height*0.5,p.z);d.scale.set(1.1,0.15,0.45);d.rotation.z=0.5;d.rotation.y=rand(TAU);c.set(0x7e9851);
      });
      const ringGeometry=new THREE.RingGeometry(0.93,1,48);ringGeometry.rotateX(-Math.PI/2);
      this.ripples=[];
      for(let i=0;i<3;i++){
        const m=new THREE.Mesh(ringGeometry,new THREE.MeshBasicMaterial({color:0xd4ece0,transparent:true,opacity:0.2,depthWrite:false}));
        m.position.set(terrain.pondCenter.x,terrain.waterY+0.075,terrain.pondCenter.z);
        this.group.add(m);this.ripples.push(m);
      }
    });
  }
  update(time, reducedMotion) {
    this.ripples.forEach((r,i)=>{
      const phase=reducedMotion ? (i+1)/4 : ((time*0.09+i/3)%1);
      r.scale.setScalar(0.8+phase*5);r.material.opacity=(1-phase)*0.22;
    });
  }
}
