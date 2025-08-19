import React from 'react';
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
import ResultCard from './ResultCard';

interface ResultsListProps {
  results: SearchResult[];
  query: string;
  loading?: boolean;
  onCopy?: (content: string) => void;
  className?: string;
  selectedResults?: Set<number>;
  onSelectionChange?: (selectedIndexes: Set<number>) => void;
  showSelection?: boolean;
}

export const ResultsList: React.FC<ResultsListProps> = ({
  results,
  query,
  loading = false,
  onCopy,
  className = "",
  selectedResults = new Set(),
  onSelectionChange,
  showSelection = false,
}) => {
  
  const handleResultSelection = (index: number, selected: boolean) => {
    if (!onSelectionChange) return;
    
    const newSelection = new Set(selectedResults);
    if (selected) {
      newSelection.add(index);
    } else {
      newSelection.delete(index);
    }
    onSelectionChange(newSelection);
  };
  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {/* Loading skeleton */}
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2 flex-1">
                <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-1" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                </div>
              </div>
              <div className="w-16 h-2 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>
            <div className="space-y-2 mb-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            </div>
            <div className="flex justify-between">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
              <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return null; // Empty state is handled by parent component
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {results.map((result, index) => (
        <ResultCard
          key={`${result.metadata.file_path}-${result.metadata.chunk_index}-${index}`}
          result={result}
          query={query}
          onCopy={onCopy}
          index={index}
          isSelected={selectedResults.has(index)}
          onSelectionChange={(selected) => handleResultSelection(index, selected)}
          showSelection={showSelection}
        />
      ))}
    </div>
  );
};

export default ResultsList;