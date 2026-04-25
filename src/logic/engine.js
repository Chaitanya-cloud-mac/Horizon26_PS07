/**
 * Mastermind Game Engine
 *
 * Two-pass peg feedback algorithm that correctly handles duplicate colour
 * instances:
 *   Pass 1 — Exact matches: guess[i] === secret[i]
 *   Pass 2 — Partial matches: remaining guess colours found in remaining
 *            secret colours (first unused occurrence consumed).
 *
 * This avoids the classic over-count bug with naive single-pass approaches.
 */

// ─── Difficulty Configurations ───────────────────────────────────────────────

export const DIFFICULTIES = {
  easy: {
    label: 'Easy',
    colors: 4,
    slots: 4,
    maxGuesses: 8,
    timerSeconds: 600,
  },
  medium: {
    label: 'Medium',
    colors: 6,
    slots: 5,
    maxGuesses: 10,
    timerSeconds: 420,
  },
  hard: {
    label: 'Hard',
    colors: 8,
    slots: 6,
    maxGuesses: 12,
    timerSeconds: 300,
  },
};

// ─── Colour Palettes ─────────────────────────────────────────────────────────
// Each palette contains enough colours for the hardest difficulty.
// Colours are curated HSL values — vibrant but harmonious, no purple.

export const COLOR_POOL = [
  { id: 0, name: 'Red',       hex: '#ff0000' },
  { id: 1, name: 'Blue',      hex: '#1a1aff' },
  { id: 2, name: 'Yellow',    hex: '#ffff00' },
  { id: 3, name: 'Green',     hex: '#00e600' },
  { id: 4, name: 'Orange',    hex: '#ff9900' },
  { id: 5, name: 'Magenta',   hex: '#ff00ff' },
  { id: 6, name: 'Cyan',      hex: '#00e6e6' },
  { id: 7, name: 'Brown',     hex: '#663300' },
];

/**
 * Get the active colour set for a given difficulty.
 */
export function getColorsForDifficulty(difficultyKey) {
  const count = DIFFICULTIES[difficultyKey].colors;
  return COLOR_POOL.slice(0, count);
}

// ─── Secret Generation ───────────────────────────────────────────────────────

export function generateSecret(difficultyKey) {
  const { colors, slots } = DIFFICULTIES[difficultyKey];
  const secret = [];
  for (let i = 0; i < slots; i++) {
    secret.push(Math.floor(Math.random() * colors));
  }
  return secret;
}

// ─── Two-Pass Feedback Algorithm ─────────────────────────────────────────────

/**
 * Evaluate a guess against the secret.
 *
 * @param {number[]} guess  – array of colour IDs (length = slots)
 * @param {number[]} secret – array of colour IDs (length = slots)
 * @returns {{ exact: number, partial: number }}
 *
 * Algorithm:
 *   Pass 1 – For each position i, if guess[i] === secret[i] mark both as
 *            "used" and increment exact.
 *   Pass 2 – For each remaining (un-used) guess peg, scan remaining secret
 *            pegs for the first colour match; if found, mark the secret peg
 *            as used and increment partial.
 *
 * This guarantees no double-counting when duplicates are present.
 */
export function evaluateGuess(guess, secret) {
  const slots = secret.length;
  const secretUsed = new Array(slots).fill(false);
  const guessUsed  = new Array(slots).fill(false);

  let exact   = 0;
  let partial = 0;

  // Pass 1: Exact matches
  for (let i = 0; i < slots; i++) {
    if (guess[i] === secret[i]) {
      exact++;
      secretUsed[i] = true;
      guessUsed[i]  = true;
    }
  }

  // Pass 2: Partial matches (colour present, wrong position)
  for (let i = 0; i < slots; i++) {
    if (guessUsed[i]) continue;           // already exact-matched
    for (let j = 0; j < slots; j++) {
      if (secretUsed[j]) continue;        // already consumed
      if (guess[i] === secret[j]) {
        partial++;
        secretUsed[j] = true;             // consume this secret peg
        break;                            // move to next guess peg
      }
    }
  }

  return { exact, partial };
}

// ─── Leaderboard (localStorage) ──────────────────────────────────────────────

const STORAGE_KEY = 'mastermind_leaderboard';

function loadAllScores() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { easy: [], medium: [], hard: [] };
  } catch {
    return { easy: [], medium: [], hard: [] };
  }
}

function saveAllScores(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Add a score entry and return the updated top-10 for that tier.
 */
export function addScore(difficultyKey, name, guessCount, timeRemaining) {
  const all = loadAllScores();
  if (!all[difficultyKey]) all[difficultyKey] = [];

  all[difficultyKey].push({
    name,
    guesses: guessCount,
    timeRemaining,
    date: new Date().toISOString(),
  });

  // Sort: fewer guesses is better; tie-break by more time remaining
  all[difficultyKey].sort((a, b) => {
    if (a.guesses !== b.guesses) return a.guesses - b.guesses;
    return b.timeRemaining - a.timeRemaining;
  });

  // Keep top 10
  all[difficultyKey] = all[difficultyKey].slice(0, 10);
  saveAllScores(all);

  return all[difficultyKey];
}

/**
 * Get top-10 leaderboard for a given difficulty tier.
 */
export function getLeaderboard(difficultyKey) {
  const all = loadAllScores();
  return (all[difficultyKey] || []).slice(0, 10);
}
