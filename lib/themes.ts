import type { ThemeId } from "./types";

export const THEMES: {
  id: ThemeId;
  name: string;
  descriptor: string;
  mood: string;
  accent: string;
  surface: string;
  layout: string;
}[] = [
  { id: "luxury-black", name: "Luxury Black", descriptor: "A quiet, considered showroom in ink and silver.", mood: "Editorial · Refined · Timeless", accent: "#d9c8a5", surface: "#10100f", layout: "editorial" },
  { id: "neon-cyber", name: "Neon Cyber", descriptor: "Electric color, sharp edges and a future-forward pulse.", mood: "Futuristic · Electric · Bold", accent: "#9e78ff", surface: "#100d1d", layout: "signal" },
  { id: "apple-minimal", name: "Apple-Inspired Minimal", descriptor: "Air, clarity and product-first simplicity.", mood: "Minimal · Calm · Product-led", accent: "#161616", surface: "#f7f7f5", layout: "gallery" },
  { id: "premium-purple", name: "Premium Purple", descriptor: "Soft glass, deep violet and a little theater.", mood: "Expressive · Glass · Modern", accent: "#bb96ff", surface: "#171022", layout: "glass" },
  { id: "modern-tech", name: "Modern Tech", descriptor: "A crisp blue-and-white home for useful technology.", mood: "Clear · Precise · Contemporary", accent: "#2563eb", surface: "#f4f7fb", layout: "modular" },
  { id: "gaming-universe", name: "Gaming Universe", descriptor: "A high-energy arena built for the next level.", mood: "Immersive · Competitive · Kinetic", accent: "#b8ff3b", surface: "#0d1012", layout: "arena" },
  { id: "silver-metallic", name: "Silver Metallic", descriptor: "Sculpted chrome, cool light and future craft.", mood: "Sculptural · Cool · Futuristic", accent: "#b8c2ca", surface: "#171b20", layout: "chrome" },
  { id: "creative-colorful", name: "Creative Colorful", descriptor: "Playful forms, confident color and a bright point of view.", mood: "Playful · Vivid · Optimistic", accent: "#ff765f", surface: "#fff8f0", layout: "playground" },
];

export const DEFAULT_THEME: ThemeId = "luxury-black";
export const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === "string" && THEMES.some((theme) => theme.id === value);
