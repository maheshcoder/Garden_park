import { terrainHeight } from "./terrain";
export type Vec3 = [number, number, number];
export const SPAWN: Vec3 = [0, 0.08, 22];
export const OUTFITS = [
  { name: "Sage", jacket: "#648c79", trousers: "#374b49", shoes: "#af7850" },
  { name: "Rose", jacket: "#bd6d7b", trousers: "#3c454d", shoes: "#8f6550" },
  { name: "Sky", jacket: "#668fba", trousers: "#394951", shoes: "#aa794e" },
] as const;
export type Quality = "low" | "medium" | "high";
export const QUALITY = {
  low: {
    dpr: 1,
    shadows: false,
    shadowSize: 512,
    treeDetail: 0,
    petals: 45,
    flowers: 7,
    birds: 3,
  },
  medium: {
    dpr: 1.35,
    shadows: true,
    shadowSize: 1024,
    treeDetail: 1,
    petals: 95,
    flowers: 11,
    birds: 5,
  },
  high: {
    dpr: 1.75,
    shadows: true,
    shadowSize: 2048,
    treeDetail: 2,
    petals: 160,
    flowers: 17,
    birds: 8,
  },
};
export type Bench = {
  id: string;
  position: Vec3;
  rotation: number;
  seat: Vec3;
  stand: Vec3;
};
function bench(id: string, x: number, z: number, rotation: number): Bench {
  return {
    id,
    position: [x, terrainHeight(x, z), z],
    rotation,
    seat: [x, terrainHeight(x, z) + 0.59, z],
    stand: [
      x + Math.sin(rotation) * 1.3,
      terrainHeight(
        x + Math.sin(rotation) * 1.3,
        z + Math.cos(rotation) * 1.3,
      ) + 0.08,
      z + Math.cos(rotation) * 1.3,
    ],
  };
}
export const BENCHES = [
  bench("plaza-west", -6.8, 3, Math.PI / 2),
  bench("plaza-east", 6.8, 3, -Math.PI / 2),
  bench("grove", -17, 3, 0.4),
  bench("garden", 17, 12, -Math.PI / 2),
  bench("pond", 21, -13, -Math.PI / 2),
  bench("birds", -13, -20, 0),
];
export type Sign = {
  id: string;
  position: Vec3;
  rotation: number;
  title: string;
  text: string;
  tag: string;
};
export const SIGNS: Sign[] = [
  {
    id: "welcome",
    position: [2.8, 0, 20],
    rotation: 0,
    title: "Welcome to Blossom Park",
    tag: "01 / THE ENTRANCE",
    text: "Take your time. Follow the cream paths to the fountain, then find your own little corner. The loop connects all six gardens. You can sit on any bench, wave hello, or simply watch the petals fall.",
  },
  {
    id: "grove-sign",
    position: [-11, 0, 7],
    rotation: 1,
    title: "A season of soft pink",
    tag: "03 / BLOSSOM GROVE",
    text: "Our pink and ivory blossom trees celebrate the fleeting beauty of spring. Their flowers feed early pollinators, and their shade makes a lovely place to pause. Find the wooden bench beneath the canopy.",
  },
  {
    id: "flower-sign",
    position: [10, 0, 11],
    rotation: 0,
    title: "Small flowers, big company",
    tag: "04 / FLOWER GARDEN",
    text: "Daisies, tulips and lavender share these curved beds. Butterflies prefer sunny, sheltered spots and flowers rich in nectar. Leave the blossoms where they grow; the garden is prettier with its visitors.",
  },
  {
    id: "pond-sign",
    position: [8, 0, -5],
    rotation: 0,
    title: "A moment by the water",
    tag: "05 / LILY POND",
    text: "Follow the wooden bridge across the pond. Reeds shelter the water’s edge, while lily pads offer resting places for insects. The banks are protected, so you can explore without taking an unexpected swim.",
  },
  {
    id: "bird-sign",
    position: [-8, 0, -17],
    rotation: 0,
    title: "Listen a little closer",
    tag: "06 / BIRD GARDEN",
    text: "Look up for the little birds circling the garden, or find one perched near a birdhouse. Their morning chorus blends with the fountain. Turn on the sound and enjoy a quiet moment.",
  },
];
export const TREES = [
  [-4, 19, 1.05, 0],
  [4, 19, 1.03, 1],
  [-7, 15, 1.15, 0],
  [8, 17, 0.94, 1],
  [-13, 1, 1.22, 0],
  [-18, -3, 1.3, 1],
  [-21, 4, 1.12, 0],
  [-14, 8, 1.08, 1],
  [-21, 10, 1.17, 0],
  [-9, -3, 1.04, 0],
  [4, -4, 1.05, 1],
  [-5, -8, 1.18, 0],
  [-17, -14, 1.12, 1],
  [-7, -23, 1.08, 0],
  [-19, -22, 1.02, 1],
  [22, -19, 1.15, 0],
  [24, -3, 1.08, 1],
  [22, 5, 1.0, 0],
  [16, 19, 1.14, 0],
  [-25, 18, 1.2, 1],
  [25, 17, 1.16, 1],
  [-24, -10, 1.07, 0],
  [4, -24, 1.25, 1],
] as const;
export const BEDS = [
  { x: 9.2, z: 4.5, rx: 2, rz: 1.7, color: "#e8b57c" },
  { x: 19.7, z: 6, rx: 2.5, rz: 2.5, color: "#ce87a6" },
  { x: 18, z: 16, rx: 3.4, rz: 1.8, color: "#e6d1eb" },
  { x: -8, z: 9, rx: 3, rz: 1.7, color: "#f5e8c1" },
  { x: -6, z: -15, rx: 2.8, rz: 2, color: "#eec787" },
  { x: -22, z: -9, rx: 2.8, rz: 1.9, color: "#d492b7" },
];
export const LOOP: Vec3[] = [
  [0, 0.035, 14],
  [0, 0.035, 3],
  [5, 0.035, 7],
  [12, 0.035, 13],
  [15, 0.035, 9],
  [13, 0.035, -4],
  [13, 0.035, -20],
  [1, 0.035, -20],
  [-11, 0.035, -18],
  [-17, 0.035, -10],
  [-17, 0.035, 0],
  [-13, 0.035, 12],
];
export function random(seed: number) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
export function zoneAt(x: number, z: number) {
  if (z > 16) return "The entrance";
  if (x > 6 && z < -4) return "Lily pond";
  if (z < -12) return "Bird garden";
  if (x < -8) return "Blossom grove";
  if (x > 8 && z > 2) return "Flower garden";
  return "Central plaza";
}

export const ARCH: Vec3 = [0, 0, 23.8];
export const PLAZA: Vec3 = [0, 0, 3];
export const POND_CENTER: Vec3 = [13, 0, -12];
export const BIRDHOUSES = [
  [-10, -19],
  [-16, -17],
  [-5, -22],
] as const;
export const SHRUBS = [
  [-23, -17],
  [24, 11],
  [-22, 23],
  [-2, -25],
] as const;
export const LILY_PADS = [
  [8, -13],
  [17, -14],
  [18, -10],
  [9, -10],
  [16, -16],
] as const;
export const POND_RIPPLES = [
  [8, -12],
  [17, -12],
  [18, -10],
  [9, -14],
] as const;
