import React, { useEffect, useState } from 'react';
import SearchInput from '@/components/search/SearchInput';
import VaultSelector from '@/components/search/VaultSelector';
import ResultsList from '@/components/search/ResultsList';
import PaginationControls from '@/components/search/PaginationControls';
import EmptyState from '@/components/search/EmptyState';
import { useSearch } from '@/hooks/useSearch';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useSearchStore, sortSearchResults } from '@/stores/searchStore';
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';

interface SearchPageProps {
  onNavigate?: (page: string) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({ onNavigate }) => {
  const [showToast, setShowToast] = useState(false);
  
  // Hooks
  const search = useSearch({ enableAutoSearch: false });
  const searchHistory = useSearchHistory();
  const {
    isFilterPanelOpen,
    sortBy,
    sortOrder,
    autoSearch,
    toggleFilterPanel,
    setSortBy,
    setSortOrder,
    setAutoSearch,
    setCopiedContent,
    addRecentSearch,
  } = useSearchStore();

  // Handle search execution
  const handleSearch = () => {
    if (!search.query.trim() || !search.vaultName) return;
    
    search.performSearch();
    searchHistory.addToHistory(search.query, search.vaultName);
    addRecentSearch(search.query);
  };

  // Handle copy with feedback
  const handleCopy = (content: string) => {
    setCopiedContent(content);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Sort results based on current settings
  const sortedResults = sortSearchResults(search.results, sortBy, sortOrder);

  // Auto-search when enabled and query/vault changes
  useEffect(() => {
    if (autoSearch && search.query.trim() && search.vaultName) {
      const timeoutId = setTimeout(handleSearch, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [search.query, search.vaultName, autoSearch, handleSearch]);

  // Determine empty state type
  const getEmptyStateType = () => {
    if (search.isError) return 'error';
    if (!search.vaultName) return 'no-vault';
    if (!search.query.trim()) return 'no-query';
    if (search.hasSearched && search.results.length === 0) return 'no-results';
    return 'no-query';
  };

  const shouldShowEmptyState = !search.isLoading && (
    search.isError || 
    !search.vaultName || 
    !search.query.trim() || 
    (search.hasSearched && search.results.length === 0)
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Search Input - spans 2 columns on large screens */}
            <div className="lg:col-span-2">
              <SearchInput
                query={search.query}
                onQueryChange={search.updateQuery}
                onSearch={handleSearch}
                loading={search.isLoading}
                placeholder="Search your vault..."
                autoFocus={true}
              />
            </div>
            
            {/* Vault Selector */}
            <div>
              <VaultSelector
                selectedVault={search.vaultName}
                onVaultChange={search.updateVaultName}
                disabled={search.isLoading}
              />
            </div>
          </div>

          {/* Search Controls */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Auto-search toggle */}
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={autoSearch}
                  onChange={(e) => setAutoSearch(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Auto-search
                </span>
              </label>

              {/* Filter panel toggle */}
              <button
                onClick={toggleFilterPanel}
                className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <AdjustmentsHorizontalIcon className="h-4 w-4" />
                <span>Filters</span>
              </button>
            </div>

            {/* Search info */}
            {search.hasSearched && !search.isLoading && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {search.results.length > 0 && (
                  <>
                    {search.totalResults} results 
                    {search.searchTimeMs && ` in ${search.searchTimeMs}ms`}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Filter Panel */}
          {isFilterPanelOpen && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Sort by */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sort by
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="date">Date</option>
                    <option value="filename">Filename</option>
                  </select>
                </div>

                {/* Sort order */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Order
                  </label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>

                {/* Results per page */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Results per page
                  </label>
                  <select
                    value={search.resultsPerPage}
                    onChange={(e) => search.updateResultsPerPage(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                {/* Similarity threshold */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Min. similarity ({Math.round(search.similarityThreshold * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={search.similarityThreshold}
                    onChange={(e) => search.updateSimilarityThreshold(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {shouldShowEmptyState ? (
          <EmptyState
            type={getEmptyStateType()}
            query={search.query}
            vaultName={search.vaultName}
            onRetry={search.retry}
            onConfigureVault={() => onNavigate?.('configure')}
          />
        ) : (
          <div className="space-y-6">
            {/* Results */}
            <ResultsList
              results={sortedResults}
              query={search.query}
              loading={search.isLoading}
              onCopy={handleCopy}
            />

            {/* Pagination */}
            {search.totalPages > 1 && (
              <PaginationControls
                currentPage={search.currentPage}
                totalPages={search.totalPages}
                totalResults={search.totalResults}
                resultsPerPage={search.resultsPerPage}
                onPageChange={search.updatePage}
                loading={search.isLoading}
              />
            )}
          </div>
        )}
      </div>

      {/* Copy Toast */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in-up">
          Content copied to clipboard!
        </div>
      )}
    </div>
  );
};

export default SearchPage;