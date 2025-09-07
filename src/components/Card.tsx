
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

  return (
    <div
      className={`relative ${sizeClass} bg-white rounded-lg shadow-md flex flex-col justify-between p-1 transition-all duration-200 ease-in-out ${colorClass} ${
        isSelected ? 'transform -translate-y-4 ring-4 ring-cyan-400' : ''
      } ${onClick && isPlayable ? 'cursor-pointer hover:-translate-y-2' : ''}`}
      onClick={handleClick}
    >
      <div className="text-left font-bold">{card.rank}</div>
      <div className={`text-center font-bold ${small ? 'text-2xl' : 'text-4xl'}`}>{card.suit}</div>
      <div className="text-right font-bold transform rotate-180">{card.rank}</div>
    </div>
  );
};

export default CardComponent;
