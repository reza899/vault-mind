import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

interface SearchHistoryEntry {
  query: string;
  vaultName: string;
  timestamp: number;
  frequency?: number; // Track how many times this query was searched
  lastUsed?: number; // Track when this query was last used
}

interface SearchSuggestion {
  query: string;
  type: 'recent' | 'popular' | 'trending';
  frequency: number;
  lastUsed: number;
}

const STORAGE_KEY = 'vault-mind-search-history';
const FREQUENCY_STORAGE_KEY = 'vault-mind-search-frequency';
const MAX_HISTORY_SIZE = 50; // Increased for better suggestions
const MAX_SUGGESTIONS = 8; // Maximum suggestions to show

export const useSearchHistory = () => {
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [queryFrequency, setQueryFrequency] = useState<Record<string, number>>({});
  
  // Use refs to maintain stable references
  const historyRef = useRef(history);
  const queryFrequencyRef = useRef(queryFrequency);
  
  // Update refs when state changes
  historyRef.current = history;
  queryFrequencyRef.current = queryFrequency;

  // Load history and frequency data from localStorage on mount
  useEffect(() => {
    try {
      // Load search history
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SearchHistoryEntry[];
        // Validate and filter the data
        const validEntries = parsed.filter(
          entry => 
            typeof entry.query === 'string' && 
            typeof entry.vaultName === 'string' && 
            typeof entry.timestamp === 'number'
        );
        setHistory(validEntries.slice(0, MAX_HISTORY_SIZE));
      }

      // Load query frequency data
      const frequencyStored = localStorage.getItem(FREQUENCY_STORAGE_KEY);
      if (frequencyStored) {
        const parsed = JSON.parse(frequencyStored);
        if (typeof parsed === 'object' && parsed !== null) {
          setQueryFrequency(parsed);
        }
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
      // Clear corrupted data
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(FREQUENCY_STORAGE_KEY);
    }
  }, []);

  // Save history to localStorage whenever it changes
  const saveToStorage = useCallback((newHistory: SearchHistoryEntry[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }, []);

  // Save frequency data to localStorage
  const saveFrequencyToStorage = useCallback((frequency: Record<string, number>) => {
    try {
      localStorage.setItem(FREQUENCY_STORAGE_KEY, JSON.stringify(frequency));
    } catch (error) {
      console.warn('Failed to save search frequency:', error);
    }
  }, []);

  // Add a new search to history
  const addToHistory = useCallback((query: string, vaultName: string) => {
    if (!query.trim() || !vaultName.trim()) {
      return;
    }

    const normalizedQuery = query.trim();
    const normalizedVaultName = vaultName.trim();
    const now = Date.now();
    const key = `${normalizedVaultName}:${normalizedQuery}`;

    // Batch the state updates to avoid nested setState
    setQueryFrequency(prev => {
      const newFrequency = { ...prev, [key]: (prev[key] || 0) + 1 };
      saveFrequencyToStorage(newFrequency);
      return newFrequency;
    });

    setHistory(prev => {
      // Remove duplicate if it exists
      const filtered = prev.filter(
        entry => !(entry.query === normalizedQuery && entry.vaultName === normalizedVaultName)
      );

      // Add new entry at the beginning
      const newEntry: SearchHistoryEntry = {
        query: normalizedQuery,
        vaultName: normalizedVaultName,
        timestamp: now,
        frequency: 1, // Will be updated in next render
        lastUsed: now,
      };

      const newHistory = [newEntry, ...filtered].slice(0, MAX_HISTORY_SIZE);
      saveToStorage(newHistory);
      return newHistory;
    });
  }, [saveToStorage, saveFrequencyToStorage]);

  // Remove a specific entry from history
  const removeFromHistory = useCallback((index: number) => {
    setHistory(prev => {
      const newHistory = prev.filter((_, i) => i !== index);
      saveToStorage(newHistory);
      return newHistory;
    });
  }, [saveToStorage]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    setQueryFrequency({});
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(FREQUENCY_STORAGE_KEY);
  }, []);

  // Get history filtered by vault
  const getHistoryForVault = useCallback((vaultName: string) => {
    return history.filter(entry => entry.vaultName === vaultName);
  }, [history]);

  // Get recent unique queries (last 5)
  const getRecentQueries = useCallback((vaultName?: string) => {
    const filteredHistory = vaultName 
      ? history.filter(entry => entry.vaultName === vaultName)
      : history;

    // Get unique queries (remove duplicates by query text)
    const seen = new Set<string>();
    const uniqueQueries = filteredHistory
      .filter(entry => {
        if (seen.has(entry.query)) {
          return false;
        }
        seen.add(entry.query);
        return true;
      })
      .slice(0, 5)
      .map(entry => entry.query);

    return uniqueQueries;
  }, [history]);

  // Check if a query exists in history
  const hasSearched = useCallback((query: string, vaultName: string) => {
    return history.some(
      entry => entry.query === query.trim() && entry.vaultName === vaultName.trim()
    );
  }, [history]);

  // Get search suggestions based on partial query with enhanced ranking
  const getSuggestions = useCallback((partialQuery: string, vaultName?: string): SearchSuggestion[] => {
    if (!partialQuery.trim()) {
      // Inline recent suggestions logic to avoid circular dependency
      const filteredHistory = vaultName 
        ? history.filter(entry => entry.vaultName === vaultName)
        : history;

      return filteredHistory
        .slice(0, MAX_SUGGESTIONS)
        .map(entry => {
          const key = `${entry.vaultName}:${entry.query}`;
          const frequency = queryFrequency[key] || 1;
          
          return {
            query: entry.query,
            type: frequency > 2 ? 'popular' : 'recent' as const,
            frequency,
            lastUsed: entry.timestamp,
          };
        });
    }

    const query = partialQuery.toLowerCase();
    const filteredHistory = vaultName 
      ? history.filter(entry => entry.vaultName === vaultName)
      : history;

    const suggestions = filteredHistory
      .filter(entry => entry.query.toLowerCase().includes(query))
      .map(entry => {
        const key = `${entry.vaultName}:${entry.query}`;
        const frequency = queryFrequency[key] || 1;
        const recency = Date.now() - entry.timestamp;
        
        // Score based on frequency and recency (higher is better)
        const score = frequency * 1000 - recency / (1000 * 60 * 60); // Reduce score by hours
        
        return {
          query: entry.query,
          type: frequency > 2 ? 'popular' : 'recent' as const,
          frequency,
          lastUsed: entry.timestamp,
          score
        } as SearchSuggestion & { score: number };
      })
      .sort((a, b) => (b as SearchSuggestion & { score: number }).score - (a as SearchSuggestion & { score: number }).score)
      .slice(0, MAX_SUGGESTIONS);

    return suggestions;
  }, [history, queryFrequency]);

  // Get recent suggestions when no query is provided
  const getRecentSuggestions = useCallback((vaultName?: string): SearchSuggestion[] => {
    const filteredHistory = vaultName 
      ? history.filter(entry => entry.vaultName === vaultName)
      : history;

    return filteredHistory
      .slice(0, MAX_SUGGESTIONS)
      .map(entry => {
        const key = `${entry.vaultName}:${entry.query}`;
        const frequency = queryFrequency[key] || 1;
        
        return {
          query: entry.query,
          type: frequency > 2 ? 'popular' : 'recent' as const,
          frequency,
          lastUsed: entry.timestamp,
        };
      });
  }, [history, queryFrequency]);

  // Get trending searches (frequently used in recent time)
  const getTrendingSearches = useCallback((vaultName?: string, days: number = 7): SearchSuggestion[] => {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const filteredHistory = vaultName 
      ? history.filter(entry => entry.vaultName === vaultName && entry.timestamp > cutoff)
      : history.filter(entry => entry.timestamp > cutoff);

    // Group by query and count frequency in the time window
    const queryMap = new Map<string, { count: number; lastUsed: number }>();
    
    filteredHistory.forEach(entry => {
      const existing = queryMap.get(entry.query);
      if (existing) {
        existing.count++;
        existing.lastUsed = Math.max(existing.lastUsed, entry.timestamp);
      } else {
        queryMap.set(entry.query, { count: 1, lastUsed: entry.timestamp });
      }
    });

    return Array.from(queryMap.entries())
      .filter(([_, data]) => data.count >= 2) // Must be searched at least twice
      .sort((a, b) => b[1].count - a[1].count) // Sort by frequency
      .slice(0, 5)
      .map(([query, data]) => ({
        query,
        type: 'trending' as const,
        frequency: data.count,
        lastUsed: data.lastUsed,
      }));
  }, [history]);

  // Get popular searches across all time
  const getPopularSearches = useCallback((vaultName?: string): SearchSuggestion[] => {
    const entries = Object.entries(queryFrequency)
      .filter(([key, _]) => !vaultName || key.startsWith(`${vaultName}:`))
      .map(([key, frequency]) => {
        const query = key.split(':').slice(1).join(':'); // Remove vault prefix
        const entry = history.find(h => h.query === query && (!vaultName || h.vaultName === vaultName));
        
        return {
          query,
          type: 'popular' as const,
          frequency,
          lastUsed: entry?.timestamp || 0,
        };
      })
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    return entries;
  }, [queryFrequency, history]);

  // Memoize the return object to prevent infinite re-renders
  return useMemo(() => ({
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getHistoryForVault,
    getRecentQueries,
    hasSearched,
    getSuggestions,
    getRecentSuggestions,
    getTrendingSearches,
    getPopularSearches,
    queryFrequency,
    historySize: history.length,
    maxHistorySize: MAX_HISTORY_SIZE,
  }), [
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getHistoryForVault,
    getRecentQueries,
    hasSearched,
    getSuggestions,
    getRecentSuggestions,
    getTrendingSearches,
    getPopularSearches,
    queryFrequency,
  ]);
};

// Export types for use in other components
export type { SearchHistoryEntry, SearchSuggestion };

export default useSearchHistory;