import React, { useState, useEffect } from 'react';
import { TrickPlay, Card, Player } from '../../types';
import CardComponent from './Card';

interface TrickAreaProps {
  currentTrick: TrickPlay[];
  players: Player[];
  roundWinnerId?: string;
  isGameplayPhase: boolean;
  isRoundOver?: boolean;
  currentPlayerId?: string;
}

const TrickArea: React.FC<TrickAreaProps> = ({ 
  currentTrick, 
  players, 
  roundWinnerId, 
  isGameplayPhase,
  isRoundOver = false,
  currentPlayerId
}) => {

  // Center of screen for stick area - responsive sizing
  const stickAreaCenter = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const isMobile = window.innerWidth < 640; // sm breakpoint
  const stickWidth = isMobile ? '300px' : '500px';
  const stickHeight = isMobile ? '150px' : '250px';

  // Determine which card is currently winning
  const getCurrentWinningCard = (): { playerId: string; cardIndex: number } | null => {
    if (currentTrick.length === 0) return null;
    
    let winningPlay = currentTrick[0];
    let winningCardIndex = 0;
    
    for (let i = 1; i < currentTrick.length; i++) {
      const currentPlay = currentTrick[i];
      if (currentPlay.cards.length > 0 && currentPlay.cards[0].value > winningPlay.cards[winningCardIndex].value) {
        winningPlay = currentPlay;
        winningCardIndex = 0;
      }
    }
    
    return { playerId: winningPlay.playerId, cardIndex: winningCardIndex };
  };


  // Don't render if not in gameplay phase and no round over
  if (!isGameplayPhase && !isRoundOver) {
    return null;
  }

  const winningCardInfo = getCurrentWinningCard();

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {/* Stick Area Background */}
      <div 
        className="absolute bg-yellow-500/30 border-2 sm:border-4 border-yellow-300 rounded-xl sm:rounded-2xl shadow-2xl"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: stickWidth,
          height: stickHeight,
          zIndex: 30
        }}
      >
        <div className="absolute -top-6 sm:-top-8 left-1/2 transform -translate-x-1/2">
          <div className="bg-black/80 text-white px-2 py-1 sm:px-3 sm:py-1 rounded-lg text-xs sm:text-sm font-bold">
            {roundWinnerId ? 
              `${players.find(p => p.id === roundWinnerId)?.name} leads` : 
              'Stick Area'
            }
          </div>
        </div>
      </div>

      {/* Played Cards in Stick Area */}
      <div 
        className="absolute"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: stickWidth,
          height: stickHeight,
          zIndex: 40
        }}
      >
        {currentTrick.map((play, playIndex) => {
          const player = players.find(p => p.id === play.playerId);
          if (!player) return null;

          // Calculate base position for this player's cards - responsive
          const centerX = isMobile ? 150 : 250;
          const centerY = isMobile ? 75 : 125;
          const spacing = isMobile ? 60 : 100;
          const baseX = centerX + (playIndex - (currentTrick.length - 1) / 2) * spacing - 30;
          const baseY = centerY - 45;

          return (
            <div key={play.playerId} className="absolute">
              {/* Player name label */}
              <div 
                className="absolute text-xs font-bold text-white bg-black/70 px-1 py-0.5 sm:px-2 sm:py-1 rounded shadow-lg"
                style={{
                  left: baseX - 10,
                  top: baseY - 20,
                  zIndex: 45
                }}
              >
                {isMobile ? player.name.split(' ')[0] : player.name}
              </div>
              
              {/* Cards for this player */}
              {play.cards.map((card, cardIndex) => {
                const isWinningCard = winningCardInfo && 
                  winningCardInfo.playerId === play.playerId && 
                  winningCardInfo.cardIndex === cardIndex;

                // Better spacing for multiple cards - responsive
                const cardSpacing = isMobile ? 10 : 15;
                const cardX = baseX + (cardIndex * cardSpacing); // Horizontal spread
                const cardY = baseY + (cardIndex * (isMobile ? 5 : 8));  // Slight vertical offset

                return (
                  <div
                    key={`${play.playerId}-${card.rank}-${card.suit}-${cardIndex}`}
                    className="absolute"
                    style={{
                      left: cardX,
                      top: cardY,
                      zIndex: 40 + cardIndex,
                      transform: isWinningCard ? 'scale(1.1)' : 'scale(1)',
                      filter: isWinningCard ? 'drop-shadow(0 0 15px rgba(255,215,0,0.8))' : 'none'
                    }}
                  >
                    <CardComponent card={card} />
                    {isWinningCard && (
                      <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-yellow-500 text-black text-xs font-bold px-1 py-0.5 rounded-full shadow-lg">
                        🏆
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Turn Status Indicators */}
      {currentPlayerId && (
        <div className="absolute inset-0 pointer-events-none">
          {players.map((player) => {
            const isCurrentPlayer = player.id === currentPlayerId;
            if (!isCurrentPlayer) return null;

            // Use the same positioning logic as GameBoard
            const humanIndex = players.findIndex(p => p.isHuman);
            const playerIndex = players.findIndex(p => p.id === player.id);
            
            let positionClass = '';
            let positionStyle: React.CSSProperties = {};
            
            if (players.length === 3) {
              // 3-player case: Human at bottom, others at left and right
              if (player.isHuman) {
                positionClass = 'bottom-32';
                positionStyle = { left: '50%', transform: 'translateX(-50%)' };
              } else {
                // Find which bot this is relative to human
                const botOffset = (playerIndex - humanIndex + players.length) % players.length;
                if (botOffset === 1) {
                  // Bot to the right of human
                  positionClass = 'right-4';
                  positionStyle = { top: '50%', right: '20px', transform: 'translateY(-50%)' };
                } else {
                  // Bot to the left of human
                  positionClass = 'left-4';
                  positionStyle = { top: '50%', left: '20px', transform: 'translateY(-50%)' };
                }
              }
            } else {
              // 4-player case: Human at bottom, others at top, left, right
              if (player.isHuman) {
                positionClass = 'bottom-32';
                positionStyle = { left: '50%', transform: 'translateX(-50%)' };
              } else {
                const botOffset = (playerIndex - humanIndex + players.length) % players.length;
                if (botOffset === 1) {
                  positionClass = 'right-4';
                  positionStyle = { top: '50%', right: '20px', transform: 'translateY(-50%)' };
                } else if (botOffset === 2) {
                  positionClass = 'top-4';
                  positionStyle = { left: '50%', transform: 'translateX(-50%)' };
                } else {
                  positionClass = 'left-4';
                  positionStyle = { top: '50%', left: '20px', transform: 'translateY(-50%)' };
                }
              }
            }

            return (
              <div
                key={player.id}
                className={`absolute ${positionClass} z-50`}
                style={positionStyle}
              >
                <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-4 py-2 rounded-full shadow-lg border-2 border-yellow-300 font-bold text-sm animate-pulse">
                  {player.isHuman ? 'Your Turn' : `${player.name}'s Turn`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TrickArea;