
import React from 'react';
import { Player, GamePhase, Card } from '../../types';
import CardComponent from './Card';

interface PlayerDisplayProps {
  player: Player;
  isCurrentPlayer: boolean;
  isStarter: boolean;
  isThinking: boolean;
  positionClass: string;
  positionStyle?: React.CSSProperties;
  faceUpCard?: Card;
  gamePhase: GamePhase;
  swappingCards?: Card[];
  isDealing?: boolean;
  dealingCards?: Card[];
  faceUpDealingCard?: Card;
}

const PlayerDisplay: React.FC<PlayerDisplayProps> = ({ player, isCurrentPlayer, isStarter, isThinking, positionClass, positionStyle, faceUpCard, gamePhase, swappingCards, isDealing, dealingCards, faceUpDealingCard }) => {
  const isBottomPlayer = positionClass.includes('bottom');
  
  const ringClass = isCurrentPlayer 
    ? 'ring-4 ring-cyan-400 shadow-lg' 
    : isStarter && gamePhase === GamePhase.DEALING 
    ? 'ring-4 ring-yellow-400 shadow-lg'
    : 'ring-2 ring-gray-600';

  // Get player status
  const getPlayerStatus = () => {
    if (isThinking) return { text: 'Thinking...', color: 'bg-blue-500', icon: '🤔' };
    if (isCurrentPlayer) {
      // Show "Your Turn" for human players, "Bot X's Turn" for bots
      const turnText = player.isHuman ? 'Your Turn' : `${player.name}'s Turn`;
      return { text: turnText, color: 'bg-yellow-500', icon: '🎯' };
    }
    
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
    <div className={`absolute transform transition-all duration-500 z-10`} style={positionStyle}>
      {/* Poker Seat Design */}
      <div className={`relative bg-gradient-to-br from-amber-800 to-amber-900 rounded-2xl p-4 shadow-2xl border-4 transition-all duration-300 ${ringClass} min-w-[200px]`}>
        
        {/* Player Avatar */}
        <div className="flex flex-col items-center space-y-3">
          <div className={`relative w-16 h-16 rounded-full border-4 transition-all duration-300 ${
            isCurrentPlayer ? 'border-cyan-400 shadow-cyan-400/50 shadow-lg' : 'border-amber-400'
          }`}>
            <img src={player.avatar} alt={player.name} className="w-full h-full rounded-full object-cover" />
            {player.isDealer && (
              <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full shadow-md">DEALER</div>
            )}
            {/* Status Ring */}
            {isThinking && (
              <div className="absolute -inset-1 rounded-full border-2 border-blue-400 animate-pulse"></div>
            )}
            {isStarter && (
              <div className="absolute -inset-1 rounded-full border-2 border-yellow-400"></div>
            )}
          </div>
          
          {/* Player Name */}
          <div className="text-center">
            <p className="text-white font-bold text-lg">{player.name}</p>
            <p className="text-amber-200 text-sm font-semibold">Score: {player.score}</p>
          </div>
          
          {/* Status Badge */}
          <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1 ${status.color} text-white shadow-lg ${isThinking ? 'animate-pulse' : ''}`}>
            <span>{status.icon}</span>
            <span>{status.text}</span>
          </div>
        </div>
        <div className="flex items-center space-x-1 mt-1">
          <div className="w-6 h-8 bg-gray-700 rounded border-2 border-gray-500 flex items-center justify-center font-bold text-lg">
            {isDealing ? (dealingCards?.length || 0) + (faceUpDealingCard ? 1 : 0) : player.hand.length}
          </div>
          {!isBottomPlayer && (
            <>
              {/* Show visual dealing cards */}
              {isDealing ? (
                <>
                  {/* Show face-down cards being dealt */}
                  {dealingCards?.map((card, index) => (
                    <CardComponent 
                      key={`dealing-${card.rank}-${card.suit}-${index}`} 
                      card={card} 
                      faceDown={true}
                      small={true}
                      isPlayable={false}
                    />
                  ))}
                  {/* Show face-up card if it's been dealt */}
                  {faceUpDealingCard && (
                    <CardComponent 
                      key={`faceup-${faceUpDealingCard.rank}-${faceUpDealingCard.suit}`} 
                      card={faceUpDealingCard} 
                      small={true}
                      isPlayable={false}
                    />
                  )}
                </>
              ) : (
                /* Show normal face-up card when not dealing */
                gamePhase === GamePhase.DEALING && faceUpCard && (
                  <CardComponent card={faceUpCard} small={true} />
                )
              )}
            </>
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
