
import React, { useState, useRef, useEffect } from 'react';
import { GameState, Card, GamePhase } from '../../types';
import ConfirmationModal from './ConfirmationModal';

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
    confirmationTitle?: string;
    confirmationVariant?: 'warning' | 'danger' | 'info';
}

const ActionButton: React.FC<ActionButtonProps> = ({ 
    onClick, 
    disabled, 
    children, 
    color, 
    variant = 'primary',
    size = 'md',
    requiresConfirmation = false,
    confirmationMessage,
    confirmationTitle = "Confirm Action",
    confirmationVariant = 'warning'
}) => {
    const [showConfirmation, setShowConfirmation] = useState(false);
    const getVariantClasses = () => {
        if (color) return color;
        
        switch (variant) {
            case 'primary': return 'bg-gradient-to-br from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 shadow-cyan-500/50 border-cyan-400';
            case 'secondary': return 'bg-gradient-to-br from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 shadow-amber-500/50 border-amber-400';
            case 'danger': return 'bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 shadow-red-500/50 border-red-400';
            case 'warning': return 'bg-gradient-to-br from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 shadow-yellow-500/50 border-yellow-400';
            default: return 'bg-gradient-to-br from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 shadow-cyan-500/50 border-cyan-400';
        }
    };

    const getSizeClasses = () => {
        switch (size) {
            case 'sm': return 'px-3 py-2 text-sm min-h-[44px]'; // Touch-friendly minimum height
            case 'md': return 'px-4 py-3 text-sm md:px-6 md:py-3 min-h-[44px] md:min-h-[48px]';
            case 'lg': return 'px-6 py-4 text-lg md:px-8 md:py-4 min-h-[48px] md:min-h-[56px]';
            default: return 'px-4 py-3 text-sm md:px-6 md:py-3 min-h-[44px] md:min-h-[48px]';
        }
    };

    const handleClick = () => {
        if (requiresConfirmation && confirmationMessage) {
            setShowConfirmation(true);
        } else {
            onClick();
        }
    };

    const handleConfirm = () => {
        setShowConfirmation(false);
        onClick();
    };

    const handleCancel = () => {
        setShowConfirmation(false);
    };

    return (
        <>
            <button
                onClick={handleClick}
                disabled={disabled}
                className={`
                    ${getSizeClasses()} 
                    font-bold text-white rounded-xl shadow-lg transition-all duration-200 
                    disabled:opacity-50 disabled:cursor-not-allowed 
                    ${getVariantClasses()} 
                    transform disabled:scale-100 hover:scale-105 active:scale-95
                    border-2 hover:border-white/30
                    focus:outline-none focus:ring-4 focus:ring-white/30
                    touch-manipulation select-none
                `}
                style={{
                    backgroundColor: disabled ? '#6b7280' : (variant === 'secondary' ? '#d97706' : '#0891b2'), // Fallback colors
                    backgroundImage: disabled ? 'none' : (variant === 'secondary' ? 'linear-gradient(to bottom right, #d97706, #b45309)' : 'linear-gradient(to bottom right, #0891b2, #0e7490)')
                }}
                title={requiresConfirmation ? "Requires confirmation" : undefined}
            >
                {children}
            </button>
            
            <ConfirmationModal
                isOpen={showConfirmation}
                title={confirmationTitle}
                message={confirmationMessage || "Are you sure you want to proceed?"}
                confirmText="Yes, Continue"
                cancelText="Cancel"
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                variant={confirmationVariant}
            />
        </>
    );
};


const ActionPanel: React.FC<ActionPanelProps> = (props) => {
    const { gameState, selectedCards, timer, onSwapDecision, onConfirmSwap, onOtherPlayerSwap, onVote, onFinalSwapDecision, onFinalSwap, onPlayCards, onMinigameSwap, onVoteDecision } = props;
    const humanPlayer = gameState.players.find(p => p.isHuman);
    const isHumanTurn = gameState.players[gameState.currentPlayerIndex]?.isHuman;
    
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    // Drag functionality
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.target === panelRef.current || (e.target as HTMLElement).closest('.drag-handle')) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y
            });
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragStart]);
    
    const renderContent = () => {
        if (!humanPlayer) return null;

        if (!isHumanTurn) {
            const swapAndVotePhases = [
                GamePhase.FIRST_SWAP_DECISION, GamePhase.FIRST_SWAP_OTHERS_DECISION,
                GamePhase.OTHERS_SWAP_DECISION, GamePhase.VOTE_SWAP_DECISION,
                GamePhase.VOTE_SWAP, GamePhase.FINAL_SWAP_DECISION
            ];
            if (swapAndVotePhases.includes(gameState.gamePhase)) {
                 return <p className="text-sm font-medium text-amber-100">Waiting for other players...</p>;
            }
        }

        switch(gameState.gamePhase) {
            case GamePhase.DEALING:
                return (
                    <div className="text-amber-100">
                        <p className="text-sm font-medium">Dealing cards...</p>
                        <p className="text-xs opacity-80">Please wait while the dealer shuffles and deals the cards.</p>
                    </div>
                );
            case GamePhase.FIRST_SWAP_DECISION:
                if (isHumanTurn) {
                    return (
                        <div>
                            <p className="text-sm font-medium text-amber-100 mb-3">Do you want to swap cards or stand pat?</p>
                            <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-2">
                                <ActionButton 
                                    onClick={() => onSwapDecision(true)} 
                                    variant="primary" 
                                    size="sm"
                                >
                                    🔄 Swap
                                </ActionButton>
                                <ActionButton 
                                    onClick={() => onSwapDecision(false)} 
                                    variant="secondary"
                                    size="sm"
                                    requiresConfirmation={true}
                                    confirmationTitle="Stand Pat?"
                                    confirmationMessage="You won't be able to swap cards in this round if you stand pat. This decision cannot be undone."
                                    confirmationVariant="warning"
                                >
                                    ✋ Stand Pat
                                </ActionButton>
                            </div>
                        </div>
                    );
                }
                break;
            case GamePhase.FIRST_SWAP_OTHERS_DECISION:
                if (isHumanTurn) {
                    // Find the player who made the initial swap decision
                    const firstPlayer = gameState.players.find(p => p.hasMadeFirstSwapDecision && !p.hasStoodPat);
                    const playerName = firstPlayer ? firstPlayer.name : "A player";
                    
                    // Debug: Log the swap amount (only once per render) - commented out to prevent spam
                    // if (gameState.swapAmount !== 0) {
                    //     console.log(`[DEBUG] ActionPanel: swapAmount = ${gameState.swapAmount}, firstPlayer = ${playerName}`);
                    // }
                    
                    // Don't show the swap decision if swapAmount is 0 (no one wants to swap)
                    if (gameState.swapAmount === 0) {
                        return (
                            <div>
                                <p className="text-sm font-medium text-amber-100 mb-3">No one wants to swap cards. The game will proceed to voting.</p>
                                <div className="flex justify-center">
                                    <ActionButton 
                                        onClick={() => onOtherPlayerSwap(false)} 
                                        variant="primary" 
                                        size="sm"
                                    >
                                        Continue
                                    </ActionButton>
                                </div>
                            </div>
                        );
                    }
                    
                    return (
                        <div>
                            <p className="text-sm font-medium text-amber-100 mb-3">{playerName} chose to swap {gameState.swapAmount} cards. Do you want to swap the same number or stand pat?</p>
                            <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-2">
                                <ActionButton 
                                    onClick={() => onOtherPlayerSwap(true)} 
                                    variant="primary" 
                                    size="sm"
                                >
                                    🔄 Swap {gameState.swapAmount}
                                </ActionButton>
                                <ActionButton 
                                    onClick={() => onOtherPlayerSwap(false)} 
                                    variant="secondary"
                                    size="sm"
                                    requiresConfirmation={true}
                                    confirmationTitle="Stand Pat?"
                                    confirmationMessage="You won't be able to swap cards in this round if you stand pat. This decision cannot be undone."
                                    confirmationVariant="warning"
                                >
                                    ✋ Stand Pat
                                </ActionButton>
                            </div>
                        </div>
                    );
                }
                break;
            case GamePhase.FIRST_SWAP_ACTION:
                 if (isHumanTurn) {
                    return (
                        <div className="flex items-center space-x-3">
                            <p className="text-sm font-medium text-amber-100">Select cards to swap, then confirm.</p>
                            <ActionButton 
                                onClick={() => onConfirmSwap(selectedCards)} 
                                disabled={selectedCards.length === 0}
                                variant="primary"
                                size="sm"
                            >
                                ✅ Confirm ({selectedCards.length})
                            </ActionButton>
                        </div>
                    );
                }
                break;
            case GamePhase.OTHERS_SWAP_DECISION:
                 if (isHumanTurn && !humanPlayer.hasStoodPat) {
                     return (
                        <div className="flex items-center space-x-3">
                            <p className="text-sm font-medium text-amber-100">{gameState.players[gameState.firstPlayerToAct].name} swapped {gameState.swapAmount} cards. Do you want to do the same?</p>
                            <div className="flex space-x-2">
                                <ActionButton 
                                    onClick={() => onOtherPlayerSwap(true)} 
                                    variant="primary"
                                    size="sm"
                                >
                                    🔄 Swap {gameState.swapAmount}
                                </ActionButton>
                                <ActionButton 
                                    onClick={() => onOtherPlayerSwap(false)} 
                                    variant="secondary"
                                    size="sm"
                                    requiresConfirmation={true}
                                    confirmationTitle="Stand Pat?"
                                    confirmationMessage="You won't be able to swap cards in this round if you stand pat. This decision cannot be undone."
                                    confirmationVariant="warning"
                                >
                                    ✋ Stand Pat
                                </ActionButton>
                            </div>
                        </div>
                     );
                 }
                break;
            case GamePhase.OTHERS_SWAP_ACTION:
                if (isHumanTurn) {
                    return (
                        <div className="flex items-center space-x-3">
                            <p className="text-sm font-medium text-amber-100">Select {gameState.swapAmount} cards to swap, then confirm.</p>
                            <ActionButton onClick={() => onConfirmSwap(selectedCards)} disabled={selectedCards.length !== gameState.swapAmount} size="sm">
                                Confirm ({selectedCards.length}/{gameState.swapAmount})
                            </ActionButton>
                        </div>
                    );
                }
                break;
            case GamePhase.VOTE_SWAP_DECISION:
                if (isHumanTurn && !humanPlayer.hasStoodPat && humanPlayer.wantsToVote === undefined) {
                    return (
                        <div className="flex items-center space-x-3">
                            <p className="text-sm font-medium text-amber-100">Time to vote on the final swap! You participated in the first swap, so you can vote on how many cards to swap in the final round.</p>
                            <div className="flex space-x-2">
                                <ActionButton onClick={() => onVoteDecision(true)} size="sm">Participate</ActionButton>
                                <ActionButton onClick={() => onVoteDecision(false)} color="bg-gray-600 hover:bg-gray-500" size="sm">Skip</ActionButton>
                            </div>
                        </div>
                    );
                }
                break;
            case GamePhase.VOTE_SWAP:
                if (isHumanTurn && !humanPlayer.hasVoted && !humanPlayer.hasStoodPat) {
                    return (
                        <div>
                            <p className="text-sm font-medium text-amber-100 mb-3">Vote for how many cards to swap:</p>
                            <div className="flex flex-wrap justify-center gap-1 sm:gap-1">
                                {[1, 2, 3, 4, 5].map(n => <ActionButton key={n} onClick={() => onVote(n)} size="sm">{n}</ActionButton>)}
                            </div>
                        </div>
                    )
                }
                break;
            case GamePhase.FINAL_SWAP_DECISION:
                console.log(`[DEBUG] ActionPanel FINAL_SWAP_DECISION: isHumanTurn=${isHumanTurn}, hasMadeFinalSwapDecision=${humanPlayer.hasMadeFinalSwapDecision}, hasStoodPat=${humanPlayer.hasStoodPat}`);
                if (isHumanTurn && !humanPlayer.hasMadeFinalSwapDecision) {
                    return (
                        <div className="flex items-center space-x-3">
                            <p className="text-sm font-medium text-amber-100">The vote is to swap {gameState.voteResult} cards. Do you want to participate?</p>
                            <div className="flex space-x-2">
                                <ActionButton onClick={() => onFinalSwapDecision(true)} size="sm">Yes, swap {gameState.voteResult}</ActionButton>
                                <ActionButton onClick={() => onFinalSwapDecision(false)} color="bg-gray-600 hover:bg-gray-500" size="sm">No, pass</ActionButton>
                            </div>
                        </div>
                    )
                }
                break;
            case GamePhase.FINAL_SWAP_ACTION:
                if (isHumanTurn && !humanPlayer.hasStoodPat && humanPlayer.hasMadeFinalSwapDecision) {
                     return (
                        <div className="flex items-center space-x-3">
                            <p className="text-sm font-medium text-amber-100">Select {gameState.voteResult} cards for the final swap.</p>
                            <ActionButton onClick={() => onFinalSwap(selectedCards)} disabled={selectedCards.length !== gameState.voteResult} size="sm">
                                Confirm ({selectedCards.length}/{gameState.voteResult})
                            </ActionButton>
                        </div>
                    );
                } else if (isHumanTurn && humanPlayer.hasStoodPat) {
                    return <p className="text-sm font-medium text-amber-100">You've decided not to participate in the final swap. Waiting for other players...</p>;
                }
                 break;
            case GamePhase.FINAL_SWAP_ONE_CARD_SELECT:
                if (isHumanTurn) {
                    return <p className="text-sm font-medium text-amber-100">Select a card from your hand to swap.</p>;
                }
                break;
            case GamePhase.GAMEPLAY:
                // Don't show ActionPanel during gameplay - use floating play button instead
                return null;
            case GamePhase.MINIGAME_SWAP:
                if (isHumanTurn) {
                    return (
                        <div className="flex items-center space-x-3">
                            <p className="text-sm font-medium text-amber-100">Minigame! Keep your 3 cards or swap for 3 new ones?</p>
                            <div className="flex space-x-2">
                                <ActionButton onClick={() => onMinigameSwap(true)} size="sm">Swap</ActionButton>
                                <ActionButton onClick={() => onMinigameSwap(false)} color="bg-gray-600 hover:bg-gray-500" size="sm">Keep</ActionButton>
                            </div>
                        </div>
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
        <div 
            ref={panelRef}
            className="fixed inset-0 flex items-center justify-center z-40 pointer-events-none"
        >
            <div 
                className="pointer-events-auto"
            >
            <div 
                className="bg-gradient-to-r from-amber-800/90 to-amber-900/90 backdrop-blur-md border-2 border-amber-400/70 rounded-xl shadow-2xl p-3 sm:p-4 text-center min-w-[280px] sm:min-w-[400px] max-w-[90vw] sm:max-w-[600px]"
                style={{
                    backgroundColor: 'rgba(146, 64, 14, 0.9)', // Fallback amber-800/90
                    backgroundImage: 'linear-gradient(to right, rgba(146, 64, 14, 0.9), rgba(120, 53, 15, 0.9))' // Fallback gradient
                }}
            >
                <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2">
                    {timer > 0 && (
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-600 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold border-2 border-white shadow-lg">
                            {timer}
                        </div>
                    )}
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-amber-200 to-amber-300 rounded-full flex items-center justify-center text-xs sm:text-sm">
                        🎯
                    </div>
                    <div className="text-amber-200 text-xs sm:text-sm font-semibold">ACTION REQUIRED</div>
                </div>
                {content}
            </div>
            </div>
        </div>
    )
}

export default ActionPanel;
