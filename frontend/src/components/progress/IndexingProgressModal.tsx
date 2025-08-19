import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import IndexingProgress from './IndexingProgress';
import { useIndexingProgress } from '@/hooks/useIndexingProgress';

interface IndexingProgressModalProps {
  collectionName: string;
  isOpen: boolean;
  onClose: () => void;
}

const IndexingProgressModal: React.FC<IndexingProgressModalProps> = ({
  collectionName,
  isOpen,
  onClose
}) => {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL LOGIC OR EARLY RETURNS
  
  // Add error boundary protection - hooks must be called unconditionally
  const [hasError, setHasError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  // Always call useIndexingProgress hook unconditionally
  const [progressState, progressActions] = useIndexingProgress();

  // Stable action references to prevent infinite loops
  const startMonitoringRef = React.useRef(progressActions?.startMonitoring);
  const stopMonitoringRef = React.useRef(progressActions?.stopMonitoring);
  
  // Handle hook initialization errors in useEffect
  React.useEffect(() => {
    if (!progressState && !progressActions) {
      setHasError(true);
      setErrorMessage('Unable to initialize progress monitoring');
    }
  }, [progressState, progressActions]);

  // Update refs when actions change, but only if they actually changed
  React.useEffect(() => {
    if (progressActions?.startMonitoring && startMonitoringRef.current !== progressActions.startMonitoring) {
      startMonitoringRef.current = progressActions.startMonitoring;
    }
    if (progressActions?.stopMonitoring && stopMonitoringRef.current !== progressActions.stopMonitoring) {
      stopMonitoringRef.current = progressActions.stopMonitoring;
    }
  }, [progressActions?.startMonitoring, progressActions?.stopMonitoring]);

  // Start monitoring when modal opens
  React.useEffect(() => {
    if (isOpen && collectionName && startMonitoringRef.current) {
      try {
        startMonitoringRef.current(collectionName);
      } catch (error) {
        console.error('[IndexingProgressModal] Error starting monitoring:', error);
        setHasError(true);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to start monitoring');
      }
    }

    // Cleanup on unmount or close
    return () => {
      if (stopMonitoringRef.current) {
        try {
          stopMonitoringRef.current();
        } catch (error) {
          console.error('[IndexingProgressModal] Error stopping monitoring:', error);
        }
      }
    };
  }, [isOpen, collectionName]);

  // NOW SAFE TO DO CONDITIONAL RENDERING AFTER ALL HOOKS ARE CALLED

  // Error state rendering
  if (hasError && isOpen) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Error</h2>
          <p className="text-red-600 dark:text-red-400 mb-4">
            Error loading progress modal: {errorMessage}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Loading state check
  if ((!progressState || !progressActions) && isOpen) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Loading Error</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Unable to initialize progress monitoring. Please try again.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Handle close with error protection
  const handleClose = () => {
    if (progressActions?.stopMonitoring) {
      try {
        progressActions.stopMonitoring();
      } catch (error) {
        console.error('[IndexingProgressModal] Error stopping monitoring:', error);
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  // Wrap entire render in error protection
  try {
    return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Indexing Progress
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Content */}
        <div className="p-4">
          {progressState.progressData ? (
            <IndexingProgress
              collectionName={collectionName}
              progressData={progressState.progressData}
              isConnected={progressState.isConnected}
              onPause={progressActions?.pauseIndexing || (() => {})}
              onResume={progressActions?.resumeIndexing || (() => {})}
              onCancel={progressActions?.cancelIndexing || (() => {})}
              onClose={handleClose}
            />
          ) : progressState.error ? (
            <div className="text-center py-8">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="text-red-700 dark:text-red-300">
                  Error loading progress: {progressState.error}
                </div>
                <button
                  onClick={() => progressActions?.startMonitoring?.(collectionName)}
                  className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <div className="text-gray-600 dark:text-gray-400">
                Connecting to indexing progress...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    );
  } catch (error) {
    console.error('[IndexingProgressModal] Render error:', error);
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Render Error</h2>
          <p className="text-red-600 dark:text-red-400 mb-4">
            Error rendering progress modal: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }
};

export default IndexingProgressModal;