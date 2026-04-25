import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import {
  DIFFICULTIES,
  COLOR_POOL,
  getColorsForDifficulty,
  generateSecret,
  evaluateGuess,
  addScore,
  getLeaderboard,
} from './logic/engine';

/* ═══════════════════════════════════════════════════════════════════════════
   Helper — Confetti pieces for win celebration
   Random values are computed at module scope (once on load) so they are
   never called during a render cycle, satisfying react-hooks/purity.
   ═══════════════════════════════════════════════════════════════════════════ */
const CONFETTI_COLORS = ['#E63946', '#F77F00', '#FCBF49', '#2A9D8F', '#219EBC', '#E76F51'];

const CONFETTI_PIECES = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  fallX: `${Math.random() * 100}%`,
  fallDuration: `${2 + Math.random() * 3}s`,
  fallDelay: `${Math.random() * 1.5}s`,
  background: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
  width: `${6 + Math.random() * 8}px`,
  height: `${6 + Math.random() * 8}px`,
  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
}));

function Confetti() {
  return (
    <div className="confetti-container">
      {CONFETTI_PIECES.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            '--fall-x': p.fallX,
            '--fall-duration': p.fallDuration,
            '--fall-delay': p.fallDelay,
            background: p.background,
            width: p.width,
            height: p.height,
            borderRadius: p.borderRadius,
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
                <th>Guesses</th>
                <th>Time Left</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i}>
                  <td className="lb-rank">{i + 1}</td>
                  <td>{e.name}</td>
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
function GameOverOverlay({ won, secret, guessCount, timeLeft, difficulty, onPlayAgain, onMenu }) {
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!name.trim()) return;
    addScore(difficulty, name.trim(), guessCount, timeLeft);
    setSaved(true);
  };

  return (
    <>
      {won && <Confetti />}
      <div className="game-over-overlay">
        <div className={`game-over-card${won ? ' win' : ''}`}>
          <div className="game-over-emoji">{won ? '🎉' : '😔'}</div>
          <h2 className="game-over-title">{won ? 'Brilliant!' : 'Game Over'}</h2>
          <p className="game-over-sub">
            {won
              ? `You cracked the code in ${guessCount} guess${guessCount > 1 ? 'es' : ''} with ${timeLeft}s remaining!`
              : 'The secret code was:'}
          </p>

          {!won && (
            <div className="secret-reveal" style={{ marginBottom: 20 }}>
              {secret.map((colorId, i) => (
                <div
                  key={i}
                  className="secret-peg"
                  style={{ background: COLOR_POOL[colorId].hex }}
                />
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
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mm_theme', theme);
  }, [theme]);

  // ── Views ────────────────────────────────────────────────────────────────
  const [view, setView] = useState('menu');           // 'menu' | 'playing' | 'over'
  const [difficulty, setDifficulty] = useState(null);  // 'easy' | 'medium' | 'hard'
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // ── Game State ───────────────────────────────────────────────────────────
  const [secret, setSecret] = useState([]);
  const [guesses, setGuesses] = useState([]);          // [{ colors: number[], feedback: {exact, partial} | null }]
  const [currentGuess, setCurrentGuess] = useState([]); // number[] (length = slots, -1 = empty)
  const [gameResult, setGameResult] = useState(null);   // 'won' | 'lost' | null
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);

  // ── Drag State ──────────────────────────────────────────────────────────
  const [dragOverSlot, setDragOverSlot] = useState(-1);

  // ── Config shorthand ────────────────────────────────────────────────────
  const config = difficulty ? DIFFICULTIES[difficulty] : null;
  const activeColors = difficulty ? getColorsForDifficulty(difficulty) : [];

  // ── Start Game ──────────────────────────────────────────────────────────
  const startGame = useCallback((diff) => {
    const cfg = DIFFICULTIES[diff];
    setDifficulty(diff);
    setSecret(generateSecret(diff));
    setGuesses([]);
    setCurrentGuess(new Array(cfg.slots).fill(-1));
    setGameResult(null);
    setTimeLeft(cfg.timerSeconds);
    setView('playing');
  }, []);

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
      // Next guess
      setCurrentGuess(new Array(config.slots).fill(-1));
    }
  };

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
    </div>
  );

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
                <div className="peg-inner" style={{ background: COLOR_POOL[colorId].hex }} />
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
                  style={colorId >= 0 ? { background: COLOR_POOL[colorId].hex } : {}}
                />
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

          <div className="color-palette">
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
                style={{ background: c.hex, '--swatch-glow': c.hex + '80' }}
                title={c.name}
              />
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
            className={`theme-toggle${theme === 'light' ? ' light' : ''}`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label="Toggle theme"
          />
        </div>
      </header>

      {/* Content */}
      <main className="app-content">
        {view === 'menu' && renderMenu()}
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
          onPlayAgain={() => startGame(difficulty)}
          onMenu={() => { setView('menu'); setGameResult(null); }}
        />
      )}

      {/* Leaderboard Overlay */}
      {showLeaderboard && <LeaderboardModal onClose={() => setShowLeaderboard(false)} />}
    </div>
  );
}
