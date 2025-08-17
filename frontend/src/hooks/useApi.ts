import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { queryKeys } from '@/services/queryClient';
import { VaultConfig, SearchParams } from '@/types';
import { ApiError } from '@/services/types';

// Health and Status hooks
export const useHealth = () => {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiClient.getHealth(),
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider stale after 10 seconds
  });
};

export const useSystemStatus = (includeMetrics = true) => {
  return useQuery({
    queryKey: [...queryKeys.systemStatus, includeMetrics],
    queryFn: () => apiClient.getSystemStatus(),
    refetchInterval: 15000, // Refetch every 15 seconds
    staleTime: 5000, // Consider stale after 5 seconds
  });
};

// Job Management hooks
export const useJobs = () => {
  return useQuery({
    queryKey: queryKeys.jobs,
    queryFn: () => apiClient.getAllJobs(),
    refetchInterval: 5000, // Refetch every 5 seconds for active jobs
  });
};

export const useJob = (jobId: string | null) => {
  return useQuery({
    queryKey: queryKeys.job(jobId || ''),
    queryFn: () => apiClient.getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (data) => {
      // Stop refetching if job is completed or failed
      const status = data?.data?.status;
      return status === 'running' || status === 'queued' ? 2000 : false;
    },
  });
};

export const useCreateIndexingJob = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (config: VaultConfig) => apiClient.createIndexingJob(config),
    onSuccess: () => {
      // Invalidate jobs query to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
    onError: (error: ApiError) => {
      console.error('Failed to create indexing job:', error);
    },
  });
};

// Search hooks
export const useSearchVault = (params: SearchParams | null) => {
  return useQuery({
    queryKey: params ? queryKeys.search(params.vault_name, params.query) : ['search', 'disabled'],
    queryFn: () => apiClient.searchVault(params!),
    enabled: !!params && !!params.vault_name && !!params.query.trim(),
    staleTime: 30000, // Search results are stale after 30 seconds
  });
};

export const useSearchVaultMutation = () => {
  return useMutation({
    mutationFn: (params: SearchParams) => apiClient.searchVault(params),
    onError: (error: ApiError) => {
      console.error('Search failed:', error);
    },
  });
};

export const useSearchableCollections = () => {
  return useQuery({
    queryKey: queryKeys.collections,
    queryFn: () => apiClient.getSearchableCollections(),
    staleTime: 5 * 60 * 1000, // Collections don't change frequently
  });
};

// Connection status hook
export const useConnectionStatus = () => {
  const healthQuery = useHealth();
  
  return {
    isConnected: healthQuery.isSuccess && healthQuery.data?.status === 'success',
    isConnecting: healthQuery.isFetching,
    error: healthQuery.error as ApiError | null,
    lastSuccessful: healthQuery.dataUpdatedAt,
  };
};

// Error retry hook
export const useRetryFailedQueries = () => {
  const queryClient = useQueryClient();
  
  const retryAll = () => {
    queryClient.invalidateQueries();
  };
  
  const retryQuery = (queryKey: readonly unknown[]) => {
    queryClient.invalidateQueries({ queryKey });
  };
  
  return { retryAll, retryQuery };
};