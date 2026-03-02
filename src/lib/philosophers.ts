/**
 * Philosopher personas for debaters and judges.
 * Each has a name, a short title, and a color for visual identity.
 */

export interface Philosopher {
  name: string;
  title: string;
  color: string;      // CSS color for avatar/accents
  icon: string;        // Unicode symbol
}

/** Pool of philosopher personas — assigned round-robin to debaters. */
export const PHILOSOPHER_POOL: Philosopher[] = [
  { name: "Socrates",    title: "The Gadfly",          color: "#5a5a5a", icon: "Σ" },
  { name: "Plato",       title: "The Idealist",        color: "#3a7ca5", icon: "Π" },
  { name: "Aristotle",   title: "The Empiricist",      color: "#8a5a4a", icon: "Α" },
  { name: "Hypatia",     title: "The Mathematician",   color: "#6a5a9a", icon: "Η" },
  { name: "Diogenes",    title: "The Cynic",           color: "#4a7a5a", icon: "Δ" },
  { name: "Epicurus",    title: "The Hedonist",        color: "#8a7a50", icon: "Ε" },
  { name: "Zeno",        title: "The Stoic",           color: "#5a5a9a", icon: "Ζ" },
  { name: "Pythagoras",  title: "The Numerist",        color: "#9a6a50", icon: "Ψ" },
  { name: "Heraclitus",  title: "The Obscure",         color: "#9a4a4a", icon: "Φ" },
  { name: "Thales",      title: "The First",           color: "#4a7a7a", icon: "Θ" },
];

/** The judge persona — Athena, goddess of wisdom. */
export const JUDGE_PERSONA: Philosopher = {
  name: "Athena",
  title: "Goddess of Wisdom",
  color: "#555555",
  icon: "⚖",
};

/** Get philosopher persona by index (wraps around pool). */
export function getPhilosopher(index: number): Philosopher {
  return PHILOSOPHER_POOL[index % PHILOSOPHER_POOL.length];
}

/** Map a debater internal name (e.g. "debater_a") to a philosopher. */
export function debaterNameToPhilosopher(name: string, allNames: string[]): Philosopher {
  const idx = allNames.indexOf(name);
  return getPhilosopher(idx >= 0 ? idx : 0);
}
