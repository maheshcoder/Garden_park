/* ===================================================================
   Shared tuning for the 3D garden.
   Numbers chosen to match the classic 2D CONFIG where a counterpart
   exists (flower/butterfly caps, day length, attract radius ~ scale).
   =================================================================== */

export const CONFIG = {
  /* population ------------------------------------------------------ */
  maxFlowers: 90,             /* same cap as the 2D garden            */
  startFlowers: 44,
  flowerCapacityPerSpecies: 40,/* InstancedMesh slots per species      */
  maxButterflies: 24,
  startButterflies: 8,
  startBirds: 8,

  /* world ----------------------------------------------------------- */
  gardenRadius: 37,           /* fence line / walkable bound          */
  reach: 3.4,                 /* interaction range in world units     */
  attractRadius: 4.2,         /* butterflies follow the cursor ray    */
  dayLength: 1200,             /* seconds for a full 24h cycle         */
  walkSpeed: 4.4,

  /* inventories ------------------------------------------------------ */
  startWater: 100,
  maxWater: 100,
  startFood: 5,
  maxFood: 12,

  /* goals for the ⭐ progress chip ----------------------------------- */
  goals: { plant: 8, water: 5, feed: 3 }
};

export const SEEDS = ['rose', 'daisy', 'sunflower', 'tulip', 'lavender'];
