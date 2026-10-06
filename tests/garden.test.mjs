import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Flowers} from '../src/scene/Flowers.js';
import {Butterflies} from '../src/entities/Butterflies.js';
import {FeedingSystem} from '../src/systems/FeedingSystem.js';
import {WateringSystem} from '../src/systems/WateringSystem.js';
import {Bird} from '../src/birds/Bird.js';
import {BirdBehavior, STATE} from '../src/birds/BirdBehavior.js';
import {Effects} from '../src/systems/Effects.js';
import {GardenState} from '../src/state/GardenState.ts';
import {withSeed,rand} from '../src/utils.js';
const terrain={heightAt:()=>0,inPond:(x,z)=>x===16&&z===-11,inBounds:(x,z)=>Number.isFinite(x)&&Number.isFinite(z)&&Math.hypot(x,z)<49,isOnSoil:()=>false};
const vec=new THREE.Vector3(0,1,0);

test('new flowers render immediately and reuse capacity after removal',()=>{
 const flowers=new Flowers(new THREE.Scene(),terrain);
 for(let i=0;i<40;i++)assert.ok(flowers.plant(i/2,0,'rose'));
 assert.equal(flowers.headMeshes.rose.count,40);assert.equal(flowers.stemMesh.count,40);
 assert.equal(flowers.plant(0,0,'rose'),null);assert.equal(flowers.slotNext.rose,40);
 const f=flowers.flowers[5];assert.equal(flowers.pick(f),true);assert.equal(flowers.pick(f),false);
 assert.equal(flowers.picked,1);assert.ok(flowers.plant(2,2,'rose'));
 assert.equal(flowers.headMeshes.rose.count,40);assert.equal(flowers.plant(NaN,0,'rose'),null);
 flowers.clear();assert.equal(flowers.stemMesh.count,0);assert.equal(flowers.headMeshes.rose.count,0);
});
test('all butterfly positions stay finite through a simulation',()=>{
 const butterflies=new Butterflies(new THREE.Scene(),terrain);for(let i=0;i<8;i++)butterflies.add();
 for(let i=0;i<300;i++)butterflies.update(1/60);
 for(const b of butterflies.list)assert.ok([b.x,b.y,b.z,b.vx,b.vy,b.vz].every(Number.isFinite));
});
test('watering changes moisture, consumes inventory and counts distinct plants',()=>{
 const flowers=new Flowers(new THREE.Scene(),terrain),f=flowers.plant(0,0,'daisy');f.waterLevel=0;
 const water=new WateringSystem(null,null);const initial=water.amount;
 assert.ok(water.waterPlant(f,vec));assert.ok(f.waterLevel>0);assert.equal(water.amount,initial-1);
 water.waterPlant(f,vec);assert.equal(water.totalWatered,1);
 water.amount=0;assert.equal(water.waterPlant(f,vec),false);assert.ok(water.refill(vec));assert.equal(water.amount,water.max);
});
test('rain nourishes plants while dry plants wilt',()=>{
 const flowers=new Flowers(new THREE.Scene(),terrain),f=flowers.plant(0,0,'tulip');f.waterLevel=0.01;
 flowers.rain=1;flowers.update(5);assert.ok(f.waterLevel>0.3);
 flowers.rain=0;f.waterLevel=0;flowers.update(5);assert.ok(f.health<1);
});
test('bird autonomously approaches, lands at raised food, eats and leaves',()=>withSeed(9237,()=>{
 const scene=new THREE.Scene(),feeding=new FeedingSystem(scene,terrain,null,null);
 const pile=feeding.placeFood(0,0,1.35),bird=new Bird(scene);
 bird.pos.set(2,4,2);bird.vel.set(0,0,0);
 const world={terrain,feeding,trees:{randomCanopyPoint:()=>new THREE.Vector3(10,4,0)}};
 const brain=new BirdBehavior(bird,world);brain._seek(pile);
 const seen=new Set();let landedY=null;
 for(let i=0;i<3600;i++){brain.update(1/60);seen.add(brain.state);if(brain.state===STATE.EATING)landedY=bird.pos.y;if(feeding.totalFed===4&&brain.state===STATE.RETURNING)break;}
 assert.ok(seen.has(STATE.LANDING));assert.ok(seen.has(STATE.EATING));assert.ok(landedY>1.35);
 assert.equal(feeding.totalFed,4);assert.equal(feeding.piles.length,0);assert.equal(brain.state,STATE.RETURNING);
}));
test('food inventory cannot go negative and optional sound is safe',()=>{
 const feeding=new FeedingSystem(new THREE.Scene(),terrain,null,null);feeding.food=1;
 assert.equal(feeding.placeFood(16,-11),null);assert.equal(feeding.food,1);
 assert.ok(feeding.placeFood(1,1));assert.equal(feeding.placeFood(2,2),null);assert.equal(feeding.food,0);
});
test('particle pool updates size attributes and retires dead particles',()=>{
 const effects=new Effects(new THREE.Scene(),{petals:1,pollen:1});effects.burst(0,1,0,'#fff',5);
 effects.update(0.01);assert.equal(effects.geo.drawRange.count,5);assert.ok(effects.geo.attributes.aSize.version>0);
 effects.update(10);effects.update(0);assert.equal(effects.geo.drawRange.count,0);
});
test('discoveries are unique and progress reaches 100 only with all goals',()=>{
 const state=new GardenState();assert.equal(state.snapshot({planted:0,watered:0,fed:0}).percent,0);
 for(const s of ['rose','daisy','tulip','sunflower','lavender'])state.discoverFlower(s);
 state.discoverFlower('rose');for(const t of ['a','b','c'])state.inspectTree(t);state.visitPond();
 assert.deepEqual(state.snapshot({planted:8,watered:5,fed:3}),{percent:100,discovered:5,trees:3,pond:true});
});
test('seeded layouts repeat without replacing Math.random globally',()=>{
 const a=withSeed(732,()=>[rand(),rand(),rand()]),b=withSeed(732,()=>[rand(),rand(),rand()]);assert.deepEqual(a,b);
});
