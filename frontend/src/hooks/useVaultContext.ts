import { useState, useEffect, useCallback } from 'react';

interface VaultContextState {
  currentVault: string | null;
  isLoading: boolean;
  error: string | null;
}

interface VaultContextActions {
  switchVault: (vaultName: string) => void;
  clearVault: () => void;
  setFromUrl: () => void;
}

const STORAGE_KEY = 'vault-mind-current-vault';

/**
 * Hook for managing vault context with URL state synchronization
 * Provides persistent vault selection across page loads and navigation
 */
export const useVaultContext = (): [VaultContextState, VaultContextActions] => {
  const [state, setState] = useState<VaultContextState>({
    currentVault: null,
    isLoading: true,
    error: null,
  });

  // Get vault from URL parameters
  const getVaultFromUrl = useCallback((): string | null => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('vault');
    } catch {
      return null;
    }
  }, []);

  // Update URL with vault parameter
  const updateUrlWithVault = useCallback((vaultName: string | null) => {
    try {
      const url = new URL(window.location.href);
      if (vaultName) {
        url.searchParams.set('vault', vaultName);
      } else {
        url.searchParams.delete('vault');
      }
      
      // Use replaceState to avoid adding to browser history for every vault switch
      window.history.replaceState(
        { ...window.history.state, vault: vaultName },
        '',
        url.toString()
      );
    } catch (error) {
      console.warn('Failed to update URL with vault:', error);
    }
  }, []);

  // Load vault from URL or localStorage on mount
  useEffect(() => {
    const loadInitialVault = async () => {
      try {
        // Priority: URL > localStorage > null
        let vaultName = getVaultFromUrl();
        
        if (!vaultName) {
          // Fallback to localStorage
          try {
            vaultName = localStorage.getItem(STORAGE_KEY);
          } catch {
            // localStorage might be disabled
          }
        }

        setState(prev => ({
          ...prev,
          currentVault: vaultName,
          isLoading: false,
        }));

        // Ensure URL reflects the current vault
        if (vaultName && !getVaultFromUrl()) {
          updateUrlWithVault(vaultName);
        }
      } catch (error) {
        console.error('Failed to load initial vault:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to load vault context',
          isLoading: false,
        }));
      }
    };

    loadInitialVault();
  }, [getVaultFromUrl, updateUrlWithVault]);

  // Listen for URL changes (back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const urlVault = getVaultFromUrl();
      setState(prev => ({
        ...prev,
        currentVault: urlVault,
      }));

      // Sync with localStorage
      try {
        if (urlVault) {
          localStorage.setItem(STORAGE_KEY, urlVault);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // Ignore localStorage errors
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [getVaultFromUrl]);

  // Switch to a different vault
  const switchVault = useCallback((vaultName: string) => {
    const startTime = performance.now();
    
    try {
      setState(prev => ({
        ...prev,
        currentVault: vaultName,
        error: null,
      }));

      // Update URL
      updateUrlWithVault(vaultName);

      // Update localStorage
      try {
        localStorage.setItem(STORAGE_KEY, vaultName);
      } catch {
        // Ignore localStorage errors
      }

      // Performance tracking
      const endTime = performance.now();
      const switchTime = endTime - startTime;
      
      if (switchTime > 50) {
        console.warn(`Vault switch took ${switchTime.toFixed(2)}ms (target: <50ms)`);
      }

      console.log(`Switched to vault: ${vaultName} (${switchTime.toFixed(2)}ms)`);
    } catch (error) {
      console.error('Failed to switch vault:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to switch vault',
      }));
    }
  }, [updateUrlWithVault]);

  // Clear current vault selection
  const clearVault = useCallback(() => {
    try {
      setState(prev => ({
        ...prev,
        currentVault: null,
        error: null,
      }));

      // Update URL
      updateUrlWithVault(null);

      // Clear localStorage
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore localStorage errors
      }

      console.log('Cleared vault selection');
    } catch (error) {
      console.error('Failed to clear vault:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to clear vault',
      }));
    }
  }, [updateUrlWithVault]);

  // Force reload vault from URL (useful after navigation)
  const setFromUrl = useCallback(() => {
    const urlVault = getVaultFromUrl();
    setState(prev => ({
      ...prev,
      currentVault: urlVault,
    }));

    // Sync with localStorage
    try {
      if (urlVault) {
        localStorage.setItem(STORAGE_KEY, urlVault);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [getVaultFromUrl]);

  const actions: VaultContextActions = {
    switchVault,
    clearVault,
    setFromUrl,
  };

  return [state, actions];
};

/**
 * Get current vault from URL or localStorage (synchronous)
 * Useful for components that need immediate access without hook
 */
export const getCurrentVault = (): string | null => {
  // Try URL first
  try {
    const params = new URLSearchParams(window.location.search);
    const urlVault = params.get('vault');
    if (urlVault) return urlVault;
  } catch {
    // Ignore URL parsing errors
  }

  // Fallback to localStorage
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * Build URL with vault parameter
 */
export const buildVaultUrl = (path: string, vaultName?: string): string => {
  try {
    const url = new URL(path, window.location.origin);
    if (vaultName) {
      url.searchParams.set('vault', vaultName);
    }
    return url.toString();
  } catch {
    return path;
  }
};

export default useVaultContext;