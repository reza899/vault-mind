import React, { useState } from 'react';
import { PlusIcon, TrashIcon, InformationCircleIcon, CogIcon } from '@heroicons/react/24/outline';
import { AdvancedConfig } from '@/types';

interface AdvancedSettingsProps {
  value: AdvancedConfig;
  onChange: (config: AdvancedConfig) => void;
  className?: string;
}

const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  value,
  onChange,
  className = ""
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newIgnorePattern, setNewIgnorePattern] = useState('');
  const [newFileType, setNewFileType] = useState('');

  const handleChunkSizeChange = (chunk_size: number) => {
    onChange({ ...value, chunk_size });
  };

  const handleChunkOverlapChange = (chunk_overlap: number) => {
    onChange({ ...value, chunk_overlap });
  };

  const handleEmbeddingModelChange = (embedding_model: string) => {
    onChange({ ...value, embedding_model });
  };

  const handleMaxFileSizeChange = (max_file_size_mb: number) => {
    onChange({ ...value, max_file_size_mb });
  };

  const addIgnorePattern = () => {
    if (newIgnorePattern.trim() && !value.ignore_patterns.includes(newIgnorePattern.trim())) {
      onChange({
        ...value,
        ignore_patterns: [...value.ignore_patterns, newIgnorePattern.trim()]
      });
      setNewIgnorePattern('');
    }
  };

  const removeIgnorePattern = (pattern: string) => {
    onChange({
      ...value,
      ignore_patterns: value.ignore_patterns.filter(p => p !== pattern)
    });
  };

  const addFileType = () => {
    const fileType = newFileType.trim();
    if (fileType && !value.file_types.includes(fileType)) {
      // Ensure file type starts with a dot
      const normalizedType = fileType.startsWith('.') ? fileType : `.${fileType}`;
      onChange({
        ...value,
        file_types: [...value.file_types, normalizedType]
      });
      setNewFileType('');
    }
  };

  const removeFileType = (fileType: string) => {
    onChange({
      ...value,
      file_types: value.file_types.filter(ft => ft !== fileType)
    });
  };

  const embeddingModels = [
    { 
      value: 'all-MiniLM-L6-v2', 
      label: 'all-MiniLM-L6-v2', 
      description: 'Fast, lightweight model (384 dimensions)' 
    },
    { 
      value: 'all-mpnet-base-v2', 
      label: 'all-mpnet-base-v2', 
      description: 'Better quality, slower (768 dimensions)' 
    },
    { 
      value: 'text-embedding-ada-002', 
      label: 'OpenAI Ada v2', 
      description: 'OpenAI model (requires API key)' 
    },
    { 
      value: 'text-embedding-3-small', 
      label: 'OpenAI Embedding v3 Small', 
      description: 'Latest OpenAI model (requires API key)' 
    }
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Basic Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chunk Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Chunk Size (tokens)
          </label>
          <input
            type="number"
            min="100"
            max="4000"
            step="100"
            value={value.chunk_size}
            onChange={(e) => handleChunkSizeChange(Number(e.target.value))}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center">
            <InformationCircleIcon className="w-3 h-3 mr-1" />
            Larger chunks preserve context, smaller chunks increase precision
          </p>
        </div>

        {/* Chunk Overlap */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Chunk Overlap (tokens)
          </label>
          <input
            type="number"
            min="0"
            max={Math.floor(value.chunk_size / 2)}
            step="50"
            value={value.chunk_overlap}
            onChange={(e) => handleChunkOverlapChange(Number(e.target.value))}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center">
            <InformationCircleIcon className="w-3 h-3 mr-1" />
            Overlap helps maintain context across chunks
          </p>
        </div>

        {/* Max File Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Max File Size (MB)
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={value.max_file_size_mb}
            onChange={(e) => handleMaxFileSizeChange(Number(e.target.value))}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center">
            <InformationCircleIcon className="w-3 h-3 mr-1" />
            Files larger than this will be skipped
          </p>
        </div>

        {/* Embedding Model */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Embedding Model
          </label>
          <select
            value={value.embedding_model}
            onChange={(e) => handleEmbeddingModelChange(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {embeddingModels.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {embeddingModels.find(m => m.value === value.embedding_model)?.description}
          </p>
        </div>
      </div>

      {/* File Types */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Supported File Types
        </label>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {value.file_types.map((fileType) => (
              <span
                key={fileType}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {fileType}
                <button
                  type="button"
                  onClick={() => removeFileType(fileType)}
                  className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex space-x-2">
            <input
              type="text"
              value={newFileType}
              onChange={(e) => setNewFileType(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFileType())}
              placeholder="e.g., .pdf, .docx"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={addFileType}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Ignore Patterns */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Ignore Patterns
        </label>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {value.ignore_patterns.map((pattern) => (
              <span
                key={pattern}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
              >
                {pattern}
                <button
                  type="button"
                  onClick={() => removeIgnorePattern(pattern)}
                  className="ml-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex space-x-2">
            <input
              type="text"
              value={newIgnorePattern}
              onChange={(e) => setNewIgnorePattern(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIgnorePattern())}
              placeholder="e.g., *.tmp, private/**"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={addIgnorePattern}
              className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
            <InformationCircleIcon className="w-3 h-3 mr-1" />
            Use glob patterns (*, **, ?) to match files and folders to exclude
          </p>
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
        >
          <CogIcon className="w-4 h-4" />
          <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Options</span>
        </button>
      </div>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="space-y-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border-l-4 border-blue-500">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Performance Settings
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Parallel Processing */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Parallel Processing
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Process multiple files simultaneously
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.parallel_processing || false}
                  onChange={(e) => onChange({ ...value, parallel_processing: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Batch Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Batch Size
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={value.batch_size || 10}
                onChange={(e) => onChange({ ...value, batch_size: Number(e.target.value) })}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Number of files to process in each batch
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Summary */}
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Configuration Summary
        </h4>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li>• Chunk size: {value.chunk_size} tokens with {value.chunk_overlap} overlap</li>
          <li>• Model: {embeddingModels.find(m => m.value === value.embedding_model)?.label}</li>
          <li>• File types: {value.file_types.join(', ')}</li>
          <li>• Max file size: {value.max_file_size_mb} MB</li>
          <li>• Ignore patterns: {value.ignore_patterns.length} configured</li>
        </ul>
      </div>
    </div>
  );
};

export default AdvancedSettings;