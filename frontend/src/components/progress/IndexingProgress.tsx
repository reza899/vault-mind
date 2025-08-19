import React, { useState } from 'react';
import {
  XMarkIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface IndexingProgressData {
  progress_percentage: number;
  current_file?: string;
  files_processed: number;
  total_files: number;
  documents_created: number;
  chunks_created: number;
  processing_rate?: number; // files per second
  eta_seconds?: number;
  errors_count: number;
  last_error?: string | null;
  status: 'indexing' | 'paused' | 'completed' | 'error' | 'cancelled';
}

interface IndexingProgressProps {
  collectionName: string;
  progressData: IndexingProgressData;
  isConnected: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
  className?: string;
}

const formatETA = (seconds?: number): string => {
  if (!seconds || seconds <= 0) return '--';
  
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
};

const formatRate = (rate?: number): string => {
  if (!rate || rate <= 0) return '--';
  return `${rate.toFixed(1)} files/s`;
};

const IndexingProgress: React.FC<IndexingProgressProps> = ({
  collectionName,
  progressData,
  isConnected,
  onPause,
  onResume,
  onCancel,
  onClose,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  // Animation for progress bar
  const progressBarClass = progressData.status === 'indexing' 
    ? 'transition-all duration-300 ease-out' 
    : 'transition-all duration-500 ease-in-out';

  // Status color mapping
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'indexing': return 'bg-blue-500';
      case 'paused': return 'bg-yellow-500';
      case 'completed': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'cancelled': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'indexing': return <PlayIcon className="w-4 h-4" />;
      case 'paused': return <PauseIcon className="w-4 h-4" />;
      case 'completed': return <DocumentTextIcon className="w-4 h-4" />;
      case 'error': return <ExclamationTriangleIcon className="w-4 h-4" />;
      case 'cancelled': return <StopIcon className="w-4 h-4" />;
      default: return <PlayIcon className="w-4 h-4" />;
    }
  };

  const canPause = progressData.status === 'indexing' && onPause;
  const canResume = progressData.status === 'paused' && onResume;
  const canCancel = ['indexing', 'paused'].includes(progressData.status) && onCancel;

  if (!isExpanded) {
    return (
      <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-1.5 rounded ${getStatusColor(progressData.status)} text-white`}>
              {getStatusIcon(progressData.status)}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {collectionName}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {progressData.progress_percentage.toFixed(1)}% • {progressData.files_processed}/{progressData.total_files} files
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsExpanded(true)}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title="Expand"
            >
              <ChartBarIcon className="w-4 h-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title="Close"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        
        {/* Mini progress bar */}
        <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${getStatusColor(progressData.status)} ${progressBarClass}`}
            style={{ width: `${Math.max(0, Math.min(100, progressData.progress_percentage))}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded ${getStatusColor(progressData.status)} text-white`}>
            {getStatusIcon(progressData.status)}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Indexing Progress
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {collectionName}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Connection indicator */}
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} 
               title={isConnected ? 'Connected' : 'Disconnected'} />
          
          {/* Controls */}
          <div className="flex items-center space-x-1">
            {canPause && (
              <button
                onClick={onPause}
                className="p-1.5 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                title="Pause indexing"
              >
                <PauseIcon className="w-4 h-4" />
              </button>
            )}
            
            {canResume && (
              <button
                onClick={onResume}
                className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                title="Resume indexing"
              >
                <PlayIcon className="w-4 h-4" />
              </button>
            )}
            
            {canCancel && (
              <button
                onClick={onCancel}
                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="Cancel indexing"
              >
                <StopIcon className="w-4 h-4" />
              </button>
            )}
            
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title="Minimize"
            >
              <XMarkIcon className="w-4 h-4 rotate-45" />
            </button>
            
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title="Close"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {progressData.progress_percentage.toFixed(1)}%
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
            {progressData.status}
          </span>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full ${getStatusColor(progressData.status)} ${progressBarClass}`}
            style={{ width: `${Math.max(0, Math.min(100, progressData.progress_percentage))}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-4 pb-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400">Files</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {progressData.files_processed.toLocaleString()}/{progressData.total_files.toLocaleString()}
            </div>
          </div>
          
          <div>
            <div className="text-gray-500 dark:text-gray-400">Documents</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {progressData.documents_created.toLocaleString()}
            </div>
          </div>
          
          <div>
            <div className="text-gray-500 dark:text-gray-400">Speed</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {formatRate(progressData.processing_rate)}
            </div>
          </div>
          
          <div>
            <div className="text-gray-500 dark:text-gray-400">ETA</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {formatETA(progressData.eta_seconds)}
            </div>
          </div>
        </div>
      </div>

      {/* Current File */}
      {progressData.current_file && (
        <div className="px-4 pb-2">
          <div className="flex items-center space-x-2 text-sm">
            <DocumentTextIcon className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">Processing:</span>
            <span className="font-mono text-gray-900 dark:text-white truncate">
              {progressData.current_file}
            </span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {progressData.errors_count > 0 && (
        <div className="px-4 pb-2">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
            <div className="flex items-start space-x-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-red-800 dark:text-red-200">
                  {progressData.errors_count} error{progressData.errors_count > 1 ? 's' : ''} encountered
                </div>
                {progressData.last_error && (
                  <div className="text-xs text-red-700 dark:text-red-300 mt-1">
                    Latest: {progressData.last_error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Toggle */}
      <div className="px-4 pb-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
        
        {showDetails && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Chunks Created:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {progressData.chunks_created.toLocaleString()}
                </span>
              </div>
              
              <div>
                <span className="text-gray-500 dark:text-gray-400">Status:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white capitalize">
                  {progressData.status}
                </span>
              </div>
              
              {progressData.processing_rate && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Processing Rate:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {formatRate(progressData.processing_rate)}
                  </span>
                </div>
              )}
              
              <div>
                <span className="text-gray-500 dark:text-gray-400">Connection:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IndexingProgress;