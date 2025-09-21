
import React from 'react';
import { Card } from '../../types';

interface CardProps {
  card: Card;
  isSelected?: boolean;
  isPlayable?: boolean;
  onClick?: () => void;
  small?: boolean;
  faceDown?: boolean;
  humanPlayer?: boolean;
  isCommander?: boolean; // Highlight commander cards that need to be beaten
}

const CardComponent: React.FC<CardProps> = ({ card, isSelected, onClick, small, isPlayable = true, faceDown = false, humanPlayer = false, isCommander = false }) => {
  const isRed = card.suit === '♥' || card.suit === '♦';
  const colorClass = isRed ? 'text-red-500' : 'text-black';
  // Mobile-first sizing: optimized for touch and visibility
  const sizeClass = small 
    ? 'w-16 h-24 sm:w-16 sm:h-24 text-base sm:text-base' // Optimized small cards
    : humanPlayer
    ? 'w-24 h-36 sm:w-24 sm:h-36 text-xl sm:text-2xl' // Mobile-optimized human cards
    : 'w-14 h-20 sm:w-32 sm:h-44 text-sm sm:text-2xl'; // Compact bot cards for mobile space efficiency

  // If face down, render a face-down card
  if (faceDown) {
    return (
      <div
        className={`card-component ${humanPlayer ? 'human-card' : ''} relative ${sizeClass} rounded-lg shadow-md flex flex-col justify-center items-center p-1 transition-all duration-200 ease-in-out ${
          isSelected ? 'transform -translate-y-2 sm:-translate-y-4 ring-2 sm:ring-4 ring-cyan-400 shadow-2xl' : ''
        } ${onClick && isPlayable ? 'cursor-pointer hover:-translate-y-1 sm:hover:-translate-y-2 hover:shadow-lg' : ''} ${
          !isPlayable ? 'opacity-60 cursor-not-allowed' : ''
        } touch-manipulation`}
        style={{
          background: `
            radial-gradient(circle at 25% 25%, #1d4ed8 2px, transparent 2px),
            radial-gradient(circle at 75% 75%, #1d4ed8 2px, transparent 2px),
            radial-gradient(circle at 25% 75%, #1d4ed8 1px, transparent 1px),
            radial-gradient(circle at 75% 25%, #1d4ed8 1px, transparent 1px),
            linear-gradient(45deg, #1e3a8a 25%, transparent 25%),
            linear-gradient(-45deg, #1e3a8a 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #1e3a8a 75%),
            linear-gradient(-45deg, transparent 75%, #1e3a8a 75%),
            linear-gradient(to bottom, #1e40af, #1e3a8a)
          `,
          backgroundColor: '#1e40af',
          backgroundSize: '8px 8px, 8px 8px, 6px 6px, 6px 6px, 4px 4px, 4px 4px, 4px 4px, 4px 4px, 100% 100%',
          border: '2px solid #1e3a8a',
          boxShadow: 'inset 0 0 0 1px #1d4ed8, 0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)'
        }}
        onClick={onClick && isPlayable ? onClick : undefined}
        title="Face down card"
      >
        {/* Traditional playing card back pattern */}
        <div className="absolute inset-2 border border-blue-400 rounded flex items-center justify-center">
          <div className="text-center">
            {/* Traditional ornate pattern using Unicode symbols */}
            <div className="text-blue-200 text-lg leading-none">
              <div className="grid grid-cols-3 gap-1 text-xs">
                <span>❖</span><span>♦</span><span>❖</span>
                <span>♦</span><span className="text-base">♠</span><span>♦</span>
                <span>❖</span><span>♦</span><span>❖</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Selection indicator for face down cards */}
        {isSelected && (
          <div className="absolute -top-2 -right-2 bg-cyan-400 text-black text-lg font-bold rounded-full w-10 h-10 flex items-center justify-center border-2 border-white touch-manipulation">
            ✓
          </div>
        )}
      </div>
    );
  }

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if(onClick && isPlayable) {
        console.log(`[DEBUG] Card clicked: ${card.rank}${card.suit}, playable: ${isPlayable}`);
        onClick();
    }
  }

  // Get card value display
  const getCardValueDisplay = () => {
    if (small) return null;
    return (
      <div className="absolute top-0 right-0 bg-gray-800 text-white text-base px-1 rounded-bl-lg rounded-tr-lg font-bold hidden sm:block">
        {card.value}
      </div>
    );
  };

  // Get selection indicator
  const getSelectionIndicator = () => {
    if (!isSelected) return null;
    return (
      <div className="absolute -top-2 -right-2 bg-cyan-400 text-black text-lg font-bold rounded-full w-10 h-10 flex items-center justify-center border-2 border-white touch-manipulation">
        ✓
      </div>
    );
  };

  return (
    <div
      className={`card-component ${humanPlayer ? 'human-card' : ''} relative ${sizeClass} bg-white rounded-lg shadow-md flex flex-col justify-between p-1 transition-all duration-200 ease-in-out ${colorClass} ${
        isCommander ? 'ring-2 ring-yellow-400 bg-yellow-50 border-yellow-400' : ''
      } ${
        isSelected ? 'transform -translate-y-2 sm:-translate-y-4 ring-2 sm:ring-4 ring-cyan-400 shadow-2xl' : ''
      } ${onClick && isPlayable ? 'cursor-pointer hover:-translate-y-1 sm:hover:-translate-y-2 hover:shadow-lg' : ''} ${
        !isPlayable ? 'opacity-60 cursor-not-allowed' : ''
      } touch-manipulation`}
      style={{
        backgroundColor: isCommander ? '#fefce8' : '#ffffff', // Yellow bg for commander cards, white for regular cards
        border: isCommander ? '2px solid #facc15' : '1px solid #e5e7eb', // Yellow border for commander, gray for regular
        boxShadow: isCommander 
          ? '0 0 0 2px #fde047, 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' 
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}
      onClick={handleClick}
      onTouchEnd={handleClick}
      title={`${card.rank} of ${card.suit} (Value: ${card.value})`}
    >
      {getCardValueDisplay()}
      {getSelectionIndicator()}
      
      <div className="text-left font-bold text-sm sm:text-2xl">{card.rank}</div>
      <div className={`text-center font-bold ${small ? 'text-3xl sm:text-3xl' : humanPlayer ? 'text-4xl sm:text-4xl' : 'text-2xl sm:text-5xl'}`}>{card.suit}</div>
      <div className="text-right font-bold transform rotate-180 text-sm sm:text-2xl">{card.rank}</div>
      
      {/* Hover effect overlay */}
      {onClick && isPlayable && (
        <div className="absolute inset-0 bg-cyan-200 opacity-0 hover:opacity-20 rounded-lg transition-opacity duration-200 pointer-events-none" />
      )}
    </div>
  );
};

export default CardComponent;
