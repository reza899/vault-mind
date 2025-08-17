import React, { useState } from 'react';
import { 
  DocumentTextIcon, 
  ClipboardDocumentIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CalendarIcon,
  TagIcon
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

interface ResultCardProps {
  result: SearchResult;
  query: string;
  onCopy?: (content: string) => void;
  className?: string;
}

export const ResultCard: React.FC<ResultCardProps> = ({
  result,
  query,
  onCopy,
  className = "",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied'>('idle');

  const highlightText = (text: string, searchQuery: string): React.ReactNode => {
    if (!searchQuery) return text;

    const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    let highlightedText = text;

    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(
        regex, 
        '###HIGHLIGHT_START###$1###HIGHLIGHT_END###'
      );
    });

    return highlightedText.split(/###HIGHLIGHT_START###|###HIGHLIGHT_END###/).map((part, index) => {
      if (index % 2 === 1) {
        return (
          <mark key={index} className="bg-yellow-200 dark:bg-yellow-600 px-1 rounded">
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  const handleCopy = async (content: string) => {
    if (copyStatus === 'copying') return;
    
    setCopyStatus('copying');
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus('copied');
      onCopy?.(content);
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
      setCopyStatus('idle');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getFileIcon = (_fileType: string) => {
    return <DocumentTextIcon className="h-4 w-4" />;
  };

  const truncatedContent = result.content.length > 300 
    ? result.content.slice(0, 300) + '...'
    : result.content;

  const displayContent = isExpanded ? result.content : truncatedContent;
  const showExpandButton = result.content.length > 300;

  // Format similarity score as percentage
  const similarityPercentage = Math.round(result.similarity_score * 100);

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow ${className}`}>
      {/* Header with file info and similarity score */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <div className="text-gray-500 dark:text-gray-400 flex-shrink-0">
            {getFileIcon(result.metadata.file_type)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {result.metadata.file_path.split('/').pop() || result.metadata.file_path}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {result.metadata.file_path}
            </p>
          </div>
        </div>
        
        {/* Similarity score */}
        <div className="flex-shrink-0 ml-4">
          <div className="flex items-center space-x-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {similarityPercentage}%
            </div>
            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${similarityPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content with highlighting */}
      <div className="mb-3">
        <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
          {highlightText(displayContent, query)}
        </div>
        
        {showExpandButton && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 flex items-center text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUpIcon className="h-3 w-3 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDownIcon className="h-3 w-3 mr-1" />
                Show more
              </>
            )}
          </button>
        )}
      </div>

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center space-x-4">
          {result.metadata.modified_at && (
            <div className="flex items-center space-x-1">
              <CalendarIcon className="h-3 w-3" />
              <span>{formatDate(result.metadata.modified_at)}</span>
            </div>
          )}
          
          {result.metadata.tags && result.metadata.tags.length > 0 && (
            <div className="flex items-center space-x-1">
              <TagIcon className="h-3 w-3" />
              <span>{result.metadata.tags.join(', ')}</span>
            </div>
          )}
          
          <div className="text-gray-400">
            Chunk {result.metadata.chunk_index + 1}
          </div>
        </div>

        {/* Copy button */}
        <button
          onClick={() => handleCopy(result.content)}
          disabled={copyStatus === 'copying'}
          className="flex items-center space-x-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Copy content"
        >
          <ClipboardDocumentIcon className="h-3 w-3" />
          <span>
            {copyStatus === 'copying' && 'Copying...'}
            {copyStatus === 'copied' && 'Copied!'}
            {copyStatus === 'idle' && 'Copy'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default ResultCard;