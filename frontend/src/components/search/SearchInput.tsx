import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import SearchSuggestions from './SearchSuggestions';
import { useSearchHistoryStore, type SearchSuggestion } from '@/hooks/useSearchHistoryStore';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';

interface SearchInputProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  loading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  debounceMs?: number;
  className?: string;
  vaultName?: string;
  showSuggestions?: boolean;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  query,
  onQueryChange,
  onSearch,
  loading = false,
  placeholder = "Search your vault...",
  autoFocus = true,
  debounceMs = 300,
  className = "",
  vaultName,
  showSuggestions = true,
  onSuggestionSelect,
}) => {
  const [localQuery, setLocalQuery] = useState(query);
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const suggestionsRef = useRef<NodeJS.Timeout>();
  
  const searchHistory = useSearchHistoryStore();

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Sync external query changes
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  // Update suggestions based on query
  const updateSuggestions = useCallback((searchQuery: string) => {
    if (suggestionsRef.current) {
      clearTimeout(suggestionsRef.current);
    }

    suggestionsRef.current = setTimeout(() => {
      if (showSuggestions && vaultName) {
        const newSuggestions = searchHistory.getSuggestions(searchQuery, vaultName);
        setSuggestions(newSuggestions);
        setShowSuggestionsDropdown(newSuggestions.length > 0);
        setSelectedSuggestionIndex(-1);
      }
    }, 150); // Faster response for suggestions
  }, [showSuggestions, vaultName, searchHistory]);

  // Debounced query update
  const debouncedQueryChange = useCallback((newQuery: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onQueryChange(newQuery);
    }, debounceMs);
  }, [onQueryChange, debounceMs]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setLocalQuery(newQuery);
    debouncedQueryChange(newQuery);
    updateSuggestions(newQuery);
  };

  // Handle input focus to show suggestions
  const handleInputFocus = () => {
    if (showSuggestions && vaultName) {
      updateSuggestions(localQuery);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    setLocalQuery(suggestion.query);
    onQueryChange(suggestion.query);
    setShowSuggestionsDropdown(false);
    
    if (onSuggestionSelect) {
      onSuggestionSelect(suggestion);
    }
    
    // Auto-trigger search
    setTimeout(() => onSearch(), 0);
  };

  // Remove suggestion from history
  const handleSuggestionRemove = (suggestion: SearchSuggestion) => {
    // Find and remove the specific entry from history
    const entryToRemove = searchHistory.history.findIndex(
      entry => entry.query === suggestion.query && (!vaultName || entry.vaultName === vaultName)
    );
    
    if (entryToRemove >= 0) {
      searchHistory.removeFromHistory(entryToRemove);
      // Don't manually refresh - let React handle the re-render naturally
    }
  };

  // Clear all search history
  const handleClearAllHistory = () => {
    searchHistory.clearHistory();
    setSuggestions([]);
    setShowSuggestionsDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestionsDropdown && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestionIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestionIndex(prev => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedSuggestionIndex >= 0) {
            handleSuggestionSelect(suggestions[selectedSuggestionIndex]);
          } else {
            onSearch();
            setShowSuggestionsDropdown(false);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowSuggestionsDropdown(false);
          setSelectedSuggestionIndex(-1);
          break;
        default:
          break;
      }
    } else {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          onSearch();
          break;
        case 'Escape':
          handleClear();
          break;
        default:
          break;
      }
    }
  };

  const handleClear = () => {
    setLocalQuery('');
    onQueryChange('');
    setShowSuggestionsDropdown(false);
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSearchClick = () => {
    onSearch();
  };

  // Close suggestions when clicking outside or on escape
  useKeyboardShortcut('Escape', () => {
    if (showSuggestionsDropdown) {
      setShowSuggestionsDropdown(false);
      setSelectedSuggestionIndex(-1);
    }
  }, { enabled: showSuggestionsDropdown });

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (suggestionsRef.current) {
        clearTimeout(suggestionsRef.current);
      }
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={localQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          disabled={loading}
          autoComplete="off"
          className="w-full pl-12 pr-20 py-3 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white dark:placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        />
        
        {/* Search icon */}
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon 
            className={`h-5 w-5 text-gray-400 dark:text-gray-500 ${loading ? 'animate-pulse' : ''}`} 
          />
        </div>

        {/* Clear and Search buttons */}
        <div className="absolute inset-y-0 right-0 flex items-center">
          {localQuery && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 mx-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Clear search"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
          
          <button
            type="button"
            onClick={handleSearchClick}
            disabled={loading || !localQuery.trim()}
            className="px-3 py-1 mr-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm rounded-md transition-colors disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              'Search'
            )}
          </button>
        </div>
      </div>

      {/* Search Suggestions */}
      {showSuggestions && (
        <SearchSuggestions
          suggestions={suggestions}
          isOpen={showSuggestionsDropdown}
          selectedIndex={selectedSuggestionIndex}
          onSelect={handleSuggestionSelect}
          onRemove={handleSuggestionRemove}
          onClearAll={handleClearAllHistory}
          onClose={() => setShowSuggestionsDropdown(false)}
          loading={false}
          showManagement={true}
        />
      )}

      {/* Search hint */}
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {showSuggestionsDropdown 
          ? 'Use ↑↓ to navigate, Enter to select, Esc to close'
          : 'Press Enter to search, Escape to clear'
        }
      </div>
    </div>
  );
};

export default SearchInput;