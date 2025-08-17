import React from 'react';

interface LogoProps {
  variant?: 'full' | 'icon' | 'text';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  variant = 'full', 
  size = 'md', 
  className = '' 
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return 'h-6 w-auto';
      case 'md': return 'h-8 w-auto';
      case 'lg': return 'h-12 w-auto';
      case 'xl': return 'h-16 w-auto';
      default: return 'h-8 w-auto';
    }
  };

  // Crystal/Gem Icon Component
  const CrystalIcon = ({ className: iconClass = '' }: { className?: string }) => (
    <svg 
      viewBox="0 0 100 120" 
      className={iconClass}
      fill="none"
    >
      {/* Crystal shape with gradient */}
      <defs>
        <linearGradient id="crystalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      
      {/* Main crystal body */}
      <path 
        d="M20 30 L50 5 L80 30 L85 90 L50 115 L15 90 Z" 
        fill="url(#crystalGradient)"
        stroke="#4C1D95"
        strokeWidth="3"
      />
      
      {/* Crystal facets for depth */}
      <path 
        d="M20 30 L50 5 L50 60 Z" 
        fill="#9333EA"
        fillOpacity="0.7"
      />
      <path 
        d="M50 5 L80 30 L50 60 Z" 
        fill="#7C3AED"
        fillOpacity="0.8"
      />
      <path 
        d="M20 30 L50 60 L15 90 Z" 
        fill="#8B5CF6"
        fillOpacity="0.6"
      />
      <path 
        d="M50 60 L80 30 L85 90 Z" 
        fill="#6D28D9"
        fillOpacity="0.9"
      />
    </svg>
  );

  // Brain Icon Component
  const BrainIcon = ({ className: iconClass = '' }: { className?: string }) => (
    <svg 
      viewBox="0 0 100 100" 
      className={iconClass}
      fill="none"
    >
      <defs>
        <linearGradient id="brainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#9333EA" />
        </linearGradient>
      </defs>
      
      {/* Speech bubble background */}
      <circle 
        cx="50" 
        cy="45" 
        r="40" 
        fill="white"
        stroke="#4C1D95"
        strokeWidth="3"
      />
      
      {/* Speech bubble tail */}
      <path 
        d="M25 75 L20 85 L35 80 Z" 
        fill="white"
        stroke="#4C1D95"
        strokeWidth="3"
      />
      
      {/* Brain shape */}
      <path 
        d="M30 35 Q35 25 45 30 Q55 25 65 35 Q70 45 65 55 Q55 65 45 60 Q35 65 30 55 Q25 45 30 35"
        fill="url(#brainGradient)"
        stroke="#4C1D95"
        strokeWidth="2"
      />
      
      {/* Brain details */}
      <path 
        d="M35 40 Q40 35 45 40 Q50 35 55 40"
        stroke="#7C3AED"
        strokeWidth="1.5"
        fill="none"
      />
      <path 
        d="M35 50 Q40 45 45 50 Q50 45 55 50"
        stroke="#7C3AED"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );

  // Text Logo Component
  const TextLogo = ({ className: textClass = '' }: { className?: string }) => (
    <span className={`font-bold tracking-tight ${textClass}`}>
      <span className="text-purple-600 dark:text-purple-400">Vault</span>
      <span className="text-gray-900 dark:text-white">Mind</span>
    </span>
  );

  if (variant === 'icon') {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        <CrystalIcon className={`${getSizeClasses()} flex-shrink-0`} />
        <BrainIcon className={`${getSizeClasses()} flex-shrink-0`} />
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <TextLogo 
        className={`${size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : size === 'xl' ? 'text-3xl' : 'text-xl'} ${className}`} 
      />
    );
  }

  // Full logo (default)
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className="flex items-center space-x-1">
        <CrystalIcon className={`${getSizeClasses()} flex-shrink-0`} />
        <BrainIcon className={`${getSizeClasses()} flex-shrink-0`} />
      </div>
      <TextLogo 
        className={`${size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : size === 'xl' ? 'text-3xl' : 'text-xl'}`} 
      />
    </div>
  );
};

export default Logo;