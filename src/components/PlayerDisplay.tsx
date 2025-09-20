
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
  lastPlayedCardsCount?: number;
}

const PlayerDisplay: React.FC<PlayerDisplayProps> = ({ player, isCurrentPlayer, isStarter, isThinking, positionClass, positionStyle, faceUpCard, gamePhase, swappingCards, isDealing, dealingCards, faceUpDealingCard, lastPlayedCardsCount = 0 }) => {
  const isBottomPlayer = positionClass.includes('bottom');
  const isTopPlayer = positionClass.includes('top');
  const isHumanPlayer = player.isHuman;
  const useLandscapeLayout = isHumanPlayer || isTopPlayer;
  
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
    <div className={`${positionClass ? 'absolute transform transition-all duration-500 z-10' : 'relative'}`} style={positionStyle}>
      {/* Poker Seat Design */}
      <div 
        className={`relative bg-gradient-to-br from-amber-800 to-amber-900 rounded-xl sm:rounded-2xl p-2 sm:p-4 shadow-2xl border-2 sm:border-4 transition-all duration-300 ${ringClass} ${useLandscapeLayout ? 'min-w-[300px] sm:min-w-[400px]' : 'min-w-[120px] sm:min-w-[200px]'}`}
        style={{
          background: 'linear-gradient(to bottom right, #92400e, #78350f)', // Rich amber/brown gradient for all players
          backgroundColor: '#92400e', // Amber fallback
          minHeight: '80px', // Ensure minimum height
          minWidth: useLandscapeLayout ? '300px' : '120px', // Ensure minimum width
          zIndex: 5 // Ensure it's visible
        }}
      >
        
        {/* Player Avatar and Info Layout */}
        <div className={`${useLandscapeLayout ? 'flex items-center space-x-3 sm:space-x-6' : 'flex flex-col items-center space-y-1 sm:space-y-3'}`}>
          <div className={`relative w-10 h-10 sm:w-16 sm:h-16 rounded-full border-2 sm:border-4 transition-all duration-300 ${
            isCurrentPlayer ? 'border-cyan-400 shadow-cyan-400/50 shadow-lg' : 'border-amber-400'
          } ${useLandscapeLayout ? 'flex-shrink-0' : ''}`}>
            <img src={player.avatar} alt={player.name} className="w-full h-full rounded-full object-cover" />
            {player.isDealer && (
              <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-yellow-500 text-black text-xs font-bold px-1 py-0.5 sm:px-2 sm:py-1 rounded-full shadow-md text-xs">DEALER</div>
            )}
            {/* Status Ring */}
            {isThinking && (
              <div className="absolute -inset-1 rounded-full border-2 border-blue-400 animate-pulse"></div>
            )}
            {isStarter && (
              <div className="absolute -inset-1 rounded-full border-2 border-yellow-400"></div>
            )}
          </div>
          
          {/* Player Name and Score */}
          <div className={`${useLandscapeLayout ? 'flex-grow text-left' : 'text-center'}`}>
            <p className="text-white font-bold text-sm sm:text-lg">{player.name}</p>
            <p className="text-amber-200 text-xs sm:text-sm font-semibold">Score: {player.score}</p>
            
            {/* Status Badge for Landscape Layout Players */}
            {useLandscapeLayout && (
              <div className={`mt-1 inline-flex px-3 py-2 sm:px-4 sm:py-2 rounded-full text-sm font-bold items-center space-x-2 ${status.color} text-white shadow-lg ${isThinking ? 'animate-pulse' : ''}`} style={{ fontSize: '0.9rem' }}>
                <span className="text-sm">{status.icon}</span>
                <span>{status.text}</span>
              </div>
            )}
          </div>
          
          {/* Status Badge for Portrait Layout Bot Players */}
          {!useLandscapeLayout && (
            <div className={`px-3 py-2 sm:px-4 sm:py-2 rounded-full text-sm font-bold flex items-center space-x-2 ${status.color} text-white shadow-lg ${isThinking ? 'animate-pulse' : ''}`} style={{ fontSize: '0.9rem' }}>
              <span className="text-sm">{status.icon}</span>
              <span className="hidden sm:inline">{status.text}</span>
              <span className="sm:hidden">{status.text.split(' ')[0]}</span>
            </div>
          )}
        </div>
        
        {/* No dealing cards shown inside player boxes - they're now displayed outside */}
        
        {/* Show swapping cards with animation */}
        {swappingCards && swappingCards.length > 0 && (
          <div className="absolute -top-16 sm:-top-20 left-1/2 transform -translate-x-1/2 bg-yellow-500/90 p-1 sm:p-2 rounded-lg shadow-lg z-20">
            <p className="text-xs font-bold text-black mb-1 hidden sm:block">Swapping:</p>
            <div className="flex space-x-0.5 sm:space-x-1">
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
