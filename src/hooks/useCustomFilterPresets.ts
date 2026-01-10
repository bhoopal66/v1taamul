import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

export interface CustomPreset {
  id: string;
  name: string;
  timePeriod: string;
  leadStatus: string;
  createdAt: number;
  useCount?: number;
  lastUsedAt?: number;
  category?: string;
}

export interface PresetAnalytics {
  id: string;
  name: string;
  useCount: number;
  lastUsedAt: number | null;
  usagePercentage: number;
}

export interface ExportedPresets {
  version: 1;
  exportedAt: string;
  presets: CustomPreset[];
}

export const DEFAULT_CATEGORIES = ['Work', 'Personal', 'Reports', 'Team'] as const;

// URL-safe base64 encoding/decoding
const encodePresets = (presets: CustomPreset[]): string => {
  const data = JSON.stringify(presets.map(p => ({
    n: p.name,
    t: p.timePeriod,
    l: p.leadStatus,
    c: p.category,
  })));
  return btoa(encodeURIComponent(data));
};

const decodePresets = (encoded: string): Partial<CustomPreset>[] | null => {
  try {
    const data = JSON.parse(decodeURIComponent(atob(encoded)));
    if (!Array.isArray(data)) return null;
    return data.map((p: any) => ({
      name: p.n,
      timePeriod: p.t,
      leadStatus: p.l,
      category: p.c,
    }));
  } catch {
    return null;
  }
};

export function useCustomFilterPresets(storageKey: string) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Check for shared presets in URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedPresets = urlParams.get('presets');
    
    if (sharedPresets) {
      const decoded = decodePresets(sharedPresets);
      if (decoded && decoded.length > 0) {
        // Store in sessionStorage to be handled by the component
        sessionStorage.setItem('pending-shared-presets', JSON.stringify(decoded));
      }
      
      // Clean up URL without reload
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  const savePreset = useCallback((name: string, timePeriod: string, leadStatus: string, category?: string) => {
    const newPreset: CustomPreset = {
      id: `custom-${Date.now()}`,
      name,
      timePeriod,
      leadStatus,
      createdAt: Date.now(),
      category,
    };
    
    setCustomPresets(prev => {
      const updated = [...prev, newPreset];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
    
    return newPreset;
  }, [storageKey]);

  const getCategories = useMemo(() => {
    const customCategories = customPresets
      .map(p => p.category)
      .filter((c): c is string => Boolean(c));
    const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...customCategories])];
    return allCategories.sort();
  }, [customPresets]);

  const getPresetsByCategory = useMemo(() => {
    const grouped: Record<string, CustomPreset[]> = { 'Uncategorized': [] };
    
    customPresets.forEach(preset => {
      const category = preset.category || 'Uncategorized';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(preset);
    });
    
    // Remove empty Uncategorized if all presets have categories
    if (grouped['Uncategorized'].length === 0) {
      delete grouped['Uncategorized'];
    }
    
    return grouped;
  }, [customPresets]);

  const deletePreset = useCallback((id: string) => {
    setCustomPresets(prev => {
      const updated = prev.filter(p => p.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  }, [storageKey]);

  const updatePreset = useCallback((id: string, updates: Partial<Omit<CustomPreset, 'id' | 'createdAt'>>) => {
    setCustomPresets(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...updates } : p);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  }, [storageKey]);

  const trackPresetUsage = useCallback((id: string) => {
    setCustomPresets(prev => {
      const updated = prev.map(p => {
        if (p.id === id) {
          return {
            ...p,
            useCount: (p.useCount || 0) + 1,
            lastUsedAt: Date.now(),
          };
        }
        return p;
      });
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  }, [storageKey]);

  const getPresetAnalytics = useCallback((): PresetAnalytics[] => {
    const totalUsage = customPresets.reduce((sum, p) => sum + (p.useCount || 0), 0);
    
    return customPresets
      .map(p => ({
        id: p.id,
        name: p.name,
        useCount: p.useCount || 0,
        lastUsedAt: p.lastUsedAt || null,
        usagePercentage: totalUsage > 0 ? Math.round(((p.useCount || 0) / totalUsage) * 100) : 0,
      }))
      .sort((a, b) => b.useCount - a.useCount);
  }, [customPresets]);

  const getMostUsedPreset = useCallback((): CustomPreset | null => {
    if (customPresets.length === 0) return null;
    return customPresets.reduce((max, p) => 
      (p.useCount || 0) > (max.useCount || 0) ? p : max
    , customPresets[0]);
  }, [customPresets]);

  const resetUsageStats = useCallback(() => {
    setCustomPresets(prev => {
      const updated = prev.map(p => ({
        ...p,
        useCount: 0,
        lastUsedAt: undefined,
      }));
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  }, [storageKey]);

  const exportPresets = useCallback(() => {
    const exportData: ExportedPresets = {
      version: 1,
      exportedAt: new Date().toISOString(),
      presets: customPresets,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filter-presets-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [customPresets]);

  const importPresets = useCallback((file: File): Promise<{ imported: number; skipped: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          
          // Validate the import data
          if (!data.presets || !Array.isArray(data.presets)) {
            reject(new Error('Invalid preset file format'));
            return;
          }
          
          let imported = 0;
          let skipped = 0;
          
          const validPresets: CustomPreset[] = data.presets.filter((preset: any) => {
            if (!preset.name || !preset.timePeriod || !preset.leadStatus) {
              skipped++;
              return false;
            }
            return true;
          }).map((preset: any) => ({
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: preset.name,
            timePeriod: preset.timePeriod,
            leadStatus: preset.leadStatus,
            createdAt: Date.now(),
          }));
          
          imported = validPresets.length;
          
          if (validPresets.length > 0) {
            setCustomPresets(prev => {
              const updated = [...prev, ...validPresets];
              localStorage.setItem(storageKey, JSON.stringify(updated));
              return updated;
            });
          }
          
          resolve({ imported, skipped });
        } catch (error) {
          reject(new Error('Failed to parse preset file'));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }, [storageKey]);

  const importFromData = useCallback((presetData: Partial<CustomPreset>[]): { imported: number; skipped: number } => {
    let imported = 0;
    let skipped = 0;
    
    const validPresets: CustomPreset[] = presetData.filter((preset) => {
      if (!preset.name || !preset.timePeriod || !preset.leadStatus) {
        skipped++;
        return false;
      }
      return true;
    }).map((preset) => ({
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: preset.name!,
      timePeriod: preset.timePeriod!,
      leadStatus: preset.leadStatus!,
      createdAt: Date.now(),
      category: preset.category,
    }));
    
    imported = validPresets.length;
    
    if (validPresets.length > 0) {
      setCustomPresets(prev => {
        const updated = [...prev, ...validPresets];
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      });
    }
    
    return { imported, skipped };
  }, [storageKey]);

  const generateShareLink = useCallback((basePath: string): string => {
    if (customPresets.length === 0) return '';
    
    const encoded = encodePresets(customPresets);
    const baseUrl = window.location.origin;
    return `${baseUrl}${basePath}?presets=${encoded}`;
  }, [customPresets]);

  const clearAllPresets = useCallback(() => {
    setCustomPresets([]);
    localStorage.setItem(storageKey, JSON.stringify([]));
  }, [storageKey]);

  const getPendingSharedPresets = useCallback((): Partial<CustomPreset>[] | null => {
    const pending = sessionStorage.getItem('pending-shared-presets');
    if (pending) {
      sessionStorage.removeItem('pending-shared-presets');
      try {
        return JSON.parse(pending);
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  return {
    customPresets,
    savePreset,
    deletePreset,
    updatePreset,
    trackPresetUsage,
    getPresetAnalytics,
    getMostUsedPreset,
    resetUsageStats,
    exportPresets,
    importPresets,
    importFromData,
    generateShareLink,
    getPendingSharedPresets,
    clearAllPresets,
    fileInputRef,
    getCategories,
    getPresetsByCategory,
  };
}
