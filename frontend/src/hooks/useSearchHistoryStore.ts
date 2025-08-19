/**
 * Simple React Hook for Search History Store
 * 
 * This hook eliminates the infinite re-render issue by:
 * 1. Using external state management (no complex useCallback chains)
 * 2. Stable function references (methods don't change)
 * 3. Simple subscription pattern for updates
 */

import { useEffect, useState } from 'react';
import { searchHistoryStore, type SearchHistoryEntry, type SearchSuggestion } from '@/stores/searchHistoryStore';

export const useSearchHistoryStore = () => {
  const [state, setState] = useState(() => searchHistoryStore.getState());

  useEffect(() => {
    // Subscribe to store changes
    const unsubscribe = searchHistoryStore.subscribe(() => {
      setState(searchHistoryStore.getState());
    });

    return unsubscribe;
  }, []);

  // Return stable API - these methods never change reference
  return {
    // State
    history: state.history,
    queryFrequency: state.queryFrequency,
    historySize: state.historySize,
    maxHistorySize: state.maxHistorySize,

    // Actions (stable references)
    addToHistory: searchHistoryStore.addToHistory.bind(searchHistoryStore),
    removeFromHistory: searchHistoryStore.removeFromHistory.bind(searchHistoryStore),
    clearHistory: searchHistoryStore.clearHistory.bind(searchHistoryStore),
    getSuggestions: searchHistoryStore.getSuggestions.bind(searchHistoryStore),
    getHistoryForVault: searchHistoryStore.getHistoryForVault.bind(searchHistoryStore),
    hasSearched: searchHistoryStore.hasSearched.bind(searchHistoryStore),
    getRecentQueries: searchHistoryStore.getRecentQueries.bind(searchHistoryStore),
  };
};

// Export types for convenience
export type { SearchHistoryEntry, SearchSuggestion };