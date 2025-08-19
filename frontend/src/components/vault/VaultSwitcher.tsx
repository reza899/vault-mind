import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MagnifyingGlassIcon,
  FolderIcon,
  ClockIcon,
  ChevronRightIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useKeyboardShortcut, formatShortcut } from '@/hooks/useKeyboardShortcut';
import { useVaultStatus } from '@/hooks/useVaultStatus';

interface VaultSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  currentVaultName?: string;
  onVaultSelect: (vaultName: string) => void;
  onCreateVault?: () => void;
}

// Vault color mapping for visual identification
const VAULT_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
  'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400',
  'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
] as const;

const getVaultColor = (vaultName: string): string => {
  // Hash vault name to consistent color
  let hash = 0;
  for (let i = 0; i < vaultName.length; i++) {
    hash = ((hash << 5) - hash + vaultName.charCodeAt(i)) & 0xffffffff;
  }
  return VAULT_COLORS[Math.abs(hash) % VAULT_COLORS.length];
};

const getRecentVaults = (): string[] => {
  try {
    const recent = localStorage.getItem('vault-mind-recent-vaults');
    return recent ? JSON.parse(recent) : [];
  } catch {
    return [];
  }
};

const addToRecentVaults = (vaultName: string) => {
  try {
    const recent = getRecentVaults();
    const updated = [vaultName, ...recent.filter(name => name !== vaultName)].slice(0, 5);
    localStorage.setItem('vault-mind-recent-vaults', JSON.stringify(updated));
  } catch (error) {
    console.warn('Failed to save recent vault:', error);
  }
};

const VaultSwitcher: React.FC<VaultSwitcherProps> = ({
  isOpen,
  onClose,
  currentVaultName,
  onVaultSelect,
  onCreateVault
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get all vaults
  const [{ collections, isLoading, error }] = useVaultStatus({
    refreshInterval: 0, // No auto-refresh needed for switcher
    enabled: isOpen
  });

  const recentVaults = useMemo(() => getRecentVaults(), []);

  // Filter and sort vaults
  const filteredVaults = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show recent vaults first, then all others
      const recentSet = new Set(recentVaults);
      const recent = collections.filter(vault => recentSet.has(vault.collection_name));
      const others = collections.filter(vault => !recentSet.has(vault.collection_name));
      
      return [
        ...recent.sort((a, b) => {
          const aIndex = recentVaults.indexOf(a.collection_name);
          const bIndex = recentVaults.indexOf(b.collection_name);
          return aIndex - bIndex;
        }),
        ...others.sort((a, b) => a.collection_name.localeCompare(b.collection_name))
      ];
    }

    // Filter by search query
    const query = searchQuery.toLowerCase();
    return collections
      .filter(vault => 
        vault.collection_name.toLowerCase().includes(query) ||
        vault.description?.toLowerCase().includes(query) ||
        vault.vault_path.toLowerCase().includes(query)
      )
      .sort((a, b) => {
        // Prioritize name matches over description/path matches
        const aNameMatch = a.collection_name.toLowerCase().includes(query);
        const bNameMatch = b.collection_name.toLowerCase().includes(query);
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        return a.collection_name.localeCompare(b.collection_name);
      });
  }, [collections, searchQuery, recentVaults]);

  // Reset selection when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredVaults]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle vault selection
  const handleSelect = (vaultName: string) => {
    addToRecentVaults(vaultName);
    onVaultSelect(vaultName);
    onClose();
  };

  // Keyboard navigation within modal
  useKeyboardShortcut('ArrowDown', () => {
    if (!isOpen) return;
    setSelectedIndex(prev => Math.min(prev + 1, filteredVaults.length - 1));
  }, { enabled: isOpen });

  useKeyboardShortcut('ArrowUp', () => {
    if (!isOpen) return;
    setSelectedIndex(prev => Math.max(prev - 1, 0));
  }, { enabled: isOpen });

  useKeyboardShortcut('Enter', () => {
    if (!isOpen) return;
    const selectedVault = filteredVaults[selectedIndex];
    if (selectedVault) {
      handleSelect(selectedVault.collection_name);
    } else if (onCreateVault && searchQuery.trim()) {
      onCreateVault();
      onClose();
    }
  }, { enabled: isOpen });

  useKeyboardShortcut('Escape', () => {
    if (isOpen) {
      onClose();
    }
  }, { enabled: isOpen });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-[10vh] p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[70vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <FolderIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Switch Vault
            </h2>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatShortcut('cmd+k')}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vaults..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 
                placeholder-gray-500 dark:placeholder-gray-400 
                focus:ring-2 focus:ring-blue-500 focus:border-transparent
                outline-none"
            />
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-gray-600 dark:text-gray-400">Loading vaults...</span>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-600 dark:text-red-400">
              Error loading vaults: {error}
            </div>
          ) : filteredVaults.length === 0 && searchQuery ? (
            <div className="p-4 text-center">
              <div className="text-gray-600 dark:text-gray-400 mb-4">
                No vaults found matching "{searchQuery}"
              </div>
              {onCreateVault && (
                <button
                  onClick={() => {
                    onCreateVault();
                    onClose();
                  }}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg 
                    hover:bg-blue-700 transition-colors"
                >
                  <span>Create new vault</span>
                </button>
              )}
            </div>
          ) : filteredVaults.length === 0 ? (
            <div className="p-4 text-center">
              <div className="text-gray-600 dark:text-gray-400 mb-4">
                No vaults configured yet
              </div>
              {onCreateVault && (
                <button
                  onClick={() => {
                    onCreateVault();
                    onClose();
                  }}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg 
                    hover:bg-blue-700 transition-colors"
                >
                  <span>Create your first vault</span>
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {/* Recent Section */}
              {!searchQuery && recentVaults.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center space-x-2 px-2 py-1 mb-1">
                    <ClockIcon className="w-3 h-3 text-gray-400" />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Recent
                    </span>
                  </div>
                </div>
              )}

              {/* Vault List */}
              {filteredVaults.map((vault, index) => {
                const isSelected = index === selectedIndex;
                const isCurrent = vault.collection_name === currentVaultName;
                const isRecent = recentVaults.includes(vault.collection_name);
                
                return (
                  <button
                    key={vault.collection_name}
                    onClick={() => handleSelect(vault.collection_name)}
                    className={`w-full text-left px-4 py-3 flex items-center space-x-3 transition-colors
                      ${isSelected 
                        ? 'bg-blue-50 dark:bg-blue-900/20' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    {/* Vault Icon with Color */}
                    <div className={`p-2 rounded-lg ${getVaultColor(vault.collection_name)}`}>
                      <FolderIcon className="w-4 h-4" />
                    </div>

                    {/* Vault Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {vault.collection_name}
                        </span>
                        
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded">
                            Current
                          </span>
                        )}
                        
                        {isRecent && !searchQuery && (
                          <ClockIcon className="w-3 h-3 text-gray-400" />
                        )}
                      </div>
                      
                      {vault.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {vault.description}
                        </p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>{vault.document_count.toLocaleString()} docs</span>
                        <span className="capitalize">{vault.status}</span>
                      </div>
                    </div>

                    {/* Selection Indicator */}
                    {isSelected && (
                      <ChevronRightIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-4">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>Esc Close</span>
            </div>
            {onCreateVault && (
              <span>Type to search or create</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaultSwitcher;