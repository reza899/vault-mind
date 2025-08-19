import { useState, useEffect, useCallback, useMemo } from 'react';

// Filter types
export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface SearchFilters {
  // File type filters
  fileTypes: string[];
  
  // Date range filters
  dateRange: DateRange;
  dateField: 'created' | 'modified' | 'indexed';
  
  // Path/folder filters
  includePaths: string[];
  excludePaths: string[];
  
  // Tag filters
  includeTags: string[];
  excludeTags: string[];
  
  // Size filters (in bytes)
  minSize: number | null;
  maxSize: number | null;
  
  // Similarity threshold
  similarityThreshold: number;
  
  // Logic operator
  logicOperator: 'AND' | 'OR';
  
  // Content filters
  hasImages: boolean | null;
  hasLinks: boolean | null;
  isEmpty: boolean | null;
}

export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filters: SearchFilters;
  createdAt: Date;
  lastUsed: Date;
}

interface UseSearchFiltersOptions {
  vaultName?: string;
  persistKey?: string;
  autoApply?: boolean;
}

interface UseSearchFiltersState {
  filters: SearchFilters;
  activeFiltersCount: number;
  presets: FilterPreset[];
  isLoading: boolean;
  error: string | null;
}

interface UseSearchFiltersActions {
  updateFilters: (updates: Partial<SearchFilters>) => void;
  resetFilters: () => void;
  clearFilters: () => void;
  savePreset: (name: string, description?: string) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
  exportFilters: () => string;
  importFilters: (filtersJson: string) => boolean;
}

const DEFAULT_FILTERS: SearchFilters = {
  fileTypes: [],
  dateRange: { from: null, to: null },
  dateField: 'modified',
  includePaths: [],
  excludePaths: [],
  includeTags: [],
  excludeTags: [],
  minSize: null,
  maxSize: null,
  similarityThreshold: 0.7,
  logicOperator: 'AND',
  hasImages: null,
  hasLinks: null,
  isEmpty: null,
};

const STORAGE_PREFIX = 'vault-mind-search-filters';

/**
 * Hook for managing search filters with persistence and presets
 */
export const useSearchFilters = (
  options: UseSearchFiltersOptions = {}
): [UseSearchFiltersState, UseSearchFiltersActions] => {
  const { vaultName, persistKey = 'default', autoApply = true } = options;
  
  const storageKey = `${STORAGE_PREFIX}-${persistKey}`;
  const presetsKey = `${STORAGE_PREFIX}-presets-${vaultName || 'global'}`;

  const [state, setState] = useState<UseSearchFiltersState>(() => ({
    filters: DEFAULT_FILTERS,
    activeFiltersCount: 0,
    presets: [],
    isLoading: true,
    error: null,
  }));

  // Calculate active filters count
  const activeFiltersCount = useMemo(() => {
    const filters = state.filters;
    let count = 0;

    if (filters.fileTypes.length > 0) count++;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    if (filters.includePaths.length > 0) count++;
    if (filters.excludePaths.length > 0) count++;
    if (filters.includeTags.length > 0) count++;
    if (filters.excludeTags.length > 0) count++;
    if (filters.minSize !== null || filters.maxSize !== null) count++;
    if (filters.similarityThreshold !== DEFAULT_FILTERS.similarityThreshold) count++;
    if (filters.hasImages !== null) count++;
    if (filters.hasLinks !== null) count++;
    if (filters.isEmpty !== null) count++;

    return count;
  }, [state.filters]);

  // Load filters and presets from localStorage
  useEffect(() => {
    try {
      // Load filters
      const savedFilters = localStorage.getItem(storageKey);
      let filters = DEFAULT_FILTERS;
      
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        filters = {
          ...DEFAULT_FILTERS,
          ...parsed,
          dateRange: {
            from: parsed.dateRange?.from ? new Date(parsed.dateRange.from) : null,
            to: parsed.dateRange?.to ? new Date(parsed.dateRange.to) : null,
          },
        };
      }

      // Load presets
      const savedPresets = localStorage.getItem(presetsKey);
      let presets: FilterPreset[] = [];
      
      if (savedPresets) {
        const parsed = JSON.parse(savedPresets);
        presets = parsed.map((preset: FilterPreset & { createdAt: string; lastUsed: string }) => ({
          ...preset,
          createdAt: new Date(preset.createdAt),
          lastUsed: new Date(preset.lastUsed),
          filters: {
            ...preset.filters,
            dateRange: {
              from: preset.filters.dateRange?.from ? new Date(preset.filters.dateRange.from) : null,
              to: preset.filters.dateRange?.to ? new Date(preset.filters.dateRange.to) : null,
            },
          },
        }));
      }

      setState(prev => ({
        ...prev,
        filters,
        presets,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to load search filters:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to load saved filters',
        isLoading: false,
      }));
    }
  }, [storageKey, presetsKey]);


  // Save filters to localStorage
  const saveFilters = useCallback((filters: SearchFilters) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch (error) {
      console.warn('Failed to save search filters:', error);
    }
  }, [storageKey]);

  // Save presets to localStorage
  const savePresets = useCallback((presets: FilterPreset[]) => {
    try {
      localStorage.setItem(presetsKey, JSON.stringify(presets));
    } catch (error) {
      console.warn('Failed to save filter presets:', error);
    }
  }, [presetsKey]);

  const updateFilters = useCallback((updates: Partial<SearchFilters>) => {
    setState(prev => {
      const newFilters = { ...prev.filters, ...updates };
      
      if (autoApply) {
        saveFilters(newFilters);
      }
      
      return {
        ...prev,
        filters: newFilters,
        error: null,
      };
    });
  }, [autoApply, saveFilters]);

  const resetFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      filters: DEFAULT_FILTERS,
      error: null,
    }));
    
    if (autoApply) {
      saveFilters(DEFAULT_FILTERS);
    }
  }, [autoApply, saveFilters]);

  const clearFilters = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setState(prev => ({
        ...prev,
        filters: DEFAULT_FILTERS,
        error: null,
      }));
    } catch (error) {
      console.warn('Failed to clear search filters:', error);
    }
  }, [storageKey]);

  const savePreset = useCallback((name: string, description?: string) => {
    const preset: FilterPreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      filters: state.filters,
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    setState(prev => {
      const newPresets = [...prev.presets, preset];
      savePresets(newPresets);
      return {
        ...prev,
        presets: newPresets,
      };
    });
  }, [state.filters, savePresets]);

  const loadPreset = useCallback((presetId: string) => {
    const preset = state.presets.find(p => p.id === presetId);
    if (!preset) {
      setState(prev => ({
        ...prev,
        error: 'Preset not found',
      }));
      return;
    }

    // Update last used timestamp
    const updatedPresets = state.presets.map(p => 
      p.id === presetId ? { ...p, lastUsed: new Date() } : p
    );

    setState(prev => ({
      ...prev,
      filters: preset.filters,
      presets: updatedPresets,
      error: null,
    }));

    savePresets(updatedPresets);
    
    if (autoApply) {
      saveFilters(preset.filters);
    }
  }, [state.presets, savePresets, autoApply, saveFilters]);

  const deletePreset = useCallback((presetId: string) => {
    setState(prev => {
      const newPresets = prev.presets.filter(p => p.id !== presetId);
      savePresets(newPresets);
      return {
        ...prev,
        presets: newPresets,
      };
    });
  }, [savePresets]);

  const exportFilters = useCallback(() => {
    return JSON.stringify({
      filters: state.filters,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    }, null, 2);
  }, [state.filters]);

  const importFilters = useCallback((filtersJson: string): boolean => {
    try {
      const data = JSON.parse(filtersJson);
      
      if (!data.filters) {
        setState(prev => ({
          ...prev,
          error: 'Invalid filter export format',
        }));
        return false;
      }

      const importedFilters = {
        ...DEFAULT_FILTERS,
        ...data.filters,
        dateRange: {
          from: data.filters.dateRange?.from ? new Date(data.filters.dateRange.from) : null,
          to: data.filters.dateRange?.to ? new Date(data.filters.dateRange.to) : null,
        },
      };

      setState(prev => ({
        ...prev,
        filters: importedFilters,
        error: null,
      }));

      if (autoApply) {
        saveFilters(importedFilters);
      }

      return true;
    } catch {
      setState(prev => ({
        ...prev,
        error: 'Failed to import filters: Invalid JSON',
      }));
      return false;
    }
  }, [autoApply, saveFilters]);

  const actions: UseSearchFiltersActions = {
    updateFilters,
    resetFilters,
    clearFilters,
    savePreset,
    loadPreset,
    deletePreset,
    exportFilters,
    importFilters,
  };

  return [{ ...state, activeFiltersCount }, actions];
};

/**
 * Convert filters to search API parameters
 */
export const filtersToSearchParams = (filters: SearchFilters, vaultName?: string) => {
  const params: Record<string, unknown> = {};

  if (vaultName) {
    params.vault_name = vaultName;
  }

  if (filters.fileTypes.length > 0) {
    params.file_types = filters.fileTypes;
  }

  if (filters.dateRange.from || filters.dateRange.to) {
    params.date_range = {
      from: filters.dateRange.from?.toISOString(),
      to: filters.dateRange.to?.toISOString(),
      field: filters.dateField,
    };
  }

  if (filters.includePaths.length > 0) {
    params.include_paths = filters.includePaths;
  }

  if (filters.excludePaths.length > 0) {
    params.exclude_paths = filters.excludePaths;
  }

  if (filters.includeTags.length > 0) {
    params.include_tags = filters.includeTags;
  }

  if (filters.excludeTags.length > 0) {
    params.exclude_tags = filters.excludeTags;
  }

  if (filters.minSize !== null || filters.maxSize !== null) {
    params.size_range = {
      min: filters.minSize,
      max: filters.maxSize,
    };
  }

  if (filters.similarityThreshold !== DEFAULT_FILTERS.similarityThreshold) {
    params.similarity_threshold = filters.similarityThreshold;
  }

  params.logic_operator = filters.logicOperator;

  if (filters.hasImages !== null) {
    params.has_images = filters.hasImages;
  }

  if (filters.hasLinks !== null) {
    params.has_links = filters.hasLinks;
  }

  if (filters.isEmpty !== null) {
    params.is_empty = filters.isEmpty;
  }

  return params;
};

export default useSearchFilters;