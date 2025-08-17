import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        const apiError = error as ApiError;
        
        // Don't retry on 4xx errors (client errors)
        if (apiError.status && apiError.status >= 400 && apiError.status < 500) {
          return false;
        }
        
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: false, // Don't retry mutations by default
      onError: (error) => {
        console.error('[Mutation Error]', error);
      },
    },
  },
});

// Query keys for consistent caching
export const queryKeys = {
  // Health queries
  health: ['health'] as const,
  systemStatus: ['system', 'status'] as const,
  
  // Job queries
  jobs: ['jobs'] as const,
  job: (jobId: string) => ['jobs', jobId] as const,
  
  // Search queries
  search: (vaultName: string, query: string) => ['search', vaultName, query] as const,
  collections: ['search', 'collections'] as const,
  
  // Vault queries
  vaults: ['vaults'] as const,
  vault: (vaultName: string) => ['vaults', vaultName] as const,
} as const;