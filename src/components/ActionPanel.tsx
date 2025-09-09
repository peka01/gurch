
import React from 'react';
import { GameState, Card, GamePhase } from '../../types';

interface ActionPanelProps {
  gameState: GameState;
  selectedCards: Card[];
  timer: number;
  onSwapDecision: (wantsToSwap: boolean) => void;
  onConfirmSwap: (cards: Card[]) => void;
  onOtherPlayerSwap: (wantsToSwap: boolean) => void;
  onVote: (amount: number) => void;
  onFinalSwapDecision: (participate: boolean) => void;
  onFinalSwap: (cards: Card[]) => void;
  onPlayCards: () => void;
  onMinigameSwap: (wantsToSwap: boolean) => void;
  onVoteDecision: (wantsToVote: boolean) => void;
}

interface ActionButtonProps {
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
    color?: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'warning';
    size?: 'sm' | 'md' | 'lg';
    requiresConfirmation?: boolean;
    confirmationMessage?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ 
    onClick, 
    disabled, 
    children, 
    color, 
    variant = 'primary',
    size = 'md',
    requiresConfirmation = false,
    confirmationMessage
}) => {
    const getVariantClasses = () => {
        if (color) return color;
        
        switch (variant) {
            case 'primary': return 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/25';
            case 'secondary': return 'bg-gray-600 hover:bg-gray-500 shadow-gray-500/25';
            case 'danger': return 'bg-red-600 hover:bg-red-500 shadow-red-500/25';
            case 'warning': return 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-500/25';
            default: return 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/25';
        }
    };

    const getSizeClasses = () => {
        switch (size) {
            case 'sm': return 'px-3 py-1.5 text-sm';
            case 'md': return 'px-4 py-2 text-sm md:px-6 md:py-3';
            case 'lg': return 'px-6 py-3 text-lg md:px-8 md:py-4';
            default: return 'px-4 py-2 text-sm md:px-6 md:py-3';
        }
    };

    const handleClick = () => {
        if (requiresConfirmation && confirmationMessage) {
            if (window.confirm(confirmationMessage)) {
                onClick();
            }
        } else {
            onClick();
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={disabled}
            className={`
                ${getSizeClasses()} 
                font-bold text-white rounded-lg shadow-md transition-all duration-200 
                disabled:opacity-50 disabled:cursor-not-allowed 
                ${getVariantClasses()} 
                transform disabled:scale-100 hover:scale-105 active:scale-95
                border-2 border-transparent hover:border-white/20
                focus:outline-none focus:ring-4 focus:ring-white/30
            `}
            title={requiresConfirmation ? "Requires confirmation" : undefined}
        >
            {children}
        </button>
    );
};


const ActionPanel: React.FC<ActionPanelProps> = (props) => {
    const { gameState, selectedCards, timer, onSwapDecision, onConfirmSwap, onOtherPlayerSwap, onVote, onFinalSwapDecision, onFinalSwap, onPlayCards, onMinigameSwap, onVoteDecision } = props;
    const humanPlayer = gameState.players.find(p => p.isHuman);
    const isHumanTurn = gameState.players[gameState.currentPlayerIndex]?.isHuman;
    
    
    const renderContent = () => {
        if (!humanPlayer) return null;

        if (!isHumanTurn) {
            const swapAndVotePhases = [
                GamePhase.FIRST_SWAP_DECISION, GamePhase.FIRST_SWAP_OTHERS_DECISION,
                GamePhase.OTHERS_SWAP_DECISION, GamePhase.VOTE_SWAP_DECISION,
                GamePhase.VOTE_SWAP, GamePhase.FINAL_SWAP_DECISION
            ];
            if (swapAndVotePhases.includes(gameState.gamePhase)) {
                 return <p className="text-lg mb-2">Waiting for other players...</p>;
            }
        }

        switch(gameState.gamePhase) {
            case GamePhase.FIRST_SWAP_DECISION:
                if (isHumanTurn) {
                    return (
                        <>
                            <p className="text-lg mb-2">Do you want to swap cards or stand pat?</p>
                            <div className="flex space-x-4">
                                <ActionButton 
                                    onClick={() => onSwapDecision(true)} 
                                    variant="primary" 
                                    size="lg"
                                >
                                    🔄 Swap Cards
                                </ActionButton>
                                <ActionButton 
                                    onClick={() => onSwapDecision(false)} 
                                    variant="secondary"
                                    requiresConfirmation={true}
                                    confirmationMessage="Are you sure you want to stand pat? You won't be able to swap cards in this round."
                                >
                                    ✋ Stand Pat
                                </ActionButton>
                            </div>
                        </>
                    );
                }
                break;
            case GamePhase.FIRST_SWAP_OTHERS_DECISION:
                if (isHumanTurn) {
                    // Find the player who made the initial swap decision
                    const firstPlayer = gameState.players.find(p => p.hasMadeFirstSwapDecision && !p.hasStoodPat);
                    const playerName = firstPlayer ? firstPlayer.name : "A player";
                    
                    // Debug: Log the swap amount (only once per render)
                    if (gameState.swapAmount !== 0) {
                        console.log(`[DEBUG] ActionPanel: swapAmount = ${gameState.swapAmount}, firstPlayer = ${playerName}`);
                    }
                    
                    return (
                        <>
                            <p className="text-lg mb-2">{playerName} chose to swap {gameState.swapAmount} cards.</p>
                            <p className="text-base mb-4">Do you want to swap the same number or stand pat?</p>
                            <div className="flex space-x-4">
                                <ActionButton 
                                    onClick={() => onOtherPlayerSwap(true)} 
                                    variant="primary" 
                                    size="lg"
                                >
                                    🔄 Swap {gameState.swapAmount} Cards
                                </ActionButton>
                                <ActionButton 
                                    onClick={() => onOtherPlayerSwap(false)} 
                                    variant="secondary"
                                    requiresConfirmation={true}
                                    confirmationMessage="Are you sure you want to stand pat? You won't be able to swap cards in this round."
                                >
                                    ✋ Stand Pat
                                </ActionButton>
                            </div>
                        </>
                    );
                }
                break;
            case GamePhase.FIRST_SWAP_ACTION:
                 if (isHumanTurn) {
                    return (
                        <>
                            <p className="text-lg mb-2">Select cards to swap, then confirm.</p>
                            <ActionButton 
                                onClick={() => onConfirmSwap(selectedCards)} 
                                disabled={selectedCards.length === 0}
                                variant="primary"
                                size="lg"
                            >
                                ✅ Confirm Swap ({selectedCards.length})
                            </ActionButton>
                        </>
                    );
                }
                break;
            case GamePhase.OTHERS_SWAP_DECISION:
                 if (isHumanTurn && !humanPlayer.hasStoodPat) {
                     return (
                        <>
                            <p className="text-lg mb-2">{gameState.players[gameState.firstPlayerToAct].name} swapped {gameState.swapAmount} cards. Do you want to do the same?</p>
                            <div className="flex space-x-4">
                                <ActionButton 
                                    onClick={() => onOtherPlayerSwap(true)} 
                                    variant="primary"
                                >
                                    🔄 Swap {gameState.swapAmount}
                                </ActionButton>
                                <ActionButton 
                                    onClick={() => onOtherPlayerSwap(false)} 
                                    variant="secondary"
                                    requiresConfirmation={true}
                                    confirmationMessage="Are you sure you want to stand pat? You won't be able to swap cards in this round."
                                >
                                    ✋ Stand Pat
                                </ActionButton>
                            </div>
                        </>
                     );
                 }
                break;
            case GamePhase.OTHERS_SWAP_ACTION:
                if (isHumanTurn) {
                    return (
                        <>
                            <p className="text-lg mb-2">Select {gameState.swapAmount} cards to swap, then confirm.</p>
                            <ActionButton onClick={() => onConfirmSwap(selectedCards)} disabled={selectedCards.length !== gameState.swapAmount}>
                                Confirm Swap ({selectedCards.length}/{gameState.swapAmount})
                            </ActionButton>
                        </>
                    );
                }
                break;
            case GamePhase.VOTE_SWAP_DECISION:
                if (isHumanTurn && !humanPlayer.hasStoodPat && humanPlayer.wantsToVote === undefined) {
                    return (
                        <>
                            <p className="text-lg mb-2">The final swap is about to happen. Do you want to participate in the vote?</p>
                            <div className="flex space-x-4">
                                <ActionButton onClick={() => onVoteDecision(true)}>Vote to Swap</ActionButton>
                                <ActionButton onClick={() => onVoteDecision(false)} color="bg-gray-600 hover:bg-gray-500">Stay</ActionButton>
                            </div>
                        </>
                    );
                }
                break;
            case GamePhase.VOTE_SWAP:
                if (isHumanTurn && !humanPlayer.hasVoted && humanPlayer.wantsToVote) {
                    return (
                        <>
                            <p className="text-lg mb-2">Vote for how many cards to swap:</p>
                            <div className="flex space-x-2">
                                {[1, 2, 3, 4, 5].map(n => <ActionButton key={n} onClick={() => onVote(n)}>{n}</ActionButton>)}
                            </div>
                        </>
                    )
                }
                break;
            case GamePhase.FINAL_SWAP_DECISION:
                if (isHumanTurn && !humanPlayer.hasMadeFinalSwapDecision && !humanPlayer.hasStoodPat) {
                    return (
                        <>
                            <p className="text-lg mb-2">The vote is to swap {gameState.voteResult}. Do you want to participate?</p>
                             <div className="flex space-x-4">
                                <ActionButton onClick={() => onFinalSwapDecision(true)}>Yes, swap {gameState.voteResult}</ActionButton>
                                <ActionButton onClick={() => onFinalSwapDecision(false)} color="bg-gray-600 hover:bg-gray-500">No</ActionButton>
                            </div>
                        </>
                    )
                }
                break;
            case GamePhase.FINAL_SWAP_ACTION:
                if (!humanPlayer.hasStoodPat) {
                     return (
                        <>
                            <p className="text-lg mb-2">Select {gameState.voteResult} cards for the final swap.</p>
                            <ActionButton onClick={() => onFinalSwap(selectedCards)} disabled={selectedCards.length !== gameState.voteResult}>
                                Confirm Swap ({selectedCards.length}/{gameState.voteResult})
                            </ActionButton>
                        </>
                    );
                }
                 break;
            case GamePhase.FINAL_SWAP_ONE_CARD_SELECT:
                if (isHumanTurn) {
                    return <p className="text-lg mb-2">Select a card from your hand to swap.</p>;
                }
                break;
            case GamePhase.GAMEPLAY:
                if (isHumanTurn) {
                    return (
                        <ActionButton onClick={onPlayCards} disabled={selectedCards.length === 0}>
                            Play Card(s)
                        </ActionButton>
                    )
                }
                break;
            case GamePhase.MINIGAME_SWAP:
                if (isHumanTurn) {
                    return (
                        <>
                            <p className="text-lg mb-2">Minigame! Keep your 3 cards or swap for 3 new ones?</p>
                            <div className="flex space-x-4">
                                <ActionButton onClick={() => onMinigameSwap(true)}>Swap</ActionButton>
                                <ActionButton onClick={() => onMinigameSwap(false)} color="bg-gray-600 hover:bg-gray-500">Keep</ActionButton>
                            </div>
                        </>
                    );
                }
                break;
            default:
                return null;
        }
    }
    
    const content = renderContent();
    if (!content) return null;

    return (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 p-6 rounded-xl shadow-lg z-40 flex flex-col items-center max-w-md">
             {timer > 0 && <div className="absolute -top-4 -right-4 w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-xl font-bold border-2 border-white">{timer}</div>}
             {content}
        </div>
    )
}

export default ActionPanel;
