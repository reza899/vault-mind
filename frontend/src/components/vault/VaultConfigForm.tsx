import React, { useState, useEffect } from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import PathPicker from './PathPicker';
import ScheduleConfig from './ScheduleConfig';
import AdvancedSettings from './AdvancedSettings';
import { VaultConfig, IndexingSchedule, AdvancedConfig } from '@/types';
import { useVaultConfigStore } from '@/stores/vaultConfigStore';

interface ValidationError {
  field: string;
  message: string;
}

interface VaultConfigFormProps {
  onSubmit: (config: VaultConfig) => void;
  initialConfig?: Partial<VaultConfig>;
  loading?: boolean;
  className?: string;
}

const VaultConfigForm: React.FC<VaultConfigFormProps> = ({
  onSubmit,
  initialConfig,
  loading = false,
  className = ""
}) => {
  // Form state
  const [vaultName, setVaultName] = useState(initialConfig?.vault_name || '');
  const [vaultPath, setVaultPath] = useState(initialConfig?.vault_path || '');
  const [description, setDescription] = useState(initialConfig?.description || '');
  const [schedule, setSchedule] = useState<IndexingSchedule>({
    enabled: false,
    frequency: 'manual',
    time: '02:00',
    timezone: 'America/New_York'
  });
  const [advancedConfig, setAdvancedConfig] = useState<AdvancedConfig>({
    chunk_size: 1000,
    chunk_overlap: 200,
    embedding_model: 'all-MiniLM-L6-v2',
    ignore_patterns: ['.obsidian/**', '.trash/**', 'templates/**'],
    file_types: ['.md', '.txt'],
    max_file_size_mb: 10
  });

  // Validation state
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Store actions
  const { validateConfig } = useVaultConfigStore();

  // Auto-generate vault name from path
  useEffect(() => {
    if (vaultPath && !vaultName) {
      const folderName = vaultPath.split('/').pop() || '';
      setVaultName(folderName);
    }
  }, [vaultPath, vaultName]);

  // Real-time validation
  useEffect(() => {
    const config: VaultConfig = {
      vault_name: vaultName,
      vault_path: vaultPath,
      description,
      schedule,
      advanced: advancedConfig
    };

    const validationErrors = validateConfig(config);
    setErrors(validationErrors);
  }, [vaultName, vaultPath, description, schedule, advancedConfig, validateConfig]);

  const handleFieldTouch = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const getFieldError = (field: string): string | undefined => {
    if (!touched[field]) return undefined;
    return errors.find(err => err.field === field)?.message;
  };

  const hasFieldError = (field: string): boolean => {
    return Boolean(getFieldError(field));
  };

  const isFormValid = (): boolean => {
    return errors.length === 0 && vaultName.trim() && vaultPath.trim();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    const allFields = ['vault_name', 'vault_path', 'description'];
    setTouched(prev => ({
      ...prev,
      ...Object.fromEntries(allFields.map(field => [field, true]))
    }));

    if (!isFormValid()) {
      return;
    }

    const config: VaultConfig = {
      vault_name: vaultName.trim(),
      vault_path: vaultPath.trim(),
      description: description.trim(),
      schedule,
      advanced: advancedConfig
    };

    onSubmit(config);
  };

  const inputClassName = (field: string) => `
    w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 
    placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent
    ${hasFieldError(field) 
      ? 'border-red-500 dark:border-red-400' 
      : 'border-gray-300 dark:border-gray-600'
    }
  `;

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Configure Vault
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Set up your Obsidian vault for indexing and semantic search
          </p>
        </div>

        {/* Basic Configuration */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Basic Configuration
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vault Name */}
            <div>
              <label htmlFor="vault-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Vault Name *
              </label>
              <input
                id="vault-name"
                type="text"
                value={vaultName}
                onChange={(e) => setVaultName(e.target.value)}
                onBlur={() => handleFieldTouch('vault_name')}
                placeholder="My Obsidian Vault"
                className={inputClassName('vault_name')}
                required
              />
              {getFieldError('vault_name') && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                  <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                  {getFieldError('vault_name')}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => handleFieldTouch('description')}
                placeholder="Personal knowledge base"
                className={inputClassName('description')}
              />
            </div>
          </div>

          {/* Vault Path */}
          <div className="mt-6">
            <label htmlFor="vault-path" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Vault Path *
            </label>
            <PathPicker
              value={vaultPath}
              onChange={(path) => {
                setVaultPath(path);
                handleFieldTouch('vault_path');
              }}
              placeholder="Select your Obsidian vault directory..."
              className="w-full"
            />
            {getFieldError('vault_path') && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                {getFieldError('vault_path')}
              </p>
            )}
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center">
              <InformationCircleIcon className="w-4 h-4 mr-1" />
              Point to the root directory of your Obsidian vault
            </p>
          </div>
        </div>

        {/* Schedule Configuration */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Indexing Schedule
          </h3>
          <ScheduleConfig
            value={schedule}
            onChange={setSchedule}
          />
        </div>

        {/* Advanced Settings */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Advanced Settings
          </h3>
          <AdvancedSettings
            value={advancedConfig}
            onChange={setAdvancedConfig}
          />
        </div>

        {/* Validation Summary */}
        {errors.length > 0 && touched.vault_name && (
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <h4 className="text-sm font-medium text-red-800 dark:text-red-400 mb-2">
              Please fix the following issues:
            </h4>
            <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
              {errors.map((error, index) => (
                <li key={index} className="flex items-center">
                  <ExclamationTriangleIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                  {error.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Success Indicator */}
        {isFormValid() && touched.vault_name && (
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-800 dark:text-green-400 flex items-center">
              <CheckCircleIcon className="w-4 h-4 mr-2" />
              Configuration is valid and ready to submit
            </p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isFormValid() || loading}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating...' : 'Create Vault Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VaultConfigForm;