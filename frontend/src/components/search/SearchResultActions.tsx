import React, { useState, useCallback } from 'react';
import {
  ClipboardDocumentIcon,
  DocumentArrowDownIcon,
  ShareIcon,
  BookmarkIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  XMarkIcon,
  DocumentDuplicateIcon,
  TableCellsIcon,
  CodeBracketIcon
} from '@heroicons/react/24/outline';

interface SearchResult {
  content: string;
  metadata: {
    file_path: string;
    chunk_index: number;
    file_type: string;
    created_at?: string;
    modified_at?: string;
    tags?: string[];
  };
  similarity_score: number;
}

interface SearchResultActionsProps {
  results: SearchResult[];
  selectedResults?: Set<number>;
  onSelectionChange?: (selectedIndexes: Set<number>) => void;
  onCopy?: (content: string) => void;
  onExport?: (format: 'json' | 'csv' | 'md', results: SearchResult[]) => void;
  onSave?: (results: SearchResult[]) => void;
  onShare?: (results: SearchResult[]) => void;
  query?: string;
  vaultName?: string;
  className?: string;
}

export const SearchResultActions: React.FC<SearchResultActionsProps> = ({
  results,
  selectedResults = new Set(),
  onSelectionChange,
  onCopy,
  onExport,
  onSave,
  onShare,
  query,
  vaultName,
  className = ''
}) => {
  const [isExporting, setIsExporting] = useState(false);
  // const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'md'>('json');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied'>('idle');

  const selectedCount = selectedResults.size;
  const hasResults = results.length > 0;
  const hasSelection = selectedCount > 0;

  // Select all/none toggle
  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;
    
    if (selectedCount === results.length) {
      // Deselect all
      onSelectionChange(new Set());
    } else {
      // Select all
      const allIndexes = new Set(results.map((_, index) => index));
      onSelectionChange(allIndexes);
    }
  }, [selectedCount, results, onSelectionChange]);

  // Get selected results
  const getSelectedResults = useCallback(() => {
    return Array.from(selectedResults).map(index => results[index]).filter(Boolean);
  }, [selectedResults, results]);

  // Copy selected results
  const handleCopySelected = useCallback(async () => {
    if (!hasSelection) return;
    
    setCopyStatus('copying');
    const selected = getSelectedResults();
    
    try {
      const content = selected.map(result => {
        const header = `# ${result.metadata.file_path}\n\n`;
        const body = result.content;
        const footer = `\n\n---\nSimilarity: ${(result.similarity_score * 100).toFixed(1)}%\n`;
        return header + body + footer;
      }).join('\n\n');
      
      await navigator.clipboard.writeText(content);
      setCopyStatus('copied');
      onCopy?.(content);
      
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      setCopyStatus('idle');
    }
  }, [hasSelection, getSelectedResults, onCopy]);

  // Export selected results
  const handleExport = useCallback(async (format: 'json' | 'csv' | 'md') => {
    if (!hasSelection || !onExport) return;
    
    setIsExporting(true);
    // setExportFormat(format);
    
    try {
      const selected = getSelectedResults();
      await onExport(format, selected);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  }, [hasSelection, getSelectedResults, onExport]);

  // Save search results
  const handleSave = useCallback(() => {
    if (!hasSelection || !onSave) return;
    const selected = getSelectedResults();
    onSave(selected);
  }, [hasSelection, getSelectedResults, onSave]);

  // Share search results
  const handleShare = useCallback(() => {
    if (!hasSelection || !onShare) return;
    const selected = getSelectedResults();
    onShare(selected);
  }, [hasSelection, getSelectedResults, onShare]);

  // Open file in external app (if supported)
  const handleOpenExternal = useCallback(() => {
    if (!hasSelection) return;
    
    const selected = getSelectedResults();
    selected.forEach(result => {
      const filePath = result.metadata.file_path;
      // This would typically integrate with a desktop app or file system
      console.log('Opening file:', filePath);
      // Example: window.electronAPI?.openFile(filePath)
    });
  }, [hasSelection, getSelectedResults]);

  if (!hasResults) return null;

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          {/* Select All Toggle */}
          <button
            onClick={handleSelectAll}
            className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <div className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-colors ${
              selectedCount === results.length 
                ? 'bg-blue-600 border-blue-600' 
                : selectedCount > 0 
                ? 'bg-blue-600 border-blue-600' 
                : 'border-gray-300 dark:border-gray-600'
            }`}>
              {selectedCount === results.length ? (
                <CheckIcon className="w-3 h-3 text-white" />
              ) : selectedCount > 0 ? (
                <div className="w-2 h-0.5 bg-white rounded" />
              ) : null}
            </div>
            <span>
              {selectedCount === 0 ? 'Select All' : 
               selectedCount === results.length ? 'Deselect All' : 
               `${selectedCount} Selected`}
            </span>
          </button>

          {/* Result Count */}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Copy Button */}
          <button
            onClick={handleCopySelected}
            disabled={!hasSelection || copyStatus === 'copying'}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Copy selected results"
          >
            {copyStatus === 'copying' ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600" />
            ) : copyStatus === 'copied' ? (
              <CheckIcon className="w-4 h-4 text-green-600" />
            ) : (
              <ClipboardDocumentIcon className="w-4 h-4" />
            )}
            <span>
              {copyStatus === 'copying' ? 'Copying...' : 
               copyStatus === 'copied' ? 'Copied!' : 'Copy'}
            </span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!hasSelection}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Export selected results"
            >
              {isExporting ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
              ) : (
                <DocumentArrowDownIcon className="w-4 h-4" />
              )}
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
            </button>

            {/* Export Menu */}
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-48">
                <div className="py-1">
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <CodeBracketIcon className="w-4 h-4" />
                    <span>Export as JSON</span>
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <TableCellsIcon className="w-4 h-4" />
                    <span>Export as CSV</span>
                  </button>
                  <button
                    onClick={() => handleExport('md')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <DocumentDuplicateIcon className="w-4 h-4" />
                    <span>Export as Markdown</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          {onSave && (
            <button
              onClick={handleSave}
              disabled={!hasSelection}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Save selected results"
            >
              <BookmarkIcon className="w-4 h-4" />
              <span>Save</span>
            </button>
          )}

          {/* Share Button */}
          {onShare && (
            <button
              onClick={handleShare}
              disabled={!hasSelection}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Share selected results"
            >
              <ShareIcon className="w-4 h-4" />
              <span>Share</span>
            </button>
          )}

          {/* Open External */}
          <button
            onClick={handleOpenExternal}
            disabled={!hasSelection}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Open in external app"
          >
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            <span>Open</span>
          </button>
        </div>
      </div>

      {/* Selected Results Summary */}
      {hasSelection && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-blue-800 dark:text-blue-200">
                {selectedCount} result{selectedCount !== 1 ? 's' : ''} selected
              </span>
            </div>
            
            <button
              onClick={() => onSelectionChange?.(new Set())}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
              title="Clear selection"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          
          {query && (
            <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">
              Query: "{query}" {vaultName && `in ${vaultName}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchResultActions;