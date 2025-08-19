import React, { useState } from 'react';
import { PlusIcon, MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import VaultCard from './VaultCard';
import { useVaultStatus } from '@/hooks/useVaultStatus';

interface VaultDashboardProps {
  onCreateVault?: () => void;
  onViewVaultDetails?: (collectionName: string) => void;
}

const VaultDashboard: React.FC<VaultDashboardProps> = ({
  onCreateVault,
  onViewVaultDetails
}) => {
  // Use the custom hook for vault status management
  const [{ collections, isLoading, error }, { refresh, reindexVault, deleteVault, getDeleteConfirmation }] = useVaultStatus({
    refreshInterval: 30000, // 30 seconds
    enabled: true
  });

  // Search/filter state - declare BEFORE useEffect
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    collectionName: string;
    confirmationToken: string;
    isDeleting: boolean;
  } | null>(null);

  // Debug logging to identify vault card rendering issues
  React.useEffect(() => {
    console.log('[VaultDashboard] State Update:', {
      collectionsCount: collections.length,
      collections: collections,
      isLoading,
      error,
      filteredCollectionsCount: collections.filter(collection => {
        const matchesSearch = searchQuery === '' || 
          collection.collection_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          collection.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          collection.vault_path.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesStatus = filterStatus === 'all' || collection.status === filterStatus;
        
        return matchesSearch && matchesStatus;
      }).length,
      searchQuery,
      filterStatus
    });
  }, [collections, isLoading, error, searchQuery, filterStatus]);
  
  // Progress modal state - TEMPORARILY DISABLED
  // const [progressModal, setProgressModal] = useState<{
  //   isOpen: boolean;
  //   collectionName: string;
  // }>({
  //   isOpen: false,
  //   collectionName: '',
  // });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReindex = async (collectionName: string) => {
    try {
      await reindexVault(collectionName);
      
      // Show progress modal for indexing operations - TEMPORARILY DISABLED
      // setProgressModal({
      //   isOpen: true,
      //   collectionName,
      // });
      
      console.log(`Reindexing started for ${collectionName}`);
    } catch (err) {
      const error = err as Error;
      console.error('Error starting reindex:', error);
      alert(`Error starting reindex: ${error.message}`);
    }
  };

  const handleDelete = async (collectionName: string) => {
    try {
      const confirmationData = await getDeleteConfirmation(collectionName);
      setDeleteConfirm({
        collectionName,
        confirmationToken: confirmationData.confirmation_token,
        isDeleting: false
      });
    } catch (err) {
      const error = err as Error;
      console.error('Error getting delete confirmation:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    try {
      setDeleteConfirm(prev => prev ? { ...prev, isDeleting: true } : null);
      
      await deleteVault(deleteConfirm.collectionName, deleteConfirm.confirmationToken);
      setDeleteConfirm(null);
      
      console.log(`Collection ${deleteConfirm.collectionName} deletion started`);
    } catch (err) {
      const error = err as Error;
      console.error('Error deleting collection:', error);
      alert(`Error deleting collection: ${error.message}`);
      setDeleteConfirm(prev => prev ? { ...prev, isDeleting: false } : null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  // Filter collections based on search and status
  const filteredCollections = collections.filter(collection => {
    const matchesSearch = searchQuery === '' || 
      collection.collection_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      collection.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      collection.vault_path.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || collection.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Status counts for filter buttons
  const statusCounts = collections.reduce((acc, collection) => {
    acc[collection.status] = (acc[collection.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-600 dark:text-gray-400">Loading vault collections...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
          <div className="text-red-600 dark:text-red-400 mb-4">
            Error loading vault collections
          </div>
          <div className="text-sm text-red-700 dark:text-red-300 mb-4">
            {error}
          </div>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Vault Collections
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your indexed Obsidian vaults
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-2 px-4 py-2 text-gray-700 dark:text-gray-300 
              border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          
          <button
            onClick={onCreateVault}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg 
              hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>New Vault</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vaults..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 
                placeholder-gray-500 dark:placeholder-gray-400 
                focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        {/* Status Filter */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              filterStatus === 'all'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            All ({collections.length})
          </button>
          
          {['active', 'indexing', 'error', 'created'].map(status => (
            statusCounts[status] ? (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
                  filterStatus === status
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {status} ({statusCounts[status]})
              </button>
            ) : null
          ))}
        </div>
      </div>

      {/* Collections Grid */}
      {filteredCollections.length === 0 ? (
        <div className="text-center py-12">
          {searchQuery || filterStatus !== 'all' ? (
            <div>
              <div className="text-gray-600 dark:text-gray-400 mb-4">
                No vaults match your current filters.
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-500">
                Total collections: {collections.length} | Applied filters: {searchQuery ? `"${searchQuery}"` : 'none'} | Status: {filterStatus}
              </div>
            </div>
          ) : collections.length === 0 ? (
            <div>
              <div className="text-gray-600 dark:text-gray-400 mb-4">
                No vault collections found.
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                {error ? `Error: ${error}` : 'Ready to create your first vault collection.'}
              </div>
              <button
                onClick={onCreateVault}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg 
                  hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Create Your First Vault</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Showing {filteredCollections.length} of {collections.length} vault collections
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCollections.map((collection) => {
              try {
                return (
                  <VaultCard
                    key={collection.collection_name}
                    collection={collection}
                    onReindex={handleReindex}
                    onDelete={handleDelete}
                    onViewDetails={onViewVaultDetails}
                    isLoading={isRefreshing}
                  />
                );
              } catch (error) {
                console.error('[VaultDashboard] Error rendering VaultCard:', error, collection);
                return (
                  <div key={collection.collection_name} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="text-red-700 dark:text-red-300 text-sm">
                      Error rendering vault: {collection.collection_name}
                    </div>
                  </div>
                );
              }
            })}
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Vault Collection
            </h3>
            
            <div className="mb-4">
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Are you sure you want to delete the vault collection "{deleteConfirm.collectionName}"?
              </p>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                <p className="text-red-700 dark:text-red-300 text-sm font-medium">
                  ⚠️ This action cannot be undone. All indexed data will be permanently deleted.
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={cancelDelete}
                disabled={deleteConfirm.isDeleting}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 
                  rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed 
                  transition-colors"
              >
                Cancel
              </button>
              
              <button
                onClick={confirmDelete}
                disabled={deleteConfirm.isDeleting}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md 
                  hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteConfirm.isDeleting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>{deleteConfirm.isDeleting ? 'Deleting...' : 'Delete Vault'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal - TEMPORARILY DISABLED FOR DEBUGGING */}
      {/* <IndexingProgressModal
        collectionName={progressModal.collectionName}
        isOpen={progressModal.isOpen}
        onClose={() => setProgressModal({ isOpen: false, collectionName: '' })}
      /> */}
    </div>
  );
};

export default VaultDashboard;