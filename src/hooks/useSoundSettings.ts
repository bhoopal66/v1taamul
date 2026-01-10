import { useState, useEffect, useCallback } from 'react';

const SOUND_ENABLED_KEY = 'celebration_sounds_enabled';

// Get initial state from localStorage
const getInitialSoundEnabled = (): boolean => {
  try {
    const stored = localStorage.getItem(SOUND_ENABLED_KEY);
    if (stored !== null) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load sound settings:', e);
  }
  return true; // Default to enabled
};

// Singleton state for cross-component sync
let globalSoundEnabled = getInitialSoundEnabled();
const listeners = new Set<(enabled: boolean) => void>();

const notifyListeners = () => {
  listeners.forEach(listener => listener(globalSoundEnabled));
};

export const useSoundSettings = () => {
  const [soundEnabled, setSoundEnabledState] = useState(globalSoundEnabled);

  useEffect(() => {
    const listener = (enabled: boolean) => {
      setSoundEnabledState(enabled);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    globalSoundEnabled = enabled;
    try {
      localStorage.setItem(SOUND_ENABLED_KEY, JSON.stringify(enabled));
    } catch (e) {
      console.error('Failed to save sound settings:', e);
    }
    notifyListeners();
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled(!globalSoundEnabled);
  }, [setSoundEnabled]);

  return {
    soundEnabled,
    setSoundEnabled,
    toggleSound,
  };
};

// Utility function for checking sound state without hook
export const isSoundEnabled = (): boolean => {
  return globalSoundEnabled;
};
