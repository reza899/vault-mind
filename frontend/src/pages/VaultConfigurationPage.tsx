import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClockIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import PathPicker from '@/components/vault/PathPicker';
import { useVaultConfigStore } from '@/stores/vaultConfigStore';
import apiClient from '@/services/apiClient';

// Inline interfaces to avoid import issues
interface IndexingSchedule {
  enabled: boolean;
  frequency: 'manual' | 'hourly' | 'daily' | 'weekly' | 'custom';
  time?: string;
  interval?: number;
  timezone?: string;
  days_of_week?: number[];
  cron_expression?: string;
}

interface VaultConfig {
  vault_name: string;
  vault_path: string;
  description?: string;
  schedule?: IndexingSchedule;
}

const VaultConfigurationPage: React.FC = () => {
  const navigate = useNavigate();
  const [vaultName, setVaultName] = useState('');
  const [vaultPath, setVaultPath] = useState('');
  const [description, setDescription] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [schedule, setSchedule] = useState<IndexingSchedule>({
    enabled: false,
    frequency: 'manual',
    timezone: 'UTC'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{ jobId: string; vaultName: string } | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [vaultNameError, setVaultNameError] = useState<string | null>(null);
  const { saveConfig } = useVaultConfigStore();

  // Vault name validation function
  const validateVaultName = (name: string): string | null => {
    if (!name.trim()) {
      return 'Vault name is required';
    }
    
    // Check for alphanumeric only (plus underscores and hyphens for usability)
    const alphanumericPattern = /^[a-zA-Z0-9_-]+$/;
    if (!alphanumericPattern.test(name.trim())) {
      return 'Vault name can only contain letters, numbers, underscores, and hyphens (no spaces)';
    }
    
    if (name.trim().length < 2) {
      return 'Vault name must be at least 2 characters long';
    }
    
    if (name.trim().length > 50) {
      return 'Vault name must be 50 characters or less';
    }
    
    return null;
  };

  // Handle vault name change with real-time validation
  const handleVaultNameChange = (value: string) => {
    setVaultName(value);
    const error = validateVaultName(value);
    setVaultNameError(error);
    // Clear submit error when user starts fixing issues
    if (submitError && error === null) {
      setSubmitError(null);
    }
  };

  // Poll job status for completion monitoring
  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await apiClient.getJobStatus(jobId);
      if (response.status === 'success' && response.data) {
        setJobStatus(response.data.status);
        
        if (response.data.status === 'completed') {
          setJobStatus('completed');
          return true; // Job completed
        } else if (response.data.status === 'failed') {
          setJobStatus('failed');
          return true; // Job finished (with error)
        }
      }
      return false; // Job still running
    } catch (error) {
      console.error('Error polling job status:', error);
      return false;
    }
  };

  const handleVaultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous states
    setSubmitError(null);
    setSubmitSuccess(null);
    
    // Validate vault name
    const nameError = validateVaultName(vaultName);
    if (nameError) {
      setVaultNameError(nameError);
      setSubmitError('Please fix the validation errors above');
      return;
    }
    
    if (!vaultPath.trim()) {
      setSubmitError('Please select a vault path');
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert schedule object to cron string for backend
      let cronSchedule: string | undefined = undefined;
      if (schedule.enabled && schedule.frequency !== 'manual') {
        const [hours, minutes] = schedule.time?.split(':') || ['02', '00'];
        const hour = parseInt(hours);
        const minute = parseInt(minutes.replace(/[^0-9]/g, ''));
        
        switch (schedule.frequency) {
          case 'hourly':
            cronSchedule = `${minute} * * * *`;
            break;
          case 'daily':
            cronSchedule = `${minute} ${hour} * * *`;
            break;
          case 'weekly':
            cronSchedule = `${minute} ${hour} * * 0`; // Sunday
            break;
          case 'custom':
            cronSchedule = schedule.cron_expression;
            break;
        }
      }

      const config: VaultConfig = {
        vault_name: vaultName.trim(),
        vault_path: vaultPath.trim(),
        description: description.trim() || undefined,
        schedule: schedule,
      };

      // Prepare backend request with cron schedule
      const backendRequest = {
        vault_name: config.vault_name,
        vault_path: config.vault_path,
        description: config.description,
        schedule: cronSchedule,
        force_reindex: false
      };

      // Save to local store
      saveConfig(config);

      // Call backend API to start indexing
      console.log('Starting indexing job for vault:', config.vault_name);
      const response = await apiClient.createIndexingJob(backendRequest);
      
      if (response.status === 'success') {
        const jobId = response.data.job_id;
        setSubmitSuccess({
          jobId: jobId,
          vaultName: response.data.vault_name
        });
        setJobStatus('queued');
        
        console.log('Indexing job created successfully:', response.data);
        
        // Start polling for job completion
        const pollInterval = setInterval(async () => {
          const isComplete = await pollJobStatus(jobId);
          if (isComplete) {
            clearInterval(pollInterval);
            // Navigate after completion
            setTimeout(() => {
              navigate('/');
            }, 2000);
          }
        }, 2000); // Poll every 2 seconds
        
        // Safety timeout to stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          if (jobStatus !== 'completed' && jobStatus !== 'failed') {
            setJobStatus('timeout');
            setTimeout(() => navigate('/'), 2000);
          }
        }, 300000);
      } else {
        throw new Error(response.message || 'Failed to create indexing job');
      }
    } catch (error) {
      console.error('Error creating indexing job:', error);
      
      // Extract specific error messages from backend validation
      let errorMessage = 'Failed to start indexing. Please check your configuration and try again.';
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        // Handle specific validation errors
        if (message.includes('vault name can only contain alphanumeric')) {
          errorMessage = 'Vault name validation failed: Only letters, numbers, underscores, and hyphens are allowed (no spaces)';
          setVaultNameError('Only letters, numbers, underscores, and hyphens are allowed (no spaces)');
        } else if (message.includes('vault path') && message.includes('not found')) {
          errorMessage = 'Vault path error: The selected directory does not exist or is not accessible';
        } else if (message.includes('vault path') && message.includes('not valid')) {
          errorMessage = 'Vault path error: The selected directory is not a valid Obsidian vault';
        } else if (message.includes('vault already exists')) {
          errorMessage = 'A vault with this name already exists. Please choose a different name.';
          setVaultNameError('A vault with this name already exists');
        } else if (message.includes('permission')) {
          errorMessage = 'Permission error: Unable to access the selected vault directory';
        } else {
          // Use the original error message if it's descriptive
          errorMessage = error.message;
        }
      }
      
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <form onSubmit={handleVaultSubmit} className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Add New Vault
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Set up your Obsidian vault for semantic search
          </p>
        </div>

        {/* Essential Information */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Vault Information
          </h3>
          
          {/* Vault Name */}
          <div>
            <label htmlFor="vault-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Vault Name *
            </label>
            <input
              id="vault-name"
              type="text"
              value={vaultName}
              onChange={(e) => handleVaultNameChange(e.target.value)}
              placeholder="MyObsidianVault (no spaces)"
              required
              className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:border-transparent transition-colors ${
                vaultNameError 
                  ? 'border-red-500 dark:border-red-400 focus:ring-red-500' 
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
              }`}
            />
            {vaultNameError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                <span className="mr-1">⚠️</span>
                {vaultNameError}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Use only letters, numbers, underscores, and hyphens. No spaces allowed.
            </p>
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
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
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
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>
        </div>

        {/* Advanced Options - Collapsible */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <ClockIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Auto-Indexing Schedule
              </h3>
            </div>
            {showAdvanced ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            )}
          </button>
          
          {showAdvanced && (
            <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 mt-4">
                Configure automatic re-indexing of your vault (optional)
              </p>
              
              {/* Simple scheduling options */}
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={schedule.enabled}
                    onChange={(e) => setSchedule(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Enable automatic re-indexing
                  </span>
                </label>
                
                {schedule.enabled && (
                  <div className="space-y-3 ml-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Frequency
                      </label>
                      <select
                        value={schedule.frequency}
                        onChange={(e) => setSchedule(prev => ({ ...prev, frequency: e.target.value as IndexingSchedule['frequency'] }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="manual">Manual only</option>
                      </select>
                    </div>
                    
                    {schedule.frequency !== 'manual' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Time
                        </label>
                        <input
                          type="time"
                          value={schedule.time || '02:00'}
                          onChange={(e) => setSchedule(prev => ({ ...prev, time: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {submitError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Error creating vault configuration
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  {submitError}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {submitSuccess && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                  Vault created successfully!
                </h3>
                <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                  <p>Vault "{submitSuccess.vaultName}" is being indexed.</p>
                  <p className="mt-1">Job ID: {submitSuccess.jobId}</p>
                  
                  {/* Job Status with Progress Indicator */}
                  <div className="mt-2 flex items-center space-x-2">
                    <span className="text-xs">Status:</span>
                    {jobStatus === 'queued' && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-medium">Queued</span>
                      </div>
                    )}
                    {jobStatus === 'running' && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-medium">Processing...</span>
                      </div>
                    )}
                    {jobStatus === 'completed' && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs font-medium">✅ Completed!</span>
                      </div>
                    )}
                    {jobStatus === 'failed' && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="text-xs font-medium">❌ Failed</span>
                      </div>
                    )}
                    {jobStatus === 'timeout' && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                        <span className="text-xs font-medium">⏰ Status check timeout</span>
                      </div>
                    )}
                  </div>
                  
                  <p className="mt-2">Once indexed, use the <code className="bg-green-100 dark:bg-green-900/50 px-1 py-0.5 rounded text-xs">/vault-mind</code> slash command in Claude Code to query your vault!</p>
                  
                  {jobStatus === 'completed' ? (
                    <p className="mt-1 font-medium">🎉 Indexing complete! Redirecting...</p>
                  ) : (
                    <p className="mt-1">Will redirect when indexing completes...</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between space-x-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            disabled={isSubmitting}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {isSubmitting && (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span>
              {isSubmitting ? 'Creating Vault...' : 'Create Vault'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default VaultConfigurationPage;