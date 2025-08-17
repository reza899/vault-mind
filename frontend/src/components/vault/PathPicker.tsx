import React, { useState, useEffect, useCallback } from 'react';
import { FolderIcon, DocumentIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

interface FileSystemItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileSystemItem[];
}

interface PathPickerProps {
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const PathPicker: React.FC<PathPickerProps> = ({
  value,
  onChange,
  placeholder = "Select Obsidian vault directory...",
  disabled = false,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState<FileSystemItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock file system data for development
  const mockFileSystem: Record<string, FileSystemItem[]> = {
    '/': [
      { name: 'Users', path: '/Users', type: 'directory' },
      { name: 'Applications', path: '/Applications', type: 'directory' },
      { name: 'System', path: '/System', type: 'directory' }
    ],
    '/Users': [
      { name: 'reza', path: '/Users/reza', type: 'directory' },
      { name: 'Shared', path: '/Users/Shared', type: 'directory' }
    ],
    '/Users/reza': [
      { name: 'Documents', path: '/Users/reza/Documents', type: 'directory' },
      { name: 'Desktop', path: '/Users/reza/Desktop', type: 'directory' },
      { name: 'Downloads', path: '/Users/reza/Downloads', type: 'directory' }
    ],
    '/Users/reza/Documents': [
      { name: 'MyVault', path: '/Users/reza/Documents/MyVault', type: 'directory' },
      { name: 'WorkVault', path: '/Users/reza/Documents/WorkVault', type: 'directory' },
      { name: 'Notes.md', path: '/Users/reza/Documents/Notes.md', type: 'file' }
    ]
  };

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // In a real implementation, this would call an API to get directory contents
      // For now, we'll use mock data
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API delay
      
      const directoryItems = mockFileSystem[path] || [];
      setItems(directoryItems);
      setCurrentPath(path);
    } catch (err) {
      setError('Failed to load directory contents');
      console.error('Error loading directory:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Start from user's home directory or current value
      const startPath = value || '/Users/reza';
      loadDirectory(startPath);
    }
  }, [isOpen, value, loadDirectory]);

  const handleDirectoryClick = (item: FileSystemItem) => {
    if (item.type === 'directory') {
      loadDirectory(item.path);
    }
  };

  const handleSelectPath = (path: string) => {
    onChange(path);
    setIsOpen(false);
  };

  const goToParent = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadDirectory(parentPath);
  };

  const isVaultDirectory = (item: FileSystemItem): boolean => {
    // Check if directory contains .obsidian folder (typical vault indicator)
    return item.type === 'directory' && (
      item.name.toLowerCase().includes('vault') ||
      item.name.toLowerCase().includes('obsidian')
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* Input Field */}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
        >
          <FolderIcon className="w-5 h-5" />
        </button>
      </div>

      {/* File Browser Modal */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <button
                onClick={goToParent}
                disabled={currentPath === '/'}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
              >
                <ArrowLeftIcon className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {currentPath}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                Loading...
              </div>
            ) : error ? (
              <div className="p-4 text-center text-red-500">
                {error}
              </div>
            ) : items.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                No items in this directory
              </div>
            ) : (
              <div className="py-1">
                {items.map((item) => (
                  <div
                    key={item.path}
                    className="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer group"
                    onClick={() => handleDirectoryClick(item)}
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      {item.type === 'directory' ? (
                        <FolderIcon className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" />
                      ) : (
                        <DocumentIcon className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                      )}
                      <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                        {item.name}
                      </span>
                      {isVaultDirectory(item) && (
                        <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          Vault
                        </span>
                      )}
                    </div>
                    
                    {item.type === 'directory' && (
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectPath(item.path);
                          }}
                          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Select
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {items.filter(item => item.type === 'directory').length} folders, {items.filter(item => item.type === 'file').length} files
            </span>
            <button
              onClick={() => handleSelectPath(currentPath)}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Use Current Path
            </button>
          </div>
        </div>
      )}

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default PathPicker;