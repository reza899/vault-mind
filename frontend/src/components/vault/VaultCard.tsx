import React, { useState } from 'react';
import {
  FolderIcon,
  DocumentTextIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PlayIcon,
  TrashIcon,
  Cog6ToothIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import type { Collection } from '@/services/apiClient';

interface VaultCardProps {
  collection: Collection;
  onReindex?: (collectionName: string) => void;
  onDelete?: (collectionName: string) => void;
  onViewDetails?: (collectionName: string) => void;
  isLoading?: boolean;
}

const StatusBadge: React.FC<{ status: Collection['status']; healthStatus: Collection['health_status'] }> = ({ 
  status, 
  healthStatus 
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'active':
        return {
          color: healthStatus === 'healthy' ? 'green' : 'yellow',
          icon: healthStatus === 'healthy' ? CheckCircleIcon : ExclamationTriangleIcon,
          text: healthStatus === 'healthy' ? 'Active' : 'Active (Issues)'
        };
      case 'indexing':
        return {
          color: 'blue',
          icon: ArrowPathIcon,
          text: 'Indexing'
        };
      case 'created':
        return {
          color: 'gray',
          icon: ClockIcon,
          text: 'Created'
        };
      case 'error':
        return {
          color: 'red',
          icon: ExclamationTriangleIcon,
          text: 'Error'
        };
      case 'paused':
        return {
          color: 'yellow',
          icon: ClockIcon,
          text: 'Paused'
        };
      case 'deleting':
        return {
          color: 'red',
          icon: TrashIcon,
          text: 'Deleting'
        };
      default:
        return {
          color: 'gray',
          icon: ClockIcon,
          text: 'Unknown'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  
  const colorClasses = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[config.color]}`}>
      <Icon className="w-3 h-3 mr-1" />
      {config.text}
    </span>
  );
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return 'Never';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    
    return date.toLocaleDateString();
  } catch {
    return 'Invalid date';
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const VaultCard: React.FC<VaultCardProps> = ({
  collection,
  onReindex,
  onDelete,
  onViewDetails,
  isLoading = false
}) => {
  const [showActions, setShowActions] = useState(false);

  const handleReindex = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReindex?.(collection.collection_name);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(collection.collection_name);
  };

  const handleViewDetails = () => {
    onViewDetails?.(collection.collection_name);
  };

  return (
    <div 
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 
        hover:border-blue-300 dark:hover:border-blue-600 transition-colors duration-200
        ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
      `}
      onClick={!isLoading ? handleViewDetails : undefined}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
              <FolderIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {collection.collection_name}
              </h3>
              {collection.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {collection.description}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex-shrink-0 ml-2">
            <StatusBadge status={collection.status} healthStatus={collection.health_status} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-2">
        {/* Vault Path */}
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 truncate">
          📁 {collection.vault_path}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="flex items-center space-x-2">
            <DocumentTextIcon className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {collection.document_count.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Documents</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <ClockIcon className="w-4 h-4 text-gray-400" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDate(collection.last_indexed_at)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Last indexed</div>
            </div>
          </div>
        </div>

        {/* Size */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
          <span>Size: {formatFileSize(collection.size_bytes)}</span>
          <span>ChromaDB: {collection.chroma_exists ? '✅' : '❌'}</span>
        </div>

        {/* Error Message */}
        {collection.error_message && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-2 mb-3">
            <div className="flex items-start space-x-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 dark:text-red-300">
                {collection.error_message}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={`px-4 pb-4 transition-opacity duration-200 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center justify-between space-x-2">
          <button
            onClick={handleViewDetails}
            disabled={isLoading}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 
              hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Cog6ToothIcon className="w-3 h-3" />
            <span>Details</span>
          </button>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={handleReindex}
              disabled={isLoading || collection.status === 'indexing' || collection.status === 'deleting'}
              className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 
                hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Re-index vault"
            >
              <PlayIcon className="w-3 h-3" />
              <span>Reindex</span>
            </button>
            
            <button
              onClick={handleDelete}
              disabled={isLoading || collection.status === 'deleting'}
              className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 
                hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete vault"
            >
              <TrashIcon className="w-3 h-3" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaultCard;