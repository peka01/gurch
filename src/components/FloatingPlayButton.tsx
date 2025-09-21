import React from 'react';

interface FloatingPlayButtonProps {
  position: { x: number; y: number };
  onPlay: () => void;
  disabled?: boolean;
  cardCount: number;
}

const FloatingPlayButton: React.FC<FloatingPlayButtonProps> = ({ 
  position, 
  onPlay, 
  disabled = false, 
  cardCount 
}) => {
  // Ensure button stays within viewport bounds with mobile-friendly positioning
    const isMobile = window.innerWidth < 640; // sm breakpoint
    const buttonWidth = isMobile ? 180 : 200; // Optimized for mobile touch
    const buttonHeight = isMobile ? 60 : 60; // Better touch target
    const margin = isMobile ? 16 : 20;
  
  // Position button centered horizontally and above human player cards
  const left = Math.max(margin, Math.min(position.x - (buttonWidth / 2), window.innerWidth - buttonWidth - margin));
  
  // Position button above human player's card area, accounting for action panel on mobile
  const mobileOffset = isMobile ? 200 : 0; // Account for action panel height
  const top = Math.max(margin, Math.min(position.y, window.innerHeight - buttonHeight - margin - mobileOffset));

  return (
    <div
      className="floating-play-button fixed z-50 pointer-events-auto"
      style={{
        left: left,
        top: top,
        transform: 'translate(0, 0)' // No additional transform needed since we're positioning directly
      }}
    >
      <button
        onClick={onPlay}
        disabled={disabled}
        className={`
          bg-gradient-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600
          text-white font-bold rounded-xl shadow-lg border-2 border-green-400
          transition-all duration-200 transform hover:scale-105 active:scale-95
          disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
          focus:outline-none focus:ring-4 focus:ring-green-400/30
          backdrop-blur-sm touch-manipulation select-none
          ${isMobile ? 'py-3 px-5 text-base' : 'py-3 px-6 text-base'}
        `}
        style={{
          backgroundColor: disabled ? '#6b7280' : '#059669', // Fallback green-600
          backgroundImage: disabled ? 'none' : 'linear-gradient(to bottom right, #059669, #047857)', // Fallback gradient
          border: '2px solid #10b981' // Fallback border
        }}
      >
        <div className="flex items-center space-x-2">
          <span className="text-lg">🎮</span>
          <span>Play Card{cardCount > 1 ? 's' : ''} ({cardCount})</span>
        </div>
      </button>
    </div>
  );
};

export default FloatingPlayButton;
