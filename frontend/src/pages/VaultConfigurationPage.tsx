import React, { useState } from 'react';
import { ArrowLeftIcon, PlayIcon } from '@heroicons/react/24/outline';
import VaultConfigForm from '@/components/vault/VaultConfigForm';
import ConfigPreview from '@/components/vault/ConfigPreview';
import { useVaultConfigStore, useVaultConfigValidation } from '@/stores/vaultConfigStore';
import { useIndexingStore } from '@/stores/indexingStore';
import apiClient from '@/services/apiClient';
import { VaultConfig } from '@/types';

const VaultConfigurationPage: React.FC = () => {
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Store hooks
  const { 
    currentConfig, 
    validateConfig, 
    resetForm, 
    saveConfig,
    isFormDirty
  } = useVaultConfigStore();
  
  const { validationErrors } = useVaultConfigValidation();
  const { addJob } = useIndexingStore();

  const handleFormSubmit = (config: VaultConfig) => {
    const errors = validateConfig(config);
    if (errors.length === 0) {
      setStep('preview');
    }
  };

  const handleCreateVault = async () => {
    if (!currentConfig.vault_name || !currentConfig.vault_path) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Create the vault configuration
      const vaultConfig: VaultConfig = {
        vault_name: currentConfig.vault_name,
        vault_path: currentConfig.vault_path,
        description: currentConfig.description,
        schedule: currentConfig.schedule,
        advanced: currentConfig.advanced,
      };

      // Call API to create indexing job
      const response = await apiClient.createIndexingJob(vaultConfig);
      
      if (response.data) {
        // Save configuration to store
        saveConfig(vaultConfig);
        
        // Add job to indexing store for real-time tracking
        addJob({
          job_id: response.data.job_id,
          vault_name: response.data.vault_name,
          status: 'queued',
          progress: 0,
          files_processed: 0,
          total_files: 0,
          created_at: new Date().toISOString(),
        });

        // Reset form and redirect or show success
        resetForm();
        
        // In a real app, you might navigate to a job status page
        console.log('Vault configuration created successfully:', response.data);
        
        // For now, show a success message and reset
        alert(`Vault "${response.data.vault_name}" configuration created! Job ID: ${response.data.job_id}`);
        setStep('form');
      }
    } catch (error: any) {
      console.error('Failed to create vault configuration:', error);
      setSubmitError(
        error.message || 'Failed to create vault configuration. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToForm = () => {
    setStep('form');
    setSubmitError(null);
  };

  const isFormValid = (): boolean => {
    return validationErrors.length === 0 && 
           Boolean(currentConfig.vault_name?.trim()) && 
           Boolean(currentConfig.vault_path?.trim());
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  if (step === 'preview') {
                    handleBackToForm();
                  } else {
                    // Navigate back to main page
                    window.history.back();
                  }
                }}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {step === 'form' ? 'Configure Vault' : 'Review Configuration'}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {step === 'form' 
                    ? 'Set up your Obsidian vault for indexing'
                    : 'Review and confirm your vault configuration'
                  }
                </p>
              </div>
            </div>

            {/* Form dirty indicator */}
            {isFormDirty && step === 'form' && (
              <div className="flex items-center space-x-2 text-sm text-amber-600 dark:text-amber-400">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span>Unsaved changes</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {step === 'form' ? (
          <VaultConfigForm
            onSubmit={handleFormSubmit}
            initialConfig={currentConfig}
            loading={isSubmitting}
          />
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <ConfigPreview
              config={currentConfig as VaultConfig}
              validationErrors={validationErrors}
              isValid={isFormValid()}
              onEdit={handleBackToForm}
            />

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <button
                onClick={handleBackToForm}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Back to Edit
              </button>

              <div className="space-x-4">
                <button
                  onClick={() => {
                    resetForm();
                    setStep('form');
                  }}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Start Over
                </button>
                
                <button
                  onClick={handleCreateVault}
                  disabled={!isFormValid() || isSubmitting}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <PlayIcon className="w-4 h-4" />
                      <span>Create & Start Indexing</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Submit Error */}
            {submitError && (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-start">
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-red-800 dark:text-red-400">
                      Failed to Create Vault
                    </h4>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                      {submitError}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress Steps */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2">
        <div className="bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 p-2 shadow-lg">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              step === 'form' 
                ? 'bg-blue-500 text-white' 
                : 'bg-green-500 text-white'
            }`}>
              1
            </div>
            <div className={`w-6 h-0.5 transition-colors ${
              step === 'preview' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              step === 'preview' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
            }`}>
              2
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaultConfigurationPage;