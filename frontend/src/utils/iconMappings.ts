/**
 * Heroicons v2 Icon Mapping Utility
 * 
 * This file provides correct icon names for Heroicons v2 to prevent import errors.
 * Common v1 -> v2 naming changes are documented here.
 */

// Re-export commonly used icons with correct v2 names
export {
  // Common icons that haven't changed
  CheckIcon,
  XMarkIcon,
  ClipboardDocumentIcon,
  DocumentArrowDownIcon,
  ShareIcon,
  BookmarkIcon,
  DocumentDuplicateIcon,
  TableCellsIcon,
  CodeBracketIcon,
  ClockIcon,
  StarIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  FolderIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon,
  CalendarIcon,
  TagIcon,
  DocumentTextIcon,
  PlusIcon,
  ArrowLeftIcon,

  // Renamed icons (v1 -> v2)
  ArrowTopRightOnSquareIcon, // was ExternalLinkIcon
  ArrowTrendingUpIcon, // was TrendingUpIcon
  
} from '@heroicons/react/24/outline';

// Common icon name mappings for reference
export const iconMappings = {
  // v1 name -> v2 name
  'ExternalLinkIcon': 'ArrowTopRightOnSquareIcon',
  'TrendingUpIcon': 'ArrowTrendingUpIcon',
  'RefreshIcon': 'ArrowPathIcon',
  'DotsVerticalIcon': 'EllipsisVerticalIcon',
  'DotsHorizontalIcon': 'EllipsisHorizontalIcon',
  'MenuIcon': 'Bars3Icon',
  'MenuAlt2Icon': 'Bars2Icon',
  'MenuAlt3Icon': 'Bars3BottomLeftIcon',
  'MenuAlt4Icon': 'Bars3BottomRightIcon',
  'CollectionIcon': 'RectangleStackIcon',
  'ViewListIcon': 'ListBulletIcon',
  'ViewGridIcon': 'Squares2X2Icon',
  'DatabaseIcon': 'CircleStackIcon',
  'TerminalIcon': 'CommandLineIcon',
  'CogIcon': 'Cog6ToothIcon',
  'BadgeCheckIcon': 'CheckBadgeIcon',
  'InformationCircleIcon': 'InformationCircleIcon', // Same
  'ExclamationIcon': 'ExclamationTriangleIcon',
  'QuestionMarkCircleIcon': 'QuestionMarkCircleIcon', // Same
  'LightBulbIcon': 'LightBulbIcon', // Same
  'BeakerIcon': 'BeakerIcon', // Same
  'SparklesIcon': 'SparklesIcon', // Same
  'FireIcon': 'FireIcon', // Same
  'HeartIcon': 'HeartIcon', // Same
  'HomeIcon': 'HomeIcon', // Same
  'UserIcon': 'UserIcon', // Same
  'UsersIcon': 'UsersIcon', // Same
  'SearchIcon': 'MagnifyingGlassIcon',
  'PencilIcon': 'PencilIcon', // Same
  'PencilAltIcon': 'PencilSquareIcon',
  'TrashIcon': 'TrashIcon', // Same
  'DownloadIcon': 'ArrowDownTrayIcon',
  'UploadIcon': 'ArrowUpTrayIcon',
  'DuplicateIcon': 'DocumentDuplicateIcon',
  'ClipboardIcon': 'ClipboardIcon', // Same
  'ClipboardCopyIcon': 'ClipboardDocumentIcon',
  'LinkIcon': 'LinkIcon', // Same
  'EyeIcon': 'EyeIcon', // Same
  'EyeOffIcon': 'EyeSlashIcon',
  'LockClosedIcon': 'LockClosedIcon', // Same
  'LockOpenIcon': 'LockOpenIcon', // Same
  'KeyIcon': 'KeyIcon', // Same
  'ShieldCheckIcon': 'ShieldCheckIcon', // Same
  'ShieldExclamationIcon': 'ShieldExclamationIcon', // Same
} as const;

/**
 * Get the correct v2 icon name for a given v1 icon name
 */
export function getV2IconName(v1Name: string): string {
  return iconMappings[v1Name as keyof typeof iconMappings] || v1Name;
}

/**
 * Validate if an icon name exists in Heroicons v2
 * This is a runtime check helper for development
 */
export function validateIconName(iconName: string): boolean {
  try {
    // This would need to be implemented with actual icon imports
    // For now, we'll check against our known mappings
    const validIcons = [
      ...Object.values(iconMappings),
      ...Object.keys(iconMappings).filter(key => !iconMappings[key as keyof typeof iconMappings])
    ];
    return validIcons.includes(iconName);
  } catch {
    return false;
  }
}

// Common icon aliases for easier usage
export const Icons = {
  // Actions
  Copy: ClipboardDocumentIcon,
  Download: DocumentArrowDownIcon,
  Share: ShareIcon,
  Save: BookmarkIcon,
  External: ArrowTopRightOnSquareIcon,
  Check: CheckIcon,
  Close: XMarkIcon,
  Duplicate: DocumentDuplicateIcon,
  
  // Content
  Table: TableCellsIcon,
  Code: CodeBracketIcon,
  Document: DocumentTextIcon,
  
  // Time & Status
  Clock: ClockIcon,
  Star: StarIcon,
  Trending: ArrowTrendingUpIcon,
  
  // Navigation
  Search: MagnifyingGlassIcon,
  Filter: AdjustmentsHorizontalIcon,
  Folder: FolderIcon,
  ChevronDown: ChevronDownIcon,
  ChevronUp: ChevronUpIcon,
  ChevronRight: ChevronRightIcon,
  Back: ArrowLeftIcon,
  Plus: PlusIcon,
  
  // Other
  Calendar: CalendarIcon,
  Tag: TagIcon,
  Trash: TrashIcon,
} as const;