import React from 'react';
import { 
  MagnifyingGlassIcon, 
  ExclamationTriangleIcon,
  FolderIcon,
  DocumentPlusIcon
} from '@heroicons/react/24/outline';

interface EmptyStateProps {
  type: 'no-query' | 'no-results' | 'no-vault' | 'error';
  query?: string;
  vaultName?: string;
  onRetry?: () => void;
  onConfigureVault?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  query,
  vaultName,
  onRetry,
  onConfigureVault,
  className = "",
}) => {
  const renderContent = () => {
    switch (type) {
      case 'no-query':
        return (
          <div className="text-center">
            <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              Start Your Search
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Enter a search query above to find relevant content in your vault. 
              Use natural language or specific keywords.
            </p>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              <p className="mb-1">💡 <strong>Tips:</strong></p>
              <ul className="text-left space-y-1 max-w-sm mx-auto">
                <li>• Try "explain machine learning" for concepts</li>
                <li>• Use "meeting notes 2024" for specific content</li>
                <li>• Search for "TODO" or "action items"</li>
              </ul>
            </div>
          </div>
        );

      case 'no-results':
        return (
          <div className="text-center">
            <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              No Results Found
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              We couldn't find any content matching "<strong>{query}</strong>" 
              {vaultName && ` in vault "${vaultName}"`}.
            </p>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              <p className="mb-2">Try:</p>
              <ul className="text-left space-y-1 max-w-sm mx-auto">
                <li>• Using different or more general keywords</li>
                <li>• Checking spelling and terminology</li>
                <li>• Searching with fewer words</li>
                <li>• Using synonyms or related terms</li>
              </ul>
            </div>
          </div>
        );

      case 'no-vault':
        return (
          <div className="text-center">
            <FolderIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              No Vault Selected
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Please select a vault to search from the dropdown above, 
              or configure a new vault to get started.
            </p>
            {onConfigureVault && (
              <button
                onClick={onConfigureVault}
                className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <DocumentPlusIcon className="h-4 w-4 mr-2" />
                Configure Vault
              </button>
            )}
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400 dark:text-red-500" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              Search Error
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Something went wrong while searching. 
              Please check your connection and try again.
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`py-12 px-6 ${className}`}>
      {renderContent()}
    </div>
  );
};

export default EmptyState;