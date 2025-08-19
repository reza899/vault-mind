import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, TagIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useVaultTags, type VaultTag } from '@/hooks/useVaultTags';

interface TagSelectorProps {
  vaultName: string;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  mode?: 'include' | 'exclude';
  className?: string;
}

const TagSelector: React.FC<TagSelectorProps> = ({
  vaultName,
  selectedTags,
  onTagsChange,
  placeholder = "Type to search tags...",
  mode = 'include',
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [{ isLoading, error }, { fetchTags, searchTags }] = useVaultTags();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch tags when vault changes
  useEffect(() => {
    if (vaultName) {
      fetchTags(vaultName);
    }
  }, [vaultName, fetchTags]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTags = searchTags(searchQuery);
  const availableTags = filteredTags.filter(tag => !selectedTags.includes(tag.name));

  const handleTagAdd = (tagName: string) => {
    if (!selectedTags.includes(tagName)) {
      onTagsChange([...selectedTags, tagName]);
    }
    setSearchQuery("");
    setIsOpen(false);
  };

  const handleTagRemove = (tagName: string) => {
    onTagsChange(selectedTags.filter(tag => tag !== tagName));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsOpen(value.length > 0 || filteredTags.length > 0);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      const query = searchQuery.trim();
      const exactMatch = filteredTags.find(tag => tag.name.toLowerCase() === query.toLowerCase());
      
      if (exactMatch) {
        handleTagAdd(exactMatch.name);
      } else {
        // Allow custom tags
        const customTag = query.startsWith('#') ? query : `#${query}`;
        handleTagAdd(customTag);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  const getTagColorClass = (mode: 'include' | 'exclude') => {
    return mode === 'include' 
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const getTagTypeIcon = (tagType: VaultTag['type']) => {
    switch (tagType) {
      case 'content':
        return '🏷️'; // Hashtag from content
      case 'frontmatter':
        return '📋'; // YAML frontmatter
      default:
        return '🔖'; // Unknown source
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedTags.map(tag => (
            <span
              key={tag}
              className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${getTagColorClass(mode)}`}
            >
              {tag}
              <button
                onClick={() => handleTagRemove(tag)}
                className={`ml-1 hover:opacity-75 ${
                  mode === 'include' 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input Field */}
      <div className="relative">
        <div className="relative">
          <TagIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 
              rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
              placeholder-gray-500 dark:placeholder-gray-400"
          />
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
            rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                Loading tags...
              </div>
            ) : error ? (
              <div className="px-3 py-2 text-sm text-red-600 dark:text-red-400">
                Error: {error}
              </div>
            ) : availableTags.length > 0 ? (
              availableTags.slice(0, 20).map(tag => (
                <button
                  key={tag.name}
                  onClick={() => handleTagAdd(tag.name)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 
                    flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-xs">{getTagTypeIcon(tag.type)}</span>
                    <span className="text-gray-900 dark:text-white">{tag.name}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{tag.frequency}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      Add
                    </span>
                  </div>
                </button>
              ))
            ) : searchQuery ? (
              <button
                onClick={() => {
                  const customTag = searchQuery.startsWith('#') ? searchQuery : `#${searchQuery}`;
                  handleTagAdd(customTag);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 
                  text-gray-600 dark:text-gray-400"
              >
                Create custom tag: {searchQuery.startsWith('#') ? searchQuery : `#${searchQuery}`}
              </button>
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                No tags found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagSelector;