const ADJECTIVES = [
  "neon",
  "crystal",
  "silent",
  "cosmic",
  "vivid",
  "gentle",
  "misty",
  "golden",
  "velvet",
  "lunar",
  "amber",
  "coral",
  "frosty",
  "hollow",
  "bright",
  "quiet",
  "rapid",
  "lucid",
  "hazy",
  "bold",
];

const NOUNS = [
  "wave",
  "bloom",
  "spark",
  "drift",
  "pulse",
  "glow",
  "echo",
  "flow",
  "shade",
  "orbit",
  "trail",
  "prism",
  "flare",
  "frost",
  "ridge",
  "ember",
  "haze",
  "loop",
  "void",
  "node",
];

export function generateProjectName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}-${noun}`;
}
