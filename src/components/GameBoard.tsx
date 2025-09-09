import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, Card, GameState, GamePhase, Rank, Suit, TrickPlay, SwappingCards } from '../../types';
import { generateCommentary } from '../services/commentaryService';
import PlayerDisplay from './PlayerDisplay';
import CardComponent from './Card';
import ActionPanel from './ActionPanel';
import GameOverModal from './GameOverModal';

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
      roundLeaderIndex: 0,
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
  const hasDealt = React.useRef(false);
  const processedDecisions = useRef<Set<string>>(new Set());

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

  // Main Game Loop using useEffect
  useEffect(() => {
    // FIX: Use ReturnType<typeof setTimeout> for browser compatibility instead of NodeJS.Timeout
    let timeoutId: ReturnType<typeof setTimeout>;

    const gameLoop = async () => {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (!currentPlayer || gameState.thinkingPlayerId) return;

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
                const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
                setGameState(prev => ({...prev, currentPlayerIndex: nextPlayerIndex}));
            } else if (!currentPlayer.isHuman) {
                setGameState(prev => ({...prev, thinkingPlayerId: currentPlayer.id }));
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
            if (currentPlayer.hasStoodPat) {
                const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
                setGameState(prev => ({...prev, currentPlayerIndex: nextPlayerIndex}));
            } else if (!currentPlayer.isHuman && currentPlayer.wantsToVote === undefined) {
                setGameState(prev => ({...prev, thinkingPlayerId: currentPlayer.id }));
            }
            return;
        case GamePhase.VOTE_SWAP:
             if (currentPlayer.hasStoodPat) {
                const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
                setGameState(prev => ({...prev, currentPlayerIndex: nextPlayerIndex}));
            } else if (!currentPlayer.isHuman && !currentPlayer.hasVoted) {
                 setGameState(prev => ({...prev, thinkingPlayerId: currentPlayer.id }));
             }
            return; // Exit early to prevent further processing
        case GamePhase.FINAL_SWAP_DECISION:
            if (!currentPlayer.isHuman) {
                setGameState(prev => ({...prev, thinkingPlayerId: currentPlayer.id }));
            }
            return; // Exit early to prevent further processing
        case GamePhase.FINAL_SWAP_ACTION:
            // Handle final swap action - if it's a human's turn, wait for them to select cards
            // If it's a bot's turn, automatically process their swap
            if (!currentPlayer.isHuman) {
                const botPlayer = currentPlayer;
                if (!botPlayer.hasStoodPat) {
                    // Bot needs to swap cards
                    const hand = [...botPlayer.hand].sort((a,b) => b.value - a.value);
                    const cardsToSwap = hand.slice(0, gameState.voteResult);
                    timeoutId = setTimeout(() => handleFinalSwap(cardsToSwap), 2000);
                } else {
                    // Bot has stood pat, move to next player
                    const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
                    setGameState(prev => ({...prev, currentPlayerIndex: nextPlayerIndex}));
                }
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
                 timeoutId = setTimeout(handleBotPlay, 2000);
            }
            // For human players, do nothing - let them interact via ActionPanel
            return; // Exit early to prevent further processing
        case GamePhase.MINIGAME:
            if (!currentPlayer.isHuman) {
                timeoutId = setTimeout(handleBotPlay, 2000);
            }
            return;
        case GamePhase.MINIGAME_SWAP:
            if (!currentPlayer.isHuman) {
                // For now, bots will not swap in minigame for simplicity
                timeoutId = setTimeout(() => handleMinigameSwap(false), 2000);
            }
            return;
        case GamePhase.ROUND_OVER:
            const roundLeaderId = gameState.players[gameState.roundLeaderIndex].id;
            const winnerId = determineTrickWinner(gameState.currentTrick, gameState.lastPlayedHand, roundLeaderId);
            timeoutId = setTimeout(() => startNextRound(winnerId), 3000);
            break;
      }
    };
    
    gameLoop();

    return () => clearTimeout(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.gamePhase, gameState.currentPlayerIndex]);

  useEffect(() => {
    // This effect creates a delay for bot actions to make them feel more natural
    if (gameState.thinkingPlayerId) {
      const timeoutId = setTimeout(() => {
        const player = gameState.players.find(p => p.id === gameState.thinkingPlayerId);
        if (!player) return;

        switch (gameState.gamePhase) {
            case GamePhase.FIRST_SWAP_DECISION:
            case GamePhase.FIRST_SWAP_OTHERS_DECISION:
                const wantsToSwap = Math.random() > 0.3; // 70% chance to swap
                handleSwapDecision(wantsToSwap);
                break;
            case GamePhase.OTHERS_SWAP_DECISION:
                handleOtherPlayerSwap(true); // Bots always swap if they can
                break;
            case GamePhase.VOTE_SWAP_DECISION:
                handleVoteDecision(Math.random() > 0.2); // 80% chance to vote
                break;
            case GamePhase.VOTE_SWAP:
                handleVote(Math.floor(Math.random() * 5) + 1); // 1-5 cards
                break;
            case GamePhase.FINAL_SWAP_DECISION:
                handleFinalSwapDecision(true); // Bots always participate if they didn't win vote
                break;
        }
        setGameState(prev => ({...prev, thinkingPlayerId: undefined}));
      }, 1500);

      return () => clearTimeout(timeoutId);
    }
  }, [gameState.thinkingPlayerId]);

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
    
    // Clear processed decisions for new game
    processedDecisions.current.clear();
    
    // Check if cards have already been dealt
    if (gameState.players.some(p => p.hand.length > 0)) {
      console.log("Cards already dealt, skipping...");
      return;
    }
    
    addCommentary("The dealer is shuffling the deck...");
    const deck = shuffleDeck(createDeck());
    const newPlayers = [...gameState.players];
    
    // Clear any existing hands first
    newPlayers.forEach(p => p.hand = []);
    
    // Deal 4 cards down
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < newPlayers.length; j++) {
        newPlayers[j].hand.push(deck.pop()!);
      }
    }
    console.log("[DEBUG] After dealing 4 cards down:");
    newPlayers.forEach(p => console.log(`  ${p.name}: ${p.hand.length} cards`));
    
    // Deal 1 card up
    for (let j = 0; j < newPlayers.length; j++) {
      const faceUpCard = deck.pop()!;
      newPlayers[j].faceUpCard = faceUpCard;
      newPlayers[j].hand.push(faceUpCard);
    }
    console.log("[DEBUG] After dealing 1 card up:");
    newPlayers.forEach(p => console.log(`  ${p.name}: ${p.hand.length} cards`));

    let highestCardValue = 0;
    let starterIndex = -1;
    let dealerIndex = newPlayers.findIndex(p => p.isDealer);

    for (let i = 0; i < newPlayers.length; i++) {
        const playerIndex = (dealerIndex + 1 + i) % newPlayers.length;
        const player = newPlayers[playerIndex];
        if (player.faceUpCard!.value >= highestCardValue) {
            highestCardValue = player.faceUpCard!.value;
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
    }, 2000);
  };
  
  const handleSwapDecision = (wantsToSwap: boolean) => {
    setTimer(0);
    const playerIndex = gameState.currentPlayerIndex;
    const player = gameState.players[playerIndex];
    const decisionKey = `${player.id}-${gameState.gamePhase}`;

    console.log(`[DEBUG] handleSwapDecision called: player=${player.name}, wantsToSwap=${wantsToSwap}, phase=${gameState.gamePhase}`);

    // Prevent duplicate execution using ref
    if (processedDecisions.current.has(decisionKey)) {
      console.log(`[DEBUG] Decision already processed for ${player.name}, skipping`);
      return;
    }
    processedDecisions.current.add(decisionKey);

    setGameState(prev => {
        const newPlayers = [...prev.players];
        newPlayers[playerIndex].hasMadeFirstSwapDecision = true;

        if (!wantsToSwap) {
            newPlayers[playerIndex].hasStoodPat = true;
            addCommentary(`${player.name} stands pat.`);
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
        }

        if (nextPlayerIndex === -1) {
            console.log(`[DEBUG] All players have made first swap decisions, processing results...`);
            const swappingPlayers = newPlayers.filter(p => !p.hasStoodPat);
            if (swappingPlayers.length === 0) {
                addCommentary(`No one wants to swap. Let the voting begin!`);
                const firstVoterIndex = newPlayers.findIndex(p => !p.hasStoodPat);
                return {...prev, players: newPlayers, gamePhase: GamePhase.VOTE_SWAP_DECISION, currentPlayerIndex: firstVoterIndex !== -1 ? firstVoterIndex : prev.firstPlayerToAct };
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
                // Ensure we swap at least 1 card, but not more than the hand size
                const swapCount = Math.min(Math.max(1, hand.length), 2);
                const cardsToSwap = hand.slice(0, swapCount);
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
  }
  
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

          setSwappingCards({playerId: player.id, cards: cardsToSwap, originalPhase: gameState.gamePhase});
          addCommentary(`${player.name} is swapping ${cardsToSwap.length} card(s)...`);
      }
  }

  const handleVote = (amount: number) => {
      setTimer(0);
      const playerIndex = gameState.currentPlayerIndex;
      const voteMessage = amount === 0 ? "not to swap any cards" : `to swap ${amount} card(s)`;
      addCommentary(`${gameState.players[playerIndex].name} votes ${voteMessage}.`);
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
              
              if (winningVote === 0) {
                  addCommentary(`The vote is in! No cards will be swapped. Let the game begin!`);
                  setShowGameplayStart(true);
                  setTimeout(() => setShowGameplayStart(false), 4000);
                  return { ...prev, players: newPlayers, gamePhase: GamePhase.GAMEPLAY, currentPlayerIndex: prev.firstPlayerToAct, roundLeaderIndex: prev.firstPlayerToAct };
              }

              addCommentary(`The vote is in! Players will swap ${winningVote} card(s).`);
              
              const firstDeciderIndex = newPlayers.findIndex(p => p.wantsToVote && p.swapVote !== winningVote);
              
              if (firstDeciderIndex === -1) {
                  // All winners, proceed to action
                  addCommentary(`The Council has spoken! A ${winningVote}-card swap is now in motion!`);
                  return {...prev, players: newPlayers, gamePhase: GamePhase.FINAL_SWAP_ACTION, voteResult: winningVote, currentPlayerIndex: 0 };
              }
              
              return {...prev, players: newPlayers, gamePhase: GamePhase.FINAL_SWAP_DECISION, voteResult: winningVote, currentPlayerIndex: firstDeciderIndex };
          }

          return {...prev, players: newPlayers, currentPlayerIndex: nextVoterIndex};
      });
      setTimer(10);
  }
  
  const handleVoteDecision = (wantsToVote: boolean) => {
      const playerIndex = gameState.currentPlayerIndex;
      addCommentary(`${gameState.players[playerIndex].name} decides ${wantsToVote ? 'to vote' : 'to stay'}.`);
      
      setGameState(prev => {
          const newPlayers = [...prev.players];
          newPlayers[playerIndex].wantsToVote = wantsToVote;

          // Find next player to make a decision
          let nextPlayerIndex = -1;
          for (let i = 1; i < newPlayers.length; i++) {
              const potentialIndex = (playerIndex + i) % newPlayers.length;
              if (newPlayers[potentialIndex].wantsToVote === undefined) {
                  nextPlayerIndex = potentialIndex;
                  break;
              }
          }

          if (nextPlayerIndex === -1) {
              // All players have decided
              const playersVoting = newPlayers.filter(p => p.wantsToVote);
              if (playersVoting.length === 0) {
                  addCommentary(`No one wants to swap. Let the game begin!`);
                  return {...prev, players: newPlayers, gamePhase: GamePhase.GAMEPLAY, currentPlayerIndex: prev.firstPlayerToAct, roundLeaderIndex: prev.firstPlayerToAct };
              }
              
              const firstVoterIndex = newPlayers.findIndex(p => p.wantsToVote);
              addCommentary(`Time to vote on the number of cards to swap.`);
              return {...prev, players: newPlayers, gamePhase: GamePhase.VOTE_SWAP, currentPlayerIndex: firstVoterIndex };
          }

          return {...prev, players: newPlayers, currentPlayerIndex: nextPlayerIndex};
      });
  };

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
            if (newPlayers[idx].wantsToVote && newPlayers[idx].swapVote !== prev.voteResult && !newPlayers[idx].hasMadeFinalSwapDecision) {
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
        const leadHand = gameState.lastPlayedHand;
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
      const isWinningPlay = gameState.lastPlayedHand.length === 0 || selectedCards[0].value >= gameState.lastPlayedHand[0].value;
      if (isWinningPlay) {
          newRoundWinnerId = player.id;
      }
      
      // Add commentary indicating if it's a sacrifice
      const isSacrifice = gameState.lastPlayedHand.length > 0 && selectedCards[0].value < gameState.lastPlayedHand[0].value;
      if (isSacrifice) {
          addCommentary(`${player.name} sacrifices ${selectedCards.map(c => `${c.rank}${c.suit}`).join(', ')} (cannot beat ${gameState.lastPlayedHand[0].rank}${gameState.lastPlayedHand[0].suit}).`);
      } else {
          addCommentary(`${player.name} plays ${selectedCards.map(c => `${c.rank}${c.suit}`).join(', ')}.`);
      }
      
      const nextPlayerIndex = (playerIndex + 1) % newPlayers.length;

      if (nextPlayerIndex === gameState.roundLeaderIndex) {
          // Round is over
          setGameState(prev => ({
              ...prev, 
              players: enforceFiveCardLimit(newPlayers),
              gamePhase: GamePhase.ROUND_OVER,
              lastPlayedHand: isWinningPlay ? selectedCards : prev.lastPlayedHand,
              currentTrick: newCurrentTrick,
              roundWinnerId: newRoundWinnerId
            }));
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
    
    const cardsToPlay = findBestPlayForBot(hand, gameState.lastPlayedHand);
    
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

        if (nextPlayerIndex === gameState.roundLeaderIndex) {
             setGameState(prev => ({
              ...prev,
              players: enforceFiveCardLimit(newPlayers),
              gamePhase: GamePhase.ROUND_OVER,
              lastPlayedHand: isWinningPlay ? cardsToPlay : prev.lastPlayedHand,
              currentTrick: newCurrentTrick,
              roundWinnerId: newRoundWinnerId,
            }));
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

  const validatePlay = (cards: Card[]): boolean => {
    const player = gameState.players[gameState.currentPlayerIndex];
    const leadHand = gameState.lastPlayedHand;

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
        group.length >= leadHand.length && group[0].value >= leadHand[0].value
    );
    console.log(`[VALIDATION] Found ${winningPlays.length} winning sets:`, winningPlays.map(g => g.map(c => c.rank)));

    // Determine if a "beat and sacrifice" play is possible
    const higherCards = player.hand.filter(c => c.value > leadHand[0].value);
    const canBeatAndSacrifice = higherCards.length > 0;
    console.log(`[VALIDATION] Can 'beat and sacrifice'? ${canBeatAndSacrifice}`);

    // A player MUST beat the hand if they are able to.
    if (winningPlays.length > 0 || canBeatAndSacrifice) {
        console.log("[VALIDATION] Player has a winning move available and must play one.");

        // Check if the played hand is a valid winning set
        const isWinningSetPlay = cards[0].value >= leadHand[0].value && cards.every(c => c.rank === cards[0].rank);
        console.log(`[VALIDATION] Is the play a valid winning set? ${isWinningSetPlay}`);
        if (isWinningSetPlay) {
            console.log("[VALIDATION] PASSED: Player made a valid winning set play.");
            return true;
        }

        // Check if the played hand is a valid "beat and sacrifice"
        const playedHigherCards = cards.filter(c => c.value > leadHand[0].value);

        if (canBeatAndSacrifice && playedHigherCards.length === 1) {
            const beatingCard = playedHigherCards[0];
            // Hand without the single beating card
            const restOfHand = player.hand.filter(c => c.rank !== beatingCard.rank || c.suit !== beatingCard.suit);
            const lowestCardsForSacrifice = restOfHand.sort((a,b) => a.value - b.value).slice(0, leadHand.length - 1);
            
            // Played cards without the single beating card
            const playedSacrificeCards = cards.filter(c => c.rank !== beatingCard.rank || c.suit !== beatingCard.suit);

            // Check if the sacrificed cards are indeed the lowest ones
            const playedSacrificeSorted = playedSacrificeCards.sort((a,b) => a.value - b.value);
            const lowestCardsSorted = lowestCardsForSacrifice.sort((a,b) => a.value - b.value);
            
            if (JSON.stringify(playedSacrificeSorted) === JSON.stringify(lowestCardsSorted)) {
                console.log("[VALIDATION] PASSED: Player made a valid 'beat and sacrifice' play.");
                return true;
            }
        }

        // If the player could have beaten the hand, but didn't, it's an invalid play.
        console.log("[VALIDATION] FAILED: Player had a winning move but played something else.");
        return false;
    }

    // If no winning moves are possible, player must sacrifice their lowest cards.
    console.log("[VALIDATION] Player must sacrifice lowest cards.");
    const sortedHand = [...player.hand].sort((a,b) => a.value - b.value);
    const lowestCards = sortedHand.slice(0, leadHand.length);
    const isLowestCards = cards.every(card => 
        lowestCards.some(lowest => lowest.rank === card.rank && lowest.suit === card.suit)
    );
    
    if (!isLowestCards) console.log("[VALIDATION] FAILED: Did not play lowest cards for sacrifice.");
    else console.log("[VALIDATION] PASSED: Correctly sacrificed lowest cards.");
    return isLowestCards;
  }
  
  const findBestPlayForBot = (hand: Card[], leadHand: Card[]): Card[] => {
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

    // Check for "beat and sacrifice"
    let beatAndSacrificePlay: Card[] | null = null;
    const higherCards = hand.filter(c => c.value > leadValue);
    if (higherCards.length > 0) {
        const lowestBeatingCard = higherCards.sort((a,b) => a.value - b.value)[0];
        const restOfHand = hand.filter(c => c.rank !== lowestBeatingCard.rank || c.suit !== lowestBeatingCard.suit);
        const lowestCards = restOfHand.sort((a,b) => a.value - b.value).slice(0, leadCount - 1);
        beatAndSacrificePlay = [lowestBeatingCard, ...lowestCards];
    }
    
    // Bot Strategy:
    // 1. If winning sets are available, play the lowest-value one.
    if (winningPlays.length > 0) {
        winningPlays.sort((a,b) => a[0].value - b[0].value);
        return winningPlays[0];
    }

    // 2. If no winning set but can "beat and sacrifice", do that.
    if (beatAndSacrificePlay) {
        return beatAndSacrificePlay;
    }

    // 3. Otherwise, sacrifice the lowest cards.
    const sortedHand = [...hand].sort((a,b) => a.value - b.value);
    return sortedHand.slice(0, leadCount);
  }


  const handleBotSelectCardForOneSwap = () => {
    const player = gameState.players[gameState.currentPlayerIndex];
    const hand = [...player.hand].sort((a,b) => a.value - b.value);
    const cardToSwap = hand[hand.length - 1]; // Bot selects its highest card
    addCommentary(`${player.name} decides to swap their ${cardToSwap.rank}.`);
    handleSelectCardForOneSwap(cardToSwap);
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
      const winnerIndex = gameState.players.findIndex(p => p.id === winnerId);
      const nextLeaderIndex = winnerIndex !== -1 ? winnerIndex : gameState.roundLeaderIndex;

      addCommentary(`${gameState.players[nextLeaderIndex].name} won the last round and will start.`);
      
      setGameState(prev => ({
          ...prev,
          gamePhase: GamePhase.GAMEPLAY,
          currentPlayerIndex: nextLeaderIndex,
          roundLeaderIndex: nextLeaderIndex,
          cardsOnTable: [],
          lastPlayedHand: [],
          currentTrick: [],
          lastRoundWinnerId: winnerId,
          roundWinnerId: undefined
      }));
  }

  const handleGameOver = (winnerId: string) => {
    const winner = gameState.players.find(p => p.id === winnerId);
    if (!winner) return;
  
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
  
    const winnerScore = scores[winnerId];
    delete scores[winnerId];
  
    const losers = Object.entries(scores);
    const maxScore = Math.max(...losers.map(([, score]) => score));
    const minScore = Math.min(...losers.map(([, score]) => score));
  
    const tiedLosers = losers.filter(([, score]) => score === maxScore).map(([id]) => id);
    const tiedWinners = lastTrick.filter(p => p.cards.reduce((acc, c) => acc + c.value, 0) === winnerScore).map(p => p.playerId);
  
    if (tiedLosers.length > 1) {
      addCommentary(`A minigame will decide the loser between ${tiedLosers.join(', ')}!`);
      startMinigame(tiedLosers);
      return;
    }
  
    if (tiedWinners.length > 1) {
      addCommentary(`A minigame will decide the winner between ${tiedWinners.join(', ')}!`);
      startMinigame(tiedWinners);
      return;
    }
  
    const loserId = losers.find(([, score]) => score === maxScore)![0];
    const loser = gameState.players.find(p => p.id === loserId);
    addCommentary(`Game Over! ${winner.name} wins! ${loser?.name} had the highest cards in the final round, awarding ${maxScore} points to ${winner.name}.`);
  
    const newPlayers = gameState.players.map(p => {
      if (p.id === winnerId) {
        return { ...p, score: p.score + maxScore };
      }
      return p;
    });
  
    setGameState(prev => ({
      ...prev, 
      players: newPlayers,
      gamePhase: GamePhase.GAME_OVER, 
      gameWinnerId: winnerId, 
      gameLoserId: loserId
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

  const onCardClick = (card: Card) => {
    setSelectedCards(prev => {
      const isAlreadySelected = prev.some(
        c => c.rank === card.rank && c.suit === card.suit
      );

      // 1. Handle deselection
      if (isAlreadySelected) {
        console.log(`[DEBUG] Deselecting card: ${card.rank}${card.suit}`);
        return prev.filter(c => !(c.rank === card.rank && c.suit === card.suit));
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
        const leadHand = gameState.lastPlayedHand;

        if (leadHand.length > 0) { // Player is following
            const handByRank: {[key: string]: Card[]} = {};
            humanPlayer.hand.forEach(c => {
                if (!handByRank[c.rank]) handByRank[c.rank] = [];
                handByRank[c.rank].push(c);
            });
            const canBeatWithSet = Object.values(handByRank).some(
                group => group.length >= leadHand.length && group[0].value >= leadHand[0].value
            );
            const higherCards = humanPlayer.hand.filter(c => c.value > leadHand[0].value);
            const canBeatAndSacrifice = !canBeatWithSet && higherCards.length > 0;

            if (canBeatWithSet) {
                const cardsOfClickedRank = handByRank[card.rank] || [];
                if (cardsOfClickedRank.length < leadHand.length || card.value < leadHand[0].value) {
                    addCommentary(`You must play a set of ${leadHand.length} that can beat the ${leadHand[0].rank}s.`);
                    return prev;
                }
                if (prev.length > 0 && prev[0].rank !== card.rank) {
                    return [card];
                }
            } else if (canBeatAndSacrifice) {
                const sortedHand = [...humanPlayer.hand].sort((a,b) => a.value - b.value);
                const lowestCards = sortedHand.slice(0, leadHand.length - 1);

                const newSelection = [...prev, card];
                const higherInSelection = newSelection.filter(c => higherCards.some(h => h.rank === c.rank && h.suit === c.suit));
                const lowestInSelection = newSelection.filter(c => lowestCards.some(l => l.rank === c.rank && l.suit === c.suit));
                
                // 1. Can't select more than one beating card.
                if (higherInSelection.length > 1) {
                    addCommentary(`You can only use one high card to beat the hand.`);
                    return prev;
                }
                // 2. Can't select cards that aren't part of the lowest set (unless it's the one beating card)
                if ((higherInSelection.length + lowestInSelection.length) !== newSelection.length) {
                    addCommentary(`To beat and sacrifice, you must use one high card and your lowest card(s).`);
                    return prev;
                }
                // 3. Don't allow selecting more cards than necessary.
                if (newSelection.length > leadHand.length) {
                    return prev; 
                }
            } else {
                // Must sacrifice lowest cards.
                const sortedHand = [...humanPlayer.hand].sort((a, b) => a.value - b.value);
                const lowestCards = sortedHand.slice(0, leadHand.length);
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
        return [...prev, card];
      }

      // If not a recognized phase for card selection, do nothing.
      return prev;
    });
  };

  const getPlayerPositions = () => {
    const positions = [
      { class: 'top-4', style: { left: '50%', transform: 'translateX(-50%)' } }, // Top
      { class: 'right-4', style: { top: '50%', right: '20px', transform: 'translateY(-50%)' } }, // Right - fixed positioning
      { class: 'bottom-32', style: { left: '50%', transform: 'translateX(-50%)' } }, // Bottom (Human) - use inline CSS
      { class: 'left-4', style: { top: '50%', left: '20px', transform: 'translateY(-50%)' } } // Left - fixed positioning
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

  return (
    <div className="relative w-full h-[85vh] bg-green-800/50 rounded-3xl border-4 border-yellow-700 shadow-2xl p-4 overflow-hidden">
      <div className="absolute inset-0 bg-green-900 rounded-2xl m-2" style={{backgroundImage: 'radial-gradient(circle, #2c5b2c, #1a3a1a)'}}></div>
      
      <button onClick={onQuit} className="absolute top-4 right-4 bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg z-50">
          Quit
      </button>

      {/* Game Phase, Turn Indicator, and Commentary */}
      <div className="absolute top-4 left-4 right-4 bg-black/30 rounded-xl p-3 backdrop-blur-sm z-40">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Left side - Game info */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="text-center md:text-left">
              <div className="text-sm font-semibold text-white mb-1">
                Phase: <span className="text-cyan-300">{getPhaseDisplayName(gameState.gamePhase)}</span>
              </div>
              <div className="text-xs text-gray-300">
                Turn: <span className={`font-bold ${isHumanTurn() ? 'text-yellow-300' : 'text-blue-300'}`}>
                  {getCurrentPlayerName()}
                  {isHumanTurn() && ' (YOU)'}
                </span>
              </div>
            </div>
            
            {/* Turn indicator with visual cue */}
            <div className={`px-3 py-1 rounded-lg font-bold text-xs transition-all duration-300 ${
              isHumanTurn() 
                ? 'bg-yellow-500 text-black animate-pulse' 
                : 'bg-blue-500 text-white'
            }`}>
              {isHumanTurn() ? '🎯 YOUR TURN' : '⏳ WAITING'}
            </div>
          </div>

          {/* Right side - Commentary */}
          <div className="flex-1 max-w-md">
            <div className="text-xs text-white">
              <div className="font-semibold text-cyan-300 mb-1 flex items-center">
                <span className="mr-1">💬</span> Commentary
              </div>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {gameState.commentary.slice(0, 3).map((line, index) => (
                  <div key={index} className={`text-xs transition-opacity duration-500 ${
                    index === 0 ? 'opacity-100 font-semibold text-white' : 'opacity-70 text-gray-300'
                  }`}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {gameState.players.map((player, index) => (
        !player.isHuman && (
          <PlayerDisplay
            key={player.id}
            player={player}
            isCurrentPlayer={index === gameState.currentPlayerIndex}
            isStarter={player.id === gameState.starterPlayerId}
            isThinking={player.id === gameState.thinkingPlayerId}
            positionClass={playerPositions[index].class}
            positionStyle={playerPositions[index].style}
            faceUpCard={player.faceUpCard}
            gamePhase={gameState.gamePhase}
            swappingCards={swappingCards?.playerId === player.id ? swappingCards.cards : undefined}
          />
        )
      ))}
      

      {/* Human Player's Hand - Horizontally centered in lower part of screen */}
      <div className="absolute bottom-8" style={{left: '50%', transform: 'translateX(-50%)'}}>
        <div className="flex justify-center items-center space-x-2">
          {gameState.players.find(p=>p.isHuman)?.hand.sort((a,b) => a.value - b.value).map((card, index) => (
            <CardComponent 
              key={`${card.rank}-${card.suit}-${index}`} 
              card={card} 
              isSelected={selectedCards.some(c => c.suit === card.suit && c.rank === card.rank)}
              onClick={() => onCardClick(card)}
              isPlayable={
                (gameState.gamePhase === GamePhase.GAMEPLAY && gameState.players[gameState.currentPlayerIndex].isHuman) ||
                (gameState.gamePhase === GamePhase.FIRST_SWAP_ACTION && gameState.players[gameState.currentPlayerIndex].isHuman) ||
                (gameState.gamePhase === GamePhase.OTHERS_SWAP_ACTION && gameState.players[gameState.currentPlayerIndex].isHuman) ||
                (gameState.gamePhase === GamePhase.FINAL_SWAP_ACTION && gameState.players[gameState.currentPlayerIndex].isHuman) ||
                (gameState.gamePhase === GamePhase.FINAL_SWAP_ONE_CARD_SELECT && gameState.players[gameState.currentPlayerIndex].isHuman)
              }
            />
          ))}
        </div>
      </div>


      {/* Cards in Play Display - positioned to avoid overlap */}
      {gameState.lastPlayedHand.length > 0 && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-yellow-500/90 border-4 border-yellow-300 rounded-xl p-4 shadow-2xl">
            <div className="text-center mb-2">
              <h3 className="text-lg font-bold text-black">Cards in Play</h3>
              <p className="text-sm text-black/80">
                {gameState.players.find(p => p.id === gameState.roundWinnerId)?.name || 'Current Lead'}
              </p>
            </div>
            <div className="flex justify-center space-x-2">
              {gameState.lastPlayedHand.map((card, index) => (
                <div key={index} className="transform hover:scale-110 transition-transform duration-200">
                  <CardComponent card={card} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Revealed Card for 1-card swap */}
      {gameState.gamePhase === GamePhase.FINAL_SWAP_ONE_CARD_REVEAL_AND_DECIDE && gameState.revealedCard && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
           <div className="bg-blue-200 border-4 border-blue-400 rounded-xl p-4 shadow-2xl flex flex-col items-center text-center">
            <h3 className="text-lg font-bold text-black mb-2">
              Swap for this card?
            </h3>
            <CardComponent card={gameState.revealedCard} />
            
              { gameState.players[gameState.currentPlayerIndex].isHuman && (
              <>
                <p className="text-sm text-black/80 my-2">
                  Accept the revealed card? If you decline, you'll receive the next card from the deck.
                </p>
                <div className="flex space-x-4 mt-2">
                    <button onClick={() => handleFinalOneCardSwap('keep')} className="px-4 py-2 font-bold text-white rounded-lg shadow-md bg-green-600 hover:bg-green-500">
                      Accept Card
                    </button>
                    <button onClick={() => handleFinalOneCardSwap('discard')} className="px-4 py-2 font-bold text-white rounded-lg shadow-md bg-red-600 hover:bg-red-500">
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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="bg-gradient-to-r from-green-500 to-blue-500 border-4 border-white rounded-2xl p-8 shadow-2xl animate-pulse">
            <div className="text-center">
              <h2 className="text-4xl font-bold text-white mb-4">🎮 GAMEPLAY BEGINS! 🎮</h2>
              <p className="text-xl text-white/90 mb-2">All swapping rounds are complete!</p>
              <p className="text-lg text-white/80">Time to play your cards and win the game!</p>
            </div>
          </div>
        </div>
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