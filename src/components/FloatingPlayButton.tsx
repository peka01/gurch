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
  // Ensure button stays within viewport bounds
  const buttonWidth = 200; // Approximate button width
  const buttonHeight = 60; // Approximate button height
  const margin = 20;
  
  // Position button slightly offset from the click position
  const left = Math.max(margin, Math.min(position.x + 30, window.innerWidth - buttonWidth - margin));
  const top = Math.max(margin, Math.min(position.y - 20, window.innerHeight - buttonHeight - margin));

  return (
    <div
      className="floating-play-button fixed z-50 pointer-events-auto"
      style={{
        left: left,
        top: top,
        transform: 'translate(-50%, -100%)'
      }}
    >
      <button
        onClick={onPlay}
        disabled={disabled}
        className={`
          bg-gradient-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600
          text-white font-bold py-3 px-6 rounded-xl shadow-lg border-2 border-green-400
          transition-all duration-200 transform hover:scale-105 active:scale-95
          disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
          focus:outline-none focus:ring-4 focus:ring-green-400/30
          backdrop-blur-sm
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
