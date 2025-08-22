import React from 'react';

interface ObsidianLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const ObsidianLogo: React.FC<ObsidianLogoProps> = ({ className = '', size = 'md' }) => {
  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'w-6 h-6';
      case 'md': return 'w-8 h-8';
      case 'lg': return 'w-12 h-12';
      default: return 'w-8 h-8';
    }
  };

  return (
    <svg 
      fill="none" 
      viewBox="0 0 512 512" 
      xmlns="http://www.w3.org/2000/svg"
      className={`${getSizeClass()} ${className}`}
    >
      <defs>
        <radialGradient id="logo-gradient-1" cx="0" cy="0" gradientTransform="matrix(-59 -225 150 -39 161.4 470)" gradientUnits="userSpaceOnUse" r="1">
          <stop offset="0" stopColor="#9333EA" stopOpacity="0.8"/>
          <stop offset="1" stopColor="#7C3AED" stopOpacity="0.4"/>
        </radialGradient>
        <radialGradient id="logo-gradient-2" cx="0" cy="0" gradientTransform="matrix(116 -205 136 77 256 370)" gradientUnits="userSpaceOnUse" r="1">
          <stop offset="0" stopColor="#A855F7" stopOpacity="0.6"/>
          <stop offset="1" stopColor="#8B5CF6" stopOpacity="0.2"/>
        </radialGradient>
        <clipPath id="obsidian-clip">
          <path d="M.2.2h512v512H.2z"/>
        </clipPath>
      </defs>
      <g clipPath="url(#obsidian-clip)">
        <path 
          d="M382.3 475.6c-3.1 23.4-26 41.6-48.7 35.3-32.4-8.9-69.9-22.8-103.6-25.4l-51.7-4a34 34 0 0 1-22-10.2l-89-91.7a34 34 0 0 1-6.7-37.7s55-121 57.1-127.3c2-6.3 9.6-61.2 14-90.6 1.2-7.9 5-15 11-20.3L248 8.9a34.1 34.1 0 0 1 49.6 4.3L386 125.6a37 37 0 0 1 7.6 22.4c0 21.3 1.8 65 13.6 93.2 11.5 27.3 32.5 57 43.5 71.5a17.3 17.3 0 0 1 1.3 19.2L382.3 475.6z" 
          fill="url(#logo-gradient-1)"
        />
        <path 
          d="M248 8.9L142.3 103.8c-6 5.3-9.8 12.4-11 20.3-4.4 29.4-12 84.3-14 90.6-2.1 6.3-57.1 127.3-57.1 127.3a34 34 0 0 0 6.7 37.7l89 91.7a34 34 0 0 0 22 10.2l51.7 4c33.7 2.6 71.2 16.5 103.6 25.4 22.7 6.3 45.6-11.9 48.7-35.3l67.4-143.4a17.3 17.3 0 0 0-1.3-19.2c-11-14.5-32-44.2-43.5-71.5-11.8-28.2-13.6-71.9-13.6-93.2a37 37 0 0 0-7.6-22.4L297.6 13.2a34.1 34.1 0 0 0-49.6-4.3z" 
          fill="url(#logo-gradient-2)"
        />
      </g>
    </svg>
  );
};

export default ObsidianLogo;