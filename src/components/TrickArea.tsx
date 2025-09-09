import React, { useState, useEffect } from 'react';
import { TrickPlay, Card, Player } from '../../types';
import CardComponent from './Card';

interface TrickAreaProps {
  currentTrick: TrickPlay[];
  players: Player[];
  roundWinnerId?: string;
  isGameplayPhase: boolean;
  isRoundOver?: boolean;
}

interface AnimatedCard {
  id: string;
  card: Card;
  playerId: string;
  playerName: string;
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
  isAnimating: boolean;
}

interface WinningStackAnimation {
  cards: Card[];
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
  isAnimating: boolean;
  winnerName: string;
}

const TrickArea: React.FC<TrickAreaProps> = ({ 
  currentTrick, 
  players, 
  roundWinnerId, 
  isGameplayPhase,
  isRoundOver = false
}) => {
  const [animatedCards, setAnimatedCards] = useState<AnimatedCard[]>([]);
  const [trickStacks, setTrickStacks] = useState<{ [playerId: string]: Card[] }>({});
  const [winningStackAnimation, setWinningStackAnimation] = useState<WinningStackAnimation | null>(null);

  // Calculate player positions for animation origins
  const getPlayerPosition = (playerId: string): { x: number; y: number } => {
    const player = players.find(p => p.id === playerId);
    if (!player) return { x: 0, y: 0 };

    const humanIndex = players.findIndex(p => p.isHuman);
    const playerIndex = players.findIndex(p => p.id === playerId);
    
    if (player.isHuman) {
      // Human player at bottom center
      return { x: window.innerWidth / 2, y: window.innerHeight - 150 };
    }

    // Bot positions based on player count and human position
    const positions = [
      { x: window.innerWidth / 2, y: 100 }, // Top
      { x: window.innerWidth - 150, y: window.innerHeight / 2 }, // Right
      { x: 150, y: window.innerHeight / 2 }, // Left
    ];

    if (players.length === 3) {
      if (humanIndex === 0) {
        // Human at bottom, bots at left and right
        return playerIndex === 1 ? positions[2] : positions[1];
      } else if (humanIndex === 1) {
        // Human in middle, bots at top and right
        return playerIndex === 0 ? positions[0] : positions[1];
      } else {
        // Human at top, bots at left and right
        return playerIndex === 0 ? positions[2] : positions[1];
      }
    } else {
      // 4 players - human at bottom, others at top, left, right
      if (humanIndex === 0) {
        return playerIndex === 1 ? positions[2] : playerIndex === 2 ? positions[0] : positions[1];
      } else if (humanIndex === 1) {
        return playerIndex === 0 ? positions[2] : playerIndex === 2 ? positions[0] : positions[1];
      } else if (humanIndex === 2) {
        return playerIndex === 0 ? positions[2] : playerIndex === 1 ? positions[0] : positions[1];
      } else {
        return playerIndex === 0 ? positions[2] : playerIndex === 1 ? positions[0] : positions[1];
      }
    }
  };

  // Trick area position (center of screen)
  const trickAreaPosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  // Handle new trick plays
  useEffect(() => {
    if (currentTrick.length === 0) {
      setTrickStacks({});
      setAnimatedCards([]);
      setWinningStackAnimation(null);
      return;
    }

    const latestPlay = currentTrick[currentTrick.length - 1];
    const player = players.find(p => p.id === latestPlay.playerId);
    if (!player) return;

    // Create animated cards for the latest play
    const newAnimatedCards: AnimatedCard[] = latestPlay.cards.map((card, index) => ({
      id: `${latestPlay.playerId}-${card.rank}-${card.suit}-${Date.now()}-${index}`,
      card,
      playerId: latestPlay.playerId,
      playerName: player.name,
      fromPosition: getPlayerPosition(latestPlay.playerId),
      toPosition: {
        x: trickAreaPosition.x + (index - (latestPlay.cards.length - 1) / 2) * 30,
        y: trickAreaPosition.y + (index - (latestPlay.cards.length - 1) / 2) * 5
      },
      isAnimating: true
    }));

    setAnimatedCards(prev => [...prev, ...newAnimatedCards]);

    // Start animation
    setTimeout(() => {
      setAnimatedCards(prev => 
        prev.map(card => ({ ...card, isAnimating: false }))
      );

      // Update trick stacks after animation
      setTimeout(() => {
        setTrickStacks(prev => ({
          ...prev,
          [latestPlay.playerId]: latestPlay.cards
        }));

        // Remove animated cards after they reach destination
        setTimeout(() => {
          setAnimatedCards(prev => 
            prev.filter(card => !newAnimatedCards.some(newCard => newCard.id === card.id))
          );
        }, 500);
      }, 800);
    }, 100);
  }, [currentTrick]);

  // Handle round over - animate winning stack to winner
  useEffect(() => {
    if (isRoundOver && roundWinnerId && currentTrick.length > 0) {
      const winner = players.find(p => p.id === roundWinnerId);
      if (!winner) return;

      // Collect all cards from the trick
      const allTrickCards: Card[] = [];
      currentTrick.forEach(play => {
        allTrickCards.push(...play.cards);
      });

      // Start winning stack animation
      setWinningStackAnimation({
        cards: allTrickCards,
        fromPosition: trickAreaPosition,
        toPosition: getPlayerPosition(roundWinnerId),
        isAnimating: true,
        winnerName: winner.name
      });

      // Clear trick stacks and animate to winner
      setTimeout(() => {
        setWinningStackAnimation(prev => prev ? { ...prev, isAnimating: false } : null);
        
        // Clear everything after animation completes
        setTimeout(() => {
          setTrickStacks({});
          setWinningStackAnimation(null);
        }, 1000);
      }, 1000);
    }
  }, [isRoundOver, roundWinnerId, currentTrick, players]);

  // Clear trick when round is over
  useEffect(() => {
    if (!isGameplayPhase) {
      setTrickStacks({});
      setAnimatedCards([]);
    }
  }, [isGameplayPhase]);

  if (!isGameplayPhase || (currentTrick.length === 0 && animatedCards.length === 0 && !winningStackAnimation)) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {/* Trick Area Background */}
      <div 
        className="absolute bg-yellow-500/20 border-4 border-yellow-300 rounded-2xl shadow-2xl"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '300px',
          height: '150px',
          minHeight: '150px'
        }}
      >
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
          <div className="bg-black/80 text-white px-3 py-1 rounded-lg text-sm font-bold">
            {roundWinnerId ? 
              `${players.find(p => p.id === roundWinnerId)?.name} leads` : 
              'Trick Area'
            }
          </div>
        </div>
      </div>

      {/* Animated Cards */}
      {animatedCards.map(animatedCard => (
        <div
          key={animatedCard.id}
          className="absolute transition-all duration-800 ease-out"
          style={{
            left: animatedCard.isAnimating ? animatedCard.fromPosition.x - 30 : animatedCard.toPosition.x - 30,
            top: animatedCard.isAnimating ? animatedCard.fromPosition.y - 45 : animatedCard.toPosition.y - 45,
            transform: animatedCard.isAnimating ? 
              'scale(0.8) rotate(-10deg)' : 
              'scale(1) rotate(0deg)',
            zIndex: animatedCard.isAnimating ? 50 : 40,
            filter: animatedCard.isAnimating ? 'drop-shadow(0 0 10px rgba(255,255,255,0.5))' : 'none'
          }}
        >
          <CardComponent card={animatedCard.card} />
          {animatedCard.isAnimating && (
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
              <div className="bg-black/80 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                {animatedCard.playerName}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Static Trick Stacks - All played cards stacked by player */}
      {Object.entries(trickStacks).map(([playerId, cards]) => {
        const player = players.find(p => p.id === playerId);
        if (!player || cards.length === 0) return null;

        // Calculate stack position based on player order
        const playerIndex = players.findIndex(p => p.id === playerId);
        const stackOffset = (playerIndex - players.length / 2) * 80; // Spread stacks horizontally

        return (
          <div
            key={playerId}
            className="absolute"
            style={{
              left: trickAreaPosition.x + stackOffset - 30,
              top: trickAreaPosition.y - 45,
              zIndex: 35
            }}
          >
            <div className="relative">
              {cards.map((card, index) => (
                <div
                  key={`${card.rank}-${card.suit}-${index}`}
                  className="absolute transition-all duration-300"
                  style={{
                    left: (index - (cards.length - 1) / 2) * 25,
                    top: index * 3, // Stack cards vertically
                    zIndex: 40 + index
                  }}
                >
                  <CardComponent card={card} />
                </div>
              ))}
              {/* Player name label */}
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                <div className="bg-black/80 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                  {player.name}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Winning Stack Animation */}
      {winningStackAnimation && (
        <div
          className="absolute transition-all duration-1000 ease-in-out"
          style={{
            left: winningStackAnimation.isAnimating ? 
              winningStackAnimation.fromPosition.x - 30 : 
              winningStackAnimation.toPosition.x - 30,
            top: winningStackAnimation.isAnimating ? 
              winningStackAnimation.fromPosition.y - 45 : 
              winningStackAnimation.toPosition.y - 45,
            transform: winningStackAnimation.isAnimating ? 
              'scale(1) rotate(0deg)' : 
              'scale(0.8) rotate(5deg)',
            zIndex: 60,
            filter: winningStackAnimation.isAnimating ? 
              'drop-shadow(0 0 15px rgba(255,215,0,0.8))' : 
              'drop-shadow(0 0 10px rgba(255,215,0,0.5))'
          }}
        >
          <div className="relative">
            {winningStackAnimation.cards.map((card, index) => (
              <div
                key={`winning-${card.rank}-${card.suit}-${index}`}
                className="absolute"
                style={{
                  left: (index - (winningStackAnimation.cards.length - 1) / 2) * 25,
                  top: index * 3,
                  zIndex: 65 + index
                }}
              >
                <CardComponent card={card} />
              </div>
            ))}
            {/* Winner label */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-3 py-1 rounded-lg text-sm font-bold whitespace-nowrap shadow-lg">
                🏆 {winningStackAnimation.winnerName} wins!
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrickArea;
