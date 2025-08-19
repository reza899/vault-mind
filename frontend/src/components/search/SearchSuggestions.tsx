import React, { useEffect, useRef } from 'react';
import {
  ClockIcon,
  ArrowTrendingUpIcon,
  XMarkIcon,
  TrashIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { type SearchSuggestion } from '@/hooks/useSearchHistory';

interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[];
  isOpen: boolean;
  selectedIndex: number;
  onSelect: (suggestion: SearchSuggestion) => void;
  onRemove?: (suggestion: SearchSuggestion) => void;
  onClearAll?: () => void;
  onClose: () => void;
  loading?: boolean;
  showManagement?: boolean;
}

const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  suggestions,
  isOpen,
  selectedIndex,
  onSelect,
  onRemove,
  onClearAll,
  onClose,
  loading = false,
  showManagement = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to selected item
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [selectedIndex]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getSuggestionIcon = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'recent':
        return <ClockIcon className="w-4 h-4 text-gray-400" />;
      case 'popular':
        return <StarIcon className="w-4 h-4 text-yellow-500" />;
      case 'trending':
        return <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />;
      default:
        return <ClockIcon className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSuggestionTypeLabel = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'recent':
        return 'Recent';
      case 'popular':
        return 'Popular';
      case 'trending':
        return 'Trending';
      default:
        return 'Recent';
    }
  };

  const formatLastUsed = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-80 overflow-hidden"
    >
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading suggestions...</span>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
          No search suggestions available
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center space-x-2">
              <ClockIcon className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Search Suggestions
              </span>
            </div>
            <div className="flex items-center space-x-1">
              {showManagement && onClearAll && (
                <button
                  onClick={onClearAll}
                  className="p-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Clear all history"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Suggestions List */}
          <div className="max-h-64 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.query}-${suggestion.type}`}
                className="group relative"
              >
                <button
                  ref={index === selectedIndex ? selectedItemRef : undefined}
                  onClick={() => onSelect(suggestion)}
                  className={`w-full text-left px-4 py-3 flex items-center space-x-3 transition-colors
                    ${index === selectedIndex 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500' 
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {getSuggestionIcon(suggestion.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {suggestion.query}
                      </span>
                      
                      {/* Type badge */}
                      <span className={`px-1.5 py-0.5 text-xs rounded-full
                        ${suggestion.type === 'popular' 
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : suggestion.type === 'trending'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }
                      `}>
                        {getSuggestionTypeLabel(suggestion.type)}
                      </span>
                    </div>
                    
                    {/* Metadata */}
                    <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {suggestion.frequency > 1 && (
                        <span>Used {suggestion.frequency} times</span>
                      )}
                      <span>{formatLastUsed(suggestion.lastUsed)}</span>
                    </div>
                  </div>

                  {/* Remove button */}
                  {showManagement && onRemove && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(suggestion);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all"
                      title="Remove from history"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Footer with keyboard hints */}
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-3">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
                <span>Esc Close</span>
              </div>
              <span>{suggestions.length} suggestions</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SearchSuggestions;