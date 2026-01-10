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

export type CategoryColor = { bg: string; text: string; border: string; dot: string };

export const CATEGORY_COLORS: Record<string, CategoryColor> = {
  Work: { bg: 'bg-blue-500/20', text: 'text-blue-600', border: 'border-blue-500/30', dot: 'bg-blue-500' },
  Personal: { bg: 'bg-purple-500/20', text: 'text-purple-600', border: 'border-purple-500/30', dot: 'bg-purple-500' },
  Reports: { bg: 'bg-amber-500/20', text: 'text-amber-600', border: 'border-amber-500/30', dot: 'bg-amber-500' },
  Team: { bg: 'bg-green-500/20', text: 'text-green-600', border: 'border-green-500/30', dot: 'bg-green-500' },
  Uncategorized: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-muted', dot: 'bg-muted-foreground' },
};

export const CUSTOM_CATEGORY_COLORS: Record<string, CategoryColor> = {
  Rose: { bg: 'bg-rose-500/20', text: 'text-rose-600', border: 'border-rose-500/30', dot: 'bg-rose-500' },
  Cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-600', border: 'border-cyan-500/30', dot: 'bg-cyan-500' },
  Orange: { bg: 'bg-orange-500/20', text: 'text-orange-600', border: 'border-orange-500/30', dot: 'bg-orange-500' },
  Indigo: { bg: 'bg-indigo-500/20', text: 'text-indigo-600', border: 'border-indigo-500/30', dot: 'bg-indigo-500' },
  Teal: { bg: 'bg-teal-500/20', text: 'text-teal-600', border: 'border-teal-500/30', dot: 'bg-teal-500' },
  Pink: { bg: 'bg-pink-500/20', text: 'text-pink-600', border: 'border-pink-500/30', dot: 'bg-pink-500' },
  Lime: { bg: 'bg-lime-500/20', text: 'text-lime-600', border: 'border-lime-500/30', dot: 'bg-lime-500' },
  Fuchsia: { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-600', border: 'border-fuchsia-500/30', dot: 'bg-fuchsia-500' },
  Red: { bg: 'bg-red-500/20', text: 'text-red-600', border: 'border-red-500/30', dot: 'bg-red-500' },
  Emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-600', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  Violet: { bg: 'bg-violet-500/20', text: 'text-violet-600', border: 'border-violet-500/30', dot: 'bg-violet-500' },
  Sky: { bg: 'bg-sky-500/20', text: 'text-sky-600', border: 'border-sky-500/30', dot: 'bg-sky-500' },
};

// Custom category with color
export interface CustomCategory {
  name: string;
  colorName: string;
}

const getCustomCategoriesFromStorage = (storageKey: string): CustomCategory[] => {
  try {
    const saved = localStorage.getItem(`${storageKey}-categories`);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    // Handle migration from old format (string[]) to new format (CustomCategory[])
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
      const colorNames = Object.keys(CUSTOM_CATEGORY_COLORS);
      return parsed.map((name: string, index: number) => ({
        name,
        colorName: colorNames[index % colorNames.length],
      }));
    }
    return parsed;
  } catch {
    return [];
  }
};

const saveCustomCategoriesToStorage = (storageKey: string, categories: CustomCategory[]) => {
  localStorage.setItem(`${storageKey}-categories`, JSON.stringify(categories));
};

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

  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(() => 
    getCustomCategoriesFromStorage(storageKey)
  );

  const addCategory = useCallback((category: string, colorName: string = 'Rose') => {
    const trimmed = category.trim();
    if (!trimmed) return false;
    
    // Check if already exists in default or custom categories
    if (DEFAULT_CATEGORIES.includes(trimmed as any) || customCategories.some(c => c.name === trimmed)) {
      return false;
    }
    
    setCustomCategories(prev => {
      const updated = [...prev, { name: trimmed, colorName }];
      saveCustomCategoriesToStorage(storageKey, updated);
      return updated;
    });
    return true;
  }, [storageKey, customCategories]);

  const updateCategoryColor = useCallback((category: string, colorName: string) => {
    // Can't update default categories
    if (DEFAULT_CATEGORIES.includes(category as any)) {
      return false;
    }
    
    setCustomCategories(prev => {
      const updated = prev.map(c => c.name === category ? { ...c, colorName } : c);
      saveCustomCategoriesToStorage(storageKey, updated);
      return updated;
    });
    
    return true;
  }, [storageKey]);

  const deleteCategory = useCallback((category: string) => {
    // Can't delete default categories
    if (DEFAULT_CATEGORIES.includes(category as any)) {
      return false;
    }
    
    setCustomCategories(prev => {
      const updated = prev.filter(c => c.name !== category);
      saveCustomCategoriesToStorage(storageKey, updated);
      return updated;
    });
    
    // Update presets that had this category to be uncategorized
    setCustomPresets(prev => {
      const updated = prev.map(p => 
        p.category === category ? { ...p, category: undefined } : p
      );
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
    
    return true;
  }, [storageKey]);

  const renameCategory = useCallback((oldName: string, newName: string) => {
    const trimmedNew = newName.trim();
    if (!trimmedNew) return false;
    
    // Can't rename default categories
    if (DEFAULT_CATEGORIES.includes(oldName as any)) {
      return false;
    }
    
    // Check if new name already exists
    if (DEFAULT_CATEGORIES.includes(trimmedNew as any) || customCategories.some(c => c.name === trimmedNew)) {
      return false;
    }
    
    setCustomCategories(prev => {
      const updated = prev.map(c => c.name === oldName ? { ...c, name: trimmedNew } : c);
      saveCustomCategoriesToStorage(storageKey, updated);
      return updated;
    });
    
    // Update presets that had this category
    setCustomPresets(prev => {
      const updated = prev.map(p => 
        p.category === oldName ? { ...p, category: trimmedNew } : p
      );
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
    
    return true;
  }, [storageKey, customCategories]);

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
    const presetCategories = customPresets
      .map(p => p.category)
      .filter((c): c is string => Boolean(c));
    const customCategoryNames = customCategories.map(c => c.name);
    const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...customCategoryNames, ...presetCategories])];
    return allCategories.sort();
  }, [customPresets, customCategories]);

  const isDefaultCategory = useCallback((category: string): boolean => {
    return DEFAULT_CATEGORIES.includes(category as any);
  }, []);

  const getCategoryColor = useCallback((category: string): CategoryColor => {
    // Check if it's a default category
    if (category in CATEGORY_COLORS) {
      return CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS];
    }
    
    // For custom categories, use the stored color
    const customCat = customCategories.find(c => c.name === category);
    if (customCat && customCat.colorName in CUSTOM_CATEGORY_COLORS) {
      return CUSTOM_CATEGORY_COLORS[customCat.colorName];
    }
    
    // Fallback to uncategorized color
    return CATEGORY_COLORS.Uncategorized;
  }, [customCategories]);

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
    customCategories,
    addCategory,
    updateCategoryColor,
    deleteCategory,
    renameCategory,
    isDefaultCategory,
    getCategoryColor,
  };
}
