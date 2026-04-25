import { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import './App.css';
import {
  DIFFICULTIES,
  COLOR_POOL,
  getColorsForDifficulty,
  generateSecret,
  evaluateGuess,
  addScore,
  getLeaderboard,
  calculateScore,
} from './logic/engine';

/* ═══════════════════════════════════════════════════════════════════════════
   Geometric symbols for accessibility overlay — one per colour slot
   ═══════════════════════════════════════════════════════════════════════════ */
const SYMBOLS = ['●', '■', '▲', '◆', '✚', '★', '▼', '✖'];

/* ═══════════════════════════════════════════════════════════════════════════
   Helper — fires dual-cannon confetti burst via canvas-confetti
   ═══════════════════════════════════════════════════════════════════════════ */
function fireConfetti() {
  const count = 200;
  function fire(particleRatio, opts) {
    // Left cannon
    confetti(Object.assign({}, { origin: { x: 0, y: 0.7 }, angle: 60, ticks: 400, zIndex: 1001 }, opts, {
      particleCount: Math.floor(count * particleRatio),
    }));
    // Right cannon
    confetti(Object.assign({}, { origin: { x: 1, y: 0.7 }, angle: 120, ticks: 400, zIndex: 1001 }, opts, {
      particleCount: Math.floor(count * particleRatio),
    }));
  }
  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2,  { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1,  { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1,  { spread: 120, startVelocity: 45 });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Rain Overlay — subtle drizzle for the lose screen
   Drops are generated at module scope to satisfy react-hooks/purity.
   ═══════════════════════════════════════════════════════════════════════════ */
const RAIN_DROPS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  duration: `${0.5 + Math.random() * 0.6}s`,
  delay: `${Math.random() * 2}s`,
  height: `${12 + Math.random() * 18}px`,
  opacity: 0.15 + Math.random() * 0.2,
}));

function RainOverlay() {
  useEffect(() => {
    // Soft rain ambient sound via Web Audio API
    let ctx, src, gain;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const bufferSize = 2 * ctx.sampleRate; // 2 seconds of noise
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      // Bandpass filter to make it sound like rain (not harsh static)
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.5;

      gain = ctx.createGain();
      gain.gain.value = 0.06; // Very quiet

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch (_) {
      // Audio not supported — rain still plays visually
    }
    return () => {
      try { src?.stop(); ctx?.close(); } catch (_) { /* cleanup */ }
    };
  }, []);

  return (
    <div className="rain-overlay">
      {RAIN_DROPS.map((d) => (
        <div
          key={d.id}
          className="rain-drop"
          style={{
            left: d.left,
            height: d.height,
            opacity: d.opacity,
            animationDuration: d.duration,
            animationDelay: d.delay,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Timer Component — SVG arc with colour-shift urgency
   ═══════════════════════════════════════════════════════════════════════════ */
function Timer({ totalSeconds, timeLeft, running }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const fraction = timeLeft / totalSeconds;
  const offset = circumference * (1 - fraction);

  // Colour urgency encoding
  let timerColor = 'var(--timer-safe)';
  if (fraction < 0.25) timerColor = 'var(--timer-danger)';
  else if (fraction < 0.5) timerColor = 'var(--timer-caution)';

  const isDanger = fraction < 0.25 && running;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="timer-container">
      <svg className="timer-svg" width="100" height="100" viewBox="0 0 100 100">
        <circle className="timer-bg" cx="50" cy="50" r={radius} />
        <circle
          className={`timer-arc${isDanger ? ' danger' : ''}`}
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ '--timer-color': timerColor, stroke: timerColor }}
        />
        {/* Centered text inside SVG */}
        <text
          x="50"
          y="54"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={timerColor}
          fontSize="16"
          fontWeight="700"
          fontFamily="'JetBrains Mono', monospace"
          transform="rotate(90, 50, 50)"
        >
          {minutes}:{seconds.toString().padStart(2, '0')}
        </text>
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Feedback Pips for a submitted row
   ═══════════════════════════════════════════════════════════════════════════ */
function FeedbackPips({ exact, partial, totalSlots }) {
  const cols = Math.ceil(totalSlots / 2);
  const pips = [];
  for (let i = 0; i < exact; i++)
    pips.push(<div key={`e${i}`} className="feedback-pip exact peg-feedback-pip" style={{ '--anim-delay': i }} />);
  for (let i = 0; i < partial; i++)
    pips.push(<div key={`p${i}`} className="feedback-pip partial peg-feedback-pip" style={{ '--anim-delay': exact + i }} />);
  // Fill remaining with empty
  for (let i = exact + partial; i < totalSlots; i++)
    pips.push(<div key={`n${i}`} className="feedback-pip peg-feedback-pip" style={{ '--anim-delay': i }} />);

  return (
    <div className="feedback-container" style={{ '--fb-cols': cols }}>
      {pips}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Leaderboard Modal
   ═══════════════════════════════════════════════════════════════════════════ */
function LeaderboardModal({ onClose }) {
  const [tab, setTab] = useState('easy');
  const entries = getLeaderboard(tab);

  return (
    <div className="leaderboard-overlay" onClick={onClose}>
      <div className="leaderboard-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="lb-title">🏆 Leaderboard</h2>
        <div className="lb-tabs">
          {Object.keys(DIFFICULTIES).map((key) => (
            <button
              key={key}
              className={`lb-tab${tab === key ? ' active' : ''}`}
              onClick={() => setTab(key)}
            >
              {DIFFICULTIES[key].label}
            </button>
          ))}
        </div>

        {entries.length === 0 ? (
          <p className="lb-empty">No scores yet. Be the first!</p>
        ) : (
          <table className="lb-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Score</th>
                <th>Guesses</th>
                <th>Time Left</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i}>
                  <td className="lb-rank">{i + 1}</td>
                  <td>{e.name}</td>
                  <td className="mono" style={{ color: 'var(--accent-1)', fontWeight: 'bold' }}>{e.score !== undefined ? e.score : '-'}</td>
                  <td className="mono">{e.guesses}</td>
                  <td className="mono">{e.timeRemaining}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button className="lb-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Game Over Overlay
   ═══════════════════════════════════════════════════════════════════════════ */
function GameOverOverlay({ won, secret, guessCount, timeLeft, difficulty, hintsUsed, symbolMode, onPlayAgain, onMenu }) {
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  // Fire confetti on win
  useEffect(() => {
    if (won) fireConfetti();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    if (!name.trim()) return;
    addScore(difficulty, name.trim(), guessCount, timeLeft, won);
    setSaved(true);
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timeString = `${mins} minute${mins !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}`;
  const score = calculateScore(won, difficulty, guessCount, timeLeft, hintsUsed);

  return (
    <>
      <div className={`game-over-overlay${won ? '' : ' lose'}`}>
        {!won && <RainOverlay />}
        <div className={`game-over-card${won ? ' win' : ' lose'}`}>
          <div className="game-over-emoji">{won ? '🎉' : '😔'}</div>
          <h2 className="game-over-title">{won ? 'Brilliant!' : 'Game Over'}</h2>
          <p className="game-over-sub">
            {won
              ? `You cracked the code in ${guessCount} guess${guessCount > 1 ? 'es' : ''} with ${timeString} remaining!`
              : 'The secret code was:'}
          </p>

          <div className="game-over-score" style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '15px 0', color: won ? 'var(--accent-1)' : 'var(--text-muted)' }}>
            Score: {score}
            {hintsUsed > 0 && (
              <div style={{ fontSize: '.8rem', fontWeight: 'normal', color: 'var(--text-muted)', marginTop: 4 }}>
                💡 {hintsUsed} hint{hintsUsed > 1 ? 's' : ''} used (−{hintsUsed * 200} pts)
              </div>
            )}
          </div>

          {!won && (
            <div className="secret-reveal" style={{ marginBottom: 20 }}>
              {secret.map((colorId, i) => (
                <div
                  key={i}
                  className="secret-peg"
                  style={{ background: symbolMode ? 'var(--bg-card)' : COLOR_POOL[colorId].hex }}
                >
                  {symbolMode && SYMBOLS[colorId] && <span className="peg-symbol">{SYMBOLS[colorId]}</span>}
                </div>
              ))}
            </div>
          )}

          {won && !saved && (
            <div className="name-input-group">
              <input
                className="name-input"
                type="text"
                placeholder="Enter your name…"
                maxLength={16}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                autoFocus
              />
              <button className="name-save-btn" onClick={handleSave}>Save</button>
            </div>
          )}
          {saved && <p style={{ color: 'var(--accent-1)', marginBottom: 16, fontWeight: 600 }}>Score saved! 🎯</p>}

          <div className="action-btns">
            <button className="action-btn primary" onClick={onPlayAgain}>Play Again</button>
            <button className="action-btn" onClick={onMenu}>Main Menu</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  // ── Theme ────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => localStorage.getItem('mm_theme') || 'dark');
  const [symbolMode, setSymbolMode] = useState(() => localStorage.getItem('mm_symbols') === 'true');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mm_theme', theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem('mm_symbols', symbolMode);
  }, [symbolMode]);

  /** Renders a geometric symbol overlay on a peg when symbol mode is on */
  const sym = (colorId) => {
    if (!symbolMode || colorId < 0) return null;
    return <span className="peg-symbol">{SYMBOLS[colorId] || '?'}</span>;
  };

  /** Returns the peg background — neutral gray in symbol mode, colour otherwise */
  const pegBg = (hex) => symbolMode ? 'var(--bg-card)' : hex;

  // ── Views ────────────────────────────────────────────────────────────────
  const [view, setView] = useState('menu');           // 'menu' | 'playing' | 'over' | 'challenge-create'
  const [difficulty, setDifficulty] = useState(null);  // 'easy' | 'medium' | 'hard'
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // ── Game State ─────────────────────────────────────────────────────────────
  const [secret, setSecret] = useState([]);
  const [guesses, setGuesses] = useState([]);          // [{ colors: number[], feedback: {exact, partial} | null }]
  const [currentGuess, setCurrentGuess] = useState([]); // number[] (length = slots, -1 = empty)
  const [gameResult, setGameResult] = useState(null);   // 'won' | 'lost' | null
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);

  // ── Hint State ─────────────────────────────────────────────────────────────
  const [hintsUsed, setHintsUsed] = useState(0);
  const [revealedHints, setRevealedHints] = useState(new Set()); // slot indices revealed

  // ── Challenge Mode State ────────────────────────────────────────────────
  const [challengeDiff, setChallengeDiff] = useState('easy');
  const [challengeCode, setChallengeCode] = useState([]);
  const [challengeLink, setChallengeLink] = useState('');
  const [isChallenge, setIsChallenge] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [challengeActiveSlot, setChallengeActiveSlot] = useState(0);

  // ── Drag State ──────────────────────────────────────────────────────────
  const [dragOverSlot, setDragOverSlot] = useState(-1);

  // ── Config shorthand ────────────────────────────────────────────────────
  const config = difficulty ? DIFFICULTIES[difficulty] : null;
  const activeColors = difficulty ? getColorsForDifficulty(difficulty) : [];

  // ── Challenge Encode / Decode ───────────────────────────────────────────
  const encodeChallenge = (diff, code) => {
    const data = JSON.stringify({ d: diff, s: code });
    return btoa(data);
  };

  const decodeChallenge = (hash) => {
    try {
      const data = JSON.parse(atob(hash));
      if (data.d && Array.isArray(data.s) && DIFFICULTIES[data.d]) {
        return { difficulty: data.d, secret: data.s };
      }
    } catch (_) { /* invalid hash */ }
    return null;
  };

  // ── Detect challenge hash on load ───────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash.replace('#challenge=', '');
    if (hash && hash !== window.location.hash) {
      const challenge = decodeChallenge(hash);
      if (challenge) {
        const cfg = DIFFICULTIES[challenge.difficulty];
        setIsChallenge(true);
        setDifficulty(challenge.difficulty);
        setSecret(challenge.secret);
        setGuesses([]);
        setCurrentGuess(new Array(cfg.slots).fill(-1));
        setGameResult(null);
        setTimeLeft(cfg.timerSeconds);
        setHintsUsed(0);
        setRevealedHints(new Set());
        setView('playing');
        // Clean the URL hash so refreshing doesn't restart
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start Game ──────────────────────────────────────────────────────────
  const startGame = useCallback((diff) => {
    const cfg = DIFFICULTIES[diff];
    setIsChallenge(false);
    setDifficulty(diff);
    setSecret(generateSecret(diff));
    setGuesses([]);
    setCurrentGuess(new Array(cfg.slots).fill(-1));
    setGameResult(null);
    setTimeLeft(cfg.timerSeconds);
    setHintsUsed(0);
    setRevealedHints(new Set());
    setView('playing');
  }, []);

  // ── Start Challenge Creation ────────────────────────────────────────────
  const startChallengeCreate = () => {
    setChallengeDiff('easy');
    setChallengeCode(new Array(DIFFICULTIES.easy.slots).fill(-1));
    setChallengeLink('');
    setLinkCopied(false);
    setChallengeActiveSlot(0);
    setView('challenge-create');
  };

  const generateChallengeLink = () => {
    if (challengeCode.includes(-1)) return;
    const encoded = encodeChallenge(challengeDiff, challengeCode);
    const url = `${window.location.origin}${window.location.pathname}#challenge=${encoded}`;
    setChallengeLink(url);
    setLinkCopied(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(challengeLink);
      setLinkCopied(true);
    } catch (_) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = challengeLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setLinkCopied(true);
    }
  };

  // ── Timer Tick ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'playing' || gameResult) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setGameResult('lost');
          setView('over');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [view, gameResult]);

  // ── Slot Interaction ────────────────────────────────────────────────────
  const cycleColor = (slotIndex) => {
    if (view !== 'playing' || gameResult) return;
    setCurrentGuess((prev) => {
      const next = [...prev];
      const numColors = config.colors;
      next[slotIndex] = (next[slotIndex] + 1) % numColors;
      // If was -1 (empty), start at 0
      if (prev[slotIndex] === -1) next[slotIndex] = 0;
      return next;
    });
  };

  const setSlotColor = (slotIndex, colorId) => {
    if (view !== 'playing' || gameResult) return;
    setCurrentGuess((prev) => {
      const next = [...prev];
      next[slotIndex] = colorId;
      return next;
    });
  };

  // ── Drag Handlers ──────────────────────────────────────────────────────
  const handleDragStart = (e, colorId) => {
    e.dataTransfer.setData('colorId', colorId.toString());
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e, slotIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverSlot(slotIndex);
  };

  const handleDragLeave = () => setDragOverSlot(-1);

  const handleDrop = (e, slotIndex) => {
    e.preventDefault();
    setDragOverSlot(-1);
    const colorId = parseInt(e.dataTransfer.getData('colorId'), 10);
    if (!isNaN(colorId)) setSlotColor(slotIndex, colorId);
  };

  // ── Submit Guess ────────────────────────────────────────────────────────
  const submitGuess = () => {
    if (currentGuess.includes(-1)) return; // not all slots filled

    const feedback = evaluateGuess(currentGuess, secret);
    const newGuesses = [...guesses, { colors: [...currentGuess], feedback }];
    setGuesses(newGuesses);

    if (feedback.exact === config.slots) {
      // WIN
      clearInterval(timerRef.current);
      setGameResult('won');
      setView('over');
    } else if (newGuesses.length >= config.maxGuesses) {
      // LOSS — used all guesses
      clearInterval(timerRef.current);
      setGameResult('lost');
      setView('over');
    } else {
      // Next guess — pre-fill any revealed hint positions
      const nextGuess = new Array(config.slots).fill(-1);
      revealedHints.forEach((idx) => {
        nextGuess[idx] = secret[idx];
      });
      setCurrentGuess(nextGuess);
    }
  };

  // ── Hint Handler ───────────────────────────────────────────────────────
  const useHint = () => {
    if (view !== 'playing' || gameResult || hintsUsed >= 3) return;
    // Find slot indices not yet revealed
    const unrevealed = [];
    for (let i = 0; i < config.slots; i++) {
      if (!revealedHints.has(i)) unrevealed.push(i);
    }
    if (unrevealed.length <= 1) return; // Can't reveal the last slot (must guess at least one)

    // Pick a random unrevealed slot
    const idx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    const newRevealed = new Set(revealedHints);
    newRevealed.add(idx);
    setRevealedHints(newRevealed);
    setHintsUsed((h) => h + 1);

    // Fill that slot with the correct colour
    setCurrentGuess((prev) => {
      const next = [...prev];
      next[idx] = secret[idx];
      return next;
    });
  };

  const hintsAvailable = config ? Math.min(3, config.slots - 1) - hintsUsed : 0;

  // ── Render Helpers ──────────────────────────────────────────────────────
  const allSlotsFilled = currentGuess.every((c) => c !== -1);

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER — MENU
     ═══════════════════════════════════════════════════════════════════════ */
  const renderMenu = () => (
    <div className="menu-screen">
      <h1 className="menu-title">
        <span>Grep-Color</span>
      </h1>
      <p className="menu-subtitle">
        Crack the secret code. Choose your difficulty and prove your deduction skills against the clock.
      </p>
      <div className="difficulty-cards">
        {Object.entries(DIFFICULTIES).map(([key, cfg]) => (
          <div key={key} className="difficulty-card" onClick={() => startGame(key)}>
            <div className="diff-info">
              <div className="diff-label">{cfg.label}</div>
              <div className="diff-details">
                {cfg.colors} colours · {cfg.slots} slots · {cfg.maxGuesses} guesses · {cfg.timerSeconds}s
              </div>
            </div>
            <span className="diff-arrow">→</span>
          </div>
        ))}
      </div>
      <button
        className="action-btn"
        style={{ marginTop: 8 }}
        onClick={() => setShowLeaderboard(true)}
      >
        🏆 Leaderboard
      </button>
      <button
        className="action-btn challenge-create-btn"
        style={{ marginTop: 8 }}
        onClick={startChallengeCreate}
      >
        ⚔️ Challenge a Friend
      </button>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER — CHALLENGE CREATE
     ═══════════════════════════════════════════════════════════════════════ */
  const renderChallengeCreate = () => {
    const cfg = DIFFICULTIES[challengeDiff];
    const colors = getColorsForDifficulty(challengeDiff);
    const allSet = challengeCode.every((c) => c !== -1);

    return (
      <div className="challenge-create-screen">
        <h2 className="menu-title" style={{ fontSize: '1.6rem' }}>⚔️ Create a Challenge</h2>
        <p className="menu-subtitle" style={{ fontSize: '.9rem' }}>
          Set a secret code and share the link with a friend to challenge them!
        </p>

        {/* Difficulty Selector */}
        <div className="challenge-diff-selector">
          {Object.entries(DIFFICULTIES).map(([key, d]) => (
            <button
              key={key}
              className={`lb-tab${challengeDiff === key ? ' active' : ''}`}
              onClick={() => {
                setChallengeDiff(key);
                setChallengeCode(new Array(d.slots).fill(-1));
                setChallengeLink('');
                setLinkCopied(false);
              }}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Code Slots */}
        <p style={{ color: 'var(--text-muted)', fontSize: '.82rem', margin: '12px 0 8px' }}>
          Click a slot, then pick a colour below:
        </p>
        <div className="challenge-slots">
          {challengeCode.map((colorId, i) => (
            <div
              key={i}
              className={`peg-slot${colorId >= 0 ? ' filled' : ''}`}
              onClick={() => {
                setChallengeActiveSlot(i);
              }}
              style={{ cursor: 'pointer', outline: challengeActiveSlot === i ? '2px solid var(--accent-1)' : 'none' }}
            >
              <div
                className="peg-inner"
                style={colorId >= 0 ? { background: pegBg(COLOR_POOL[colorId].hex) } : {}}
              >{sym(colorId)}</div>
            </div>
          ))}
        </div>

        {/* Colour Palette */}
        <div className="challenge-palette" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
          {colors.map((c) => (
            <div
              key={c.id}
              className="palette-swatch"
              onClick={() => {
                if (challengeActiveSlot === -1) return;
                setChallengeCode((prev) => {
                  const next = [...prev];
                  next[challengeActiveSlot] = c.id;
                  return next;
                });
                // Auto-advance to next empty slot
                setChallengeActiveSlot((prev) => {
                  const next = challengeCode.findIndex((v, idx) => idx > prev && v === -1);
                  return next !== -1 ? next : prev;
                });
                setChallengeLink('');
                setLinkCopied(false);
              }}
              style={{ background: pegBg(c.hex), '--swatch-glow': symbolMode ? 'transparent' : c.hex + '80' }}
              title={c.name}
            >
              {sym(c.id)}
            </div>
          ))}
        </div>

        {/* Generate Button */}
        <button
          className="submit-btn"
          disabled={!allSet}
          onClick={generateChallengeLink}
          style={{ marginTop: 20 }}
        >
          Generate Challenge Link
        </button>

        {/* Link Display */}
        {challengeLink && (
          <div className="challenge-link-box">
            <input
              type="text"
              readOnly
              value={challengeLink}
              className="challenge-link-input"
              onClick={(e) => e.target.select()}
            />
            <button className="action-btn" onClick={copyLink}>
              {linkCopied ? '✅ Copied!' : '📋 Copy'}
            </button>
          </div>
        )}

        <button
          className="action-btn"
          style={{ marginTop: 16, fontSize: '.78rem' }}
          onClick={() => setView('menu')}
        >
          ← Back to Menu
        </button>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER — GAME BOARD
     ═══════════════════════════════════════════════════════════════════════ */
  const renderGame = () => {
    const rows = [];

    // Past guesses
    for (let i = 0; i < guesses.length; i++) {
      const g = guesses[i];
      rows.push(
        <div key={`past-${i}`} className="guess-row past" style={{ animation: 'rowSlideIn .3s ease both', animationDelay: `${i * 0.05}s` }}>
          <span className="row-number">{i + 1}</span>
          <div className="row-slots">
            {g.colors.map((colorId, j) => (
              <div key={j} className="peg-slot filled">
                <div className="peg-inner" style={{ background: pegBg(COLOR_POOL[colorId].hex) }}>{sym(colorId)}</div>
              </div>
            ))}
          </div>
          {g.feedback && (
            <FeedbackPips exact={g.feedback.exact} partial={g.feedback.partial} totalSlots={config.slots} />
          )}
        </div>
      );
    }

    // Active row (current guess)
    if (!gameResult && guesses.length < config.maxGuesses) {
      rows.push(
        <div key="active" className="guess-row active">
          <span className="row-number">{guesses.length + 1}</span>
          <div className="row-slots">
            {currentGuess.map((colorId, j) => (
              <div
                key={j}
                className={`peg-slot active${colorId >= 0 ? ' filled' : ''}${dragOverSlot === j ? ' drag-over' : ''}`}
                onClick={() => cycleColor(j)}
                onDragOver={(e) => handleDragOver(e, j)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, j)}
              >
                <div
                  className="peg-inner"
                  style={colorId >= 0 ? { background: pegBg(COLOR_POOL[colorId].hex) } : {}}
                >{sym(colorId)}</div>
              </div>
            ))}
          </div>
          {/* Placeholder for feedback column alignment */}
          <div className="feedback-container" style={{ '--fb-cols': Math.ceil(config.slots / 2), visibility: 'hidden' }}>
            {Array.from({ length: config.slots }).map((_, i) => (
              <div key={i} className="feedback-pip" />
            ))}
          </div>
        </div>
      );
    }

    // Future rows
    for (let i = guesses.length + 1; i < config.maxGuesses; i++) {
      rows.push(
        <div key={`future-${i}`} className="guess-row future">
          <span className="row-number">{i + 1}</span>
          <div className="row-slots">
            {Array.from({ length: config.slots }).map((_, j) => (
              <div key={j} className="peg-slot">
                <div className="peg-inner" />
              </div>
            ))}
          </div>
          <div className="feedback-container" style={{ '--fb-cols': Math.ceil(config.slots / 2), visibility: 'hidden' }}>
            {Array.from({ length: config.slots }).map((_, i) => (
              <div key={i} className="feedback-pip" />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="game-layout">
        {/* Sidebar: Timer + Palette */}
        <div className="game-sidebar">
          <Timer totalSeconds={config.timerSeconds} timeLeft={timeLeft} running={!gameResult} />

          <div className="color-palette" style={{ '--palette-cols': activeColors.length / 2 }}>
            <div className="palette-title">Colours</div>
            {activeColors.map((c) => (
              <div
                key={c.id}
                className="palette-swatch"
                draggable
                onDragStart={(e) => handleDragStart(e, c.id)}
                onClick={() => {
                  // Quick-fill: find first empty slot and set it
                  const emptyIdx = currentGuess.indexOf(-1);
                  if (emptyIdx !== -1) setSlotColor(emptyIdx, c.id);
                }}
                style={{ background: pegBg(c.hex), '--swatch-glow': symbolMode ? 'transparent' : c.hex + '80' }}
                title={c.name}
              >
                {sym(c.id)}
              </div>
            ))}
          </div>

          <button
            className="submit-btn"
            disabled={!allSlotsFilled}
            onClick={submitGuess}
          >
            Submit Guess
          </button>

          <button
            className="hint-btn"
            disabled={hintsAvailable <= 0 || !!gameResult}
            onClick={useHint}
            title={`Reveal a correct position (-200 pts). ${hintsAvailable} left`}
          >
            💡 Hint ({hintsAvailable})
          </button>

          <button
            className="action-btn"
            onClick={() => {
              clearInterval(timerRef.current);
              setView('menu');
              setGameResult(null);
            }}
            style={{ fontSize: '.78rem', padding: '7px 18px' }}
          >
            ← Back
          </button>
        </div>

        {/* Board */}
        <div className="game-board">
          <div className="board-header">
            <span className="board-header-label">{DIFFICULTIES[difficulty].label} Mode</span>
            <span className="guess-counter">
              Guess <span>{gameResult ? guesses.length : Math.min(guesses.length + 1, config.maxGuesses)}</span> / {config.maxGuesses}
            </span>
          </div>
          {rows}
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER — MAIN
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="app-wrapper">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">Grep-Color</h1>
        <div className="header-controls">
          <button
            className="icon-btn"
            title="Leaderboard"
            onClick={() => setShowLeaderboard(true)}
          >
            🏆
          </button>
          <button
            className={`icon-btn${symbolMode ? ' active' : ''}`}
            title={symbolMode ? 'Disable symbol overlay' : 'Enable symbol overlay (accessibility)'}
            onClick={() => setSymbolMode((s) => !s)}
            aria-label="Toggle symbol overlay"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-15.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zM19 9h-4.25v10h-1.5v-5h-2.5v5h-1.5V9H5V7h14v2z"/>
            </svg>
          </button>
          {/* Theme toggle: hidden checkbox + label — cross-browser reliable */}
          <input
            id="theme-toggle-cb"
            type="checkbox"
            className="theme-toggle-input"
            checked={theme === 'light'}
            onChange={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label="Toggle light/dark theme"
          />
          <label
            htmlFor="theme-toggle-cb"
            className="theme-toggle-label"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span className="theme-toggle-thumb">
              {theme === 'dark' ? '🌙' : '☀️'}
            </span>
          </label>
        </div>
      </header>

      {/* Content */}
      <main className="app-content">
        {view === 'menu' && renderMenu()}
        {view === 'challenge-create' && renderChallengeCreate()}
        {(view === 'playing' || view === 'over') && config && renderGame()}
      </main>

      {/* Game Over Overlay */}
      {view === 'over' && (
        <GameOverOverlay
          won={gameResult === 'won'}
          secret={secret}
          guessCount={guesses.length}
          timeLeft={timeLeft}
          difficulty={difficulty}
          hintsUsed={hintsUsed}
          symbolMode={symbolMode}
          onPlayAgain={() => startGame(difficulty)}
          onMenu={() => { setView('menu'); setGameResult(null); }}
        />
      )}

      {/* Leaderboard Overlay */}
      {showLeaderboard && <LeaderboardModal onClose={() => setShowLeaderboard(false)} />}
    </div>
  );
}
