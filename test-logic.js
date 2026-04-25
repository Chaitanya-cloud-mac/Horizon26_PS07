import { evaluateGuess } from './src/logic/engine.js';

// Colors: 0: Red, 1: Orange, 2: Yellow, 3: Teal
// Guess 1: Orange, Orange, Orange, Teal -> [1, 1, 1, 3] -> 2 partial
// Guess 2: Red, Red, Yellow, Yellow -> [0, 0, 2, 2] -> 2 partial
// Guess 3: Orange, Yellow, Red, Teal -> [1, 2, 0, 3] -> 1 exact, 2 partial

const guess1 = [1, 1, 1, 3];
const guess2 = [0, 0, 2, 2];
const guess3 = [1, 2, 0, 3];

let validSecrets = 0;
for (let s0 = 0; s0 < 4; s0++) {
  for (let s1 = 0; s1 < 4; s1++) {
    for (let s2 = 0; s2 < 4; s2++) {
      for (let s3 = 0; s3 < 4; s3++) {
        const secret = [s0, s1, s2, s3];
        
        const r1 = evaluateGuess(guess1, secret);
        if (r1.exact !== 0 || r1.partial !== 2) continue;
        
        const r2 = evaluateGuess(guess2, secret);
        if (r2.exact !== 0 || r2.partial !== 2) continue;
        
        const r3 = evaluateGuess(guess3, secret);
        if (r3.exact !== 1 || r3.partial !== 2) continue;
        
        console.log('Valid secret found:', secret);
        validSecrets++;
      }
    }
  }
}

console.log('Total valid secrets:', validSecrets);
