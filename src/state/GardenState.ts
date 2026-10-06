export type CareCounters = { planted: number; watered: number; fed: number };
export type GardenProgress = { percent: number; discovered: number; trees: number; pond: boolean };

/** Session discoveries and a derived progress view; inventories stay in their owning systems. */
export class GardenState {
  private flowers = new Set<string>();
  private trees = new Set<string>();
  private pond = false;
  discoverFlower(species: string): void { this.flowers.add(species); }
  inspectTree(id: string): void { this.trees.add(id); }
  visitPond(): void { this.pond = true; }
  snapshot(care: CareCounters): GardenProgress {
    const fraction = (n: number, target: number) => Math.max(0, Math.min(1, n / target));
    const score = fraction(care.planted,8) + fraction(care.watered,5) + fraction(care.fed,3)
      + fraction(this.flowers.size,5) + fraction(this.trees.size,3) + Number(this.pond);
    return { percent: Math.round(score / 6 * 100), discovered: this.flowers.size, trees: this.trees.size, pond: this.pond };
  }
}
