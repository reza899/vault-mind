import React, { useState } from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, ClockIcon } from '@heroicons/react/24/outline';
import PathPicker from './PathPicker';
import ScheduleConfig from './ScheduleConfig';
// Define IndexingSchedule inline to avoid import issues
interface IndexingSchedule {
  enabled: boolean;
  frequency: 'manual' | 'hourly' | 'daily' | 'weekly' | 'custom';
  time?: string;
  interval?: number;
  timezone?: string;
  days_of_week?: number[];
  cron_expression?: string;
}

interface SimpleVaultFormProps {
  onSubmit: (data: { 
    vault_name: string; 
    vault_path: string; 
    description?: string;
    schedule: IndexingSchedule;
  }) => void;
  onCancel: () => void;
}

const defaultSchedule: IndexingSchedule = {
  frequency: 'manual',
  enabled: true,
  timezone: 'UTC'
};

const SimpleVaultForm: React.FC<SimpleVaultFormProps> = ({ onSubmit, onCancel }) => {
  const [vaultName, setVaultName] = useState('');
  const [vaultPath, setVaultPath] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState<IndexingSchedule>(defaultSchedule);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!vaultName.trim()) {
      newErrors.vault_name = 'Vault name is required';
    }
    
    if (!vaultPath.trim()) {
      newErrors.vault_path = 'Vault path is required';
    } else if (!vaultPath.startsWith('/')) {
      newErrors.vault_path = 'Path must be absolute (start with /)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit({
        vault_name: vaultName.trim(),
        vault_path: vaultPath.trim(),
        description: description.trim() || undefined,
        schedule,
      });
    }
  };

  const isValid = vaultName.trim() && vaultPath.trim() && Object.keys(errors).length === 0;

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Configure Your Vault
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Set up your Obsidian vault for semantic search and indexing
          </p>
        </div>

        {/* Form Fields */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
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
              placeholder="My Obsidian Vault"
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.vault_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {errors.vault_name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                {errors.vault_name}
              </p>
            )}
          </div>

          {/* Vault Path */}
          <div>
            <label htmlFor="vault-path" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Vault Path *
            </label>
            <PathPicker
              value={vaultPath}
              onChange={setVaultPath}
              placeholder="Select your Obsidian vault directory..."
              className={errors.vault_path ? 'border-red-500' : ''}
            />
            {errors.vault_path && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                {errors.vault_path}
              </p>
            )}
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Browse and select your Obsidian vault directory
            </p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Personal knowledge base for research notes..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Indexing Schedule */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-4">
            <ClockIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Indexing Schedule
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Configure when your vault should be automatically re-indexed
          </p>
          <ScheduleConfig
            value={schedule}
            onChange={setSchedule}
          />
        </div>

        {/* Success Indicator */}
        {isValid && (
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-800 dark:text-green-400 flex items-center">
              <CheckCircleIcon className="w-4 h-4 mr-2" />
              Configuration looks good! Ready to create your vault.
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-between space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Create Vault Configuration
          </button>
        </div>
      </form>
    </div>
  );
};

export default SimpleVaultForm;