import React, { useState, useEffect } from 'react';
import { TrickPlay, Card, Player } from '../../types';
import CardComponent from './Card';
import Stick from './Stick';

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
  animationProgress: number;
  isWinningCard?: boolean;
}

interface WinningStackAnimation {
  cards: Card[];
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
  isAnimating: boolean;
  winnerName: string;
}

interface StickAnimation {
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
  isAnimating: boolean;
  winnerName: string;
}

interface WinnerAnnouncement {
  winnerName: string;
  isVisible: boolean;
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
  const [stickAnimation, setStickAnimation] = useState<StickAnimation | null>(null);
  const [stickPosition, setStickPosition] = useState<{ x: number; y: number } | null>(null);
  const [winnerAnnouncement, setWinnerAnnouncement] = useState<WinnerAnnouncement | null>(null);

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

  // Determine winning card in current trick
  const getWinningCard = (trick: TrickPlay[]): { playerId: string; cardIndex: number } | null => {
    if (trick.length === 0) return null;
    
    const leadHand = trick[0].cards;
    let winningPlay = trick[0];
    let winningCardIndex = 0;
    
    for (let i = 1; i < trick.length; i++) {
      const currentPlay = trick[i];
      if (currentPlay.cards.length >= leadHand.length) {
        const currentCard = currentPlay.cards[0];
        const winningCard = winningPlay.cards[winningCardIndex];
        
        // Simple comparison - in real game this would use proper card ranking
        if (currentCard.value > winningCard.value) {
          winningPlay = currentPlay;
          winningCardIndex = 0;
        }
      }
    }
    
    return { playerId: winningPlay.playerId, cardIndex: winningCardIndex };
  };

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

    // Determine if this is a winning card
    const winningCardInfo = getWinningCard(currentTrick);
    const isWinningCard = winningCardInfo && 
      winningCardInfo.playerId === latestPlay.playerId && 
      winningCardInfo.cardIndex === 0;

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
      isAnimating: true,
      animationProgress: 0,
      isWinningCard: isWinningCard && index === 0
    }));

    setAnimatedCards(prev => [...prev, ...newAnimatedCards]);

    // Start tossing animation with arc motion
    const animateCard = (cardId: string, duration: number = 1200) => {
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth arc motion
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        
        setAnimatedCards(prev => 
          prev.map(card => 
            card.id === cardId 
              ? { ...card, animationProgress: easeOutCubic }
              : card
          )
        );
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Animation complete - keep cards in their final positions
          setAnimatedCards(prev => 
            prev.map(card => 
              card.id === cardId 
                ? { ...card, isAnimating: false, animationProgress: 1 }
                : card
            )
          );
          
          // Don't move to trickStacks - keep animated cards in place
          // This prevents the visual effect of multiple cards
        }
      };
      
      requestAnimationFrame(animate);
    };

    // Start animation for each card with slight delay
    newAnimatedCards.forEach((card, index) => {
      setTimeout(() => animateCard(card.id), index * 100);
    });
  }, [currentTrick]);

  // Handle round over - animate winning stack and stick to winner
  useEffect(() => {
    if (isRoundOver && roundWinnerId && currentTrick.length > 0) {
      const winner = players.find(p => p.id === roundWinnerId);
      if (!winner) return;

      // Collect all cards from the trick
      const allTrickCards: Card[] = [];
      currentTrick.forEach(play => {
        allTrickCards.push(...play.cards);
      });

      // Show winner announcement immediately
      setWinnerAnnouncement({
        winnerName: winner.name,
        isVisible: true
      });

      // Start winning stack animation
      setWinningStackAnimation({
        cards: allTrickCards,
        fromPosition: trickAreaPosition,
        toPosition: getPlayerPosition(roundWinnerId),
        isAnimating: true,
        winnerName: winner.name
      });

      // Start stick animation after a short delay
      setTimeout(() => {
        setStickAnimation({
          fromPosition: stickPosition || trickAreaPosition,
          toPosition: getPlayerPosition(roundWinnerId),
          isAnimating: true,
          winnerName: winner.name
        });
      }, 500);

      // Clear trick stacks and animate to winner
      setTimeout(() => {
        setWinningStackAnimation(prev => prev ? { ...prev, isAnimating: false } : null);
        
        // Clear everything after animation completes
        setTimeout(() => {
          setTrickStacks({});
          setWinningStackAnimation(null);
        }, 1000);
      }, 1000);

      // Complete stick animation
      setTimeout(() => {
        setStickAnimation(prev => prev ? { ...prev, isAnimating: false } : null);
        setStickPosition(getPlayerPosition(roundWinnerId));
      }, 1500);

      // Hide winner announcement after animations complete
      setTimeout(() => {
        setWinnerAnnouncement(null);
      }, 3000);
    }
  }, [isRoundOver, roundWinnerId, currentTrick, players]);

  // Clear trick when game phase changes (but not during ROUND_OVER)
  useEffect(() => {
    if (!isGameplayPhase && !isRoundOver) {
      setTrickStacks({});
      setAnimatedCards([]);
    }
  }, [isGameplayPhase, isRoundOver]);

  // Initialize stick position at game start
  useEffect(() => {
    if (isGameplayPhase && !stickPosition && !stickAnimation) {
      // Start stick at the first player's position
      const firstPlayer = players[0];
      if (firstPlayer) {
        setStickPosition(getPlayerPosition(firstPlayer.id));
      }
    }
  }, [isGameplayPhase, players, stickPosition, stickAnimation]);

  if ((!isGameplayPhase && !isRoundOver) || (currentTrick.length === 0 && animatedCards.length === 0 && !winningStackAnimation && !stickPosition && !stickAnimation && !isRoundOver)) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {/* Winner Announcement */}
      {winnerAnnouncement && (
        <div className="absolute inset-0 flex items-center justify-center z-80">
          <div className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 text-black px-8 py-4 rounded-2xl text-3xl font-bold shadow-2xl border-4 border-yellow-300 animate-bounce">
            🏆 {winnerAnnouncement.winnerName} WINS THE STICK! 🏆
          </div>
        </div>
      )}

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

      {/* Animated Cards with Arc Motion */}
      {animatedCards.map(animatedCard => {
        // Calculate arc motion position
        const progress = animatedCard.animationProgress;
        const fromPos = animatedCard.fromPosition;
        const toPos = animatedCard.toPosition;
        
        // Create arc motion with peak height
        const midX = (fromPos.x + toPos.x) / 2;
        const midY = Math.min(fromPos.y, toPos.y) - 100; // Arc peak
        const arcHeight = Math.abs(fromPos.y - toPos.y) + 100;
        
        // Quadratic bezier curve for arc motion
        const x = Math.pow(1 - progress, 2) * fromPos.x + 
                  2 * (1 - progress) * progress * midX + 
                  Math.pow(progress, 2) * toPos.x;
        const y = Math.pow(1 - progress, 2) * fromPos.y + 
                  2 * (1 - progress) * progress * midY + 
                  Math.pow(progress, 2) * toPos.y;
        
        // Rotation based on progress
        const rotation = animatedCard.isAnimating ? 
          (progress * 360) + (Math.sin(progress * Math.PI) * 20) : 0;
        
        // Scale and glow effects
        const scale = animatedCard.isAnimating ? 
          0.8 + (progress * 0.2) : 1;
        const glow = animatedCard.isWinningCard ? 
          'drop-shadow(0 0 15px rgba(255,215,0,0.8))' : 
          animatedCard.isAnimating ? 
          'drop-shadow(0 0 10px rgba(255,255,255,0.5))' : 'none';

        return (
          <div
            key={animatedCard.id}
            className="absolute"
            style={{
              left: x - 30,
              top: y - 45,
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              zIndex: animatedCard.isAnimating ? 50 : 40,
              filter: glow,
              transition: animatedCard.isAnimating ? 'none' : 'all 0.3s ease-out'
            }}
          >
            <CardComponent card={animatedCard.card} />
            {animatedCard.isAnimating && (
              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
                <div className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${
                  animatedCard.isWinningCard ? 
                    'bg-gradient-to-r from-yellow-500 to-orange-500 text-black' : 
                    'bg-black/80 text-white'
                }`}>
                  {animatedCard.playerName}
                  {animatedCard.isWinningCard && ' 🏆'}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Static Trick Stacks - All played cards stacked by player */}
      {Object.entries(trickStacks).map(([playerId, cards]) => {
        const player = players.find(p => p.id === playerId);
        if (!player || cards.length === 0) return null;

        // Skip showing static stacks if we have animated cards for this player
        const hasAnimatedCards = animatedCards.some(card => card.playerId === playerId);
        if (hasAnimatedCards) return null;

        // Calculate stack position based on player order
        const playerIndex = players.findIndex(p => p.id === playerId);
        const stackOffset = (playerIndex - players.length / 2) * 80; // Spread stacks horizontally
        
        // Check if this player has the winning card
        const winningCardInfo = getWinningCard(currentTrick);
        const hasWinningCard = winningCardInfo && winningCardInfo.playerId === playerId;

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
              {cards.map((card, index) => {
                const isWinningCard = hasWinningCard && index === 0;
                return (
                  <div
                    key={`${card.rank}-${card.suit}-${index}`}
                    className="absolute transition-all duration-300"
                    style={{
                      left: (index - (cards.length - 1) / 2) * 25,
                      top: index * 3, // Stack cards vertically
                      zIndex: 40 + index,
                      transform: isWinningCard ? 'scale(1.1) translateY(-5px)' : 'scale(1)',
                      filter: isWinningCard ? 'drop-shadow(0 0 15px rgba(255,215,0,0.8))' : 'none'
                    }}
                  >
                    <CardComponent card={card} />
                    {isWinningCard && (
                      <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-bold px-1 py-0.5 rounded-full shadow-lg">
                        🏆
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Player name label */}
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                <div className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${
                  hasWinningCard ? 
                    'bg-gradient-to-r from-yellow-500 to-orange-500 text-black' : 
                    'bg-black/80 text-white'
                }`}>
                  {player.name}
                  {hasWinningCard && ' 🏆'}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Winning Stack Animation */}
      {winningStackAnimation && (
        <div
          className="absolute transition-all duration-1500 ease-in-out"
          style={{
            left: winningStackAnimation.isAnimating ? 
              winningStackAnimation.fromPosition.x - 30 : 
              winningStackAnimation.toPosition.x - 30,
            top: winningStackAnimation.isAnimating ? 
              winningStackAnimation.fromPosition.y - 45 : 
              winningStackAnimation.toPosition.y - 45,
            transform: winningStackAnimation.isAnimating ? 
              'scale(1.2) rotate(0deg)' : 
              'scale(1) rotate(0deg)',
            zIndex: 60,
            filter: winningStackAnimation.isAnimating ? 
              'drop-shadow(0 0 25px rgba(255,215,0,1))' : 
              'drop-shadow(0 0 15px rgba(255,215,0,0.8))'
          }}
        >
          <div className="relative">
            {winningStackAnimation.cards.map((card, index) => (
              <div
                key={`winning-${card.rank}-${card.suit}-${index}`}
                className="absolute transition-all duration-300"
                style={{
                  left: (index - (winningStackAnimation.cards.length - 1) / 2) * 25,
                  top: index * 3,
                  zIndex: 65 + index,
                  transform: winningStackAnimation.isAnimating ? 'scale(1.1)' : 'scale(1)',
                  filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.8))'
                }}
              >
                <CardComponent card={card} />
              </div>
            ))}
            {/* Enhanced Winner label */}
            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
              <div className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 text-black px-4 py-2 rounded-xl text-lg font-bold whitespace-nowrap shadow-2xl border-2 border-yellow-300 animate-pulse">
                🏆 {winningStackAnimation.winnerName} WINS THE STICK! 🏆
              </div>
            </div>
            {/* Victory particles effect */}
            {winningStackAnimation.isAnimating && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
                <div className="absolute top-2 left-1/4 w-1 h-1 bg-yellow-300 rounded-full animate-ping" style={{animationDelay: '0.2s'}}></div>
                <div className="absolute top-2 right-1/4 w-1 h-1 bg-yellow-300 rounded-full animate-ping" style={{animationDelay: '0.4s'}}></div>
                <div className="absolute bottom-0 left-1/3 w-1.5 h-1.5 bg-orange-400 rounded-full animate-ping" style={{animationDelay: '0.6s'}}></div>
                <div className="absolute bottom-0 right-1/3 w-1.5 h-1.5 bg-orange-400 rounded-full animate-ping" style={{animationDelay: '0.8s'}}></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stick Animation */}
      {stickAnimation && (
        <div className="relative">
          <Stick
            position={{
              x: stickAnimation.isAnimating ? stickAnimation.fromPosition.x : stickAnimation.toPosition.x,
              y: stickAnimation.isAnimating ? stickAnimation.fromPosition.y : stickAnimation.toPosition.y
            }}
            isAnimating={stickAnimation.isAnimating}
          />
          {/* Stick movement trail effect */}
          {stickAnimation.isAnimating && (
            <div className="absolute pointer-events-none">
              <div 
                className="w-1 h-1 bg-yellow-400 rounded-full animate-ping"
                style={{
                  left: stickAnimation.fromPosition.x - 2,
                  top: stickAnimation.fromPosition.y - 2,
                  animationDelay: '0s'
                }}
              ></div>
              <div 
                className="w-1 h-1 bg-yellow-300 rounded-full animate-ping"
                style={{
                  left: stickAnimation.fromPosition.x + 10,
                  top: stickAnimation.fromPosition.y + 5,
                  animationDelay: '0.3s'
                }}
              ></div>
              <div 
                className="w-1 h-1 bg-orange-400 rounded-full animate-ping"
                style={{
                  left: stickAnimation.fromPosition.x - 5,
                  top: stickAnimation.fromPosition.y + 10,
                  animationDelay: '0.6s'
                }}
              ></div>
            </div>
          )}
        </div>
      )}

      {/* Static Stick Position */}
      {stickPosition && !stickAnimation && (
        <Stick position={stickPosition} />
      )}
    </div>
  );
};

export default TrickArea;

