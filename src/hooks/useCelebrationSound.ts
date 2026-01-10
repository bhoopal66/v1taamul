// Celebration sound effects using Web Audio API
// Different sounds for different milestone rarities

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Audio context singleton
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
};

// Play a single note
const playNote = (
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  gain: number = 0.3,
  type: OscillatorType = 'sine'
) => {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);

  // Envelope: quick attack, sustain, smooth release
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.02);
  gainNode.gain.setValueAtTime(gain, startTime + duration * 0.7);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
};

// Simple chime for common badges
const playCommonSound = () => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  playNote(ctx, 523.25, now, 0.15, 0.2); // C5
  playNote(ctx, 659.25, now + 0.1, 0.2, 0.25); // E5
};

// Two-note ascending chime for uncommon
const playUncommonSound = () => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  playNote(ctx, 523.25, now, 0.15, 0.2); // C5
  playNote(ctx, 659.25, now + 0.1, 0.15, 0.25); // E5
  playNote(ctx, 783.99, now + 0.2, 0.25, 0.3); // G5
};

// Chord progression for rare
const playRareSound = () => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Major chord arpeggio
  playNote(ctx, 523.25, now, 0.2, 0.2); // C5
  playNote(ctx, 659.25, now + 0.1, 0.2, 0.25); // E5
  playNote(ctx, 783.99, now + 0.2, 0.2, 0.25); // G5
  playNote(ctx, 1046.5, now + 0.3, 0.35, 0.3); // C6
};

// Triumphant fanfare for epic
const playEpicSound = () => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Fanfare pattern
  playNote(ctx, 392.00, now, 0.15, 0.25); // G4
  playNote(ctx, 523.25, now + 0.12, 0.15, 0.25); // C5
  playNote(ctx, 659.25, now + 0.24, 0.15, 0.25); // E5
  playNote(ctx, 783.99, now + 0.36, 0.25, 0.3); // G5
  
  // Sustain chord
  playNote(ctx, 523.25, now + 0.5, 0.4, 0.2); // C5
  playNote(ctx, 659.25, now + 0.5, 0.4, 0.2); // E5
  playNote(ctx, 783.99, now + 0.5, 0.4, 0.25); // G5
};

// Majestic legendary sound with multiple layers
const playLegendarySound = () => {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // Opening flourish
  playNote(ctx, 261.63, now, 0.1, 0.2); // C4
  playNote(ctx, 329.63, now + 0.08, 0.1, 0.2); // E4
  playNote(ctx, 392.00, now + 0.16, 0.1, 0.2); // G4
  playNote(ctx, 523.25, now + 0.24, 0.1, 0.25); // C5
  playNote(ctx, 659.25, now + 0.32, 0.1, 0.25); // E5
  playNote(ctx, 783.99, now + 0.40, 0.15, 0.3); // G5
  playNote(ctx, 1046.5, now + 0.50, 0.2, 0.35); // C6
  
  // Triumphant sustained chord
  playNote(ctx, 523.25, now + 0.65, 0.5, 0.2, 'triangle'); // C5
  playNote(ctx, 659.25, now + 0.65, 0.5, 0.2, 'triangle'); // E5
  playNote(ctx, 783.99, now + 0.65, 0.5, 0.25, 'triangle'); // G5
  playNote(ctx, 1046.5, now + 0.65, 0.5, 0.3, 'triangle'); // C6
  
  // Sparkle effect
  playNote(ctx, 1318.5, now + 0.8, 0.15, 0.15); // E6
  playNote(ctx, 1568.0, now + 0.9, 0.15, 0.12); // G6
  playNote(ctx, 2093.0, now + 1.0, 0.2, 0.1); // C7
};

export const playCelebrationSound = (rarity: Rarity) => {
  try {
    // Resume audio context if suspended (browser autoplay policy)
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    switch (rarity) {
      case 'legendary':
        playLegendarySound();
        break;
      case 'epic':
        playEpicSound();
        break;
      case 'rare':
        playRareSound();
        break;
      case 'uncommon':
        playUncommonSound();
        break;
      case 'common':
      default:
        playCommonSound();
        break;
    }
  } catch (error) {
    console.warn('Could not play celebration sound:', error);
  }
};

// Hook to manage celebration sounds
export const useCelebrationSound = () => {
  const play = (rarity: Rarity) => {
    playCelebrationSound(rarity);
  };

  return { play };
};
