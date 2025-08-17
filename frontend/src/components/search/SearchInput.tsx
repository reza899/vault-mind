import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SearchInputProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  loading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  debounceMs?: number;
  className?: string;
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
}) => {
  const [localQuery, setLocalQuery] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

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
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch();
    }
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  const handleClear = () => {
    setLocalQuery('');
    onQueryChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSearchClick = () => {
    onSearch();
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
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
          placeholder={placeholder}
          disabled={loading}
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

      {/* Search hint */}
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Press Enter to search, Escape to clear
      </div>
    </div>
  );
};

export default SearchInput;