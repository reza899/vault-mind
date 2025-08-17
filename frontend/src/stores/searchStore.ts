import { create } from 'zustand';
interface SearchResult {
  content: string;
  metadata: {
    file_path: string;
    chunk_index: number;
    file_type: string;
    created_at?: string;
    modified_at?: string;
    tags?: string[];
  };
  similarity_score: number;
}

interface SearchUIState {
  // UI state
  isFilterPanelOpen: boolean;
  selectedResultIndex: number | null;
  sortBy: 'relevance' | 'date' | 'filename';
  sortOrder: 'asc' | 'desc';
  
  // Search preferences
  autoSearch: boolean;
  showSnippets: boolean;
  highlightTerms: boolean;
  
  // Recent searches for quick access
  recentSearches: string[];
  
  // Copy feedback
  lastCopiedContent: string | null;
  copyFeedbackTimeout: NodeJS.Timeout | null;
}

interface SearchUIActions {
  // UI actions
  toggleFilterPanel: () => void;
  setSelectedResult: (index: number | null) => void;
  setSortBy: (sortBy: SearchUIState['sortBy']) => void;
  setSortOrder: (sortOrder: SearchUIState['sortOrder']) => void;
  
  // Preference actions
  setAutoSearch: (enabled: boolean) => void;
  setShowSnippets: (enabled: boolean) => void;
  setHighlightTerms: (enabled: boolean) => void;
  
  // Recent searches
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  
  // Copy feedback
  setCopiedContent: (content: string) => void;
  clearCopyFeedback: () => void;
  
  // Reset
  resetState: () => void;
}

type SearchStore = SearchUIState & SearchUIActions;

const defaultState: SearchUIState = {
  isFilterPanelOpen: false,
  selectedResultIndex: null,
  sortBy: 'relevance',
  sortOrder: 'desc',
  autoSearch: false,
  showSnippets: true,
  highlightTerms: true,
  recentSearches: [],
  lastCopiedContent: null,
  copyFeedbackTimeout: null,
};

export const useSearchStore = create<SearchStore>((set, get) => ({
  ...defaultState,

  // UI actions
  toggleFilterPanel: () => set(state => ({ 
    isFilterPanelOpen: !state.isFilterPanelOpen 
  })),

  setSelectedResult: (index) => set({ selectedResultIndex: index }),

  setSortBy: (sortBy) => set({ sortBy }),

  setSortOrder: (sortOrder) => set({ sortOrder }),

  // Preference actions
  setAutoSearch: (autoSearch) => set({ autoSearch }),

  setShowSnippets: (showSnippets) => set({ showSnippets }),

  setHighlightTerms: (highlightTerms) => set({ highlightTerms }),

  // Recent searches
  addRecentSearch: (query) => set(state => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return state;

    const existing = state.recentSearches.filter(q => q !== trimmedQuery);
    return {
      recentSearches: [trimmedQuery, ...existing].slice(0, 10)
    };
  }),

  clearRecentSearches: () => set({ recentSearches: [] }),

  // Copy feedback
  setCopiedContent: (content) => {
    const state = get();
    
    // Clear existing timeout
    if (state.copyFeedbackTimeout) {
      clearTimeout(state.copyFeedbackTimeout);
    }

    // Set new timeout to clear feedback
    const timeout = setTimeout(() => {
      set({ lastCopiedContent: null, copyFeedbackTimeout: null });
    }, 3000);

    set({ 
      lastCopiedContent: content,
      copyFeedbackTimeout: timeout
    });
  },

  clearCopyFeedback: () => {
    const state = get();
    if (state.copyFeedbackTimeout) {
      clearTimeout(state.copyFeedbackTimeout);
    }
    set({ lastCopiedContent: null, copyFeedbackTimeout: null });
  },

  // Reset
  resetState: () => {
    const state = get();
    if (state.copyFeedbackTimeout) {
      clearTimeout(state.copyFeedbackTimeout);
    }
    set(defaultState);
  },
}));

// Helper functions for sorting results
export const sortSearchResults = (
  results: SearchResult[], 
  sortBy: SearchUIState['sortBy'], 
  sortOrder: SearchUIState['sortOrder']
): SearchResult[] => {
  const sorted = [...results].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'relevance': {
        comparison = b.similarity_score - a.similarity_score;
        break;
      }
      
      case 'date': {
        const dateA = new Date(a.metadata.modified_at || a.metadata.created_at || 0);
        const dateB = new Date(b.metadata.modified_at || b.metadata.created_at || 0);
        comparison = dateB.getTime() - dateA.getTime();
        break;
      }
      
      case 'filename': {
        const nameA = a.metadata.file_path.split('/').pop() || '';
        const nameB = b.metadata.file_path.split('/').pop() || '';
        comparison = nameA.localeCompare(nameB);
        break;
      }
      
      default:
        return 0;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sorted;
};

export default useSearchStore;