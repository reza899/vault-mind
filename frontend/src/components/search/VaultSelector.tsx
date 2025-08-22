import React from 'react';
import { ChevronDownIcon, FolderIcon } from '@heroicons/react/24/outline';
import { useVaultConfigStore } from '@/stores/vaultConfigStore';
import { useVaultStatus } from '@/hooks/useVaultStatus';

interface VaultSelectorProps {
  selectedVault: string;
  onVaultChange: (vaultName: string) => void;
  disabled?: boolean;
  className?: string;
}

export const VaultSelector: React.FC<VaultSelectorProps> = ({
  selectedVault,
  onVaultChange,
  disabled = false,
  className = "",
}) => {
  const { recentConfigs } = useVaultConfigStore();
  const [{ collections }] = useVaultStatus({ refreshInterval: 30000, enabled: true });

  // Convert collections to vault config format for compatibility
  const collectionsAsConfigs = collections.map(collection => {
    // Extract actual vault name by removing 'vault_' prefix
    const actualVaultName = collection.collection_name.startsWith('vault_') 
      ? collection.collection_name.substring(6)  // Remove 'vault_' prefix
      : collection.collection_name;
    
    return {
      vault_name: actualVaultName,
      collection_name: collection.collection_name, // Keep original for reference
      vault_path: collection.vault_path,
      description: collection.description,
    };
  });

  // Combine recent configs with actual collections, prioritizing actual collections
  const collectionNames = new Set(collections.map(c => c.collection_name));
  const validRecentConfigs = recentConfigs.filter(config => 
    collectionNames.has(config.vault_name)
  );

  // Use actual collections as the source of truth
  const availableVaults = collectionsAsConfigs.length > 0 
    ? collectionsAsConfigs 
    : validRecentConfigs;

  if (availableVaults.length === 0) {
    return (
      <div className={`${className}`}>
        <div className="relative">
          <div className="flex items-center px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400">
            <FolderIcon className="h-4 w-4 mr-2" />
            <span className="text-sm">No vaults configured</span>
          </div>
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Create a vault collection first to enable search
        </div>
      </div>
    );
  }

  const handleVaultChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onVaultChange(e.target.value);
  };

  const selectedVaultConfig = availableVaults.find(v => v.vault_name === selectedVault);

  return (
    <div className={`${className}`}>
      <div className="relative">
        <select
          value={selectedVault}
          onChange={handleVaultChange}
          disabled={disabled}
          className="w-full pl-10 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors appearance-none"
        >
          <option value="">Select a vault</option>
          {availableVaults.map((vault) => (
            <option key={vault.vault_name} value={vault.vault_name}>
              {vault.vault_name}
            </option>
          ))}
        </select>
        
        {/* Folder icon */}
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FolderIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>

        {/* Dropdown chevron */}
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <ChevronDownIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>
      </div>

      {/* Vault info */}
      {selectedVaultConfig && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          <div className="truncate">
            Path: {selectedVaultConfig.vault_path}
          </div>
          {selectedVaultConfig.description && (
            <div className="truncate">
              {selectedVaultConfig.description}
            </div>
          )}
        </div>
      )}

      {/* No vault selected hint */}
      {!selectedVault && availableVaults.length > 0 && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Choose a vault to search
        </div>
      )}
    </div>
  );
};

export default VaultSelector;