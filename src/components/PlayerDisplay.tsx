
import React from 'react';
import { Player, GamePhase, Card } from '../../types';
import CardComponent from './Card';

interface PlayerDisplayProps {
  player: Player;
  isCurrentPlayer: boolean;
  isStarter: boolean;
  isThinking: boolean;
  positionClass: string;
  faceUpCard?: Card;
  gamePhase: GamePhase;
  swappingCards?: Card[];
}

const PlayerDisplay: React.FC<PlayerDisplayProps> = ({ player, isCurrentPlayer, isStarter, isThinking, positionClass, faceUpCard, gamePhase, swappingCards }) => {
  const isBottomPlayer = positionClass.includes('bottom');
  
  const ringClass = isCurrentPlayer 
    ? 'ring-4 ring-cyan-400 shadow-lg' 
    : isStarter && gamePhase === GamePhase.DEALING 
    ? 'ring-4 ring-yellow-400 shadow-lg'
    : 'ring-2 ring-gray-600';

  // Get player status
  const getPlayerStatus = () => {
    if (isThinking) return { text: 'Thinking...', color: 'bg-blue-500', icon: '🤔' };
    if (isCurrentPlayer) return { text: 'Your Turn', color: 'bg-yellow-500', icon: '🎯' };
    
    // Only show swap-related status during swapping phases
    const isSwappingPhase = [
      GamePhase.FIRST_SWAP_DECISION, GamePhase.FIRST_SWAP_ACTION, GamePhase.FIRST_SWAP_OTHERS_DECISION,
      GamePhase.OTHERS_SWAP_DECISION, GamePhase.OTHERS_SWAP_ACTION, GamePhase.VOTE_SWAP_DECISION,
      GamePhase.VOTE_SWAP, GamePhase.FINAL_SWAP_DECISION, GamePhase.FINAL_SWAP_ACTION,
      GamePhase.FINAL_SWAP_ONE_CARD_SELECT, GamePhase.FINAL_SWAP_ONE_CARD_REVEAL_AND_DECIDE
    ].includes(gamePhase);
    
    if (isSwappingPhase) {
      if (player.hasStoodPat) return { text: 'Stood Pat', color: 'bg-gray-500', icon: '✋' };
      if (player.hasMadeFirstSwapDecision) return { text: 'Swapped', color: 'bg-purple-500', icon: '🔄' };
    }
    
    return { text: 'Waiting', color: 'bg-gray-600', icon: '⏳' };
  };

  const status = getPlayerStatus();

  return (
    <div className={`absolute transform ${positionClass} transition-all duration-500 z-10`}>
      <div className={`flex flex-col items-center p-2 rounded-lg bg-black/40 ${ringClass}`}>
        <div className="relative">
          <img src={player.avatar} alt={player.name} className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-yellow-400 object-cover" />
          {player.isDealer && (
            <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full shadow-md">DEALER</div>
          )}
          {/* Status indicator */}
          <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 ${status.color} text-white text-xs font-bold px-3 py-1 rounded-full shadow-md ${isThinking ? 'animate-pulse' : ''}`}>
            {status.icon} {status.text}
          </div>
        </div>
        <p className="mt-2 text-sm md:text-base font-semibold">{player.name}</p>
        <p className="text-xs text-yellow-300 font-bold">Score: {player.score}</p>
        <div className="flex items-center space-x-1 mt-1">
          <div className="w-6 h-8 bg-gray-700 rounded border-2 border-gray-500 flex items-center justify-center font-bold text-lg">
            {player.hand.length}
          </div>
          {!isBottomPlayer && gamePhase === GamePhase.DEALING && faceUpCard && (
             <CardComponent card={faceUpCard} />
          )}
        </div>
        <div className="flex justify-center mt-2 space-x-1">
          {player.playedCards.slice(-3).map((card, index) => (
            <div key={index} className="transform -translate-y-2">
              <CardComponent card={card} small />
            </div>
          ))}
        </div>
        
        {/* Show swapping cards with animation */}
        {swappingCards && swappingCards.length > 0 && (
          <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 bg-yellow-500/90 p-2 rounded-lg shadow-lg z-20">
            <p className="text-xs font-bold text-black mb-1">Swapping:</p>
            <div className="flex space-x-1">
              {swappingCards.map((card, index) => (
                <div key={index} className="animate-pulse">
                  <CardComponent card={card} small />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerDisplay;
