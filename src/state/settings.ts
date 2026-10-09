import type { Quality } from "../config/park";
export type Settings = {
  name: string;
  outfit: number;
  quality: Quality;
  muted: boolean;
  volume: number;
  reducedMotion: boolean;
};
export function defaults(): Settings {
  return {
    name: "",
    outfit: 0,
    quality: "medium",
    muted: false,
    volume: 0.3,
    reducedMotion:
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}
export function readSettings(storage?: Pick<Storage, "getItem">): Settings {
  const base = defaults();
  try {
    const saved = JSON.parse(storage?.getItem("blossom-park:v1") ?? "null");
    if (!saved || typeof saved !== "object") return base;
    return {
      name:
        typeof saved.name === "string" ? saved.name.slice(0, 24) : base.name,
      outfit:
        Number.isInteger(saved.outfit) && saved.outfit >= 0 && saved.outfit < 3
          ? saved.outfit
          : 0,
      quality: ["low", "medium", "high"].includes(saved.quality)
        ? saved.quality
        : base.quality,
      muted: typeof saved.muted === "boolean" ? saved.muted : base.muted,
      volume:
        typeof saved.volume === "number" && Number.isFinite(saved.volume)
          ? Math.max(0, Math.min(1, saved.volume))
          : base.volume,
      reducedMotion: base.reducedMotion || saved.reducedMotion === true,
    };
  } catch {
    return base;
  }
}
export function writeSettings(
  storage: Pick<Storage, "setItem"> | undefined,
  settings: Settings,
) {
  try {
    storage?.setItem("blossom-park:v1", JSON.stringify(settings));
  } catch {
    /* Private browsing can disable storage. */
  }
}
