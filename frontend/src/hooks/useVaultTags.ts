import { useState, useCallback } from 'react';
import apiClient from '@/services/apiClient';

export interface VaultTag {
  name: string;
  frequency: number;
  type: 'content' | 'frontmatter' | 'unknown';
}

interface UseVaultTagsState {
  tags: VaultTag[];
  isLoading: boolean;
  error: string | null;
  totalTags: number;
}

interface UseVaultTagsActions {
  fetchTags: (vaultName: string, limit?: number) => Promise<void>;
  clearTags: () => void;
  searchTags: (query: string) => VaultTag[];
}

/**
 * Hook for managing vault tags with caching and search functionality
 */
export const useVaultTags = (): [UseVaultTagsState, UseVaultTagsActions] => {
  const [state, setState] = useState<UseVaultTagsState>({
    tags: [],
    isLoading: false,
    error: null,
    totalTags: 0,
  });

  // Cache tags by vault name to avoid refetching
  const [tagCache, setTagCache] = useState<Map<string, { tags: VaultTag[]; totalTags: number }>>(new Map());

  const fetchTags = useCallback(async (vaultName: string, limit: number = 100) => {
    // Check cache first
    const cached = tagCache.get(vaultName);
    if (cached) {
      setState(prev => ({
        ...prev,
        tags: cached.tags,
        totalTags: cached.totalTags,
        error: null,
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await apiClient.getVaultTags(vaultName, limit);
      
      if (response.status === 'success') {
        const { tags, total_tags } = response.data;
        
        // Update cache
        setTagCache(prev => new Map(prev).set(vaultName, { tags, totalTags: total_tags }));
        
        setState(prev => ({
          ...prev,
          tags,
          totalTags: total_tags,
          isLoading: false,
          error: null,
        }));
      } else {
        throw new Error('Failed to fetch tags');
      }
    } catch (error) {
      const err = error as Error;
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Failed to fetch vault tags',
      }));
    }
  }, [tagCache]);

  const clearTags = useCallback(() => {
    setState({
      tags: [],
      isLoading: false,
      error: null,
      totalTags: 0,
    });
  }, []);

  const searchTags = useCallback((query: string): VaultTag[] => {
    if (!query.trim()) {
      return state.tags;
    }

    const searchTerm = query.toLowerCase().replace('#', '');
    
    return state.tags.filter(tag => 
      tag.name.toLowerCase().includes(searchTerm)
    ).sort((a, b) => {
      // Prioritize exact matches and higher frequency
      const aExact = a.name.toLowerCase() === searchTerm;
      const bExact = b.name.toLowerCase() === searchTerm;
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // Then sort by frequency
      return b.frequency - a.frequency;
    });
  }, [state.tags]);

  const actions: UseVaultTagsActions = {
    fetchTags,
    clearTags,
    searchTags,
  };

  return [state, actions];
};

export default useVaultTags;