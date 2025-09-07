import React from 'react';
import { GameState, Card, GamePhase } from '../types';

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
}

const ActionButton: React.FC<{onClick: () => void, disabled?: boolean, children: React.ReactNode, color?: string}> = ({ onClick, disabled, children, color = 'bg-cyan-600 hover:bg-cyan-500' }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`px-6 py-3 font-bold text-white rounded-lg shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${color} transform disabled:scale-100 hover:scale-105`}
    >
        {children}
    </button>
);


const ActionPanel: React.FC<ActionPanelProps> = (props) => {
    const { gameState, selectedCards, timer, onSwapDecision, onConfirmSwap, onOtherPlayerSwap, onVote, onFinalSwapDecision, onFinalSwap, onPlayCards, onMinigameSwap } = props;
    const humanPlayer = gameState.players.find(p => p.isHuman);
    const isHumanTurn = gameState.players[gameState.currentPlayerIndex]?.isHuman;
    
    const renderContent = () => {
        if (!humanPlayer) return null;

        switch(gameState.gamePhase) {
            case GamePhase.FIRST_SWAP_DECISION:
                if (isHumanTurn) {
                    return (
                        <>
                            <p className="text-lg mb-2">Do you want to swap cards or start the game?</p>
                            <div className="flex space-x-4">
                                <ActionButton onClick={() => onSwapDecision(true)}>Swap Cards</ActionButton>
                                <ActionButton onClick={() => onSwapDecision(false)} color="bg-green-600 hover:bg-green-500">Start Game</ActionButton>
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
                            <ActionButton onClick={() => onConfirmSwap(selectedCards)} disabled={selectedCards.length === 0}>
                                Confirm Swap ({selectedCards.length})
                            </ActionButton>
                        </>
                    );
                }
                break;
            case GamePhase.OTHERS_SWAP_DECISION:
                 if (isHumanTurn) {
                     return (
                        <>
                            <p className="text-lg mb-2">{gameState.players[gameState.firstPlayerToAct].name} swapped {gameState.swapAmount} cards. Do you want to do the same?</p>
                            <div className="flex space-x-4">
                                <ActionButton onClick={() => onOtherPlayerSwap(true)}>Swap {gameState.swapAmount}</ActionButton>
                                <ActionButton onClick={() => onOtherPlayerSwap(false)} color="bg-gray-600 hover:bg-gray-500">Stand Pat</ActionButton>
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
            case GamePhase.VOTE_SWAP:
                if (isHumanTurn && !humanPlayer.hasVoted) {
                    return (
                        <>
                            <p className="text-lg mb-2">Vote for how many cards to swap:</p>
                            <div className="flex space-x-2">
                                {[1,2,3,4,5].map(n => <ActionButton key={n} onClick={() => onVote(n)}>{n}</ActionButton>)}
                            </div>
                        </>
                    )
                }
                break;
            case GamePhase.FINAL_SWAP_DECISION:
                if (isHumanTurn && !humanPlayer.hasMadeFinalSwapDecision) {
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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 p-6 rounded-xl shadow-lg z-40 flex flex-col items-center">
             {timer > 0 && <div className="absolute -top-4 -right-4 w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-xl font-bold border-2 border-white">{timer}</div>}
             {content}
        </div>
    )
}

export default ActionPanel;