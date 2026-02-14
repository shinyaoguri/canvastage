// 形容詞（最大6文字）
const ADJECTIVES = [
  "neon", "calm", "wild", "soft", "bold",
  "dim", "raw", "warm", "cool", "deep",
  "pale", "dark", "thin", "vast", "tiny",
  "hazy", "opal", "mint", "ruby", "aqua",
  "gilt", "ashy", "icy", "airy", "silky",
  "dusty", "vivid", "lucid", "rapid", "quiet",
  "misty", "coral", "amber", "foggy", "rosy",
  "mossy", "milky", "rusty", "crisp", "stark",
  "lunar", "solar", "polar", "tidal", "sonic",
  "pixel", "cyber", "retro", "micro", "ultra",
];

// 名詞（最大5文字）
const NOUNS = [
  "wave", "glow", "echo", "flux", "node",
  "loop", "mesh", "beam", "orb", "arc",
  "haze", "mist", "void", "dust", "foam",
  "seed", "leaf", "vine", "moss", "twig",
  "reef", "dune", "cave", "lake", "rain",
  "star", "moon", "dawn", "dusk", "noon",
  "fire", "ash", "ice", "wind", "bolt",
  "rune", "glyph", "prism", "shard", "bloom",
  "pulse", "drift", "spark", "flare", "trail",
  "pixel", "voxel", "grid", "cell", "field",
];

// 36進数3桁のランダムID（a-z0-9, 46656通り）
function randomId(): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let id = "";
  for (let i = 0; i < 3; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// 形式: "adj-noun-xxx" (最大 6+1+5+1+3 = 16文字)
// 組み合わせ: 50 × 50 × 46656 ≈ 1.17億通り
export function generateProjectName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}-${noun}-${randomId()}`;
}
