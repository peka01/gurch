
import React from 'react';
import { Card } from '../../types';

interface CardProps {
  card: Card;
  isSelected?: boolean;
  isPlayable?: boolean;
  onClick?: () => void;
  small?: boolean;
}

const CardComponent: React.FC<CardProps> = ({ card, isSelected, onClick, small, isPlayable = true }) => {
  const isRed = card.suit === '♥' || card.suit === '♦';
  const colorClass = isRed ? 'text-red-500' : 'text-black';
  const sizeClass = small ? 'w-10 h-14 text-sm' : 'w-16 h-24 text-2xl';

  const handleClick = () => {
    if(onClick && isPlayable) {
        onClick();
    }
  }

  // Get card value display
  const getCardValueDisplay = () => {
    if (small) return null;
    return (
      <div className="absolute top-0 right-0 bg-gray-800 text-white text-xs px-1 rounded-bl-lg rounded-tr-lg font-bold">
        {card.value}
      </div>
    );
  };

  // Get selection indicator
  const getSelectionIndicator = () => {
    if (!isSelected) return null;
    return (
      <div className="absolute -top-2 -right-2 bg-cyan-400 text-black text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white">
        ✓
      </div>
    );
  };

  return (
    <div
      className={`relative ${sizeClass} bg-white rounded-lg shadow-md flex flex-col justify-between p-1 transition-all duration-200 ease-in-out ${colorClass} ${
        isSelected ? 'transform -translate-y-4 ring-4 ring-cyan-400 shadow-2xl' : ''
      } ${onClick && isPlayable ? 'cursor-pointer hover:-translate-y-2 hover:shadow-lg' : ''} ${
        !isPlayable ? 'opacity-60 cursor-not-allowed' : ''
      }`}
      onClick={handleClick}
      title={`${card.rank} of ${card.suit} (Value: ${card.value})`}
    >
      {getCardValueDisplay()}
      {getSelectionIndicator()}
      
      <div className="text-left font-bold">{card.rank}</div>
      <div className={`text-center font-bold ${small ? 'text-2xl' : 'text-4xl'}`}>{card.suit}</div>
      <div className="text-right font-bold transform rotate-180">{card.rank}</div>
      
      {/* Hover effect overlay */}
      {onClick && isPlayable && (
        <div className="absolute inset-0 bg-cyan-200 opacity-0 hover:opacity-20 rounded-lg transition-opacity duration-200 pointer-events-none" />
      )}
    </div>
  );
};

export default CardComponent;
