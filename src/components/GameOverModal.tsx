
import React from 'react';
import { Player, Card } from '../../types';
import CardComponent from './Card'; // Import the Card component

interface GameOverModalProps {
  players: Player[];
  winnerId?: string;
  loserId?: string;
  onPlayAgain: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({ players, winnerId, loserId, onPlayAgain }) => {
  const winner = players.find(p => p.id === winnerId);
  const loser = players.find(p => p.id === loserId);

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 p-6 sm:p-8 rounded-xl shadow-2xl border-2 border-cyan-400 text-center w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl flex flex-col max-h-[90vh]">
        <h2 className="text-4xl font-bold mb-4 text-cyan-300">Game Over!</h2>
        
        <div className="overflow-y-auto px-2">
              {winner && (
                <div className="mb-6">
                  <h3 className="text-2xl font-semibold text-yellow-400">Winner!</h3>
                  <div className="flex items-center justify-center mt-2">
                    <img src={winner.avatar} alt={winner.name} className="w-24 h-24 rounded-full border-4 border-yellow-400" />
                    <p className="ml-4 text-3xl font-bold">{winner.name}</p>
                  </div>
                </div>
              )}

              <div className="mb-8 p-4 bg-black/30 rounded-lg">
                  <h3 className="text-xl font-semibold text-gray-300 mb-4 border-b border-gray-600 pb-2">Final Hands</h3>
                  <div className="space-y-4">
                      {players.map(player => (
                          <div key={player.id} className={`flex items-center p-2 rounded-lg ${player.id === loserId ? 'bg-red-500/20' : ''}`}>
                              <img src={player.avatar} alt={player.name} className="w-12 h-12 rounded-full border-2 border-gray-400" />
                              <p className="ml-4 text-lg font-semibold flex-1 text-left">{player.name}</p>
                              <div className="flex space-x-1">
                                  {player.hand.map((card, index) => (
                                      <CardComponent key={index} card={card} small={true} />
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              {loser && (
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-red-400">Highest Hand</h3>
                   <div className="flex items-center justify-center mt-2">
                    <img src={loser.avatar} alt={loser.name} className="w-16 h-16 rounded-full border-2 border-red-400" />
                    <p className="ml-4 text-xl">{loser.name}</p>
                  </div>
                   <p className="text-gray-400 mt-2">With a hand value of {loser.hand.reduce((sum, card) => sum + card.value, 0)}</p>
                </div>
              )}
          </div>

          <button
            onClick={onPlayAgain}
            className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 text-xl rounded-lg shadow-lg transition-transform duration-200 transform hover:scale-105 mt-auto"
          >
            Play Again
          </button>
        </div>
    </div>
  );
};

export default GameOverModal;
