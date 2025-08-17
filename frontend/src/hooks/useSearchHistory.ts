import { useState, useCallback, useEffect } from 'react';

interface SearchHistoryEntry {
  query: string;
  vaultName: string;
  timestamp: number;
}

const STORAGE_KEY = 'vault-mind-search-history';
const MAX_HISTORY_SIZE = 10;

export const useSearchHistory = () => {
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
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
    } catch (error) {
      console.warn('Failed to load search history:', error);
      // Clear corrupted data
      localStorage.removeItem(STORAGE_KEY);
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

  // Add a new search to history
  const addToHistory = useCallback((query: string, vaultName: string) => {
    if (!query.trim() || !vaultName.trim()) {
      return;
    }

    const normalizedQuery = query.trim();
    const normalizedVaultName = vaultName.trim();

    setHistory(prev => {
      // Remove duplicate if it exists
      const filtered = prev.filter(
        entry => !(entry.query === normalizedQuery && entry.vaultName === normalizedVaultName)
      );

      // Add new entry at the beginning
      const newEntry: SearchHistoryEntry = {
        query: normalizedQuery,
        vaultName: normalizedVaultName,
        timestamp: Date.now(),
      };

      const newHistory = [newEntry, ...filtered].slice(0, MAX_HISTORY_SIZE);
      saveToStorage(newHistory);
      return newHistory;
    });
  }, [saveToStorage]);

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
    localStorage.removeItem(STORAGE_KEY);
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

  // Get search suggestions based on partial query
  const getSuggestions = useCallback((partialQuery: string, vaultName?: string) => {
    if (!partialQuery.trim()) {
      return [];
    }

    const query = partialQuery.toLowerCase();
    const filteredHistory = vaultName 
      ? history.filter(entry => entry.vaultName === vaultName)
      : history;

    return filteredHistory
      .filter(entry => entry.query.toLowerCase().includes(query))
      .slice(0, 5)
      .map(entry => entry.query);
  }, [history]);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getHistoryForVault,
    getRecentQueries,
    hasSearched,
    getSuggestions,
    historySize: history.length,
    maxHistorySize: MAX_HISTORY_SIZE,
  };
};

export default useSearchHistory;