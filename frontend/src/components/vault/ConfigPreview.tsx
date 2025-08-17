import React from 'react';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  ClockIcon, 
  FolderIcon,
  CogIcon,
  DocumentTextIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import { VaultConfig } from '@/types';

interface ConfigPreviewProps {
  config: VaultConfig;
  validationErrors: Array<{ field: string; message: string; }>;
  isValid: boolean;
  onEdit?: () => void;
  showSensitive?: boolean;
  className?: string;
}

const ConfigPreview: React.FC<ConfigPreviewProps> = ({
  config,
  validationErrors,
  isValid,
  onEdit,
  showSensitive = false,
  className = ""
}) => {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const getScheduleSummary = (): string => {
    if (!config.schedule?.enabled || config.schedule.frequency === 'manual') {
      return 'Manual indexing only';
    }

    const { frequency, time, interval, days_of_week, timezone } = config.schedule;
    const tz = timezone || 'UTC';

    switch (frequency) {
      case 'hourly':
        return `Every ${interval || 6} hours in ${tz}`;
      case 'daily':
        return `Daily at ${time || '02:00'} ${tz}`;
      case 'weekly': {
        const days = days_of_week || [1];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayString = days.map(d => dayNames[d]).join(', ');
        return `Weekly on ${dayString} at ${time || '02:00'} ${tz}`;
      }
      case 'custom':
        return `Custom: ${config.schedule.cron_expression || '0 2 * * *'} in ${tz}`;
      default:
        return 'Unknown schedule';
    }
  };

  const formatFileSize = (mb: number): string => {
    if (mb < 1) return `${(mb * 1024).toFixed(0)} KB`;
    return `${mb} MB`;
  };

  const truncatePath = (path: string, maxLength: number = 50): string => {
    if (path.length <= maxLength) return path;
    const start = path.substring(0, 15);
    const end = path.substring(path.length - (maxLength - 18));
    return `${start}...${end}`;
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${isValid ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
              {isValid ? (
                <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : (
                <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Configuration Preview
              </h3>
              <p className={`text-sm ${isValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isValid ? 'Ready to create vault' : `${validationErrors.length} issue${validationErrors.length !== 1 ? 's' : ''} found`}
              </p>
            </div>
          </div>
          {onEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
            >
              Edit Configuration
            </button>
          )}
        </div>
      </div>

      {/* Basic Information */}
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <DocumentTextIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Vault Name
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100 break-words">
                  {config.vault_name || <span className="text-gray-400 italic">Not specified</span>}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <FolderIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Vault Path
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100 break-all" title={config.vault_path}>
                  {config.vault_path ? (
                    showSensitive ? config.vault_path : truncatePath(config.vault_path)
                  ) : (
                    <span className="text-gray-400 italic">Not specified</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <ClockIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Indexing Schedule
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {getScheduleSummary()}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <DocumentTextIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {config.description || <span className="text-gray-400 italic">No description</span>}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Settings Preview */}
        {config.advanced && (
          <div className="mt-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <CogIcon className="w-4 h-4" />
              <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Settings</span>
              {showAdvanced ? (
                <EyeSlashIcon className="w-4 h-4" />
              ) : (
                <EyeIcon className="w-4 h-4" />
              )}
            </button>

            {showAdvanced && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Chunk Size:</span>
                    <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                      {config.advanced.chunk_size} tokens
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Chunk Overlap:</span>
                    <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                      {config.advanced.chunk_overlap} tokens
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Max File Size:</span>
                    <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                      {formatFileSize(config.advanced.max_file_size_mb)}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Embedding Model:</span>
                    <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                      {config.advanced.embedding_model}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">File Types:</span>
                    <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                      {config.advanced.file_types.join(', ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Ignore Patterns:</span>
                    <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                      {config.advanced.ignore_patterns.length} configured
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="px-6 pb-6">
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="ml-3">
                <h4 className="text-sm font-medium text-red-800 dark:text-red-400">
                  Configuration Issues
                </h4>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <ul className="list-disc list-inside space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error.message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Summary Stats */}
      <div className="px-6 pb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-400 mb-2">
            Estimated Processing
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-600 dark:text-blue-400 font-medium">Chunk Size:</span>
              <p className="text-blue-800 dark:text-blue-200">
                {config.advanced?.chunk_size || 1000} tokens
              </p>
            </div>
            <div>
              <span className="text-blue-600 dark:text-blue-400 font-medium">File Types:</span>
              <p className="text-blue-800 dark:text-blue-200">
                {config.advanced?.file_types.length || 2} types
              </p>
            </div>
            <div>
              <span className="text-blue-600 dark:text-blue-400 font-medium">Max Size:</span>
              <p className="text-blue-800 dark:text-blue-200">
                {formatFileSize(config.advanced?.max_file_size_mb || 10)}
              </p>
            </div>
            <div>
              <span className="text-blue-600 dark:text-blue-400 font-medium">Auto Sync:</span>
              <p className="text-blue-800 dark:text-blue-200">
                {config.schedule?.enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigPreview;