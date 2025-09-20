import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, Card, GameState, GamePhase, Rank, Suit, TrickPlay, SwappingCards } from '../../types';
import { generateCommentary } from '../services/commentaryService';
import PlayerDisplay from './PlayerDisplay';
import CardComponent from './Card';
import ActionPanel from './ActionPanel';
import GameOverModal from './GameOverModal';
import FloatingPlayButton from './FloatingPlayButton';
import DraggableCommentary from './DraggableCommentary';
import Stick from './Stick';

interface GameBoardProps {
  players: Player[];
  onQuit: () => void;
}

const CARD_VALUES: { [key in Rank]: number } = {
  [Rank.Two]: 2, [Rank.Three]: 3, [Rank.Four]: 4, [Rank.Five]: 5, [Rank.Six]: 6, [Rank.Seven]: 7,
  [Rank.Eight]: 8, [Rank.Nine]: 9, [Rank.Ten]: 10, [Rank.Jack]: 11, [Rank.Queen]: 12,
  [Rank.King]: 13, [Rank.Ace]: 14
};

const createDeck = (): Card[] => {
  const suits = Object.values(Suit);
  const ranks = Object.values(Rank);
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank, value: CARD_VALUES[rank] });
    }
  }
  return deck;
};

const shuffleDeck = <T,>(array: T[]): T[] => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

const GameBoard: React.FC<GameBoardProps> = ({ players: initialPlayers, onQuit }) => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const initialDealerIndex = Math.floor(Math.random() * initialPlayers.length);
    const playersWithHands = initialPlayers.map((p, index) => ({
      ...p,
      hand: [],
      playedCards: [],
      isDealer: index === initialDealerIndex,
      score: 0,
    }));

    return {
      players: playersWithHands,
      deck: [],
      gamePhase: GamePhase.DEALING,
      currentPlayerIndex: 0,
      commentary: ["Welcome to Gurch! Let's get started."],
      roundLeaderIndex: 0, // Will be set to firstPlayerToAct when game starts
      cardsOnTable: [],
      firstPlayerToAct: 0,
      swapAmount: 0,
      voteResult: 0,
      lastPlayedHand: [],
      currentTrick: [],
      minigamePlayers: [],
    };
  });
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [timer, setTimer] = useState<number>(0);
  const [swappingCards, setSwappingCards] = useState<SwappingCards | null>(null);
  const [swapInProgress, setSwapInProgress] = useState<boolean>(false);
  const [showGameplayStart, setShowGameplayStart] = useState<boolean>(false);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showFloatingPlayButton, setShowFloatingPlayButton] = useState<boolean>(false);
  const [buttonPosition, setButtonPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [lastPlayedCardsCount, setLastPlayedCardsCount] = useState<{ [playerId: string]: number }>({});
  const [stickPosition, setStickPosition] = useState<{ x: number; y: number }>({ 
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 400, 
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 300 
  });
  const [stickAnimating, setStickAnimating] = useState<boolean>(false);
  const [showCardClearAnimation, setShowCardClearAnimation] = useState<boolean>(false);
  const hasDealt = React.useRef(false);
  // Complex deduplication system removed - using simple state guards instead
  const lastCardClick = useRef<{card: string, timestamp: number} | null>(null);
  // Removed complex timestamp tracking
  
  // Fallback system to prevent stalls
  const [phaseStartTime, setPhaseStartTime] = useState<number>(Date.now());
  const [stallCount, setStallCount] = useState<number>(0);
  const maxStallTime = 30000; // 30 seconds max per phase
  const maxStallCount = 3; // Max 3 stalls before emergency fallback
  
  // Visual dealing system
  const [isDealing, setIsDealing] = useState<boolean>(false);
  const [dealingStep, setDealingStep] = useState<number>(0);
  const [dealingCards, setDealingCards] = useState<{ [playerId: string]: Card[] }>({});
  const [faceUpCards, setFaceUpCards] = useState<{ [playerId: string]: Card }>({});

  // Utility function to enforce 5-card limit
  const enforceFiveCardLimit = (players: Player[]): Player[] => {
    return players.map(player => {
      if (player.hand.length > 5) {
        console.log(`[DEBUG] ENFORCING 5-card limit: ${player.name} had ${player.hand.length} cards, reducing to 5`);
        return {
          ...player,
          hand: player.hand.slice(0, 5)
        };
      }
      return player;
    });
  };

  const addCommentary = useCallback(async (text: string) => {
    const dynamicComment = await generateCommentary(text);
    setGameState(prev => ({ ...prev, commentary: [dynamicComment, ...prev.commentary.slice(0, 4)] }));
  }, []);

  const nextTurn = useCallback(() => {
    setGameState(prev => {
        const nextIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
        return {...prev, currentPlayerIndex: nextIndex};
    });
  }, []);

  // Emergency fallback system to prevent infinite stalls
  const emergencyFallback = useCallback((reason: string) => {
    console.warn(`[EMERGENCY FALLBACK] ${reason}`);
    addCommentary(`Game auto-advanced due to: ${reason}`);
    
    setGameState(prev => {
      const newPlayers = [...prev.players];
      
      // Force all players to make decisions if they haven't
      newPlayers.forEach(player => {
        if (!player.hasMadeFirstSwapDecision) {
          player.hasMadeFirstSwapDecision = true;
          player.hasStoodPat = true;
        }
        if (player.wantsToVote === undefined) {
          player.wantsToVote = false;
        }
        if (player.hasMadeFinalSwapDecision === undefined) {
          player.hasMadeFinalSwapDecision = true;
          player.hasStoodPat = true;
        }
      });
      
      // Force transition to gameplay
      return {
        ...prev,
        players: newPlayers,
        gamePhase: GamePhase.GAMEPLAY,
        currentPlayerIndex: 0,
        swapAmount: 0,
        voteResult: 0
      };
    });
    
    setStallCount(0);
    setPhaseStartTime(Date.now());
  }, [addCommentary]);

  // Centralized phase transition manager with validation
  const transitionToPhase = useCallback((newPhase: GamePhase, options: {
    currentPlayerIndex?: number;
    swapAmount?: number;
    voteResult?: number;
    commentary?: string;
  } = {}) => {
    // Validate phase transition
    const validTransitions: { [key in GamePhase]?: GamePhase[] } = {
      [GamePhase.DEALING]: [GamePhase.FIRST_SWAP_DECISION],
      [GamePhase.FIRST_SWAP_DECISION]: [GamePhase.FIRST_SWAP_ACTION, GamePhase.FIRST_SWAP_OTHERS_DECISION, GamePhase.VOTE_SWAP_DECISION],
      [GamePhase.FIRST_SWAP_ACTION]: [GamePhase.FIRST_SWAP_OTHERS_DECISION],
      [GamePhase.FIRST_SWAP_OTHERS_DECISION]: [GamePhase.OTHERS_SWAP_DECISION, GamePhase.VOTE_SWAP_DECISION],
      [GamePhase.OTHERS_SWAP_DECISION]: [GamePhase.OTHERS_SWAP_ACTION, GamePhase.VOTE_SWAP_DECISION],
      [GamePhase.OTHERS_SWAP_ACTION]: [GamePhase.OTHERS_SWAP_DECISION, GamePhase.VOTE_SWAP_DECISION],
      [GamePhase.VOTE_SWAP_DECISION]: [GamePhase.VOTE_SWAP, GamePhase.FINAL_SWAP_DECISION, GamePhase.GAMEPLAY],
      [GamePhase.VOTE_SWAP]: [GamePhase.VOTE_SWAP_DECISION, GamePhase.FINAL_SWAP_DECISION, GamePhase.GAMEPLAY],
      [GamePhase.FINAL_SWAP_DECISION]: [GamePhase.FINAL_SWAP_ACTION, GamePhase.GAMEPLAY],
      [GamePhase.FINAL_SWAP_ACTION]: [GamePhase.FINAL_SWAP_ONE_CARD_SELECT, GamePhase.GAMEPLAY],
      [GamePhase.FINAL_SWAP_ONE_CARD_SELECT]: [GamePhase.FINAL_SWAP_ONE_CARD_REVEAL_AND_DECIDE],
      [GamePhase.FINAL_SWAP_ONE_CARD_REVEAL_AND_DECIDE]: [GamePhase.FINAL_SWAP_ACTION, GamePhase.GAMEPLAY],
      [GamePhase.GAMEPLAY]: [GamePhase.ROUND_OVER, GamePhase.GAME_OVER],
      [GamePhase.ROUND_OVER]: [GamePhase.GAMEPLAY, GamePhase.GAME_OVER],
      [GamePhase.MINIGAME]: [GamePhase.MINIGAME_SWAP, GamePhase.GAME_OVER],
      [GamePhase.MINIGAME_SWAP]: [GamePhase.MINIGAME, GamePhase.GAME_OVER],
    };

    const currentPhase = gameState.gamePhase;
    const validNextPhases = validTransitions[currentPhase] || [];
    
    if (!validNextPhases.includes(newPhase)) {
      console.warn(`Invalid phase transition: ${currentPhase} -> ${newPhase}. Valid transitions: ${validNextPhases.join(', ')}`);
      // Don't transition if invalid, but don't crash the game
      return;
    }

    setGameState(prev => {
      const updates: Partial<GameState> = { gamePhase: newPhase };
      
      if (options.currentPlayerIndex !== undefined) {
        updates.currentPlayerIndex = options.currentPlayerIndex;
      }
      if (options.swapAmount !== undefined) {
        updates.swapAmount = options.swapAmount;
      }
      if (options.voteResult !== undefined) {
        updates.voteResult = options.voteResult;
      }
      
      return { ...prev, ...updates };
    });

    if (options.commentary) {
      addCommentary(options.commentary);
    }
  }, [addCommentary, gameState.gamePhase]);

  // Helper function to find next player who hasn't made a decision
  const findNextPlayerForDecision = useCallback((players: Player[], currentIndex: number, decisionType: 'firstSwap' | 'othersSwap' | 'vote' | 'finalSwap') => {
    for (let i = 1; i < players.length; i++) {
      const potentialIndex = (currentIndex + i) % players.length;
      const player = players[potentialIndex];
      
      switch (decisionType) {
        case 'firstSwap':
          if (!player.hasMadeFirstSwapDecision) return potentialIndex;
          break;
        case 'othersSwap':
          if (!player.hasMadeFirstSwapDecision && !player.hasStoodPat) return potentialIndex;
          break;
        case 'vote':
          if (!player.hasStoodPat && player.wantsToVote === undefined) return potentialIndex;
          break;
        case 'finalSwap':
          if (!player.hasStoodPat && player.hasMadeFinalSwapDecision === undefined) return potentialIndex;
          break;
      }
    }
    return -1; // No more players need to make this decision
  }, []);

  // Process vote results and determine next phase
  const processVoteResults = useCallback(() => {
    setGameState(prev => {
      const playersVoting = prev.players.filter(p => !p.hasStoodPat && p.wantsToVote);
      
      if (playersVoting.length === 0) {
        addCommentary("No one wants to swap. Let the game begin!");
        return {
          ...prev,
          gamePhase: GamePhase.GAMEPLAY,
          currentPlayerIndex: prev.firstPlayerToAct,
          roundLeaderIndex: prev.firstPlayerToAct
        };
      }
      
      // Count votes
      const voteCounts: { [key: number]: number } = {};
      playersVoting.forEach(player => {
        if (player.swapVote) {
          voteCounts[player.swapVote] = (voteCounts[player.swapVote] || 0) + 1;
        }
      });
      
      // Find winning vote (majority, or lowest if tie)
      let winningVote = 1;
      let maxVotes = 0;
      for (const [vote, count] of Object.entries(voteCounts)) {
        if (count > maxVotes || (count === maxVotes && parseInt(vote) < winningVote)) {
          winningVote = parseInt(vote);
          maxVotes = count;
        }
      }
      
      const newPlayers = [...prev.players];
      const firstDeciderIndex = newPlayers.findIndex(p => !p.hasStoodPat && p.wantsToVote && p.swapVote !== winningVote);
      
      if (firstDeciderIndex === -1) {
        // All winners, proceed to action
        addCommentary(`The Council has spoken! A ${winningVote}-card swap is now in motion!`);
        return {
          ...prev,
          players: newPlayers,
          gamePhase: GamePhase.FINAL_SWAP_ACTION,
          voteResult: winningVote,
          currentPlayerIndex: 0
        };
      }
      
      return {
        ...prev,
        players: newPlayers,
        gamePhase: GamePhase.FINAL_SWAP_DECISION,
        voteResult: winningVote,
        currentPlayerIndex: firstDeciderIndex
      };
    });
  }, [addCommentary]);

  // Stall detection and timeout mechanism
  useEffect(() => {
    const checkForStall = () => {
      const timeInPhase = Date.now() - phaseStartTime;
      const isStalled = timeInPhase > maxStallTime;
      
      if (isStalled) {
        console.warn(`[STALL DETECTED] Phase ${gameState.gamePhase} has been running for ${timeInPhase}ms`);
        setStallCount(prev => prev + 1);
        
        if (stallCount >= maxStallCount) {
          emergencyFallback(`Phase ${gameState.gamePhase} stalled for too long`);
          return;
        }
        
        // Try to auto-advance the current phase
        autoAdvancePhase();
      }
    };
    
    const stallCheckInterval = setInterval(checkForStall, 5000); // Check every 5 seconds
    return () => clearInterval(stallCheckInterval);
  }, [gameState.gamePhase, phaseStartTime, stallCount, maxStallTime, maxStallCount, emergencyFallback]);

  // Auto-advance mechanism for stuck phases
  const autoAdvancePhase = useCallback(() => {
    console.log(`[AUTO-ADVANCE] Attempting to advance from phase ${gameState.gamePhase}`);
    
    setGameState(prev => {
      const newPlayers = [...prev.players];
      const currentPlayer = newPlayers[prev.currentPlayerIndex];
      
      // Force current player to make a decision
      switch (prev.gamePhase) {
        case GamePhase.FIRST_SWAP_DECISION:
        case GamePhase.FIRST_SWAP_OTHERS_DECISION:
          if (!currentPlayer.hasMadeFirstSwapDecision) {
            currentPlayer.hasMadeFirstSwapDecision = true;
            currentPlayer.hasStoodPat = true;
            addCommentary(`${currentPlayer.name} auto-decided to stand pat.`);
          }
          break;
        case GamePhase.VOTE_SWAP_DECISION:
          if (currentPlayer.wantsToVote === undefined && !currentPlayer.hasStoodPat) {
            currentPlayer.wantsToVote = false;  // Auto-decide not to vote
            addCommentary(`${currentPlayer.name} auto-decided to stay.`);
          }
          break;
        case GamePhase.FINAL_SWAP_DECISION:
          if (currentPlayer.hasMadeFinalSwapDecision === undefined) {
            currentPlayer.hasMadeFinalSwapDecision = true;
            currentPlayer.hasStoodPat = true;
            addCommentary(`${currentPlayer.name} auto-decided to stand pat.`);
          }
          break;
      }
      
      return { ...prev, players: newPlayers };
    });
    
    setPhaseStartTime(Date.now());
  }, [gameState.gamePhase, addCommentary]);

  // Reset phase start time when phase changes
  useEffect(() => {
    setPhaseStartTime(Date.now());
    setStallCount(0);
  }, [gameState.gamePhase]);

  // Simplified phase tracking - no complex decision clearing needed

  // Main Game Loop using useEffect
  useEffect(() => {
    // FIX: Use ReturnType<typeof setTimeout> for browser compatibility instead of NodeJS.Timeout
    let timeoutId: ReturnType<typeof setTimeout>;

    const gameLoop = async () => {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (!currentPlayer || gameState.thinkingPlayerId) return;

      console.log(`[DEBUG] GameLoop: phase=${gameState.gamePhase}, player=${currentPlayer.name}, isHuman=${currentPlayer.isHuman}`);

      switch (gameState.gamePhase) {
        case GamePhase.DEALING:
          if (!hasDealt.current) {
            hasDealt.current = true;
            dealCards();
          }
          break;
        case GamePhase.FIRST_SWAP_DECISION:
        case GamePhase.FIRST_SWAP_OTHERS_DECISION:
           if (currentPlayer.hasStoodPat) {
                // Find next player who hasn't made a decision
                const nextPlayerIndex = findNextPlayerForDecision(gameState.players, gameState.currentPlayerIndex, 'firstSwap');
                if (nextPlayerIndex !== -1) {
                setGameState(prev => ({...prev, currentPlayerIndex: nextPlayerIndex}));
                } else {
                    // All players have made their decision, move to vote phase
                    console.log(`[DEBUG] All players have made first swap decision, moving to vote phase`);
                    const firstVoterIndex = gameState.players.findIndex(p => !p.hasStoodPat);
                    setGameState(prev => ({
                        ...prev, 
                        gamePhase: GamePhase.VOTE_SWAP_DECISION, 
                        currentPlayerIndex: firstVoterIndex !== -1 ? firstVoterIndex : 0
                    }));
                }
            } else if (!currentPlayer.isHuman && !currentPlayer.hasMadeFirstSwapDecision) {
                setGameState(prev => ({...prev, thinkingPlayerId: currentPlayer.id }));
            } else if (currentPlayer.isHuman && !currentPlayer.hasMadeFirstSwapDecision) {
                // Human player needs to make a decision - wait for their input
                // But add a timeout fallback
                timeoutId = setTimeout(() => {
                    console.log(`[TIMEOUT] Human player ${currentPlayer.name} taking too long, auto-advancing`);
                    handleSwapDecision(false);
                }, 10000); // 10 second timeout for human decisions
            }
            return;
        case GamePhase.FIRST_SWAP_ACTION:
          // Human player is selecting cards to swap - no automatic action needed
          return; // Exit early to prevent further processing
        case GamePhase.OTHERS_SWAP_DECISION:
             if (currentPlayer.hasStoodPat) {
                const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
                setGameState(prev => ({...prev, currentPlayerIndex: nextPlayerIndex}));
            } else if (!currentPlayer.isHuman) {
                setGameState(prev => ({...prev, thinkingPlayerId: currentPlayer.id }));
             }
            return; // Exit early to prevent further processing
        case GamePhase.OTHERS_SWAP_ACTION:
            // Human player is selecting cards for the second swap - no automatic action needed
            return; // Exit early to prevent further processing
        case GamePhase.VOTE_SWAP_DECISION:
            console.log(`[DEBUG] VOTE_SWAP_DECISION: player=${currentPlayer.name}, hasStoodPat=${currentPlayer.hasStoodPat}, wantsToVote=${currentPlayer.wantsToVote}`);
            
            // Check if all players have made their decisions
            const allPlayersDecided = gameState.players.every(p => p.wantsToVote !== undefined || p.hasStoodPat);
            if (allPlayersDecided) {
                console.log(`[DEBUG] All players have made vote decisions, transitioning to next phase`);
                const playersVoting = gameState.players.filter(p => p.wantsToVote);
                if (playersVoting.length === 0) {
                    setGameState(prev => ({
                        ...prev, 
                        gamePhase: GamePhase.GAMEPLAY, 
                        currentPlayerIndex: prev.firstPlayerToAct, 
                        roundLeaderIndex: prev.firstPlayerToAct 
                    }));
                } else {
                    const firstVoterIndex = gameState.players.findIndex(p => p.wantsToVote);
                    setGameState(prev => ({
                        ...prev, 
                        gamePhase: GamePhase.VOTE_SWAP, 
                        currentPlayerIndex: firstVoterIndex 
                    }));
                }
                return;
            }
            
            // If current player has already decided, advance to next player
            if (currentPlayer.wantsToVote !== undefined || currentPlayer.hasStoodPat) {
                const nextPlayerIndex = findNextPlayerForDecision(gameState.players, gameState.currentPlayerIndex, 'vote');
                if (nextPlayerIndex !== -1) {
                    console.log(`[DEBUG] Current player decided, advancing to ${gameState.players[nextPlayerIndex].name}`);
                setGameState(prev => ({...prev, currentPlayerIndex: nextPlayerIndex}));
                } else {
                    // No more players, let the all players decided logic above handle phase transition
                    console.log(`[DEBUG] No more players for vote decisions, waiting for phase transition`);
                }
                return;
            }
            
            // Only process if current player hasn't made a decision yet
            if (!currentPlayer.isHuman) {
                console.log(`[DEBUG] Bot ${currentPlayer.name} needs to make vote decision, setting thinking state`);
                setGameState(prev => ({...prev, thinkingPlayerId: currentPlayer.id }));
            } else {
                // Human player needs to make a vote decision - wait for their input
                console.log(`[DEBUG] Waiting for human player ${currentPlayer.name} to make vote decision`);
            }
            return;
        case GamePhase.VOTE_SWAP:
             if (currentPlayer.hasStoodPat) {
                const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
                setGameState(prev => ({...prev, currentPlayerIndex: nextPlayerIndex}));
            } else if (currentPlayer.hasVoted) {
                // Player has already voted, advance to next player
                const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
                setGameState(prev => ({...prev, currentPlayerIndex: nextPlayerIndex}));
            } else if (!currentPlayer.isHuman && !currentPlayer.hasVoted) {
                 setGameState(prev => ({...prev, thinkingPlayerId: currentPlayer.id }));
             }
            return; // Exit early to prevent further processing
        case GamePhase.FINAL_SWAP_DECISION:
            if (!currentPlayer.isHuman) {
                setGameState(prev => ({...prev, thinkingPlayerId: currentPlayer.id }));
            } else if (currentPlayer.isHuman && currentPlayer.hasMadeFinalSwapDecision === undefined) {
                // Human player needs to make a final swap decision - wait for their input
                // But add a timeout fallback
                timeoutId = setTimeout(() => {
                    console.log(`[TIMEOUT] Human player ${currentPlayer.name} taking too long for final swap decision, auto-advancing`);
                    handleFinalSwapDecision(false);
                }, 10000); // 10 second timeout for human decisions
            }
            return; // Exit early to prevent further processing
        case GamePhase.FINAL_SWAP_ACTION:
            // Handle final swap action - if it's a human's turn, wait for them to select cards
            // If it's a bot's turn, automatically process their swap
            if (currentPlayer.hasStoodPat) {
                // Player has stood pat, move to next player
                const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
                setGameState(prev => ({...prev, currentPlayerIndex: nextPlayerIndex}));
                return;
            }
            
            if (!currentPlayer.isHuman) {
                const botPlayer = currentPlayer;
                    // Strategic bot card selection for multi-card swap
                    const cardsToSwap = selectWorstCardsForSwap(botPlayer.hand, gameState.voteResult);
                    timeoutId = setTimeout(() => handleFinalSwap(cardsToSwap), 2000);
            }
            // If it's a human's turn, the ActionPanel will handle the UI
            return; // Exit early to prevent further processing
        case GamePhase.FINAL_SWAP_ONE_CARD_SELECT:
             if (!currentPlayer.isHuman) {
                timeoutId = setTimeout(handleBotSelectCardForOneSwap, 2000);
            }
            return;
        case GamePhase.FINAL_SWAP_ONE_CARD_REVEAL_AND_DECIDE:
            if (!currentPlayer.isHuman) {
                timeoutId = setTimeout(handleBotOneCardSwapDecision, 2000);
            }
            return; // For human, wait for ActionPanel interaction
        case GamePhase.GAMEPLAY:
            if (!currentPlayer.isHuman) {
                 timeoutId = setTimeout(handleBotPlay, 3000);
            }
            // For human players, do nothing - let them interact via ActionPanel
            return; // Exit early to prevent further processing
        case GamePhase.MINIGAME:
            if (!currentPlayer.isHuman) {
                timeoutId = setTimeout(handleBotPlay, 3000);
            }
            return;
        case GamePhase.MINIGAME_SWAP:
            if (!currentPlayer.isHuman) {
                // For now, bots will not swap in minigame for simplicity
                timeoutId = setTimeout(() => handleMinigameSwap(false), 2000);
            }
            return;
        case GamePhase.ROUND_OVER:
            // Don't process ROUND_OVER in the main game loop - let the timeout handle it
            // This prevents the phase from being cleared too quickly
            break;
      }
    };
    
    gameLoop();

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.gamePhase, gameState.currentPlayerIndex]);

  // Global safety net - force gameplay if stuck in pre-gameplay phases for too long
  useEffect(() => {
    const preGameplayPhases = [
      GamePhase.DEALING,
      GamePhase.FIRST_SWAP_DECISION,
      GamePhase.FIRST_SWAP_ACTION,
      GamePhase.FIRST_SWAP_OTHERS_DECISION,
      GamePhase.OTHERS_SWAP_DECISION,
      GamePhase.OTHERS_SWAP_ACTION,
      GamePhase.VOTE_SWAP_DECISION,
      GamePhase.VOTE_SWAP,
      GamePhase.FINAL_SWAP_DECISION,
      GamePhase.FINAL_SWAP_ACTION,
      GamePhase.FINAL_SWAP_ONE_CARD_SELECT,
      GamePhase.FINAL_SWAP_ONE_CARD_REVEAL_AND_DECIDE
    ];

    if (preGameplayPhases.includes(gameState.gamePhase)) {
      const globalTimeout = setTimeout(() => {
        console.warn(`[GLOBAL TIMEOUT] Game stuck in ${gameState.gamePhase} for too long, forcing to gameplay`);
        emergencyFallback(`Global timeout in phase ${gameState.gamePhase}`);
      }, 60000); // 60 seconds global timeout

      return () => clearTimeout(globalTimeout);
    }
  }, [gameState.gamePhase, emergencyFallback]);

  useEffect(() => {
    // This effect creates a delay for bot actions to make them feel more natural
    if (gameState.thinkingPlayerId) {
      const timeoutId = setTimeout(() => {
        const player = gameState.players.find(p => p.id === gameState.thinkingPlayerId);
        if (!player) return;

        console.log(`[DEBUG] Bot ${player.name} making decision for phase: ${gameState.gamePhase}`);

        switch (gameState.gamePhase) {
            case GamePhase.FIRST_SWAP_DECISION:
            case GamePhase.FIRST_SWAP_OTHERS_DECISION:
                // Strategic swap decision based on hand quality
                const handQuality = evaluateHandQuality(player.hand);
                const wantsToSwap = handQuality < 8; // Swap if hand quality is poor
                console.log(`[STRATEGIC] Bot ${player.name} hand quality: ${handQuality.toFixed(1)}, deciding to swap: ${wantsToSwap}`);
                handleSwapDecision(wantsToSwap);
                break;
            case GamePhase.OTHERS_SWAP_DECISION:
                // Strategic decision: swap if hand quality is below average
                const currentQuality = evaluateHandQuality(player.hand);
                const shouldSwapInOthers = currentQuality < 6;
                console.log(`[STRATEGIC] Bot ${player.name} in others swap, quality: ${currentQuality.toFixed(1)}, swapping: ${shouldSwapInOthers}`);
                handleOtherPlayerSwap(shouldSwapInOthers);
                break;
            case GamePhase.VOTE_SWAP_DECISION:
                // Strategic voting: participate if hand needs improvement
                const voteHandQuality = evaluateHandQuality(player.hand);
                const wantsToVote = voteHandQuality < 10; // Vote if hand could be better
                console.log(`[STRATEGIC] Bot ${player.name} vote decision, quality: ${voteHandQuality.toFixed(1)}, voting: ${wantsToVote}`);
                handleVoteDecision(wantsToVote);
                break;
            case GamePhase.VOTE_SWAP:
                // Strategic vote amount based on hand assessment
                const quality = evaluateHandQuality(player.hand);
                let voteAmount;
                if (quality < 4) {
                    voteAmount = 4; // Desperate - need major changes
                } else if (quality < 8) {
                    voteAmount = 3; // Need improvement
                } else if (quality < 12) {
                    voteAmount = 2; // Minor tweaks
                } else {
                    voteAmount = 1; // Just need small adjustment
                }
                console.log(`[STRATEGIC] Bot ${player.name} voting for ${voteAmount} cards (quality: ${quality.toFixed(1)})`);
                handleVote(voteAmount);
                break;
            case GamePhase.FINAL_SWAP_DECISION:
                // Strategic final swap: participate if hand quality is poor or vote didn't go our way
                const finalQuality = evaluateHandQuality(player.hand);
                const shouldParticipate = finalQuality < 8; // Always participate if hand needs work
                console.log(`[STRATEGIC] Bot ${player.name} final swap decision, quality: ${finalQuality.toFixed(1)}, participating: ${shouldParticipate}`);
                handleFinalSwapDecision(shouldParticipate);
                break;
            default:
                console.log(`[DEBUG] Bot ${player.name} - no action for phase: ${gameState.gamePhase}`);
        }
        setGameState(prev => ({...prev, thinkingPlayerId: undefined}));
      }, 1500);

      return () => clearTimeout(timeoutId);
    }
  }, [gameState.thinkingPlayerId, gameState.gamePhase]);

  useEffect(() => {
    // This effect handles the visual delay for bot card swaps
    if (swappingCards) {
      const timeoutId = setTimeout(() => {
        const { playerId, cards } = swappingCards;
        const playerIndex = gameState.players.findIndex(p => p.id === playerId);
        
        setGameState(prev => {
          const newDeck = [...prev.deck];
          let newHand = [...prev.players[playerIndex].hand];
          
          newHand = newHand.filter(c => !cards.some(sc => sc.rank === c.rank && sc.suit === c.suit));
          for(let i = 0; i < cards.length; i++) {
            if (newDeck.length > 0) newHand.push(newDeck.pop()!);
          }

          const newPlayers = prev.players.map((p, idx) => 
              idx === playerIndex ? { ...p, hand: newHand } : p
          );
          
          let nextPlayerIndex = (playerIndex + 1) % newPlayers.length;
          let nextPhase = prev.gamePhase;

          if (prev.gamePhase === GamePhase.FIRST_SWAP_ACTION) {
              nextPhase = GamePhase.OTHERS_SWAP_DECISION;
          } else if (prev.gamePhase === GamePhase.OTHERS_SWAP_DECISION) {
              if (nextPlayerIndex === prev.firstPlayerToAct) {
                  const firstVoterIndex = newPlayers.findIndex(p => !p.hasStoodPat);
                  nextPhase = GamePhase.VOTE_SWAP_DECISION;
                  nextPlayerIndex = firstVoterIndex !== -1 ? firstVoterIndex : prev.firstPlayerToAct;
              }
          }
          
          return { ...prev, players: newPlayers, deck: newDeck, gamePhase: nextPhase, currentPlayerIndex: nextPlayerIndex };
        });

        setSwappingCards(null);
      }, 1500);

      return () => clearTimeout(timeoutId);
    }
  }, [swappingCards]);

  const determineTrickWinner = (trick: TrickPlay[], leadHand: Card[], roundLeaderId: string): string => {
    if (!trick || trick.length === 0) {
      return roundLeaderId;
    }
  
    const leadValue = leadHand.length > 0 ? leadHand[0].value : 0;
  
    let winningPlay: TrickPlay | null = null;
    let highestValue = -1;
  
    // The first play sets the benchmark if it's a valid lead
    const leaderPlay = trick.find(p => p.playerId === roundLeaderId);
    if (leaderPlay) {
      winningPlay = leaderPlay;
      highestValue = leaderPlay.cards[0].value;
    }
  
    for (const play of trick) {
      // A play can only win if all cards are the same rank.
      const isSameRankPlay = play.cards.every(c => c.rank === play.cards[0].rank);
      if (!isSameRankPlay) continue;

      // Skip the leader's play as it's our starting benchmark
      if (play.playerId === roundLeaderId) continue;
  
      const playValue = play.cards[0].value;
  
      // To win, a play must be of higher value.
      // If values are equal, the later play wins.
      if (playValue >= highestValue) {
        highestValue = playValue;
        winningPlay = play;
      }
    }
  
    // If no one could beat the leader, the leader wins.
    if (winningPlay && winningPlay.cards[0].value < leadValue && trick.length > 1) {
        return roundLeaderId;
    }
  
    return winningPlay ? winningPlay.playerId : roundLeaderId;
  };

  // Clear swapping cards display when gameplay starts
  useEffect(() => {
    if (gameState.gamePhase === GamePhase.GAMEPLAY) {
      setSwappingCards(null);
    }
  }, [gameState.gamePhase]);

  // Hide floating play button when game phase changes away from gameplay or when it's not human's turn
  useEffect(() => {
    if (gameState.gamePhase !== GamePhase.GAMEPLAY || !gameState.players[gameState.currentPlayerIndex]?.isHuman) {
      setShowFloatingPlayButton(false);
    }
  }, [gameState.gamePhase, gameState.currentPlayerIndex]);

   // Timer countdown effect
  useEffect(() => {
    if (timer > 0) {
      const intervalId = setInterval(() => {
        setTimer(t => t - 1);
      }, 1000);
      return () => clearInterval(intervalId);
    }
  }, [timer]);



  const dealCards = () => {
    console.log("[DEBUG] dealCards called");
    console.log("[DEBUG] Current hand sizes before dealing:");
    gameState.players.forEach(p => console.log(`  ${p.name}: ${p.hand.length} cards`));
    
    // Simple dealing - no complex tracking needed
    
    // Check if cards have already been dealt
    if (gameState.players.some(p => p.hand.length > 0)) {
      console.log("Cards already dealt, skipping...");
      return;
    }
    
    addCommentary("The dealer is shuffling the deck...");
    const deck = shuffleDeck(createDeck());
    
    // Start visual dealing
    startVisualDealing(deck);
  };

  const startVisualDealing = (deck: Card[]) => {
    setIsDealing(true);
    setDealingStep(0);
    setDealingCards({});
    setFaceUpCards({});
    
    // Initialize dealing cards for each player
    const initialDealingCards: { [playerId: string]: Card[] } = {};
    gameState.players.forEach(player => {
      initialDealingCards[player.id] = [];
    });
    setDealingCards(initialDealingCards);
    
    // Start the dealing sequence
    dealCardsSequentially(deck, 0);
  };

  const dealCardsSequentially = (deck: Card[], step: number, currentDealingCards: { [playerId: string]: Card[] } = {}, currentFaceUpCards: { [playerId: string]: Card } = {}) => {
    if (step >= 5) {
      // All cards dealt, finalize the hands
      finalizeDealing(deck, currentDealingCards, currentFaceUpCards);
      return;
    }
    
    const newDealingCards = { ...currentDealingCards };
    const newFaceUpCards = { ...currentFaceUpCards };
    
    if (step < 4) {
      // Deal 4 cards down (face down)
      gameState.players.forEach(player => {
        const card = deck.pop()!;
        newDealingCards[player.id] = [...(newDealingCards[player.id] || []), card];
      });
      setDealingCards(newDealingCards);
      addCommentary(`Dealing round ${step + 1} of 4...`);
    } else {
      // Deal 1 card up (face up)
      gameState.players.forEach(player => {
        const faceUpCard = deck.pop()!;
        newFaceUpCards[player.id] = faceUpCard;
      });
      setFaceUpCards(newFaceUpCards);
      addCommentary("Dealing the face-up cards...");
    }
    
    setDealingStep(step + 1);
    
    // Continue to next step after a delay
    setTimeout(() => {
      dealCardsSequentially(deck, step + 1, newDealingCards, newFaceUpCards);
    }, 800); // 800ms delay between each dealing step
  };

  const finalizeDealing = (deck: Card[], finalDealingCards: { [playerId: string]: Card[] }, finalFaceUpCards: { [playerId: string]: Card }) => {
    const newPlayers = [...gameState.players];
    
    // Clear any existing hands first
    newPlayers.forEach(p => p.hand = []);
    
    // Add all dealing cards to hands
    newPlayers.forEach(player => {
      const playerDealingCards = finalDealingCards[player.id] || [];
      player.hand = [...playerDealingCards];
      
      // Add face-up card
      const faceUpCard = finalFaceUpCards[player.id];
      if (faceUpCard) {
        player.faceUpCard = faceUpCard;
        player.hand.push(faceUpCard);
      }
    });
    
    console.log("[DEBUG] After dealing 4 cards down:");
    newPlayers.forEach(p => console.log(`  ${p.name}: ${p.hand.length} cards`));
    console.log("[DEBUG] After dealing 1 card up:");
    newPlayers.forEach(p => console.log(`  ${p.name}: ${p.hand.length} cards`));

    let highestCardValue = 0;
    let starterIndex = -1;
    let dealerIndex = newPlayers.findIndex(p => p.isDealer);

    for (let i = 0; i < newPlayers.length; i++) {
        const playerIndex = (dealerIndex + 1 + i) % newPlayers.length;
        const player = newPlayers[playerIndex];
        if (player.faceUpCard!.value > highestCardValue) {
            highestCardValue = player.faceUpCard!.value;
            starterIndex = playerIndex;
        } else if (player.faceUpCard!.value === highestCardValue) {
            // Tie-breaker: If ranks are tied, the player who was dealt their card last wins the tie
            // Since we're going in dealing order (dealer + 1, dealer + 2, etc.), the later player wins
            starterIndex = playerIndex;
        }
    }
    
    setGameState(prev => ({ ...prev, starterPlayerId: newPlayers[starterIndex].id }));
    
    setTimeout(() => {
      console.log("[DEBUG] After dealing, hand sizes:");
      newPlayers.forEach(p => console.log(`  ${p.name}: ${p.hand.length} cards`));
      
      setGameState(prev => ({
        ...prev,
        players: enforceFiveCardLimit(newPlayers),
        deck,
        gamePhase: GamePhase.FIRST_SWAP_DECISION,
        currentPlayerIndex: starterIndex,
        firstPlayerToAct: starterIndex,
      }));
      addCommentary(`${newPlayers[starterIndex].name} has the highest card and starts the action.`);
      
      // End visual dealing
      setIsDealing(false);
      setDealingStep(0);
      setDealingCards({});
      setFaceUpCards({});
    }, 2000);
  };
  
  const handleSwapDecision = useCallback((wantsToSwap: boolean) => {
    setTimer(0);
    const playerIndex = gameState.currentPlayerIndex;
    const player = gameState.players[playerIndex];

    console.log(`[DEBUG] handleSwapDecision called: player=${player.name}, wantsToSwap=${wantsToSwap}, phase=${gameState.gamePhase}`);

    // SIMPLE guard - if player already made decision, exit immediately
    if (player.hasMadeFirstSwapDecision) {
      console.log(`[DEBUG] Player ${player.name} already decided, ignoring duplicate call`);
      return;
    }

    // Clear any existing thinking state
    setGameState(prev => ({ ...prev, thinkingPlayerId: undefined }));

    setGameState(prev => {
        const newPlayers = [...prev.players];
        newPlayers[playerIndex].hasMadeFirstSwapDecision = true;

        if (!wantsToSwap) {
            newPlayers[playerIndex].hasStoodPat = true;
            addCommentary(`${player.name} stands pat.`);
            
            // IMPORTANT RULE: If the commander (starter) decides not to swap, game starts directly!
            if (playerIndex === prev.firstPlayerToAct) {
                console.log(`[DEBUG] Commander ${player.name} decided not to swap - starting game directly!`);
                addCommentary(`${player.name} is the commander and chose not to swap. The game starts now!`);
                return {
                    ...prev, 
                    players: newPlayers, 
                    gamePhase: GamePhase.GAMEPLAY,
                    currentPlayerIndex: playerIndex,
                    roundLeaderIndex: playerIndex,
                    swapAmount: 0
                };
            }
            
            // Set swapAmount to 0 when first player decides not to swap
            if (prev.swapAmount === undefined) {
                console.log(`[DEBUG] First player ${player.name} decided not to swap, setting swapAmount to 0`);
                return {...prev, players: newPlayers, swapAmount: 0};
            }
        } else {
            addCommentary(`${player.name} wants to swap cards.`);
        }

        // Find next player for the first swap decision round
        const nextPlayerIndex = findNextPlayerForDecision(newPlayers, playerIndex, 'firstSwap');
        console.log(`[DEBUG] handleSwapDecision: nextPlayerIndex = ${nextPlayerIndex}, wantsToSwap = ${wantsToSwap}, isHuman = ${player.isHuman}`);
        
        if (wantsToSwap && player.isHuman) {
            // Set a default swap amount for human players (they'll choose the actual amount later)
            // This ensures other players know how many cards to expect
            console.log(`[DEBUG] Human player ${player.name} wants to swap, setting swapAmount to 2`);
            return {...prev, players: newPlayers, gamePhase: GamePhase.FIRST_SWAP_ACTION, swapAmount: 2};
        }

        if (wantsToSwap && !player.isHuman) {
            // Bot wants to swap - execute the swap immediately and set swapAmount
            console.log(`[DEBUG] Bot ${player.name} wants to swap, executing swap now`);
            const hand = [...player.hand].sort((a,b) => b.value - a.value);
            
            // Ensure the bot has cards to swap
            if (hand.length === 0) {
                console.log(`[DEBUG] Bot ${player.name} has no cards to swap, treating as stand pat`);
                newPlayers[playerIndex].hasStoodPat = true;
                addCommentary(`${player.name} has no cards to swap, so stands pat.`);
            } else {
                const swapCount = Math.min(Math.max(1, hand.length), 2);
                const cardsToSwap = hand.slice(0, swapCount);
                console.log(`[DEBUG] Bot ${player.name} swapping ${cardsToSwap.length} cards, setting swapAmount to ${cardsToSwap.length}`);
                addCommentary(`${player.name} swaps ${cardsToSwap.length} cards.`);
                setSwappingCards({ playerId: player.id, cards: cardsToSwap, originalPhase: GamePhase.FIRST_SWAP_ACTION });
                
                // If there are more players to decide, continue to next player
                if (nextPlayerIndex !== -1) {
                    return {
                        ...prev,
                        players: newPlayers,
                        gamePhase: GamePhase.FIRST_SWAP_OTHERS_DECISION,
                        currentPlayerIndex: nextPlayerIndex,
                        swapAmount: cardsToSwap.length
                    };
                }
                // If this was the last player, the logic below will handle the transition
                // Don't return here, let the logic below handle the transition
            }
        }

        if (nextPlayerIndex === -1) {
            console.log(`[DEBUG] All players have made first swap decisions, processing results...`);
            const swappingPlayers = newPlayers.filter(p => !p.hasStoodPat);
            if (swappingPlayers.length === 0) {
                addCommentary(`No one wants to swap. Let the voting begin!`);
                // Find the first player who hasn't stood pat (should be all players at this point)
                const firstVoterIndex = newPlayers.findIndex(p => !p.hasStoodPat);
                return {...prev, players: newPlayers, gamePhase: GamePhase.VOTE_SWAP_DECISION, currentPlayerIndex: firstVoterIndex !== -1 ? firstVoterIndex : 0 };
            }

            const firstSwapperIndex = newPlayers.findIndex(p => !p.hasStoodPat);
            console.log(`[DEBUG] First swapper is ${newPlayers[firstSwapperIndex].name}, isHuman: ${newPlayers[firstSwapperIndex].isHuman}`);
            addCommentary(`Now, ${newPlayers[firstSwapperIndex].name} will start the swap.`);

            if (newPlayers[firstSwapperIndex].isHuman) {
                console.log(`[DEBUG] Human player will start swap, setting swapAmount to 2`);
                return {...prev, players: newPlayers, gamePhase: GamePhase.FIRST_SWAP_ACTION, currentPlayerIndex: firstSwapperIndex, swapAmount: 2 };
            } else {
                const botPlayer = newPlayers[firstSwapperIndex];
                const hand = [...botPlayer.hand].sort((a,b) => b.value - a.value);
                // Debug: Check if hand is empty
                console.log(`[DEBUG] Bot ${botPlayer.name} hand size: ${hand.length}`);
                if (hand.length === 0) {
                    console.error(`[ERROR] Bot ${botPlayer.name} has empty hand!`);
                    addCommentary(`${botPlayer.name} has no cards to swap.`);
                    return {...prev, players: newPlayers, swapAmount: 0 };
                }
                // Strategic bot card selection for initial swap
                const swapCount = Math.min(Math.max(1, hand.length), 2);
                const cardsToSwap = selectWorstCardsForSwap(hand, swapCount);
                console.log(`[DEBUG] Bot ${botPlayer.name} swapping ${cardsToSwap.length} cards, setting swapAmount to ${cardsToSwap.length}`);
                addCommentary(`${botPlayer.name} swaps ${cardsToSwap.length} cards.`);
                setSwappingCards({ playerId: botPlayer.id, cards: cardsToSwap, originalPhase: GamePhase.FIRST_SWAP_ACTION });
                return {...prev, players: newPlayers, swapAmount: cardsToSwap.length };
            }
        }
        
        return {
            ...prev,
            players: newPlayers,
            gamePhase: GamePhase.FIRST_SWAP_OTHERS_DECISION,
            currentPlayerIndex: nextPlayerIndex,
        };
    });
  }, [gameState.currentPlayerIndex, gameState.gamePhase, gameState.players, setTimer, addCommentary, setSwappingCards, findNextPlayerForDecision]);
  
  const handleOtherPlayerSwap = (wantsToSwap: boolean) => {
      setTimer(0);
      const playerIndex = gameState.currentPlayerIndex;
      const player = gameState.players[playerIndex];

      if (player.isHuman) {
          if (wantsToSwap) {
              addCommentary(`${player.name} wants to swap cards.`);
              setGameState(prev => ({ ...prev, gamePhase: GamePhase.OTHERS_SWAP_ACTION }));
          } else {
              addCommentary(`${player.name} stands pat.`);
              setGameState(prev => {
                  const newPlayers = [...prev.players];
                  newPlayers[playerIndex].hasStoodPat = true;
                  
                  // Find the next player who hasn't stood pat to continue the round
                  const nextPlayerIndex = findNextPlayerForDecision(newPlayers, playerIndex, 'othersSwap');
                  
                  if (nextPlayerIndex === -1 || nextPlayerIndex === prev.firstPlayerToAct) {
                      // Circle complete, move to vote
                      const firstVoterIndex = newPlayers.findIndex(p => !p.hasStoodPat);
                      addCommentary("Time for the final vote on swapping cards!");
                      return {...prev, players: newPlayers, gamePhase: GamePhase.VOTE_SWAP_DECISION, currentPlayerIndex: firstVoterIndex !== -1 ? firstVoterIndex : prev.firstPlayerToAct};
                  }

                  return { ...prev, players: newPlayers, currentPlayerIndex: nextPlayerIndex };
              });
          }
          return;
      }

      // --- Bot Logic ---
      if (!wantsToSwap) {
          addCommentary(`${player.name} stands pat.`);
          setGameState(prev => {
              const newPlayers = [...prev.players];
              newPlayers[playerIndex].hasStoodPat = true;

              const nextPlayerIndex = findNextPlayerForDecision(newPlayers, playerIndex, 'othersSwap');
              if (nextPlayerIndex === -1) {
                  const firstVoterIndex = newPlayers.findIndex(p => !p.hasStoodPat);
                  return {...prev, players: newPlayers, gamePhase: GamePhase.VOTE_SWAP_DECISION, currentPlayerIndex: firstVoterIndex !== -1 ? firstVoterIndex : prev.firstPlayerToAct};
              }
              return { ...prev, players: newPlayers, currentPlayerIndex: nextPlayerIndex };
          });
      } else {
          const hand = [...player.hand].sort((a,b) => b.value - a.value);
          // Use the swapAmount from the first player's decision, but ensure it's at least 1
          const swapCount = Math.max(1, gameState.swapAmount);
          const cardsToSwap = hand.slice(0, swapCount);

          // Ensure we actually have cards to swap
          if (cardsToSwap.length === 0) {
              console.log(`[DEBUG] ${player.name} has no cards to swap, treating as stand pat`);
              addCommentary(`${player.name} has no cards to swap, so stands pat.`);
              setGameState(prev => {
                  const newPlayers = [...prev.players];
                  newPlayers[playerIndex].hasStoodPat = true;
                  
                  // Find the next player who hasn't stood pat to continue the round
                  const nextPlayerIndex = findNextPlayerForDecision(newPlayers, playerIndex, 'othersSwap');
                  
                  if (nextPlayerIndex === -1 || nextPlayerIndex === prev.firstPlayerToAct) {
                      // Circle complete, move to vote
                      const firstVoterIndex = newPlayers.findIndex(p => !p.hasStoodPat);
                      addCommentary("Time for the final vote on swapping cards!");
                      return {...prev, players: newPlayers, gamePhase: GamePhase.VOTE_SWAP_DECISION, currentPlayerIndex: firstVoterIndex !== -1 ? firstVoterIndex : prev.firstPlayerToAct};
                  }

                  return { ...prev, players: newPlayers, currentPlayerIndex: nextPlayerIndex };
              });
          } else {
          setSwappingCards({playerId: player.id, cards: cardsToSwap, originalPhase: gameState.gamePhase});
          addCommentary(`${player.name} is swapping ${cardsToSwap.length} card(s)...`);
          }
      }
  }

  const handleVote = useCallback((amount: number) => {
      setTimer(0);
      const playerIndex = gameState.currentPlayerIndex;
      const player = gameState.players[playerIndex];

      console.log(`[DEBUG] handleVote called: player=${player.name}, amount=${amount}`);

      // SIMPLE guard - if player already voted, exit immediately
      if (player.hasVoted) {
          console.log(`[DEBUG] Player ${player.name} already voted, ignoring duplicate call`);
          return;
      }

      const voteMessage = amount === 0 ? "not to swap any cards" : `to swap ${amount} card(s)`;
      addCommentary(`${player.name} votes ${voteMessage}.`);
      setGameState(prev => {
          const newPlayers = [...prev.players];
          newPlayers[playerIndex].swapVote = amount;
          newPlayers[playerIndex].hasVoted = true;

          let nextVoterIndex = -1;
          for (let i = 1; i < newPlayers.length; i++) {
              const potentialNextIndex = (playerIndex + i) % newPlayers.length;
              if (!newPlayers[potentialNextIndex].hasStoodPat && !newPlayers[potentialNextIndex].hasVoted) {
                  nextVoterIndex = potentialNextIndex;
                  break;
              }
          }

          if (nextVoterIndex === -1) {
              // All have voted
              const votes = newPlayers.filter(p => p.swapVote !== undefined).map(p => p.swapVote!);
              const voteCounts: {[key:number]: number} = {};
              let maxVotes = 0;
              let winningVote = 0;
              let minVote = 6;

              votes.forEach(v => {
                  voteCounts[v] = (voteCounts[v] || 0) + 1;
                  if (v < minVote) minVote = v;
              });
              
              Object.entries(voteCounts).forEach(([voteStr, count]) => {
                  const vote = parseInt(voteStr);
                  if (count > maxVotes) {
                      maxVotes = count;
                      winningVote = vote;
                  } else if (count === maxVotes) {
                      winningVote = Math.min(winningVote, vote);
                  }
              });

              if (Object.values(voteCounts).every(c => c === 1)) {
                  winningVote = minVote;
              }
              
              // Rule: 0 can NEVER win - if 0 is the winning vote, use the lowest non-zero vote instead
              if (winningVote === 0) {
                  const nonZeroVotes = votes.filter(v => v > 0);
                  if (nonZeroVotes.length > 0) {
                      winningVote = Math.min(...nonZeroVotes);
                      addCommentary(`The vote is tied at 0, but 0 can never win! Using the lowest vote: ${winningVote}.`);
                  } else {
                      // Fallback: if somehow all votes are 0, default to 1
                      winningVote = 1;
                      addCommentary(`All votes were 0, defaulting to 1 card swap.`);
                  }
              }

              addCommentary(`The vote is in! Players will swap ${winningVote} card(s).`);
              
              // Find the first player who voted for the winning amount and needs to decide whether to participate
              const firstDeciderIndex = newPlayers.findIndex(p => p.wantsToVote && p.swapVote === winningVote && p.hasMadeFinalSwapDecision === undefined);
              
              if (firstDeciderIndex === -1) {
                  // All players have decided, proceed to action
                  addCommentary(`The Council has spoken! A ${winningVote}-card swap is now in motion!`);
                  return {...prev, players: newPlayers, gamePhase: GamePhase.FINAL_SWAP_ACTION, voteResult: winningVote, currentPlayerIndex: 0 };
              }
              
              return {...prev, players: newPlayers, gamePhase: GamePhase.FINAL_SWAP_DECISION, voteResult: winningVote, currentPlayerIndex: firstDeciderIndex };
          }

          return {...prev, players: newPlayers, currentPlayerIndex: nextVoterIndex};
      });
      setTimer(10);
  }, [gameState.currentPlayerIndex, gameState.players, addCommentary, setTimer]);
  
  const handleVoteDecision = useCallback((wantsToVote: boolean) => {
      const playerIndex = gameState.currentPlayerIndex;
      const player = gameState.players[playerIndex];

      console.log(`[DEBUG] handleVoteDecision called: player=${player.name}, wantsToVote=${wantsToVote}`);

      // SIMPLE guard - if player already has vote decision, exit immediately
      if (player.wantsToVote !== undefined) {
          console.log(`[DEBUG] Player ${player.name} already has vote decision, ignoring duplicate call`);
          return;
      }

      console.log(`[DEBUG] Processing vote decision for ${player.name}: wantsToVote=${wantsToVote}`);

      // Clear any existing thinking state
      setGameState(prev => ({ ...prev, thinkingPlayerId: undefined }));

      addCommentary(`${player.name} decides ${wantsToVote ? 'to vote' : 'to stay'}.`);
      
      setGameState(prev => {
          const newPlayers = [...prev.players];
          newPlayers[playerIndex].wantsToVote = wantsToVote;

          // Check if all players who should vote have made their decision
          // Only players who didn't stand pat should vote
          const playersWhoShouldVote = newPlayers.filter(p => !p.hasStoodPat);
          const allDecided = playersWhoShouldVote.every(p => p.wantsToVote !== undefined);
          
          if (allDecided) {
              // All players have decided
              const playersVoting = newPlayers.filter(p => p.wantsToVote);
              console.log(`[DEBUG] All vote decisions made. Players voting: ${playersVoting.length}`);
              
              if (playersVoting.length === 0) {
                  addCommentary(`No one wants to swap. Let the game begin!`);
                  return {...prev, players: newPlayers, gamePhase: GamePhase.GAMEPLAY, currentPlayerIndex: prev.firstPlayerToAct, roundLeaderIndex: prev.firstPlayerToAct };
              }
              
              const firstVoterIndex = newPlayers.findIndex(p => p.wantsToVote);
              console.log(`[DEBUG] Moving to VOTE_SWAP phase, first voter: ${newPlayers[firstVoterIndex].name}`);
              addCommentary(`Time to vote on the number of cards to swap.`);
              return {...prev, players: newPlayers, gamePhase: GamePhase.VOTE_SWAP, currentPlayerIndex: firstVoterIndex };
          }

          // Advance to next player who needs to make a vote decision
          const nextPlayerIndex = findNextPlayerForDecision(newPlayers, playerIndex, 'vote');
          if (nextPlayerIndex !== -1) {
            console.log(`[DEBUG] Vote decision processed, advancing to ${newPlayers[nextPlayerIndex].name}`);
            return {...prev, players: newPlayers, currentPlayerIndex: nextPlayerIndex};
              } else {
            console.log(`[DEBUG] Vote decision processed, no more players need to decide`);
            return {...prev, players: newPlayers};
              }
      });
  }, [gameState.currentPlayerIndex, gameState.players, addCommentary, findNextPlayerForDecision]);

  const handleFinalSwapDecision = (participate: boolean) => {
    setTimer(0);
    const playerIndex = gameState.currentPlayerIndex;
    setGameState(prev => {
        const newPlayers = [...prev.players];
        newPlayers[playerIndex].hasMadeFinalSwapDecision = true;

        if (!participate) {
            newPlayers[playerIndex].hasStoodPat = true; // effectively standing pat now
            addCommentary(`${newPlayers[playerIndex].name} decides not to swap.`);
        } else {
             addCommentary(`${newPlayers[playerIndex].name} will join the swap.`);
        }

        let nextDeciderIndex = -1;
        for (let i = 1; i < newPlayers.length; i++) {
            const idx = (playerIndex + i) % newPlayers.length;
            if (newPlayers[idx].wantsToVote && newPlayers[idx].swapVote === prev.voteResult && !newPlayers[idx].hasMadeFinalSwapDecision) {
                nextDeciderIndex = idx;
                break;
            }
        }
        
        if (nextDeciderIndex === -1) {
            // all have decided
            addCommentary(`All decisions made. Final swap is happening now!`);
            
            // Check for the special 1-card swap rule
            if (prev.voteResult === 1) {
              const firstSwapperIndex = newPlayers.findIndex(p => !p.hasStoodPat);

              addCommentary(`A special 1-card swap begins! ${newPlayers[firstSwapperIndex].name} is up.`);
              
              return {
                ...prev,
                players: newPlayers,
                gamePhase: GamePhase.FINAL_SWAP_ONE_CARD_SELECT,
                currentPlayerIndex: firstSwapperIndex,
              };
            }

            return {...prev, players: newPlayers, gamePhase: GamePhase.FINAL_SWAP_ACTION, currentPlayerIndex: 0};
        }
        
        return {...prev, players: newPlayers, currentPlayerIndex: nextDeciderIndex};
    });
    setTimer(10);
  };
  
  const handleFinalSwap = (cardsToSwap: Card[]) => {
      console.log(`[DEBUG] handleFinalSwap called with ${cardsToSwap.length} cards`);
      
      // Immediate safety check using a closure variable
      if ((handleFinalSwap as any)._inProgress) {
          console.log(`[DEBUG] Final swap already in progress (closure check), ignoring call`);
          return;
      }
      (handleFinalSwap as any)._inProgress = true;
      
      if (cardsToSwap.length !== gameState.voteResult) {
          (handleFinalSwap as any)._inProgress = false;
          return;
      }
      
      const playerIndex = gameState.players.findIndex(p => p.isHuman);
      
      setGameState(prev => {
          const newDeck = [...prev.deck];
          
          // Process human player first
          const humanPlayer = prev.players[playerIndex];
          let newHumanHand = [...humanPlayer.hand];
          console.log(`[DEBUG] Before final swap - ${humanPlayer.name} has ${newHumanHand.length} cards`);
          console.log(`[DEBUG] Cards to remove:`, cardsToSwap.map(c => `${c.rank}${c.suit}`));

          for (const cardToRemove of cardsToSwap) {
            const index = newHumanHand.findIndex(c => c.rank === cardToRemove.rank && c.suit === cardToRemove.suit);
            if (index !== -1) {
              newHumanHand.splice(index, 1);
            }
          }
          console.log(`[DEBUG] After removing ${cardsToSwap.length} cards - ${humanPlayer.name} has ${newHumanHand.length} cards`);

          for (let i = 0; i < prev.voteResult; i++) {
              if (newDeck.length > 0) newHumanHand.push(newDeck.pop()!);
          }
          console.log(`[DEBUG] After adding ${prev.voteResult} cards - ${humanPlayer.name} has ${newHumanHand.length} cards`);
          addCommentary(`${humanPlayer.name} completes the final swap.`);
          
          const newPlayers = prev.players.map((p, idx) => {
              if (idx === playerIndex) {
                  return { ...p, hand: newHumanHand };
              }
              if (!p.isHuman && !p.hasStoodPat) {
                  const hand = [...p.hand].sort((a,b)=> b.value - a.value);
                  const botCardsToSwap = hand.slice(0, prev.voteResult);
                  let newBotHand = [...p.hand];
                  for (const cardToRemove of botCardsToSwap) {
                    const index = newBotHand.findIndex(c => c.rank === cardToRemove.rank && c.suit === cardToRemove.suit);
                    if (index !== -1) {
                      newBotHand.splice(index, 1);
                    }
                  }
                  for(let i=0; i<prev.voteResult; i++) {
                      if (newDeck.length > 0) newBotHand.push(newDeck.pop()!);
                  }
                  return { ...p, hand: newBotHand };
              }
              return p;
          });
          
          addCommentary(`The deck is set. Let the game begin!`);
          addCommentary(`🎮 GAMEPLAY BEGINS! Time to play your cards! 🎮`);

          // Show the gameplay start indicator
          setShowGameplayStart(true);
          setTimeout(() => setShowGameplayStart(false), 4000); // Hide after 4 seconds

          return {
              ...prev,
              players: enforceFiveCardLimit(newPlayers),
              deck: newDeck,
              gamePhase: GamePhase.GAMEPLAY,
              currentPlayerIndex: prev.firstPlayerToAct,
              roundLeaderIndex: prev.firstPlayerToAct
          };
      });
      setSelectedCards([]);
      (handleFinalSwap as any)._inProgress = false;
  }
  
  const handlePlayCards = () => {
      if (selectedCards.length === 0) return;
      const playerIndex = gameState.currentPlayerIndex;

      // Basic validation
      const isValidPlay = validatePlay(selectedCards);
      if(!isValidPlay) {
        const leadHand = getCommanderCards(); // Use commander's cards for error messages
        if (leadHand.length > 0 && selectedCards.length > 0) {
          const canBeatLead = selectedCards[0].value >= leadHand[0].value;
          if (!canBeatLead) {
            addCommentary(`You must play your lowest cards when you can't beat ${leadHand[0].rank}${leadHand[0].suit}.`);
          } else {
            addCommentary("Invalid play. Try again.");
          }
        } else {
          addCommentary("Invalid play. Try again.");
        }
        return;
      }

      const newPlayers = [...gameState.players];
      const player = newPlayers[playerIndex];
      player.hand = player.hand.filter(c => !selectedCards.some(sc => sc.rank === c.rank && sc.suit === c.suit));
      
      // Update last played cards count for animation
      setLastPlayedCardsCount(prev => ({
        ...prev,
        [player.id]: player.playedCards.length
      }));
      
      player.playedCards.push(...selectedCards);

      const newTrickPlay: TrickPlay = {
        playerId: player.id,
        cards: selectedCards,
      };

      const newCurrentTrick = [...gameState.currentTrick, newTrickPlay];
      
      const isGameOver = player.hand.length === 0;

      if(isGameOver) {
          handleGameOver(player.id);
          return;
      }
      
      let newRoundWinnerId = gameState.roundWinnerId;
      const commanderCards = getCommanderCards();
      const isWinningPlay = commanderCards.length === 0 || selectedCards[0].value >= commanderCards[0].value;
      if (isWinningPlay) {
          newRoundWinnerId = player.id;
      }
      
      // Add commentary indicating if it's a sacrifice (compared to commander's cards)
      const isSacrifice = commanderCards.length > 0 && selectedCards[0].value < commanderCards[0].value;
      if (isSacrifice) {
          addCommentary(`${player.name} sacrifices ${selectedCards.map(c => `${c.rank}${c.suit}`).join(', ')} (cannot beat ${commanderCards[0].rank}${commanderCards[0].suit}).`);
      } else {
          addCommentary(`${player.name} plays ${selectedCards.map(c => `${c.rank}${c.suit}`).join(', ')}.`);
      }
      
      const nextPlayerIndex = (playerIndex + 1) % newPlayers.length;

      // Update state immediately to trigger animation
      console.log(`[ROUND DEBUG] nextPlayerIndex: ${nextPlayerIndex}, roundLeaderIndex: ${gameState.roundLeaderIndex}, players in trick: ${newCurrentTrick.length}`);
      if (nextPlayerIndex === gameState.roundLeaderIndex) {
          // Round is over - determine winner and set up for next round
          console.log(`[ROUND DEBUG] Round ending! Determining winner...`);
          const roundLeaderId = gameState.players[gameState.roundLeaderIndex].id;
          const winnerId = determineTrickWinner(newCurrentTrick, isWinningPlay ? selectedCards : gameState.lastPlayedHand, roundLeaderId);
          console.log(`[ROUND DEBUG] Round winner: ${winnerId}`);
          
          setGameState(prev => ({
              ...prev, 
              players: enforceFiveCardLimit(newPlayers),
              gamePhase: GamePhase.ROUND_OVER,
              lastPlayedHand: isWinningPlay ? selectedCards : prev.lastPlayedHand,
              currentTrick: newCurrentTrick,
              roundWinnerId: winnerId
            }));
            
          // Set timeout to start next round after animations complete
          setTimeout(() => startNextRound(winnerId), 5000); // Extended to 5 seconds for animations
      } else {
        setGameState(prev => ({
          ...prev, 
          players: enforceFiveCardLimit(newPlayers), 
          currentPlayerIndex: nextPlayerIndex,
          lastPlayedHand: isWinningPlay ? selectedCards : prev.lastPlayedHand,
          currentTrick: newCurrentTrick,
          roundWinnerId: newRoundWinnerId
        }));
      }
      
      setSelectedCards([]);
  }

  const handleBotPlay = () => {
    const playerIndex = gameState.currentPlayerIndex;
    const player = gameState.players[playerIndex];
    const hand = [...player.hand];
    
    // Use commander cards for consistent rule following
    const leadHand = getCommanderCards();
    const cardsToPlay = findBestPlayForBot(hand, leadHand);
    
    // Ensure cardsToPlay is always an array
    if (!cardsToPlay || cardsToPlay.length === 0) {
        console.error(`[ERROR] findBestPlayForBot returned invalid result:`, cardsToPlay);
        return;
    }
    
    // Simulate selection for UI effect if needed
    setSelectedCards(cardsToPlay);

    setTimeout(() => {
        const newPlayers = [...gameState.players];
        const botPlayer = newPlayers[playerIndex];
        botPlayer.hand = botPlayer.hand.filter(c => !cardsToPlay.some(sc => sc.rank === c.rank && sc.suit === c.suit));
        botPlayer.playedCards.push(...cardsToPlay);
        
        const newTrickPlay: TrickPlay = {
          playerId: botPlayer.id,
          cards: cardsToPlay,
        };

        const newCurrentTrick = [...gameState.currentTrick, newTrickPlay];
        
        const isGameOver = botPlayer.hand.length === 0;
        if (isGameOver) {
            handleGameOver(botPlayer.id);
            return;
        }

        let newRoundWinnerId = gameState.roundWinnerId;
        const isWinningPlay = gameState.lastPlayedHand.length === 0 || cardsToPlay[0].value >= gameState.lastPlayedHand[0].value;
        if (isWinningPlay) {
            newRoundWinnerId = botPlayer.id;
        }

        addCommentary(`${botPlayer.name} plays ${cardsToPlay.map(c => `${c.rank}${c.suit}`).join(', ')}.`);
        
        const nextPlayerIndex = (playerIndex + 1) % newPlayers.length;

        console.log(`[DEBUG] Bot ${botPlayer.name} played. Next player index: ${nextPlayerIndex}, Round leader index: ${gameState.roundLeaderIndex}, Players: ${newPlayers.map(p => p.name).join(', ')}`);

        // Update state immediately to trigger animation
        console.log(`[BOT ROUND DEBUG] nextPlayerIndex: ${nextPlayerIndex}, roundLeaderIndex: ${gameState.roundLeaderIndex}, players in trick: ${newCurrentTrick.length}`);
        if (nextPlayerIndex === gameState.roundLeaderIndex) {
            // Round is over - determine winner and set up for next round
            console.log(`[BOT ROUND DEBUG] Round ending! Determining winner...`);
            const roundLeaderId = gameState.players[gameState.roundLeaderIndex].id;
            const winnerId = determineTrickWinner(newCurrentTrick, isWinningPlay ? cardsToPlay : gameState.lastPlayedHand, roundLeaderId);
            console.log(`[BOT ROUND DEBUG] Round winner: ${winnerId}`);
            
            setGameState(prev => ({
              ...prev,
              players: enforceFiveCardLimit(newPlayers),
              gamePhase: GamePhase.ROUND_OVER,
              lastPlayedHand: isWinningPlay ? cardsToPlay : prev.lastPlayedHand,
              currentTrick: newCurrentTrick,
              roundWinnerId: winnerId,
            }));
            
            // Set timeout to start next round after animations complete
            setTimeout(() => startNextRound(winnerId), 5000); // Extended to 5 seconds for animations
        } else {
             setGameState(prev => ({
              ...prev,
              players: enforceFiveCardLimit(newPlayers),
              currentPlayerIndex: nextPlayerIndex,
              lastPlayedHand: isWinningPlay ? cardsToPlay : prev.lastPlayedHand,
              currentTrick: newCurrentTrick,
              roundWinnerId: newRoundWinnerId,
            }));
        }
       
        setSelectedCards([]);
    }, 1000);
  }

  // Helper function to get the commander's cards (original lead cards) from current trick
  const getCommanderCards = (): Card[] => {
    if (gameState.currentTrick.length === 0) {
      return []; // No trick in progress, so no commander cards yet
    }
    // The first play in the current trick are the commander's cards
    return gameState.currentTrick[0].cards;
  };

  const validatePlay = (cards: Card[]): boolean => {
    const player = gameState.players[gameState.currentPlayerIndex];
    const leadHand = getCommanderCards(); // Use commander's cards, not most recent cards

    console.log(`[VALIDATION] Player: ${player.name}`);
    console.log(`[VALIDATION] Lead Hand:`, leadHand.map(c => c.rank));
    console.log(`[VALIDATION] Player Hand:`, player.hand.map(c => c.rank));
    console.log(`[VALIDATION] Played Cards:`, cards.map(c => c.rank));

    if (cards.length === 0) {
      console.log("[VALIDATION] FAILED: No cards played.");
      return false;
    }

    if (leadHand.length === 0) {
        const isSameRank = cards.every(c => c.rank === cards[0].rank);
        if (!isSameRank) console.log("[VALIDATION] FAILED: Lead play must be of the same rank.");
        else console.log("[VALIDATION] PASSED: Valid lead play.");
        return isSameRank;
    }

    if (cards.length !== leadHand.length) {
      console.log(`[VALIDATION] FAILED: Must play ${leadHand.length} cards, but tried to play ${cards.length}.`);
      return false;
    }

    const handByRank: {[key: string]: Card[]} = {};
    player.hand.forEach(card => {
        if (!handByRank[card.rank]) handByRank[card.rank] = [];
        handByRank[card.rank].push(card);
    });

    const winningPlays = Object.values(handByRank).filter(group => 
        group.length >= leadHand.length && group[0].value > leadHand[0].value
    );
    
    // Also check for equal-value plays (matching the lead)
    const equalPlays = Object.values(handByRank).filter(group => 
        group.length >= leadHand.length && group[0].value === leadHand[0].value
    );
    console.log(`[VALIDATION] Found ${winningPlays.length} winning sets:`, winningPlays.map(g => g.map(c => c.rank)));

    // Determine if a "beat and sacrifice" play is possible
    const higherCards = player.hand.filter(c => c.value > leadHand[0].value);
    const canBeatAndSacrifice = higherCards.length > 0;
    console.log(`[VALIDATION] Can 'beat and sacrifice'? ${canBeatAndSacrifice}`);

    // Check if the played hand can beat or match the lead
    const highestPlayedCard = Math.max(...cards.map(c => c.value));
    const highestLeadCard = Math.max(...leadHand.map(c => c.value));
    const canBeatOrMatch = highestPlayedCard >= highestLeadCard;
    
    console.log(`[VALIDATION] Highest played card: ${highestPlayedCard}, Highest lead card: ${highestLeadCard}, Can beat or match: ${canBeatOrMatch}`);
    
    // ALWAYS allow equal-value plays (same value as lead)
    const isEqualPlay = cards[0].value === leadHand[0].value && cards.every(c => c.value === cards[0].value);
    if (isEqualPlay) {
        console.log("[VALIDATION] PASSED: Valid equal-value play (same value as lead).");
        return true;
    }
    
    if (canBeatOrMatch) {
        // Check if all played cards can beat the lead (normal beating play)
        const allCardsBeatLead = cards.every(c => c.value >= leadHand[0].value);
        
        if (allCardsBeatLead) {
            console.log("[VALIDATION] PASSED: All played cards beat or match the lead.");
            return true;
        }
        
        // Apply "beat/equal and sacrifice" rule if player has higher/equal cards but can't make a valid set
        if ((canBeatAndSacrifice || equalPlays.length > 0) && !winningPlays.length) {
            // Player must play a higher/equal card + lowest cards to match count
            const hasHigherCard = cards.some(c => c.value > leadHand[0].value);
            const hasEqualCard = cards.some(c => c.value === leadHand[0].value);
            const sortedHand = [...player.hand].sort((a,b) => a.value - b.value);
            const lowestCards = sortedHand.slice(0, leadHand.length - 1); // -1 because one card is the higher/equal card
            
            // Fixed: Allow any cards with the same VALUES as the lowest cards, not exact matches
            const lowestValues = lowestCards.map(c => c.value);
            const sacrificeCards = cards.filter(c => c.value <= leadHand[0].value);
            const hasLowestCards = sacrificeCards.every(card => lowestValues.includes(card.value));
            
            const playType = hasHigherCard ? "Beat & sacrifice" : "Equal & sacrifice";
            console.log(`[VALIDATION] ${playType} - lowest values required: [${lowestValues.join(', ')}], sacrifice cards played: [${sacrificeCards.map(c => c.value).join(', ')}]`);
            
            if ((hasHigherCard || hasEqualCard) && hasLowestCards) {
                console.log(`[VALIDATION] PASSED: Valid '${playType}' play.`);
                return true;
            } else {
                console.log(`[VALIDATION] FAILED: Invalid '${playType}' - must play higher/equal card + lowest cards.`);
                return false;
            }
        }
        
        console.log("[VALIDATION] PASSED: Player made a valid play that beats or matches the lead.");
        return true;
    }

    // A player MUST beat the hand if they are able to.
    if (winningPlays.length > 0 || canBeatAndSacrifice) {
        console.log("[VALIDATION] FAILED: Player had a winning move but played something else.");
        return false;
    } else if (equalPlays.length > 0) {
        // Player has equal-value plays available but didn't play equal cards
        // Check if the played cards can beat or match the lead
        const highestPlayedCard = Math.max(...cards.map(c => c.value));
        const highestLeadCard = Math.max(...leadHand.map(c => c.value));
        const canBeatOrMatch = highestPlayedCard >= highestLeadCard;
        
        if (canBeatOrMatch) {
            console.log("[VALIDATION] PASSED: Valid play that beats or matches the lead.");
            return true;
        }
        
        // If player has equal plays but played lower cards, it's a valid sacrifice
        const isSacrifice = highestPlayedCard < highestLeadCard;
        if (isSacrifice) {
            console.log("[VALIDATION] PASSED: Valid sacrifice play.");
            return true;
        }
        
        console.log("[VALIDATION] FAILED: Invalid play.");
        return false;
    } else {
        // No winning or equal moves available, check if the play is a valid sacrifice
        const highestPlayedCard = Math.max(...cards.map(c => c.value));
        const highestLeadCard = Math.max(...leadHand.map(c => c.value));
        const isSacrifice = highestPlayedCard < highestLeadCard;
        
        console.log(`[VALIDATION] No winning or equal moves available. Play is sacrifice: ${isSacrifice}`);
        if (isSacrifice) {
            console.log("[VALIDATION] PASSED: Valid sacrifice play.");
            return true;
        }
    }

    // If no winning moves are possible, player must sacrifice their lowest cards.
    console.log("[VALIDATION] Player must sacrifice lowest cards.");
    const sortedHand = [...player.hand].sort((a,b) => a.value - b.value);
    const lowestCards = sortedHand.slice(0, leadHand.length);
    
    // Fixed: Allow any cards with the same VALUES as the lowest cards, not exact matches
    const lowestValues = lowestCards.map(c => c.value);
    const isLowestCards = cards.every(card => lowestValues.includes(card.value));
    
    console.log(`[VALIDATION] Lowest values required: [${lowestValues.join(', ')}], played values: [${cards.map(c => c.value).join(', ')}]`);
    
    if (!isLowestCards) console.log("[VALIDATION] FAILED: Did not play lowest cards for sacrifice.");
    else console.log("[VALIDATION] PASSED: Correctly sacrificed lowest cards.");
    return isLowestCards;
  }
  
  // Helper function to evaluate hand quality for strategic bot decisions
  const evaluateHandQuality = (hand: Card[]): number => {
    if (!hand || hand.length === 0) return 0;
    
    // Count pairs, triples, quads (key for Gurch)
    const rankCounts: {[key: string]: number} = {};
    hand.forEach(card => {
      rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
    });
    
    let score = 0;
    const counts = Object.values(rankCounts);
    
    // High value for multiple cards of same rank (key for winning rounds)
    counts.forEach(count => {
      if (count >= 2) score += count * 3; // Pairs/sets are very valuable
    });
    
    // Bonus for having low cards (good for going out)
    const lowCards = hand.filter(c => c.value <= 5).length;
    score += lowCards * 2;
    
    // Bonus for having high cards (good for winning rounds)
    const highCards = hand.filter(c => c.value >= 11).length;
    score += highCards * 1.5;
    
    // Penalty for scattered ranks (hard to make sets)
    const uniqueRanks = Object.keys(rankCounts).length;
    if (uniqueRanks === hand.length) score -= 3; // All different ranks
    
    return score;
  };

  // Strategic function to select worst cards for swapping
  const selectWorstCardsForSwap = (hand: Card[], count: number): Card[] => {
    if (!hand || hand.length === 0 || count <= 0) return [];
    
    // Score each card based on how much it contributes to hand quality
    const cardScores = hand.map(card => {
      // Simulate removing this card and see impact on hand quality
      const remainingHand = hand.filter(c => c.rank !== card.rank || c.suit !== card.suit);
      const qualityAfterRemoval = evaluateHandQuality(remainingHand);
      
      // Factor in isolation (cards without pairs are better to discard)
      const hasMatching = hand.filter(c => c.rank === card.rank).length > 1;
      const isolationBonus = hasMatching ? 0 : 3; // Bonus for discarding isolated cards
      
      // High cards are sometimes good to keep (for winning) but also risky
      const valueConsideration = card.value > 10 ? -1 : 1; // Slight preference to keep high cards
      
      return {
        card,
        discardScore: qualityAfterRemoval + isolationBonus + valueConsideration
      };
    });
    
    // Sort by discard score (higher score = better to discard)
    cardScores.sort((a, b) => b.discardScore - a.discardScore);
    
    // Return the worst cards up to the count needed
    return cardScores.slice(0, Math.min(count, cardScores.length)).map(item => item.card);
  };

  const findBestPlayForBot = (hand: Card[], leadHand: Card[]): Card[] => {
    // Safety check: ensure we have cards to play
    if (!hand || hand.length === 0) {
        console.error(`[ERROR] findBestPlayForBot: hand is empty or undefined`);
        return [];
    }
    
    const handByRank: {[key in Rank]?: Card[]} = {};
    hand.forEach(card => {
        if (!handByRank[card.rank]) {
            handByRank[card.rank] = [];
        }
        handByRank[card.rank]!.push(card);
    });

    if (leadHand.length === 0) { // Bot is leading
        const sortedGroups = Object.values(handByRank).sort((a, b) => {
            if (a.length !== b.length) return b.length - a.length;
            return b[0].value - a[0].value;
        });
        return sortedGroups[0];
    }

    const leadValue = leadHand[0].value;
    const leadCount = leadHand.length;

    // 1. Check for a winning play (higher pair/triple etc.)
    const winningPlays = Object.values(handByRank).filter(group => 
        group.length >= leadCount && group[0].value >= leadValue
    ).map(group => group.slice(0, leadCount));

    // Check for "beat and sacrifice" or "equal and sacrifice"
    let beatAndSacrificePlay: Card[] | null = null;
    let equalAndSacrificePlay: Card[] | null = null;
    
    // Higher card + sacrifice
    const higherCards = hand.filter(c => c.value > leadValue);
    if (higherCards.length > 0) {
        const lowestBeatingCard = higherCards.sort((a,b) => a.value - b.value)[0];
        const restOfHand = hand.filter(c => c.rank !== lowestBeatingCard.rank || c.suit !== lowestBeatingCard.suit);
        const lowestCards = restOfHand.sort((a,b) => a.value - b.value).slice(0, leadCount - 1);
        beatAndSacrificePlay = [lowestBeatingCard, ...lowestCards];
    }
    
    // Equal card + sacrifice (if no winning sets available)
    const equalCards = hand.filter(c => c.value === leadValue);
    if (equalCards.length > 0 && winningPlays.length === 0) {
        const equalCard = equalCards[0]; // Use first equal card
        const restOfHand = hand.filter(c => c.rank !== equalCard.rank || c.suit !== equalCard.suit);
        const lowestCards = restOfHand.sort((a,b) => a.value - b.value).slice(0, leadCount - 1);
        equalAndSacrificePlay = [equalCard, ...lowestCards];
    }
    
    // ENHANCED Bot Strategy:
    // 1. If winning sets are available, play strategically
    // EXCEPTION: If bot has only one card left, play it immediately to go out!
    if (winningPlays.length > 0) {
        if (hand.length === 1) {
            // Bot has only one card - play it to go out immediately!
            return hand;
        }
        
        // Strategic choice: if multiple winning options, consider which preserves better hand
        if (winningPlays.length > 1) {
            // Prefer plays that keep pairs/sets in hand for future rounds
            winningPlays.sort((a, b) => {
                const remainingAfterA = hand.filter(c => !a.some(ac => ac.rank === c.rank && ac.suit === c.suit));
                const remainingAfterB = hand.filter(c => !b.some(bc => bc.rank === c.rank && bc.suit === c.suit));
                const qualityAfterA = evaluateHandQuality(remainingAfterA);
                const qualityAfterB = evaluateHandQuality(remainingAfterB);
                return qualityAfterB - qualityAfterA; // Prefer play that leaves better hand
            });
            return winningPlays[0];
        }
        
        // Single winning option - play it
        winningPlays.sort((a,b) => a[0].value - b[0].value);
        return winningPlays[0];
    }

    // 2. If no winning set but can "beat and sacrifice" or "equal and sacrifice", choose best option
    if (beatAndSacrificePlay && equalAndSacrificePlay) {
        // Both options available - prefer beat and sacrifice (more aggressive)
        return beatAndSacrificePlay;
    } else if (beatAndSacrificePlay) {
        return beatAndSacrificePlay;
    } else if (equalAndSacrificePlay) {
        return equalAndSacrificePlay;
    }

    // 3. Otherwise, sacrifice the lowest cards.
    // EXCEPTION: If bot has only one card left, play it immediately to go out!
    if (hand.length === 1) {
        // Bot has only one card - play it to go out immediately!
        return hand;
    }
    
    const sortedHand = [...hand].sort((a,b) => a.value - b.value);
    const cardsToReturn = sortedHand.slice(0, leadCount);
    
    // Safety check: ensure we always return at least one card if hand is not empty
    if (cardsToReturn.length === 0 && hand.length > 0) {
        console.warn(`[WARNING] findBestPlayForBot: leadCount=${leadCount}, hand.length=${hand.length}, returning first card as fallback`);
        return [sortedHand[0]];
    }
    
    return cardsToReturn;
  }


  const handleBotSelectCardForOneSwap = () => {
    const player = gameState.players[gameState.currentPlayerIndex];
    const hand = player.hand;
    
    // Strategic card selection: find the card that least contributes to hand quality
    let worstCard = hand[0];
    let worstScore = Infinity;
    
    hand.forEach(card => {
      // Simulate removing this card and see how it affects hand quality
      const remainingHand = hand.filter(c => c.rank !== card.rank || c.suit !== card.suit);
      const qualityAfterRemoval = evaluateHandQuality(remainingHand);
      
      // Also consider if this card is isolated (no pairs)
      const hasMatching = hand.filter(c => c.rank === card.rank).length > 1;
      const isolationPenalty = hasMatching ? 0 : 2; // Prefer removing isolated cards
      
      const score = qualityAfterRemoval - isolationPenalty;
      
      if (score > worstScore || (score === worstScore && card.value > worstCard.value)) {
        worstScore = score;
        worstCard = card;
      }
    });
    
    addCommentary(`${player.name} strategically swaps their ${worstCard.rank}.`);
    handleSelectCardForOneSwap(worstCard);
  };

  const handleBotOneCardSwapDecision = () => {
    const player = gameState.players[gameState.currentPlayerIndex];
    const hand = [...player.hand].sort((a,b) => a.value - b.value);
    const highestCard = hand[hand.length - 1];
    const revealedCard = gameState.revealedCard!;

    // Bot strategy: Keep the revealed card if it's better than its worst card.
    // Note: A lower value is better in this game.
    if (revealedCard.value < highestCard.value) {
        // Bot decides to 'keep'
        addCommentary(`${player.name} decides to keep the revealed card.`);
        handleFinalOneCardSwap('keep');
    } else {
        // Bot decides to 'discard'
        addCommentary(`${player.name} rejects the revealed card, hoping for better.`);
        handleFinalOneCardSwap('discard');
    }
  };

  const handleSelectCardForOneSwap = (card: Card) => {
    setGameState(prev => {
        const newDeck = [...prev.deck];
        const revealedCard = newDeck.pop()!;
        addCommentary(`${prev.players[prev.currentPlayerIndex].name} considers swapping ${card.rank}. A card is revealed!`);
        return {
            ...prev,
            deck: newDeck,
            gamePhase: GamePhase.FINAL_SWAP_ONE_CARD_REVEAL_AND_DECIDE,
            cardToSwap: card,
            revealedCard: revealedCard
        };
    });
  };

  const handleFinalOneCardSwap = (choice: 'keep' | 'discard') => {
    const playerIndex = gameState.currentPlayerIndex;
    const player = gameState.players[playerIndex];
    const cardToDiscard = gameState.cardToSwap;
    
    if (!cardToDiscard) {
        console.error("handleFinalOneCardSwap called without cardToSwap being set.");
        return;
    }

    setGameState(prev => {
      const newPlayers = [...prev.players];
      const newDeck = [...prev.deck];
      let newHand = [...player.hand];

      // Remove the card to discard
      const discardIndex = newHand.findIndex(c => c.rank === cardToDiscard.rank && c.suit === cardToDiscard.suit);
      if (discardIndex !== -1) newHand.splice(discardIndex, 1);

      if (choice === 'keep') {
        newHand.push(prev.revealedCard!);
        addCommentary(`${player.name} keeps the ${prev.revealedCard!.rank} and discards a card.`);
      } else { // 'discard'
        const newHiddenCard = newDeck.pop()!;
        newHand.push(newHiddenCard);
        addCommentary(`${player.name} discards the ${prev.revealedCard!.rank} and takes the next card from the deck.`);
      }
      
      newPlayers[playerIndex] = { ...player, hand: newHand };

      // Find the next player who needs to swap
      let nextPlayerIndex = -1;
      for (let i = 1; i < newPlayers.length; i++) {
        const potentialNextIndex = (playerIndex + i) % newPlayers.length;
        if (!newPlayers[potentialNextIndex].hasStoodPat) {
            nextPlayerIndex = potentialNextIndex;
            break;
        }
      }

      if (nextPlayerIndex === -1 || nextPlayerIndex === prev.firstPlayerToAct) {
        // All players have completed the 1-card swap
        addCommentary(`The final swap is complete. Let the game begin!`);
        return {
          ...prev,
          players: enforceFiveCardLimit(newPlayers),
          deck: newDeck,
          gamePhase: GamePhase.GAMEPLAY,
          currentPlayerIndex: prev.firstPlayerToAct,
          roundLeaderIndex: prev.firstPlayerToAct,
          revealedCard: undefined,
          cardToSwap: undefined,
        }
      } else {
        // Move to the next player's decision
        addCommentary(`${newPlayers[nextPlayerIndex].name} is now up for the 1-card swap.`);
        return {
          ...prev,
          players: newPlayers,
          deck: newDeck,
          currentPlayerIndex: nextPlayerIndex,
          gamePhase: GamePhase.FINAL_SWAP_ONE_CARD_SELECT,
          revealedCard: undefined,
          cardToSwap: undefined,
        }
      }
    });

    setSelectedCards([]);
  };

  const startNextRound = (winnerId: string) => {
      // Start card clearing animation
      setShowCardClearAnimation(true);
      
      // Get winner position for stick animation
      setGameState(prev => {
          const winnerIndex = prev.players.findIndex(p => p.id === winnerId);
          console.log(`[STICK] Winner ID: ${winnerId}, Winner Index: ${winnerIndex}`);
          if (winnerIndex !== -1) {
              const winnerPosition = playerPositions[winnerIndex];
              console.log(`[STICK] Winner Position:`, winnerPosition);
              if (winnerPosition) {
                  // Calculate stick destination based on player position
                  let stickX = window.innerWidth / 2;
                  let stickY = window.innerHeight / 2;
                  
                  // Position stick close to actual player positions
                  const centerX = window.innerWidth / 2;
                  const centerY = window.innerHeight / 2;
                  
                  if (winnerPosition.class.includes('top-')) {
                      stickX = centerX;
                      stickY = centerY - 200; // Above center, closer to top players
                      console.log(`[STICK] Top position: ${stickX}, ${stickY}`);
                  } else if (winnerPosition.class.includes('left-')) {
                      stickX = 150; // Much closer to left edge where Bot 2 actually is
                      stickY = centerY - 50; // Slightly above center
                      console.log(`[STICK] Left position: ${stickX}, ${stickY}`);
                  } else if (winnerPosition.class.includes('right-')) {
                      stickX = centerX + 200; // Right of center (revert to working version)
                      stickY = centerY;
                      console.log(`[STICK] Right position: ${stickX}, ${stickY}`);
                  } else if (winnerPosition.class.includes('bottom-')) {
                      stickX = centerX;
                      stickY = centerY + 200; // Below center, closer to human player
                      console.log(`[STICK] Bottom position: ${stickX}, ${stickY}`);
                  } else {
                      console.log(`[STICK] No matching position class: ${winnerPosition.class}`);
                  }
                  
                  console.log(`[STICK] Final position: ${stickX}, ${stickY}`);
                  // Animate stick to winner
                  setStickPosition({ x: stickX, y: stickY });
                  setStickAnimating(true);
                  
                  // Stop stick animation after 2 seconds
                  setTimeout(() => setStickAnimating(false), 2000);
              } else {
                  console.log(`[STICK] No position found for winner index ${winnerIndex}`);
              }
          } else {
              console.log(`[STICK] Winner not found in players list`);
          }
          
          return prev;
      });
      
      // Clear cards after animation and proceed with round logic
      setTimeout(() => {
          setShowCardClearAnimation(false);
          
      setGameState(prev => {
          // Check if any players still have cards
          const playersWithCards = prev.players.filter(p => p.hand.length > 0);
          
          console.log(`[DEBUG] startNextRound: Players with cards: ${playersWithCards.map(p => `${p.name}(${p.hand.length})`).join(', ')}`);
          
          if (playersWithCards.length === 0) {
              // No players have cards left, game is over
              handleGameOver(winnerId);
              return prev;
          }
          
          if (playersWithCards.length === 1) {
              // Only one player has cards left, they win
              const winner = playersWithCards[0];
              addCommentary(`${winner.name} wins! All other players are out of cards.`);
              handleGameOver(winner.id);
              return prev;
          }

          const winnerIndex = prev.players.findIndex(p => p.id === winnerId);
          const nextLeaderIndex = winnerIndex !== -1 ? winnerIndex : prev.roundLeaderIndex;

          addCommentary(`${prev.players[nextLeaderIndex].name} won the last round and will start.`);
          
          // Starting new round
          console.log(`[DEBUG] Starting new round. Winner: ${prev.players[nextLeaderIndex].name}`);
              
              // Clear all played cards and reset for next round
              const playersWithClearedCards = prev.players.map(player => ({
                  ...player,
                  playedCards: [] // Clear all played cards
              }));
          
          return {
              ...prev,
                  players: playersWithClearedCards,
              gamePhase: GamePhase.GAMEPLAY,
              currentPlayerIndex: nextLeaderIndex,
              roundLeaderIndex: nextLeaderIndex,
              cardsOnTable: [],
              lastPlayedHand: [],
              currentTrick: [],
              lastRoundWinnerId: winnerId,
              roundWinnerId: undefined
          };
      });
          
          // Reset last played cards count for animations
          setLastPlayedCardsCount({});
      }, 1500); // Cards clear after 1.5 seconds
  }

  const handleGameOver = (playerWhoWentOutId: string) => {
    const playerWhoWentOut = gameState.players.find(p => p.id === playerWhoWentOutId);
    if (!playerWhoWentOut) return;
  
    const lastTrick = gameState.currentTrick;
    const scores: { [playerId: string]: number } = {};
  
    lastTrick.forEach(play => {
      scores[play.playerId] = play.cards.reduce((acc, card) => acc + card.value, 0);
    });
  
    // Handle players who didn't play in the last round (if any)
    gameState.players.forEach(p => {
      if (!scores[p.id]) {
        scores[p.id] = p.hand.reduce((acc, card) => acc + card.value, 0) + (lastTrick.length > 0 ? 100 : 0); // Penalize non-players
      }
    });
  
    // Rule: The player who went out with the LOWEST total card value wins
    const allScores = Object.entries(scores);
    const minScore = Math.min(...allScores.map(([, score]) => score));
    const maxScore = Math.max(...allScores.map(([, score]) => score));
  
    const tiedWinners = allScores.filter(([, score]) => score === minScore).map(([id]) => id);
    const tiedLosers = allScores.filter(([, score]) => score === maxScore).map(([id]) => id);
  
    if (tiedWinners.length > 1) {
      addCommentary(`A minigame will decide the winner between ${tiedWinners.join(', ')}!`);
      startMinigame(tiedWinners);
      return;
    }
  
    if (tiedLosers.length > 1) {
      addCommentary(`A minigame will decide the loser between ${tiedLosers.join(', ')}!`);
      startMinigame(tiedLosers);
      return;
    }
  
    const actualWinnerId = tiedWinners[0];
    const actualLoserId = tiedLosers[0];
    const actualWinner = gameState.players.find(p => p.id === actualWinnerId);
    const actualLoser = gameState.players.find(p => p.id === actualLoserId);
    
    addCommentary(`Game Over! ${actualWinner?.name} wins with the lowest total (${minScore})! ${actualLoser?.name} had the highest cards in the final round (${maxScore}), awarding ${maxScore} points to ${actualWinner?.name}.`);
  
    const newPlayers = gameState.players.map(p => {
      if (p.id === actualWinnerId) {
        return { ...p, score: p.score + maxScore };
      }
      return p;
    });
  
    setGameState(prev => ({
      ...prev, 
      players: newPlayers,
      gamePhase: GamePhase.GAME_OVER, 
      gameWinnerId: actualWinnerId, 
      gameLoserId: actualLoserId
    }));
  };

  const startMinigame = (playerIds: string[]) => {
    addCommentary("A tie! It's time for a MINIGAME!");
    setGameState(prev => {
      const deck = shuffleDeck(createDeck());
      const newPlayers = prev.players.map(p => {
        if (playerIds.includes(p.id)) {
          return { ...p, hand: deck.splice(0, 3) };
        }
        return { ...p, hand: [] }; // Others out of the game
      });

      return {
        ...prev,
        players: newPlayers,
        deck,
        gamePhase: GamePhase.MINIGAME_SWAP,
        currentPlayerIndex: prev.players.findIndex(p => p.id === playerIds[0]),
        roundLeaderIndex: prev.players.findIndex(p => p.id === playerIds[0]),
        lastPlayedHand: [],
        currentTrick: [],
        minigamePlayers: playerIds,
      };
    });
  };

  const handleMinigameSwap = (wantsToSwap: boolean) => {
    const playerIndex = gameState.currentPlayerIndex;
    const player = gameState.players[playerIndex];
    addCommentary(`${player.name} decides ${wantsToSwap ? 'to swap' : 'not to swap'} their minigame hand.`);

    setGameState(prev => {
      let newPlayers = [...prev.players];
      let newDeck = [...prev.deck];

      if (wantsToSwap) {
        const newHand = newDeck.splice(0, 3);
        newPlayers[playerIndex] = { ...newPlayers[playerIndex], hand: newHand };
      }

      const nextPlayerIndex = (playerIndex + 1) % prev.players.length;
      const nextMinigamePlayer = prev.players[nextPlayerIndex];

      // If we've circled back to the start of the minigame players
      if (nextMinigamePlayer.id === prev.minigamePlayers![0]) {
        return {
          ...prev,
          players: newPlayers,
          deck: newDeck,
          gamePhase: GamePhase.MINIGAME,
        }
      }

      return {
        ...prev,
        players: newPlayers,
        deck: newDeck,
        currentPlayerIndex: nextPlayerIndex,
      };
    });
  };

  const handleFloatingPlayClick = () => {
    setShowFloatingPlayButton(false);
    handlePlayCards();
  };

  const onCardClick = (card: Card) => {
    // Prevent duplicate clicks within 100ms
    const cardKey = `${card.rank}${card.suit}`;
    const now = Date.now();
    if (lastCardClick.current && 
        lastCardClick.current.card === cardKey && 
        now - lastCardClick.current.timestamp < 100) {
      return;
    }
    lastCardClick.current = { card: cardKey, timestamp: now };

    setSelectedCards(prev => {
      const isAlreadySelected = prev.some(
        c => c.rank === card.rank && c.suit === card.suit
      );

      // 1. Handle deselection
      if (isAlreadySelected) {
        console.log(`[DEBUG] Deselecting card: ${card.rank}${card.suit}`);
        const newSelection = prev.filter(c => !(c.rank === card.rank && c.suit === card.suit));
        
        // Hide floating play button if no cards are selected during gameplay
        if (gameState.gamePhase === GamePhase.GAMEPLAY && newSelection.length === 0) {
          setShowFloatingPlayButton(false);
        }
        
        return newSelection;
      }

      // 2. Handle selection based on game phase
      const currentPhase = gameState.gamePhase;

      if (currentPhase === GamePhase.FINAL_SWAP_ONE_CARD_SELECT && isAlreadySelected) {
        return prev.filter(c => !(c.rank === card.rank && c.suit === card.suit));
      }
      
      if(currentPhase === GamePhase.FINAL_SWAP_ONE_CARD_SELECT) {
        console.log(`[DEBUG] Player selected ${card.rank}${card.suit} to swap.`);
        handleSelectCardForOneSwap(card);
        return [card]; // Visually select just this card
      }

      const isSwapPhase = 
        currentPhase === GamePhase.FIRST_SWAP_ACTION ||
        currentPhase === GamePhase.OTHERS_SWAP_ACTION ||
        currentPhase === GamePhase.FINAL_SWAP_ACTION;

      if (isSwapPhase) {
        console.log(`[DEBUG] Selecting card for swap: ${card.rank}${card.suit}`);
        return [...prev, card];
      }

      const isTurn = gameState.players[gameState.currentPlayerIndex]?.isHuman;
      const isActionPhase = 
        gameState.gamePhase === GamePhase.FIRST_SWAP_ACTION || 
        gameState.gamePhase === GamePhase.OTHERS_SWAP_ACTION ||
        gameState.gamePhase === GamePhase.FINAL_SWAP_ACTION ||
        gameState.gamePhase === GamePhase.GAMEPLAY;

      if (isTurn && isActionPhase) {
        const humanPlayer = gameState.players.find(p => p.isHuman);
        if (!humanPlayer) return prev;
        const leadHand = getCommanderCards(); // Use commander's cards, not most recent cards

        if (leadHand.length > 0) { // Player is following
            const newSelection = [...prev, card];
            
            // Check if we have enough cards to play
            if (newSelection.length > leadHand.length) {
                return prev; // Don't allow selecting more cards than needed
            }
            
            // Check if the current selection can beat or match the lead
            const highestPlayedCard = Math.max(...newSelection.map(c => c.value));
            const highestLeadCard = Math.max(...leadHand.map(c => c.value));
            const canBeatOrMatchLead = highestPlayedCard >= highestLeadCard;
            
            // Check if player has any cards that can beat the lead
            const higherCards = humanPlayer.hand.filter(c => c.value > highestLeadCard);
            const equalCards = humanPlayer.hand.filter(c => c.value === highestLeadCard);
            const hasWinningCards = higherCards.length > 0;
            const hasEqualCards = equalCards.length > 0;
            
            // Check if it's a valid equal-rank play (complete set)
            const isEqualPlay = highestPlayedCard === highestLeadCard && 
                               newSelection.every(c => c.value === newSelection[0].value);
            
            // Check if this could be an "equal and sacrifice" play
            const hasEqualCardInSelection = newSelection.some(c => c.value === highestLeadCard);
            const sortedHand = [...humanPlayer.hand].sort((a, b) => a.value - b.value);
            const lowestCards = sortedHand.slice(0, leadHand.length);
            const isSelectingLowestOrEqual = lowestCards.some(c => c.rank === card.rank && c.suit === card.suit) || 
                                           card.value === highestLeadCard;
            
            if (hasWinningCards && !canBeatOrMatchLead && !isEqualPlay && !hasEqualCardInSelection) {
                // Player has cards that can beat the lead, but current selection doesn't beat, match, or equal
                addCommentary(`You must play cards that can beat or match the ${leadHand[0].rank}s.`);
                return prev;
            }
            
            // If player can't beat the lead but has equal cards, allow equal + sacrifice
            if (!hasWinningCards && hasEqualCards) {
                if (!isSelectingLowestOrEqual) {
                    addCommentary(`You can play equal cards (${leadHand[0].rank}) plus your lowest cards, or sacrifice lowest cards.`);
                    return prev;
                }
            }
            
            // If player can't beat or equal the lead, they must sacrifice their lowest cards
            if (!hasWinningCards && !hasEqualCards) {
                const isLowest = lowestCards.some(c => c.rank === card.rank && c.suit === card.suit);
                if (!isLowest) {
                    addCommentary(`You can't beat the hand, you must sacrifice your lowest cards.`);
                    return prev;
                }
            }
        } else { // Player is leading
            if (prev.length > 0 && prev[0].rank !== card.rank) {
                return [card];
            }
        }
        
        console.log(`[DEBUG] Selecting card for gameplay: ${card.rank}${card.suit}`);
        const newSelection = [...prev, card];
        
        // Show floating play button when cards are selected during gameplay
        if (gameState.gamePhase === GamePhase.GAMEPLAY) {
          setShowFloatingPlayButton(true);
          // Set button position to current mouse position when first card is selected
          if (prev.length === 0) {
            setButtonPosition({ x: mousePosition.x, y: mousePosition.y });
          }
        }
        
        return newSelection;
      }

      // If not a recognized phase for card selection, do nothing.
      return prev;
    });
  };

  const getPlayerPositions = () => {
    const positions = [
      { class: 'top-2 sm:top-4', style: { left: '50%', transform: 'translateX(-50%)' } }, // Top
      { class: 'right-2 sm:right-4', style: { top: '50%', right: '10px', transform: 'translateY(-50%)' } }, // Right - fixed positioning
      { class: 'bottom-2 sm:bottom-4', style: { left: '50%', transform: 'translateX(-50%)' } }, // Bottom (Human) - closer to cards
      { class: 'left-2 sm:left-4', style: { top: '50%', left: '10px', transform: 'translateY(-50%)' } } // Left - fixed positioning
    ];
    const humanIndex = gameState.players.findIndex(p => p.isHuman);
    if (humanIndex === -1) return positions.slice(0, gameState.players.length);

    const reorderedPositions = [];
    
    if (gameState.players.length === 3) {
        // 3-player case: Human at bottom, other players at left and right
    for(let i=0; i < gameState.players.length; i++) {
        const playerIndex = (humanIndex + i) % gameState.players.length;
        if (playerIndex === humanIndex) {
                reorderedPositions[playerIndex] = positions[2]; // Bottom (Human)
            } else if (i === 1) { // Player to the right of human
                reorderedPositions[playerIndex] = positions[1]; // Right
            } else if (i === 2) { // Player to the left of human
                reorderedPositions[playerIndex] = positions[3]; // Left
            }
        }
    } else {
        // 4-player case: Human at bottom, others at top, left, right
        for(let i=0; i < gameState.players.length; i++) {
            const playerIndex = (humanIndex + i) % gameState.players.length;
            if (playerIndex === humanIndex) {
                reorderedPositions[playerIndex] = positions[2]; // Bottom (Human)
        } else if (i === 1) { // Player to the left of human
                reorderedPositions[playerIndex] = positions[3]; // Left
        } else if (i === 2) { // Player across from human
                reorderedPositions[playerIndex] = positions[0]; // Top
        } else { // Player to the right of human
                reorderedPositions[playerIndex] = positions[1]; // Right
            }
        }
    }
    return reorderedPositions;
  }
  
  const playerPositions = getPlayerPositions();
  

  // Helper function to get phase display name
  const getPhaseDisplayName = (phase: GamePhase): string => {
    switch (phase) {
      case GamePhase.DEALING: return "Dealing Cards";
      case GamePhase.FIRST_SWAP_DECISION: return "First Swap Decision";
      case GamePhase.FIRST_SWAP_ACTION: return "Select Cards to Swap";
      case GamePhase.FIRST_SWAP_OTHERS_DECISION: return "Other Players Decide";
      case GamePhase.OTHERS_SWAP_DECISION: return "Other Players Swap";
      case GamePhase.OTHERS_SWAP_ACTION: return "Other Players Selecting";
      case GamePhase.VOTE_SWAP_DECISION: return "Vote on Final Swap";
      case GamePhase.VOTE_SWAP: return "Voting in Progress";
      case GamePhase.VOTE_RESULT: return "Vote Results";
      case GamePhase.FINAL_SWAP_DECISION: return "Final Swap Decision";
      case GamePhase.FINAL_SWAP_ACTION: return "Final Card Selection";
      case GamePhase.FINAL_SWAP_ONE_CARD_SELECT: return "Select Card to Swap";
      case GamePhase.FINAL_SWAP_ONE_CARD_REVEAL_AND_DECIDE: return "Revealed Card Decision";
      case GamePhase.GAMEPLAY: return "Playing Cards";
      case GamePhase.ROUND_OVER: return "Round Complete";
      case GamePhase.GAME_OVER: return "Game Over";
      case GamePhase.MINIGAME: return "Tie-Breaker Minigame";
      case GamePhase.MINIGAME_SWAP: return "Minigame Swap";
      default: return "Game in Progress";
    }
  };

  // Helper function to get current player name
  const getCurrentPlayerName = (): string => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return currentPlayer ? currentPlayer.name : "Unknown";
  };

  // Helper function to check if it's human player's turn
  const isHumanTurn = (): boolean => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return currentPlayer ? currentPlayer.isHuman : false;
  };




  const handleConfirmSwap = (cards: Card[]) => {
      setGameState(prev => {
          const playerIndex = prev.currentPlayerIndex;
          const player = prev.players[playerIndex];
          const amount = cards.length;
          const newDeck = [...prev.deck];
          
          let newHand = player.hand.filter(c => !cards.some(sc => sc.rank === c.rank && sc.suit === c.suit));
          for(let i = 0; i < amount; i++) {
              if (newDeck.length > 0) newHand.push(newDeck.pop()!);
          }

          const newPlayers = prev.players.map((p, idx) => idx === playerIndex ? { ...p, hand: newHand } : p);
          addCommentary(`${player.name} swaps ${amount} card(s).`);

          let nextPlayerIndex = (playerIndex + 1) % newPlayers.length;
          // Find next player who hasn't stood pat
          for (let i = 0; i < newPlayers.length; i++) {
              if (!newPlayers[nextPlayerIndex].hasStoodPat) break;
              nextPlayerIndex = (nextPlayerIndex + 1) % newPlayers.length;
          }

          if (prev.gamePhase === GamePhase.FIRST_SWAP_ACTION) {
              return {
                  ...prev, players: newPlayers, deck: newDeck,
                  gamePhase: GamePhase.OTHERS_SWAP_DECISION,
                  currentPlayerIndex: nextPlayerIndex,
                  swapAmount: amount,
              };
          }

          // This logic is for OTHERS_SWAP_ACTION
          if (nextPlayerIndex === prev.firstPlayerToAct) {
              const firstVoterIndex = newPlayers.findIndex(p => !p.hasStoodPat);
              if (firstVoterIndex === -1) {
                  return { ...prev, players: newPlayers, deck: newDeck, gamePhase: GamePhase.GAMEPLAY, currentPlayerIndex: prev.firstPlayerToAct, roundLeaderIndex: prev.firstPlayerToAct };
              }
              return { ...prev, players: newPlayers, deck: newDeck, gamePhase: GamePhase.VOTE_SWAP_DECISION, currentPlayerIndex: firstVoterIndex };
          }

          return {
              ...prev, players: newPlayers, deck: newDeck,
              gamePhase: GamePhase.OTHERS_SWAP_DECISION,
              currentPlayerIndex: nextPlayerIndex,
          };
      });
      setSelectedCards([]);
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const humanPlayer = gameState.players.find(p => p.isHuman);
      const isHumanTurn = gameState.players[gameState.currentPlayerIndex]?.isHuman;
      
      if (!humanPlayer || !isHumanTurn) return;

      switch (event.key.toLowerCase()) {
        case ' ':
        case 'enter':
          event.preventDefault();
          // Handle primary action based on game phase
          if (gameState.gamePhase === GamePhase.FIRST_SWAP_DECISION) {
            handleSwapDecision(true);
          } else if (gameState.gamePhase === GamePhase.FIRST_SWAP_ACTION && selectedCards.length > 0) {
            handleConfirmSwap(selectedCards);
          } else if (gameState.gamePhase === GamePhase.GAMEPLAY && selectedCards.length > 0) {
            handlePlayCards();
          }
          break;
        case 'escape':
          event.preventDefault();
          // Clear selection or stand pat
          if (selectedCards.length > 0) {
            setSelectedCards([]);
          } else if (gameState.gamePhase === GamePhase.FIRST_SWAP_DECISION) {
            handleSwapDecision(false);
          }
          break;
        case 'u':
          event.preventDefault();
          // Undo selection
          if (selectedCards.length > 0) {
            setSelectedCards([]);
          }
          break;
        case 'h':
          event.preventDefault();
          // Show help
          addCommentary("Keyboard shortcuts: SPACE/ENTER for primary action, ESC to cancel, U to undo selection!");
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameState.gamePhase, gameState.currentPlayerIndex, selectedCards, handleSwapDecision, handleConfirmSwap, handlePlayCards, addCommentary]);

  // Mouse position tracking for floating play button
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({ x: event.clientX, y: event.clientY });
    };

    const handleClickOutside = (event: MouseEvent) => {
      // Hide floating button when clicking outside of cards during gameplay
      if (showFloatingPlayButton && gameState.gamePhase === GamePhase.GAMEPLAY) {
        const target = event.target as HTMLElement;
        // Check if click is not on a card or the floating button itself
        if (!target.closest('.card-component') && !target.closest('.floating-play-button')) {
          setShowFloatingPlayButton(false);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [showFloatingPlayButton, gameState.gamePhase]);

  return (
    <div className="relative w-full h-screen bg-gradient-to-br from-emerald-900 via-green-800 to-emerald-900 overflow-hidden" style={{ maxHeight: '100vh' }}>
      {/* Poker Table Surface */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="relative w-4/5 h-4/5 max-w-6xl max-h-5xl">
          {/* Professional Card Table */}
          <div 
            className="absolute inset-0 rounded-full shadow-2xl border-4 sm:border-8 border-amber-600"
            style={{
              background: 'radial-gradient(ellipse at center, #22c55e 0%, #16a34a 50%, #15803d  100%)',
              backgroundColor: '#16a34a',
              boxShadow: 'inset 0 0 50px rgba(0,0,0,0.2), 0 8px 32px rgba(0,0,0,0.3)'
            }}
          >
            {/* Table Cloth Texture */}
            <div 
              className="absolute inset-0 rounded-full opacity-30"
              style={{
                background: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3Ccircle cx='15' cy='15' r='1'/%3E%3Ccircle cx='45' cy='15' r='1'/%3E%3Ccircle cx='15' cy='45' r='1'/%3E%3Ccircle cx='45' cy='45' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                backgroundSize: '60px 60px'
              }}
            />
          </div>
        </div>
      </div>
      
        {/* Gurch Crown Logo - Embroidered on Table Cloth */}
        <div className="absolute inset-0 flex items-center justify-center z-30">
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
            {/* Font Awesome Crown - Bright Yellow Filled */}
            <i 
              className="fas fa-crown text-yellow-400" 
              style={{ 
                fontSize: '8rem',
                textShadow: '0 0 20px rgba(255, 235, 59, 0.9), 0 0 40px rgba(255, 235, 59, 0.6), 0 2px 4px rgba(0,0,0,0.3)',
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
                display: 'block',
                textAlign: 'center',
                lineHeight: '1'
              }}
            ></i>
            
            {/* Half Circle Text Below Crown */}
            <svg 
              className="absolute inset-0 w-full h-full" 
              viewBox="0 0 320 320"
              style={{
                overflow: 'visible'
              }}
            >
              <defs>
                <path
                  id="bottom-arc-path"
                  d="M 40,160 A 120,120 0 0,0 280,160"
                />
              </defs>
              <text 
                className="fill-yellow-400 font-bold" 
                style={{ 
                  fontSize: '1.8rem', // 1.5x larger (1.2rem * 1.5 = 1.8rem)
                  fontFamily: 'serif',
                  textShadow: '0 0 10px rgba(255, 235, 59, 0.8), 0 0 20px rgba(255, 235, 59, 0.5)',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                  textAnchor: 'middle',
                  dominantBaseline: 'central'
                }}
              >
                <textPath href="#bottom-arc-path" startOffset="50%" textAnchor="middle">
                  GURCH CARD GAME
                </textPath>
              </text>
            </svg>
        </div>
      </div>


      {/* Draggable Commentary */}
      <DraggableCommentary commentary={gameState.commentary} />

      {/* Central Table - Played Cards in Specific Areas */}
      <div className="absolute inset-0 z-40 pointer-events-none">
        {gameState.players.map((player, playerIndex) => {
          const isHuman = player.isHuman;
          
          // Get position for this player's played cards based on player positions
          let cardAreaStyle: React.CSSProperties = {};
          let cardAreaClass = "absolute w-48 h-20 sm:w-64 sm:h-24 flex justify-center items-center";
          
          // Add clearing animation class
          if (showCardClearAnimation) {
            cardAreaClass += " transition-all duration-1000 ease-in-out";
            cardAreaStyle.opacity = 0;
            cardAreaStyle.transform = "scale(0.8) translateY(-20px)";
          }
          
          if (isHuman) {
            // Human player cards appear on the table above their player box
            cardAreaClass += " bottom-48 sm:bottom-52 left-1/2 transform -translate-x-1/2";
          } else {
            // Bot players: Position based on their actual seat position around the table
            const position = playerPositions[playerIndex];
            if (position) {
              // Determine position based on the player's seat position
              if (position.class.includes('top-')) {
                // Top player - cards in upper center of table
                cardAreaClass += " top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2";
              } else if (position.class.includes('left-')) {
                // Left player - cards in left center of table
                cardAreaClass += " left-1/4 top-1/2 transform -translate-x-1/2 -translate-y-1/2";
              } else if (position.class.includes('right-')) {
                // Right player - cards in right center of table
                cardAreaClass += " right-1/4 top-1/2 transform translate-x-1/2 -translate-y-1/2";
              } else {
                // Fallback - center table
                cardAreaClass += " top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2";
              }
            }
          }
          
          return (
            <div key={`played-cards-${player.id}`} className={cardAreaClass} style={cardAreaStyle}>
              {player.playedCards.map((card, cardIndex) => {
                const isNewlyPlayed = cardIndex >= (lastPlayedCardsCount[player.id] || 0);
                // Check if this card is a commander card (belongs to the first player in current trick)
                const isCommanderCard = gameState.currentTrick.length > 0 && 
                                       gameState.currentTrick[0].playerId === player.id &&
                                       gameState.currentTrick[0].cards.some(c => c.rank === card.rank && c.suit === card.suit);
                return (
                  <div 
                    key={`${player.id}-${card.rank}-${card.suit}-${cardIndex}`}
                    className={isNewlyPlayed ? "animate-toss-from-player" : ""}
                    style={{
                      zIndex: cardIndex + 10,
                      marginLeft: cardIndex > 0 ? `-${24}px` : '0',
                      ...(isNewlyPlayed ? {
                        animationDelay: `${(cardIndex - (lastPlayedCardsCount[player.id] || 0)) * 0.1}s`,
                        animationDuration: '0.8s',
                        animationFillMode: 'forwards'
                      } : {})
                    }}
                  >
                    <CardComponent card={card} humanPlayer={true} isCommander={isCommanderCard} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Stick Component */}
      <Stick 
        position={stickPosition} 
        isAnimating={stickAnimating}
        className="pointer-events-none"
      />

      {/* Bot Players */}
      {gameState.players.filter(player => !player.isHuman).map((player, index) => (
        <PlayerDisplay
          key={player.id}
          player={player}
          isCurrentPlayer={gameState.players.indexOf(player) === gameState.currentPlayerIndex}
          isStarter={player.id === gameState.starterPlayerId}
          isThinking={player.id === gameState.thinkingPlayerId}
          positionClass={playerPositions[gameState.players.indexOf(player)].class}
          positionStyle={playerPositions[gameState.players.indexOf(player)].style}
          faceUpCard={player.faceUpCard}
          gamePhase={gameState.gamePhase}
          swappingCards={swappingCards?.playerId === player.id ? swappingCards.cards : undefined}
          isDealing={isDealing}
          dealingCards={dealingCards[player.id]}
          faceUpDealingCard={faceUpCards[player.id]}
          lastPlayedCardsCount={lastPlayedCardsCount[player.id] || 0}
        />
      ))}
      
      {/* Human Player - Always at Bottom */}
      {gameState.players.find(player => player.isHuman) && (
        <div className="absolute bottom-20 sm:bottom-24 left-0 right-0 flex justify-center z-10">
          <PlayerDisplay
            key={gameState.players.find(player => player.isHuman)!.id}
            player={gameState.players.find(player => player.isHuman)!}
            isCurrentPlayer={gameState.players.findIndex(p => p.isHuman) === gameState.currentPlayerIndex}
            isStarter={gameState.players.find(player => player.isHuman)!.id === gameState.starterPlayerId}
            isThinking={gameState.players.find(player => player.isHuman)!.id === gameState.thinkingPlayerId}
            positionClass=""
            positionStyle={{}}
            faceUpCard={gameState.players.find(player => player.isHuman)!.faceUpCard}
            gamePhase={gameState.gamePhase}
            swappingCards={swappingCards?.playerId === gameState.players.find(player => player.isHuman)!.id ? swappingCards.cards : undefined}
            isDealing={isDealing}
            dealingCards={dealingCards[gameState.players.find(player => player.isHuman)!.id]}
            faceUpDealingCard={faceUpCards[gameState.players.find(player => player.isHuman)!.id]}
            lastPlayedCardsCount={lastPlayedCardsCount[gameState.players.find(player => player.isHuman)!.id] || 0}
          />
                </div>
              )}
      
      {/* Bot Players Dealing Cards - Outside their boxes */}
      {isDealing && gameState.players.filter(player => !player.isHuman).map((player, index) => {
        const botIndex = gameState.players.findIndex(p => p.id === player.id);
        const position = playerPositions[botIndex];
        if (!position) return null;

        let dealingAreaClass = "absolute flex justify-center items-center space-x-1 z-50";
        
        // Position dealing cards outside each bot's player box
        if (position.class.includes('top-')) {
          dealingAreaClass += " top-40 left-1/2 transform -translate-x-1/2";
        } else if (position.class.includes('left-')) {
          dealingAreaClass += " left-60 top-1/2 transform -translate-y-1/2";
        } else if (position.class.includes('right-')) {
          dealingAreaClass += " right-60 top-1/2 transform -translate-y-1/2";
        }

        return (
          <div key={`bot-dealing-${player.id}`} className={dealingAreaClass}>
            <div className="flex justify-center items-center space-x-1 bg-black/20 rounded-xl p-2 backdrop-blur-sm border border-amber-500/30">
              {/* Show face-down cards being dealt */}
              {dealingCards[player.id]?.map((card, cardIndex) => (
                <CardComponent 
                  key={`dealing-${card.rank}-${card.suit}-${cardIndex}`} 
                  card={card} 
                  faceDown={true}
                  small={true}
                  isPlayable={false}
                />
              ))}
              {/* Show face-up card if it's been dealt */}
              {faceUpCards[player.id] && (
                <CardComponent 
                  key={`faceup-${faceUpCards[player.id].rank}-${faceUpCards[player.id].suit}`} 
                  card={faceUpCards[player.id]} 
                  small={true}
                  isPlayable={false}
                />
              )}
            </div>
            </div>
        );
      })}
        
      {/* Human Player's Hand Cards Only */}
      <div className="absolute bottom-4 sm:bottom-6 left-0 right-0 flex justify-center z-40">
        <div className="flex justify-center items-center space-x-1 sm:space-x-2 bg-black/20 rounded-xl p-2 sm:p-4 backdrop-blur-sm border border-amber-500/30">
        {/* Show visual dealing cards if dealing is in progress */}
        {isDealing ? (
          <>
            {/* Show face-down cards being dealt */}
            {gameState.players.find(p => p.isHuman) && dealingCards[gameState.players.find(p => p.isHuman)!.id]?.map((card, index) => (
              <CardComponent 
                key={`dealing-${card.rank}-${card.suit}-${index}`} 
                card={card} 
                faceDown={true}
                isPlayable={false}
              />
            ))}
            {/* Show face-up card if it's been dealt */}
            {gameState.players.find(p => p.isHuman) && faceUpCards[gameState.players.find(p => p.isHuman)!.id] && (
              <CardComponent 
                key={`faceup-${faceUpCards[gameState.players.find(p => p.isHuman)!.id].rank}-${faceUpCards[gameState.players.find(p => p.isHuman)!.id].suit}`} 
                card={faceUpCards[gameState.players.find(p => p.isHuman)!.id]} 
                humanPlayer={true}
                isPlayable={false}
              />
            )}
          </>
        ) : (
          /* Show normal hand when not dealing */
          gameState.players.find(p=>p.isHuman)?.hand.sort((a,b) => a.value - b.value).map((card, index) => (
            <CardComponent 
              key={`${card.rank}-${card.suit}-${index}`} 
              card={card} 
              isSelected={selectedCards?.some(c => c.suit === card.suit && c.rank === card.rank) || false}
              onClick={() => onCardClick(card)}
              humanPlayer={true}
              isPlayable={
                (gameState.gamePhase === GamePhase.GAMEPLAY && gameState.players[gameState.currentPlayerIndex].isHuman) ||
                (gameState.gamePhase === GamePhase.FIRST_SWAP_ACTION && gameState.players[gameState.currentPlayerIndex].isHuman) ||
                (gameState.gamePhase === GamePhase.OTHERS_SWAP_ACTION && gameState.players[gameState.currentPlayerIndex].isHuman) ||
                (gameState.gamePhase === GamePhase.FINAL_SWAP_ACTION && gameState.players[gameState.currentPlayerIndex].isHuman) ||
                (gameState.gamePhase === GamePhase.FINAL_SWAP_ONE_CARD_SELECT && gameState.players[gameState.currentPlayerIndex].isHuman)
              }
            />
          ))
        )}
        </div>
      </div>



      {/* Revealed Card for 1-card swap */}
      {gameState.gamePhase === GamePhase.FINAL_SWAP_ONE_CARD_REVEAL_AND_DECIDE && gameState.revealedCard && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
           <div className="bg-blue-200 border-2 sm:border-4 border-blue-400 rounded-xl p-3 sm:p-4 shadow-2xl flex flex-col items-center text-center max-w-[90vw] sm:max-w-none">
            <h3 className="text-base sm:text-lg font-bold text-black mb-2">
              Swap for this card?
            </h3>
            <CardComponent card={gameState.revealedCard} humanPlayer={true} />
            
              { gameState.players[gameState.currentPlayerIndex].isHuman && (
              <>
                <p className="text-xs sm:text-sm text-black/80 my-2 px-2">
                  Accept the revealed card? If you decline, you'll receive the next card from the deck.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-2">
                    <button onClick={() => handleFinalOneCardSwap('keep')} className="px-3 py-2 sm:px-4 sm:py-2 font-bold text-white rounded-lg shadow-md bg-green-600 hover:bg-green-500 text-sm sm:text-base min-h-[44px]">
                      Accept Card
                    </button>
                    <button onClick={() => handleFinalOneCardSwap('discard')} className="px-3 py-2 sm:px-4 sm:py-2 font-bold text-white rounded-lg shadow-md bg-red-600 hover:bg-red-500 text-sm sm:text-base min-h-[44px]">
                      Decline
                    </button>
                </div>
              </>
              )}
          </div>
        </div>
      )}

      {/* Gameplay Start Indicator */}
      {showGameplayStart && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="bg-gradient-to-r from-green-500 to-blue-500 border-2 sm:border-4 border-white rounded-xl sm:rounded-2xl p-4 sm:p-8 shadow-2xl animate-pulse max-w-[90vw] sm:max-w-none">
            <div className="text-center">
              <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2 sm:mb-4">🎮 GAMEPLAY BEGINS! 🎮</h2>
              <p className="text-lg sm:text-xl text-white/90 mb-1 sm:mb-2">All swapping rounds are complete!</p>
              <p className="text-base sm:text-lg text-white/80">Time to play your cards and win the game!</p>
            </div>
          </div>
        </div>
      )}

      {/* Floating Play Button for Gameplay */}
      {showFloatingPlayButton && gameState.gamePhase === GamePhase.GAMEPLAY && (
        <FloatingPlayButton
          position={buttonPosition}
          onPlay={handleFloatingPlayClick}
          disabled={selectedCards.length === 0}
          cardCount={selectedCards.length}
        />
      )}

      <ActionPanel
        gameState={gameState}
        selectedCards={selectedCards}
        timer={timer}
        onSwapDecision={handleSwapDecision}
        onConfirmSwap={handleConfirmSwap}
        onOtherPlayerSwap={handleOtherPlayerSwap}
        onVote={handleVote}
        onFinalSwapDecision={handleFinalSwapDecision}
        onFinalSwap={handleFinalSwap}
        onPlayCards={handlePlayCards}
        onMinigameSwap={handleMinigameSwap}
        onVoteDecision={handleVoteDecision}
      />
      {gameState.gamePhase === GamePhase.GAME_OVER && (
          <GameOverModal
            players={gameState.players}
            winnerId={gameState.gameWinnerId}
            loserId={gameState.gameLoserId}
            onPlayAgain={onQuit}
          />
      )}
    </div>
  );
};

export default GameBoard;