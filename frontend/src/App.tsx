import React, { useState } from 'react';
import { PlusIcon, FolderIcon, ArrowLeftIcon, ClockIcon } from '@heroicons/react/24/outline';
import Logo from '@/components/ui/Logo';
import { useVaultConfigStore } from '@/stores/vaultConfigStore';

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
  const [currentPage, setCurrentPage] = useState<'home' | 'configure'>('home');
  const [vaultName, setVaultName] = useState('');
  const [vaultPath, setVaultPath] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState<IndexingSchedule>({
    enabled: true,
    frequency: 'manual',
    timezone: 'UTC'
  });
  const { saveConfig } = useVaultConfigStore();

  const handleVaultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (vaultName.trim() && vaultPath.trim()) {
      const config: VaultConfig = {
        vault_name: vaultName.trim(),
        vault_path: vaultPath.trim(),
        description: description.trim() || undefined,
        schedule: schedule,
      };

      // Save to store
      saveConfig(config);

      // Show success and return home
      alert(`Vault "${config.vault_name}" configured successfully! 🎉\nSchedule: ${schedule.frequency}`);
      setCurrentPage('home');
      
      // Reset form
      setVaultName('');
      setVaultPath('');
      setDescription('');
      setSchedule({
        enabled: true,
        frequency: 'manual',
        timezone: 'UTC'
      });
    } else {
      alert('Please fill in vault name and path');
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
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

              {/* Buttons */}
              <div className="flex justify-between space-x-4">
                <button
                  type="button"
                  onClick={() => setCurrentPage('home')}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create Vault Configuration
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