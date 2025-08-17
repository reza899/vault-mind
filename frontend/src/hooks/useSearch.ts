import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
interface SearchParams {
  vault_name: string;
  query: string;
  limit?: number;
  similarity_threshold?: number;
  include_context?: boolean;
  filter_metadata?: Record<string, unknown>;
}

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

interface APIResponse<T = unknown> {
  status: 'success' | 'error';
  data: T;
  message?: string;
  request_id: string;
}
import apiClient from '@/services/apiClient';

interface SearchState {
  query: string;
  vaultName: string;
  currentPage: number;
  resultsPerPage: number;
  similarityThreshold: number;
}

interface SearchResponse {
  results: SearchResult[];
  total_found: number;
  search_time_ms: number;
}

interface UseSearchOptions {
  enableAutoSearch?: boolean;
  defaultResultsPerPage?: number;
  defaultSimilarityThreshold?: number;
}

export const useSearch = (options: UseSearchOptions = {}) => {
  const {
    enableAutoSearch = false,
    defaultResultsPerPage = 10,
    defaultSimilarityThreshold = 0.7,
  } = options;

  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    vaultName: '',
    currentPage: 1,
    resultsPerPage: defaultResultsPerPage,
    similarityThreshold: defaultSimilarityThreshold,
  });

  const [hasSearched, setHasSearched] = useState(false);

  // Build search parameters
  const buildSearchParams = useCallback((): SearchParams | null => {
    if (!searchState.query.trim() || !searchState.vaultName) {
      return null;
    }

    const offset = (searchState.currentPage - 1) * searchState.resultsPerPage;

    return {
      vault_name: searchState.vaultName,
      query: searchState.query.trim(),
      limit: searchState.resultsPerPage,
      similarity_threshold: searchState.similarityThreshold,
      include_context: true,
      filter_metadata: {
        offset,
      },
    };
  }, [searchState]);

  // Search query using React Query
  const searchParams = buildSearchParams();
  const shouldFetch = enableAutoSearch ? !!searchParams : (hasSearched && !!searchParams);

  const {
    data: searchResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['search', searchParams],
    queryFn: async (): Promise<APIResponse<SearchResponse>> => {
      if (!searchParams) {
        throw new Error('Invalid search parameters');
      }
      return apiClient.searchVault(searchParams);
    },
    enabled: shouldFetch,
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Manual search trigger
  const searchMutation = useMutation({
    mutationFn: async (params: SearchParams): Promise<APIResponse<SearchResponse>> => {
      return apiClient.searchVault(params);
    },
    onSuccess: () => {
      setHasSearched(true);
    },
  });

  // Update search parameters
  const updateQuery = useCallback((query: string) => {
    setSearchState(prev => ({ ...prev, query, currentPage: 1 }));
  }, []);

  const updateVaultName = useCallback((vaultName: string) => {
    setSearchState(prev => ({ ...prev, vaultName, currentPage: 1 }));
  }, []);

  const updatePage = useCallback((page: number) => {
    setSearchState(prev => ({ ...prev, currentPage: page }));
  }, []);

  const updateResultsPerPage = useCallback((resultsPerPage: number) => {
    setSearchState(prev => ({ ...prev, resultsPerPage, currentPage: 1 }));
  }, []);

  const updateSimilarityThreshold = useCallback((threshold: number) => {
    setSearchState(prev => ({ ...prev, similarityThreshold: threshold, currentPage: 1 }));
  }, []);

  // Manual search trigger
  const performSearch = useCallback(async () => {
    const params = buildSearchParams();
    if (params) {
      setHasSearched(true);
      return searchMutation.mutateAsync(params);
    }
  }, [buildSearchParams, searchMutation]);

  // Reset search state
  const resetSearch = useCallback(() => {
    setSearchState({
      query: '',
      vaultName: '',
      currentPage: 1,
      resultsPerPage: defaultResultsPerPage,
      similarityThreshold: defaultSimilarityThreshold,
    });
    setHasSearched(false);
  }, [defaultResultsPerPage, defaultSimilarityThreshold]);

  // Calculate pagination info
  const totalPages = Math.ceil((searchResponse?.data.total_found || 0) / searchState.resultsPerPage);

  return {
    // Search state
    query: searchState.query,
    vaultName: searchState.vaultName,
    currentPage: searchState.currentPage,
    resultsPerPage: searchState.resultsPerPage,
    similarityThreshold: searchState.similarityThreshold,
    hasSearched,

    // Search results
    results: searchResponse?.data.results || [],
    totalResults: searchResponse?.data.total_found || 0,
    searchTimeMs: searchResponse?.data.search_time_ms || 0,
    totalPages,

    // Loading states
    isLoading: isLoading || searchMutation.isPending,
    isError: isError || searchMutation.isError,
    error: error || searchMutation.error,

    // Actions
    updateQuery,
    updateVaultName,
    updatePage,
    updateResultsPerPage,
    updateSimilarityThreshold,
    performSearch,
    resetSearch,
    retry: refetch,

    // Manual search for non-auto mode
    search: performSearch,
  };
};

export default useSearch;