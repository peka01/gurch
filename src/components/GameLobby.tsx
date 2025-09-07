
import React, { useState } from 'react';
import { GameMode } from '../../types';

interface GameLobbyProps {
  onStartGame: (numPlayers: number, mode: GameMode) => void;
}

const GameLobby: React.FC<GameLobbyProps> = ({ onStartGame }) => {
  const [numPlayers, setNumPlayers] = useState<number>(3);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.VS_BOTS);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md">
        <h2 className="text-3xl font-bold text-center mb-6 text-cyan-300">New Game</h2>
        
        <div className="mb-6">
          <label className="block text-lg font-semibold mb-2 text-gray-300">Number of Players</label>
          <div className="flex justify-center space-x-4">
            {[3, 4].map((num) => (
              <button
                key={num}
                onClick={() => setNumPlayers(num)}
                className={`px-6 py-3 rounded-lg text-xl font-bold transition-all duration-200 ${
                  numPlayers === num 
                  ? 'bg-cyan-500 text-white shadow-lg scale-105' 
                  : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-lg font-semibold mb-2 text-gray-300">Game Mode</label>
          <div className="space-y-3">
            <LobbyButton
              icon="fa-robot"
              text="VS Bots"
              active={gameMode === GameMode.VS_BOTS}
              onClick={() => setGameMode(GameMode.VS_BOTS)}
            />
             <LobbyButton
              icon="fa-glass-cheers"
              text="Play for Fun (Online)"
              active={gameMode === GameMode.PLAY_FOR_FUN}
              onClick={() => {}}
              disabled={true}
            />
             <LobbyButton
              icon="fa-user-friends"
              text="Play with Friends"
              active={gameMode === GameMode.FRIENDS}
              onClick={() => {}}
              disabled={true}
            />
          </div>
        </div>

        <button 
          onClick={() => onStartGame(numPlayers, gameMode)}
          className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 text-xl rounded-lg shadow-lg transition-transform duration-200 transform hover:scale-105"
        >
          Start Game
        </button>
      </div>
    </div>
  );
};

interface LobbyButtonProps {
    icon: string;
    text: string;
    active: boolean;
    onClick: () => void;
    disabled?: boolean;
}

const LobbyButton: React.FC<LobbyButtonProps> = ({ icon, text, active, onClick, disabled }) => {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full flex items-center justify-start p-4 rounded-lg border-2 transition-all duration-200 ${
                active 
                ? 'bg-cyan-500/20 border-cyan-500' 
                : `bg-gray-700 border-gray-600 ${!disabled ? 'hover:bg-gray-600 hover:border-gray-500' : 'opacity-50 cursor-not-allowed'}`
            }`}
        >
            <i className={`fas ${icon} w-8 text-xl text-center ${active ? 'text-cyan-400' : 'text-gray-400'}`}></i>
            <span className="ml-4 text-lg font-semibold">{text}</span>
            {disabled && <span className="ml-auto text-xs bg-gray-600 px-2 py-1 rounded">Soon</span>}
        </button>
    );
}

export default GameLobby;
