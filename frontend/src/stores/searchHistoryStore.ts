/**
 * Search History Store - Architectural Pattern
 * 
 * This store uses the singleton pattern to avoid React Hook dependency cycles.
 * Instead of complex useCallback/useMemo patterns that create circular dependencies,
 * we manage state outside of React's render cycle.
 */

interface SearchHistoryEntry {
  query: string;
  vaultName: string;
  timestamp: number;
  frequency?: number;
  lastUsed?: number;
}

interface SearchSuggestion {
  query: string;
  type: 'recent' | 'popular' | 'trending';
  frequency: number;
  lastUsed: number;
}

class SearchHistoryStore {
  private history: SearchHistoryEntry[] = [];
  private queryFrequency: Record<string, number> = {};
  private listeners: Set<() => void> = new Set();
  
  private readonly STORAGE_KEY = 'vault-mind-search-history';
  private readonly FREQUENCY_STORAGE_KEY = 'vault-mind-search-frequency';
  private readonly MAX_HISTORY_SIZE = 50;
  private readonly MAX_SUGGESTIONS = 8;

  constructor() {
    this.loadFromStorage();
  }

  // Load data from localStorage
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SearchHistoryEntry[];
        this.history = parsed.filter(
          entry => 
            typeof entry.query === 'string' && 
            typeof entry.vaultName === 'string' && 
            typeof entry.timestamp === 'number'
        ).slice(0, this.MAX_HISTORY_SIZE);
      }

      const frequencyStored = localStorage.getItem(this.FREQUENCY_STORAGE_KEY);
      if (frequencyStored) {
        const parsed = JSON.parse(frequencyStored);
        if (typeof parsed === 'object' && parsed !== null) {
          this.queryFrequency = parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.FREQUENCY_STORAGE_KEY);
    }
  }

  // Save to localStorage
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.history));
      localStorage.setItem(this.FREQUENCY_STORAGE_KEY, JSON.stringify(this.queryFrequency));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }

  // Notify listeners of changes
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  // Subscribe to changes
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Get current state
  getState() {
    return {
      history: [...this.history],
      queryFrequency: { ...this.queryFrequency },
      historySize: this.history.length,
      maxHistorySize: this.MAX_HISTORY_SIZE,
    };
  }

  // Add search to history
  addToHistory(query: string, vaultName: string): void {
    if (!query.trim() || !vaultName.trim()) {
      return;
    }

    const normalizedQuery = query.trim();
    const normalizedVaultName = vaultName.trim();
    const now = Date.now();
    const key = `${normalizedVaultName}:${normalizedQuery}`;

    // Update frequency
    this.queryFrequency[key] = (this.queryFrequency[key] || 0) + 1;

    // Remove duplicate if exists
    this.history = this.history.filter(
      entry => !(entry.query === normalizedQuery && entry.vaultName === normalizedVaultName)
    );

    // Add new entry at beginning
    const newEntry: SearchHistoryEntry = {
      query: normalizedQuery,
      vaultName: normalizedVaultName,
      timestamp: now,
      frequency: this.queryFrequency[key],
      lastUsed: now,
    };

    this.history = [newEntry, ...this.history].slice(0, this.MAX_HISTORY_SIZE);
    
    this.saveToStorage();
    this.notifyListeners();
  }

  // Remove from history
  removeFromHistory(index: number): void {
    if (index >= 0 && index < this.history.length) {
      this.history = this.history.filter((_, i) => i !== index);
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  // Clear all history
  clearHistory(): void {
    this.history = [];
    this.queryFrequency = {};
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.FREQUENCY_STORAGE_KEY);
    this.notifyListeners();
  }

  // Get suggestions
  getSuggestions(partialQuery: string, vaultName?: string): SearchSuggestion[] {
    if (!partialQuery.trim()) {
      const filteredHistory = vaultName 
        ? this.history.filter(entry => entry.vaultName === vaultName)
        : this.history;

      return filteredHistory
        .slice(0, this.MAX_SUGGESTIONS)
        .map(entry => {
          const key = `${entry.vaultName}:${entry.query}`;
          const frequency = this.queryFrequency[key] || 1;
          
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
      ? this.history.filter(entry => entry.vaultName === vaultName)
      : this.history;

    return filteredHistory
      .filter(entry => entry.query.toLowerCase().includes(query))
      .map(entry => {
        const key = `${entry.vaultName}:${entry.query}`;
        const frequency = this.queryFrequency[key] || 1;
        const recency = Date.now() - entry.timestamp;
        const score = frequency * 1000 - recency / (1000 * 60 * 60);
        
        return {
          query: entry.query,
          type: frequency > 2 ? 'popular' : 'recent' as const,
          frequency,
          lastUsed: entry.timestamp,
          score
        } as SearchSuggestion & { score: number };
      })
      .sort((a, b) => (b as SearchSuggestion & { score: number }).score - (a as SearchSuggestion & { score: number }).score)
      .slice(0, this.MAX_SUGGESTIONS);
  }

  // Get history for specific vault
  getHistoryForVault(vaultName: string): SearchHistoryEntry[] {
    return this.history.filter(entry => entry.vaultName === vaultName);
  }

  // Check if query exists
  hasSearched(query: string, vaultName: string): boolean {
    return this.history.some(
      entry => entry.query === query.trim() && entry.vaultName === vaultName.trim()
    );
  }

  // Get recent queries
  getRecentQueries(vaultName?: string): string[] {
    const filteredHistory = vaultName 
      ? this.history.filter(entry => entry.vaultName === vaultName)
      : this.history;

    const seen = new Set<string>();
    return filteredHistory
      .filter(entry => {
        if (seen.has(entry.query)) return false;
        seen.add(entry.query);
        return true;
      })
      .slice(0, 5)
      .map(entry => entry.query);
  }
}

// Create singleton instance
export const searchHistoryStore = new SearchHistoryStore();

// Export types
export type { SearchHistoryEntry, SearchSuggestion };