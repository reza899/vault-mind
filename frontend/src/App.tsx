import React, { useState } from 'react';
import { PlusIcon, FolderIcon, ArrowLeftIcon, ClockIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Logo from '@/components/ui/Logo';
import { useVaultConfigStore } from '@/stores/vaultConfigStore';
import SearchPage from '@/pages/SearchPage';
import apiClient from '@/services/apiClient';

// Define types inline to avoid import issues
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
import PathPicker from '@/components/vault/PathPicker';
import ScheduleConfig from '@/components/vault/ScheduleConfig';

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'configure' | 'search'>('home');
  const [vaultName, setVaultName] = useState('');
  const [vaultPath, setVaultPath] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState<IndexingSchedule>({
    enabled: true,
    frequency: 'manual',
    timezone: 'UTC'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{ jobId: string; vaultName: string } | null>(null);
  const { saveConfig } = useVaultConfigStore();

  const handleVaultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous states
    setSubmitError(null);
    setSubmitSuccess(null);
    
    if (!vaultName.trim() || !vaultPath.trim()) {
      setSubmitError('Please fill in vault name and path');
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
        setSubmitSuccess({
          jobId: response.data.job_id,
          vaultName: response.data.vault_name
        });
        
        console.log('Indexing job created successfully:', response.data);
        
        // Reset form after success
        setTimeout(() => {
          setVaultName('');
          setVaultPath('');
          setDescription('');
          setSchedule({
            enabled: true,
            frequency: 'manual',
            timezone: 'UTC'
          });
          setSubmitSuccess(null);
          setCurrentPage('home');
        }, 3000);
      } else {
        throw new Error(response.message || 'Failed to create indexing job');
      }
    } catch (error: any) {
      console.error('Error creating indexing job:', error);
      
      // Use the cleaned error message from API client
      const errorMessage = error?.message || 'Failed to start indexing. Please check your vault path and try again.';
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200">
      {currentPage === 'home' ? (
        <>
          <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                  <Logo variant="full" size="md" />
                </div>
                <div className="flex items-center space-x-4">
                  {/* Connection Status */}
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Connected</span>
                  </div>
                  
                  {/* Theme Toggle */}
                  <button 
                    onClick={() => document.documentElement.classList.toggle('dark')}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  >
                    🌓
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Welcome to Vault Mind
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                Index your Obsidian vault and unlock the power of semantic search
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {/* Search Vaults */}
              <div 
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600 transition-colors cursor-pointer"
                onClick={() => setCurrentPage('search')}
              >
                <div className="flex items-center space-x-4 mb-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <MagnifyingGlassIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Search Vaults
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Search your indexed vaults with semantic search and explore your knowledge base.
                </p>
                <button className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 font-medium">
                  Start Searching →
                </button>
              </div>

              {/* Configure New Vault */}
              <div 
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                onClick={() => setCurrentPage('configure')}
              >
                <div className="flex items-center space-x-4 mb-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <PlusIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Configure New Vault
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Set up a new Obsidian vault for indexing with customizable settings and scheduling.
                </p>
                <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium">
                  Get Started →
                </button>
              </div>

              {/* Manage Existing Vaults */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer opacity-50">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="p-3 bg-gray-100 dark:bg-gray-900/20 rounded-lg">
                    <FolderIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Manage Vaults
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  View and manage your existing vault configurations, monitor indexing progress.
                </p>
                <button className="text-gray-400 font-medium cursor-not-allowed">
                  Coming Soon
                </button>
              </div>
            </div>
          </main>

          <footer className="mt-auto py-4">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                Vault Mind Frontend - Development Mode
              </div>
            </div>
          </footer>
        </>
      ) : currentPage === 'search' ? (
        <SearchPage onNavigate={setCurrentPage} />
      ) : (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {/* Configuration Page */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setCurrentPage('home')}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  >
                    <ArrowLeftIcon className="w-5 h-5" />
                  </button>
                  <div>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      Configure Vault
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Set up your Obsidian vault for indexing
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <form onSubmit={handleVaultSubmit} className="space-y-6">
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
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
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

              {/* Error Message */}
              {submitError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
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
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                        Indexing job started successfully!
                      </h3>
                      <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                        <p>Vault "{submitSuccess.vaultName}" is being indexed.</p>
                        <p className="mt-1">Job ID: {submitSuccess.jobId}</p>
                        <p className="mt-1">You'll be redirected to the home page in a few seconds...</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-between space-x-4">
                <button
                  type="button"
                  onClick={() => setCurrentPage('home')}
                  disabled={isSubmitting}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {isSubmitting && (
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>
                    {isSubmitting ? 'Creating & Starting Indexing...' : 'Create Vault Configuration'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;