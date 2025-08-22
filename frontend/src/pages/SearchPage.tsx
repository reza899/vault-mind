import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchInput from '@/components/search/SearchInput';
import VaultSelector from '@/components/search/VaultSelector';
import ResultsList from '@/components/search/ResultsList';
import PaginationControls from '@/components/search/PaginationControls';
import EmptyState from '@/components/search/EmptyState';
import SearchFilters from '@/components/search/SearchFilters';
import SearchResultActions from '@/components/search/SearchResultActions';
import { useSearch } from '@/hooks/useSearch';
import { useSearchHistoryStore, type SearchSuggestion } from '@/hooks/useSearchHistoryStore';
import { useSearchStore, sortSearchResults } from '@/stores/searchStore';
import { type SearchFilters as FilterType } from '@/hooks/useSearchFilters';
import { searchExportUtils } from '@/utils/searchExport';
import { AdjustmentsHorizontalIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface SearchPageProps {
  onNavigate?: (page: string) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const [showToast, setShowToast] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const [toastMessage, setToastMessage] = useState('');
  
  // Hooks
  const search = useSearch({ enableAutoSearch: false });
  const searchHistory = useSearchHistoryStore();
  const {
    sortBy,
    sortOrder,
    autoSearch,
    setSortBy,
    setSortOrder,
    setAutoSearch,
    setCopiedContent,
    addRecentSearch,
  } = useSearchStore();

  // Create refs for stable access to store functions
  const searchHistoryRef = useRef(searchHistory);
  const addRecentSearchRef = useRef(addRecentSearch);
  searchHistoryRef.current = searchHistory;
  addRecentSearchRef.current = addRecentSearch;

  // Stable history functions using refs
  const stableAddToHistory = useCallback((query: string, vaultName: string) => {
    try {
      searchHistoryRef.current.addToHistory(query, vaultName);
    } catch (error) {
      console.warn('Failed to add to search history:', error);
    }
  }, []); // Empty deps - using refs for stability

  const stableAddRecentSearch = useCallback((query: string) => {
    try {
      addRecentSearchRef.current(query);
    } catch (error) {
      console.warn('Failed to add recent search:', error);
    }
  }, []); // Empty deps - using refs for stability

  // Handle search execution
  const handleSearch = useCallback((_filters?: FilterType) => {
    const currentSearch = searchRef.current;
    if (!currentSearch.query.trim() || !currentSearch.vaultName) return;
    
    // Use the hook's performSearch method (no parameters needed)
    currentSearch.performSearch();
    stableAddToHistory(currentSearch.query, currentSearch.vaultName);
    stableAddRecentSearch(currentSearch.query);
  }, [stableAddToHistory, stableAddRecentSearch]); // Only truly stable functions

  // Use refs to avoid dependency issues with hook functions
  const searchRef = useRef(search);
  searchRef.current = search;

  // Create stable search trigger function using refs
  const triggerAutoSearch = useCallback(() => {
    const currentSearch = searchRef.current;
    if (currentSearch.query.trim() && currentSearch.vaultName) {
      currentSearch.performSearch();
      stableAddToHistory(currentSearch.query, currentSearch.vaultName);
      stableAddRecentSearch(currentSearch.query);
    }
  }, [stableAddToHistory, stableAddRecentSearch]); // Only stable functions in deps

  // Handle filter changes
  const handleFiltersChange = useCallback((filters: FilterType) => {
    // Auto-search with new filters if enabled
    const currentSearch = searchRef.current;
    if (autoSearch && currentSearch.query.trim() && currentSearch.vaultName) {
      handleSearch(filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSearch, handleSearch]); // Intentionally using refs to avoid infinite loops

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: SearchSuggestion) => {
    // Update search query and execute search
    const currentSearch = searchRef.current;
    currentSearch.updateQuery(suggestion.query);
    
    // Add to history (will be done automatically by handleSearch)
    setTimeout(() => {
      handleSearch();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSearch]); // Intentionally using refs to avoid infinite loops

  // Handle export functionality
  const handleExport = useCallback(async (format: 'json' | 'csv' | 'md', results: unknown[]) => {
    try {
      const options = {
        includeMetadata: true,
        includeTimestamp: true,
        includeQuery: true,
        query: search.query,
        vaultName: search.vaultName
      };

      switch (format) {
        case 'json':
          searchExportUtils.exportToJSON(results, options);
          break;
        case 'csv':
          searchExportUtils.exportToCSV(results, options);
          break;
        case 'md':
          searchExportUtils.exportToMarkdown(results, options);
          break;
      }

      setToastMessage(`Successfully exported ${results.length} results as ${format.toUpperCase()}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      setToastMessage('Export failed. Please try again.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }, [search.query, search.vaultName]);

  // Handle save functionality
  const handleSave = useCallback(async (results: unknown[]) => {
    try {
      searchExportUtils.saveSearchResults(
        results as never,
        search.query,
        search.vaultName,
        `Search: ${search.query}` 
      );
      
      setToastMessage(`Saved ${results.length} results`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Save failed:', error);
      setToastMessage('Save failed. Please try again.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }, [search.query, search.vaultName]);

  // Handle share functionality
  const handleShare = useCallback(async (results: unknown[]) => {
    try {
      await searchExportUtils.shareSearchResults(
        results as never,
        search.query,
        search.vaultName
      );
      
      setToastMessage('Share URL copied to clipboard');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Share failed:', error);
      setToastMessage('Share failed. Please try again.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }, [search.query, search.vaultName]);

  // Clear selection when query/vault changes (moved to auto-search effect)

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
    // Always clear selection when query or vault changes
    setSelectedResults(new Set());
    
    if (autoSearch) {
      const timeoutId = setTimeout(() => {
        triggerAutoSearch();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [search.query, search.vaultName, autoSearch, triggerAutoSearch]); // Use stable trigger function

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Main Search Section */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            {/* Search Input - spans 3 columns on large screens */}
            <div className="lg:col-span-3">
              <SearchInput
                query={search.query}
                onQueryChange={search.updateQuery}
                onSearch={handleSearch}
                loading={search.isLoading}
                placeholder="Search your vault..."
                autoFocus={true}
                vaultName={search.vaultName}
                showSuggestions={true}
                onSuggestionSelect={handleSuggestionSelect}
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

          {/* Search Info and Simple Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
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

              {/* Quick Sort */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="text-sm border-0 bg-transparent text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 rounded"
                >
                  <option value="relevance">Relevance</option>
                  <option value="date">Date</option>
                  <option value="filename">Filename</option>
                </select>
              </div>

              {/* Advanced Filters Toggle (collapsed by default) */}
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center space-x-1 px-2 py-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <AdjustmentsHorizontalIcon className="h-4 w-4" />
                <span>More filters</span>
                {showAdvancedFilters ? <XMarkIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
              </button>
            </div>

            {/* Search Results Info */}
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

          {/* Advanced Filters Panel - Hidden by default */}
          {showAdvancedFilters && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Sort Order */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Order
                  </label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="desc">Newest first</option>
                    <option value="asc">Oldest first</option>
                  </select>
                </div>

                {/* Results per page */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Show
                  </label>
                  <select
                    value={search.resultsPerPage}
                    onChange={(e) => search.updateResultsPerPage(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value={10}>10 results</option>
                    <option value={20}>20 results</option>
                    <option value={50}>50 results</option>
                  </select>
                </div>

                {/* Similarity threshold */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Relevance ({Math.round(search.similarityThreshold * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={search.similarityThreshold}
                    onChange={(e) => search.updateSimilarityThreshold(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                </div>

                {/* Additional Filters */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    More Options
                  </label>
                  <SearchFilters
                    vaultName={search.vaultName}
                    onFiltersChange={handleFiltersChange}
                    className="text-sm"
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
            onConfigureVault={() => onNavigate ? onNavigate('configure') : navigate('/configure')}
          />
        ) : (
          <div className="space-y-6">
            {/* Search Result Actions */}
            {!search.isLoading && sortedResults.length > 0 && (
              <SearchResultActions
                results={sortedResults}
                selectedResults={selectedResults}
                onSelectionChange={setSelectedResults}
                onCopy={handleCopy}
                onExport={handleExport}
                onSave={handleSave}
                onShare={handleShare}
                query={search.query}
                vaultName={search.vaultName}
              />
            )}

            {/* Results */}
            <ResultsList
              results={sortedResults}
              query={search.query}
              loading={search.isLoading}
              onCopy={handleCopy}
              selectedResults={selectedResults}
              onSelectionChange={setSelectedResults}
              showSelection={sortedResults.length > 0}
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

      {/* Toast Notifications */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in-up">
          {toastMessage || 'Content copied to clipboard!'}
        </div>
      )}
    </div>
  );
};

export default SearchPage;