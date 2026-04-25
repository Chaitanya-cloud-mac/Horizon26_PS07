# <span style="background: linear-gradient(to right, #3b82f6, #f59e0b, #ef4444); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Grep-Color</span>

**Grep-Color** is a highly-polished, cinematic Mastermind-style deduction game built with React and Vite. It combines classic logic puzzles with a modern, atmospheric aesthetic, featuring dynamic lighting, accessibility-first design, and asynchronous social play.

## 🌟 Key Features

### 🎮 Gameplay & Mechanics
- **Three Difficulty Tiers**: Easy (4 slots/4 colors), Medium (5 slots/6 colors), and Hard (6 slots/8 colors).
- **Intelligent Feedback**: A robust two-pass deduction engine correctly handles duplicate colors and partial matches.
- **Hint System**: Stuck? Reveal a correct position at the cost of -200 points. Capped at a maximum of 3 hints to maintain the challenge.
- **Local Leaderboard**: Track your best scores across different difficulties.

### 🎭 Cinematic Aesthetic
- **Valley of Light**: A dynamic background featuring animated vertical light bars that shift between fiery orange (Dark Mode) and azure blue (Light Mode).
- **Atmospheric Effects**: Experience high-energy confetti bursts on a win, and a somber rain overlay with ambient audio on a loss.
- **Multicolored Branding**: A logo that reflects the colors of the three difficulty modes.

### 👥 Social & Multiplayer
- **Challenge a Friend**: Create your own secret code and generate a unique URL hash. Send it to a friend to see if they can crack your specific code. No backend or database required!

### ♿ Accessibility First
- **Symbol-Overlay Mode**: Toggle the Universal Access icon to overlay distinct geometric patterns on pegs, making the game fully playable for colorblind users.
- **No-Color Mode**: When accessibility is active, colors are stripped away to leave high-contrast symbols as the sole identifiers, ensuring zero ambiguity.

## 🛠️ Technology Stack
- **Frontend**: React (Hooks, Context, Functional Components)
- **Build Tool**: Vite
- **Styling**: Vanilla CSS with custom properties (Glassmorphism & Dynamic Animations)
- **Audio**: Web Audio API for procedural rain sound synthesis
- **State Management**: LocalStorage for persistence (Leaderboard, Settings, Themes)

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- npm or yarn

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 📜 How to Play
1. **Choose a Difficulty**: Pick from Easy, Medium, or Hard.
2. **Make a Guess**: Drag colors into the slots or click a slot then a color.
3. **Analyze Feedback**: 
   - **Black Peg**: Correct color in the correct position.
   - **White Peg**: Correct color but in the wrong position.
4. **Crack the Code**: Use logic to narrow down the secret pattern before you run out of attempts!

---
*Built with passion for deduction and design.*
