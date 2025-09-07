
export interface Card {
  suit: Suit;
  rank: Rank;
  value: number;
}

export enum Suit {
  Hearts = '♥',
  Diamonds = '♦',
  Clubs = '♣',
  Spades = '♠',
}

export enum Rank {
  Two = '2',
  Three = '3',
  Four = '4',
  Five = '5',
  Six = '6',
  Seven = '7',
  Eight = '8',
  Nine = '9',
  Ten = '10',
  Jack = 'J',
  Queen = 'Q',
  King = 'K',
  Ace = 'A',
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  hand: Card[];
  faceUpCard?: Card;
  isHuman: boolean;
  isDealer?: boolean;
  playedCards: Card[];
  hasStoodPat?: boolean;
  swapVote?: number;
  hasVoted?: boolean;
  hasMadeFinalSwapDecision?: boolean;
  score: number;
}

export interface TrickPlay {
  playerId: string;
  cards: Card[];
}

export enum GamePhase {
  LOBBY = 'LOBBY',
  DEALING = 'DEALING',
  FIRST_SWAP_DECISION = 'FIRST_SWAP_DECISION',
  FIRST_SWAP_ACTION = 'FIRST_SWAP_ACTION',
  OTHERS_SWAP_DECISION = 'OTHERS_SWAP_DECISION',
  OTHERS_SWAP_ACTION = 'OTHERS_SWAP_ACTION', // New phase for human players to select cards
  VOTE_SWAP = 'VOTE_SWAP',
  VOTE_RESULT = 'VOTE_RESULT',
  FINAL_SWAP_DECISION = 'FINAL_SWAP_DECISION',
  FINAL_SWAP_ACTION = 'FINAL_SWAP_ACTION',
  FINAL_SWAP_ONE_CARD_SELECT = 'FINAL_SWAP_ONE_CARD_SELECT',
  FINAL_SWAP_ONE_CARD_REVEAL_AND_DECIDE = 'FINAL_SWAP_ONE_CARD_REVEAL_AND_DECIDE',
  GAMEPLAY = 'GAMEPLAY',
  ROUND_OVER = 'ROUND_OVER',
  GAME_OVER = 'GAME_OVER',
  MINIGAME = 'MINIGAME',
  MINIGAME_SWAP = 'MINIGAME_SWAP',
}

export interface GameState {
  players: Player[];
  deck: Card[];
  gamePhase: GamePhase;
  currentPlayerIndex: number;
  commentary: string[];
  roundLeaderIndex: number;
  cardsOnTable: Card[];
  firstPlayerToAct: number;
  swapAmount: number;
  voteResult: number;
  lastPlayedHand: Card[];
  currentTrick: TrickPlay[];
  roundWinnerId?: string;
  lastRoundWinnerId?: string;
  gameWinnerId?: string;
  gameLoserId?: string;
  minigamePlayers?: string[];
  revealedCard?: Card;
  cardToSwap?: Card;
}

export enum GameMode {
  VS_BOTS = 'VS_BOTS',
  PLAY_FOR_FUN = 'PLAY_FOR_FUN',
  FRIENDS = 'FRIENDS',
}
