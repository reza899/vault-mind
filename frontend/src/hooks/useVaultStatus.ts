import { useState, useEffect, useCallback } from 'react';
import apiClient, { type Collection } from '@/services/apiClient';

interface UseVaultStatusOptions {
  refreshInterval?: number; // milliseconds
  enabled?: boolean;
}

interface VaultStatusState {
  collections: Collection[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface VaultStatusActions {
  refresh: () => Promise<void>;
  reindexVault: (collectionName: string) => Promise<void>;
  deleteVault: (collectionName: string, confirmationToken: string) => Promise<void>;
  getDeleteConfirmation: (collectionName: string) => Promise<{
    collection_name: string;
    vault_path: string;
    document_count: number;
    size_estimate: number;
    created_at: string;
    confirmation_token: string;
    token_expires_in: number;
    warning: string;
  }>;
}

/**
 * Custom hook for managing vault status with real-time updates
 */
export const useVaultStatus = (options: UseVaultStatusOptions = {}): [VaultStatusState, VaultStatusActions] => {
  const { refreshInterval = 30000, enabled = true } = options;

  const [state, setState] = useState<VaultStatusState>({
    collections: [],
    isLoading: true,
    error: null,
    lastUpdated: null,
  });

  const refresh = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await apiClient.getCollections();
      
      console.log('[useVaultStatus] API Response:', {
        status: response.status,
        collectionsCount: response.status === 'success' ? response.data.collections.length : 0,
        collections: response.status === 'success' ? response.data.collections : null,
        error: response.status === 'error' ? response.message : null
      });
      
      if (response.status === 'success') {
        setState(prev => ({
          ...prev,
          collections: response.data.collections,
          isLoading: false,
          lastUpdated: new Date(),
        }));
      } else {
        throw new Error(response.message || 'Failed to fetch collections');
      }
    } catch (err) {
      console.error('Error fetching vault collections:', err);
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load vault collections',
        isLoading: false,
      }));
    }
  }, []);

  const reindexVault = useCallback(async (collectionName: string) => {
    try {
      const response = await apiClient.reindexCollection(collectionName, 'incremental');
      
      if (response.status === 'success') {
        // Update the specific collection's status to indexing
        setState(prev => ({
          ...prev,
          collections: prev.collections.map(collection =>
            collection.collection_name === collectionName
              ? { ...collection, status: 'indexing' as const }
              : collection
          ),
        }));
        
        // Trigger a refresh after a short delay to get updated status
        setTimeout(async () => {
          try {
            const response = await apiClient.getCollections();
            if (response.status === 'success') {
              setState(prev => ({
                ...prev,
                collections: response.data.collections,
                lastUpdated: new Date(),
              }));
            }
          } catch (err) {
            console.debug('Delayed refresh error (ignoring):', err);
          }
        }, 2000);
        
        console.log(`Reindexing started for ${collectionName}: ${response.data.job_id}`);
      } else {
        throw new Error(response.message || 'Failed to start reindexing');
      }
    } catch (err) {
      console.error('Error starting reindex:', err);
      throw err;
    }
  }, []);

  const deleteVault = useCallback(async (collectionName: string, confirmationToken: string) => {
    try {
      const response = await apiClient.deleteCollection(collectionName, confirmationToken);
      
      if (response.status === 'success') {
        // Remove the collection from local state immediately
        setState(prev => ({
          ...prev,
          collections: prev.collections.filter(c => c.collection_name !== collectionName),
        }));
        
        console.log(`Collection ${collectionName} deletion started`);
      } else {
        throw new Error(response.message || 'Failed to delete collection');
      }
    } catch (err) {
      console.error('Error deleting collection:', err);
      throw err;
    }
  }, []);

  const getDeleteConfirmation = useCallback(async (collectionName: string) => {
    try {
      const response = await apiClient.getDeleteConfirmation(collectionName);
      
      if (response.status === 'success') {
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to get delete confirmation');
      }
    } catch (err) {
      console.error('Error getting delete confirmation:', err);
      throw err;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      const initialFetch = async () => {
        try {
          setState(prev => ({ ...prev, isLoading: true, error: null }));
          
          const response = await apiClient.getCollections();
          
          if (response.status === 'success') {
            setState(prev => ({
              ...prev,
              collections: response.data.collections,
              isLoading: false,
              lastUpdated: new Date(),
            }));
          } else {
            throw new Error(response.message || 'Failed to fetch collections');
          }
        } catch (err) {
          console.error('Error fetching vault collections:', err);
          setState(prev => ({
            ...prev,
            error: err instanceof Error ? err.message : 'Failed to load vault collections',
            isLoading: false,
          }));
        }
      };
      
      initialFetch();
    }
  }, [enabled]);

  // Set up polling for real-time updates
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) return;

    const interval = setInterval(async () => {
      // Only refresh if we're not currently loading and there's no error
      try {
        const response = await apiClient.getCollections();
        
        if (response.status === 'success') {
          setState(prev => {
            // Only update if we're not loading and have no error
            if (!prev.isLoading && !prev.error) {
              return {
                ...prev,
                collections: response.data.collections,
                lastUpdated: new Date(),
              };
            }
            return prev;
          });
        }
      } catch (err) {
        // Silently ignore polling errors to prevent console spam
        console.debug('Polling error (ignoring):', err);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [enabled, refreshInterval]);

  // Real-time status updates for collections that are indexing
  useEffect(() => {
    if (!enabled) return;

    const indexingCollections = state.collections.filter(
      c => c.status === 'indexing' || c.status === 'deleting'
    );

    if (indexingCollections.length === 0) return;

    // More frequent updates for active operations
    const activeUpdateInterval = setInterval(async () => {
      try {
        const response = await apiClient.getCollections();
        
        if (response.status === 'success') {
          setState(prev => ({
            ...prev,
            collections: response.data.collections,
            lastUpdated: new Date(),
          }));
        }
      } catch (err) {
        console.debug('Active operations polling error (ignoring):', err);
      }
    }, 5000); // 5 second updates for active operations

    return () => clearInterval(activeUpdateInterval);
  }, [enabled, state.collections]); // Include full dependency

  const actions: VaultStatusActions = {
    refresh,
    reindexVault,
    deleteVault,
    getDeleteConfirmation,
  };

  return [state, actions];
};

export default useVaultStatus;