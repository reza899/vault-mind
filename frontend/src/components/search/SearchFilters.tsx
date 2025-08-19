import React, { useState } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FunnelIcon,
  XMarkIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  FolderIcon,
  TagIcon,
  AdjustmentsHorizontalIcon,
  ArchiveBoxIcon,
  BookmarkIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useSearchFilters, type SearchFilters as FilterType } from '@/hooks/useSearchFilters';
import TagSelector from './TagSelector';

interface SearchFiltersProps {
  vaultName?: string;
  onFiltersChange?: (filters: FilterType) => void;
  className?: string;
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: number;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  children,
  badge,
}) => (
  <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <div className="flex items-center space-x-2">
        <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-900 dark:text-white">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded-full">
            {badge}
          </span>
        )}
      </div>
      {isOpen ? (
        <ChevronDownIcon className="w-4 h-4 text-gray-400" />
      ) : (
        <ChevronRightIcon className="w-4 h-4 text-gray-400" />
      )}
    </button>
    
    {isOpen && (
      <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700">
        {children}
      </div>
    )}
  </div>
);

const SearchFilters: React.FC<SearchFiltersProps> = ({
  vaultName,
  onFiltersChange,
  className = '',
}) => {
  const [filtersState, filtersActions] = useSearchFilters({
    vaultName,
    persistKey: vaultName || 'global',
  });

  // Section collapse states
  const [openSections, setOpenSections] = useState({
    fileTypes: true,
    dateRange: false,
    paths: false,
    tags: false,
    similarity: false,
    content: false,
    presets: false,
  });

  // Preset management
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleFilterChange = (updates: Partial<FilterType>) => {
    filtersActions.updateFilters(updates);
    onFiltersChange?.({ ...filtersState.filters, ...updates });
  };

  const handleSavePreset = () => {
    if (presetName.trim()) {
      filtersActions.savePreset(presetName.trim(), presetDescription.trim() || undefined);
      setPresetName('');
      setPresetDescription('');
      setShowSavePreset(false);
    }
  };

  const fileTypeBadges = filtersState.filters.fileTypes.length;
  const pathBadges = filtersState.filters.includePaths.length + filtersState.filters.excludePaths.length;
  const tagBadges = filtersState.filters.includeTags.length + filtersState.filters.excludeTags.length;
  const dateRangeBadges = (filtersState.filters.dateRange.from || filtersState.filters.dateRange.to) ? 1 : 0;
  const similarityBadges = filtersState.filters.similarityThreshold !== 0.7 ? 1 : 0;
  const contentBadges = [
    filtersState.filters.hasImages,
    filtersState.filters.hasLinks,
    filtersState.filters.isEmpty,
    filtersState.filters.minSize,
    filtersState.filters.maxSize,
  ].filter(v => v !== null).length;

  if (filtersState.isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FunnelIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
          {filtersState.activeFiltersCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded-full">
              {filtersState.activeFiltersCount} active
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={filtersActions.resetFilters}
            disabled={filtersState.activeFiltersCount === 0}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Clear all filters"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error Display */}
      {filtersState.error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{filtersState.error}</p>
        </div>
      )}

      {/* File Types */}
      <CollapsibleSection
        title="File Types"
        icon={DocumentTextIcon}
        isOpen={openSections.fileTypes}
        onToggle={() => toggleSection('fileTypes')}
        badge={fileTypeBadges}
      >
        <div className="pt-3 space-y-2">
          {[
            { value: 'md', label: 'Markdown (.md)', icon: '📝' },
            { value: 'canvas', label: 'Canvas (.canvas)', icon: '🎨' },
            { value: 'excalidraw', label: 'Excalidraw (.excalidraw)', icon: '✏️' },
            { value: 'txt', label: 'Text (.txt)', icon: '📄' },
            { value: 'pdf', label: 'PDF (.pdf)', icon: '📑' },
          ].map(({ value, label, icon }) => (
            <label key={value} className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={filtersState.filters.fileTypes.includes(value)}
                onChange={(e) => {
                  const newTypes = e.target.checked
                    ? [...filtersState.filters.fileTypes, value]
                    : filtersState.filters.fileTypes.filter(t => t !== value);
                  handleFilterChange({ fileTypes: newTypes });
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="mr-1">{icon}</span>
              <span className="text-gray-700 dark:text-gray-300">{label}</span>
            </label>
          ))}
        </div>
      </CollapsibleSection>

      {/* Date Range */}
      <CollapsibleSection
        title="Date Range"
        icon={CalendarDaysIcon}
        isOpen={openSections.dateRange}
        onToggle={() => toggleSection('dateRange')}
        badge={dateRangeBadges}
      >
        <div className="pt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date Field
            </label>
            <select
              value={filtersState.filters.dateField}
              onChange={(e) => handleFilterChange({ dateField: e.target.value as 'created' | 'modified' | 'indexed' })}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="modified">Last Modified</option>
              <option value="created">Created</option>
              <option value="indexed">Last Indexed</option>
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                From
              </label>
              <input
                type="date"
                value={filtersState.filters.dateRange.from?.toISOString().split('T')[0] || ''}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : null;
                  handleFilterChange({
                    dateRange: { ...filtersState.filters.dateRange, from: date }
                  });
                }}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                To
              </label>
              <input
                type="date"
                value={filtersState.filters.dateRange.to?.toISOString().split('T')[0] || ''}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : null;
                  handleFilterChange({
                    dateRange: { ...filtersState.filters.dateRange, to: date }
                  });
                }}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Similarity Threshold */}
      <CollapsibleSection
        title="Similarity"
        icon={AdjustmentsHorizontalIcon}
        isOpen={openSections.similarity}
        onToggle={() => toggleSection('similarity')}
        badge={similarityBadges}
      >
        <div className="pt-3 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Threshold
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {(filtersState.filters.similarityThreshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.0"
              step="0.05"
              value={filtersState.filters.similarityThreshold}
              onChange={(e) => handleFilterChange({ similarityThreshold: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>Broader</span>
              <span>More Precise</span>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Logic Operator
            </label>
            <select
              value={filtersState.filters.logicOperator}
              onChange={(e) => handleFilterChange({ logicOperator: e.target.value as 'AND' | 'OR' })}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="AND">AND (All conditions)</option>
              <option value="OR">OR (Any condition)</option>
            </select>
          </div>
        </div>
      </CollapsibleSection>

      {/* Content Properties */}
      <CollapsibleSection
        title="Content"
        icon={ArchiveBoxIcon}
        isOpen={openSections.content}
        onToggle={() => toggleSection('content')}
        badge={contentBadges}
      >
        <div className="pt-3 space-y-3">
          <div className="space-y-2">
            {[
              { key: 'hasImages' as const, label: 'Has Images', icon: '🖼️' },
              { key: 'hasLinks' as const, label: 'Has Links', icon: '🔗' },
              { key: 'isEmpty' as const, label: 'Is Empty', icon: '📭' },
            ].map(({ key, label, icon }) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm">{icon}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                </div>
                <select
                  value={filtersState.filters[key] === null ? 'any' : filtersState.filters[key] ? 'yes' : 'no'}
                  onChange={(e) => {
                    const value = e.target.value === 'any' ? null : e.target.value === 'yes';
                    handleFilterChange({ [key]: value });
                  }}
                  className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="any">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min Size (KB)
              </label>
              <input
                type="number"
                value={filtersState.filters.minSize ? Math.round(filtersState.filters.minSize / 1024) : ''}
                onChange={(e) => {
                  const kb = e.target.value ? parseInt(e.target.value) : null;
                  handleFilterChange({ minSize: kb ? kb * 1024 : null });
                }}
                placeholder="0"
                min="0"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Size (KB)
              </label>
              <input
                type="number"
                value={filtersState.filters.maxSize ? Math.round(filtersState.filters.maxSize / 1024) : ''}
                onChange={(e) => {
                  const kb = e.target.value ? parseInt(e.target.value) : null;
                  handleFilterChange({ maxSize: kb ? kb * 1024 : null });
                }}
                placeholder="∞"
                min="0"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Folder/Path Filters */}
      <CollapsibleSection
        title="Folders"
        icon={FolderIcon}
        isOpen={openSections.paths}
        onToggle={() => toggleSection('paths')}
        badge={pathBadges}
      >
        <div className="pt-3 space-y-3">
          {/* Include Paths */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Include Paths
            </label>
            <div className="space-y-1">
              <input
                type="text"
                placeholder="e.g., Projects/, Notes/Daily/"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const value = e.currentTarget.value.trim();
                    if (value && !filtersState.filters.includePaths.includes(value)) {
                      handleFilterChange({
                        includePaths: [...filtersState.filters.includePaths, value]
                      });
                      e.currentTarget.value = '';
                    }
                  }
                }}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <div className="flex flex-wrap gap-1">
                {filtersState.filters.includePaths.map(path => (
                  <span
                    key={path}
                    className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-800 
                      dark:bg-green-900/20 dark:text-green-400 rounded-full"
                  >
                    {path}
                    <button
                      onClick={() => {
                        const newPaths = filtersState.filters.includePaths.filter(p => p !== path);
                        handleFilterChange({ includePaths: newPaths });
                      }}
                      className="ml-1 text-green-600 dark:text-green-400 hover:text-green-800 
                        dark:hover:text-green-200"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Exclude Paths */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Exclude Paths
            </label>
            <div className="space-y-1">
              <input
                type="text"
                placeholder="e.g., Archive/, Templates/"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const value = e.currentTarget.value.trim();
                    if (value && !filtersState.filters.excludePaths.includes(value)) {
                      handleFilterChange({
                        excludePaths: [...filtersState.filters.excludePaths, value]
                      });
                      e.currentTarget.value = '';
                    }
                  }
                }}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <div className="flex flex-wrap gap-1">
                {filtersState.filters.excludePaths.map(path => (
                  <span
                    key={path}
                    className="inline-flex items-center px-2 py-1 text-xs bg-red-100 text-red-800 
                      dark:bg-red-900/20 dark:text-red-400 rounded-full"
                  >
                    {path}
                    <button
                      onClick={() => {
                        const newPaths = filtersState.filters.excludePaths.filter(p => p !== path);
                        handleFilterChange({ excludePaths: newPaths });
                      }}
                      className="ml-1 text-red-600 dark:text-red-400 hover:text-red-800 
                        dark:hover:text-red-200"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Tag Filters */}
      <CollapsibleSection
        title="Tags"
        icon={TagIcon}
        isOpen={openSections.tags}
        onToggle={() => toggleSection('tags')}
        badge={tagBadges}
      >
        <div className="pt-3 space-y-4">
          {/* Include Tags */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Include Tags
            </label>
            <TagSelector
              vaultName={vaultName || ''}
              selectedTags={filtersState.filters.includeTags}
              onTagsChange={(tags) => handleFilterChange({ includeTags: tags })}
              placeholder="Search tags to include..."
              mode="include"
            />
          </div>

          {/* Exclude Tags */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Exclude Tags
            </label>
            <TagSelector
              vaultName={vaultName || ''}
              selectedTags={filtersState.filters.excludeTags}
              onTagsChange={(tags) => handleFilterChange({ excludeTags: tags })}
              placeholder="Search tags to exclude..."
              mode="exclude"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Filter Presets */}
      <CollapsibleSection
        title="Presets"
        icon={BookmarkIcon}
        isOpen={openSections.presets}
        onToggle={() => toggleSection('presets')}
        badge={filtersState.presets.length}
      >
        <div className="pt-3 space-y-3">
          {/* Save Current Filters */}
          <div>
            <button
              onClick={() => setShowSavePreset(!showSavePreset)}
              className="w-full text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors"
            >
              Save Current Filters
            </button>
            
            {showSavePreset && (
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name"
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="text"
                  value={presetDescription}
                  onChange={(e) => setPresetDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleSavePreset}
                    disabled={!presetName.trim()}
                    className="flex-1 text-xs bg-green-600 text-white px-2 py-1 rounded disabled:opacity-50 
                      disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setShowSavePreset(false);
                      setPresetName('');
                      setPresetDescription('');
                    }}
                    className="flex-1 text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Preset List */}
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {filtersState.presets.map(preset => (
              <div key={preset.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {preset.name}
                  </div>
                  {preset.description && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {preset.description}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-1 ml-2">
                  <button
                    onClick={() => filtersActions.loadPreset(preset.id)}
                    className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded"
                    title="Load preset"
                  >
                    <BookmarkIcon className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => filtersActions.deletePreset(preset.id)}
                    className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                    title="Delete preset"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            
            {filtersState.presets.length === 0 && (
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                No saved presets
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
};

export default SearchFilters;