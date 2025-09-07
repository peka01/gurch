import { useState, useEffect } from 'react';
import GameBoard from './components/GameBoard';
import GameLobby from './components/GameLobby';
import { Player, GameMode } from './types';
import { generateAvatar } from './services/avatarService';

function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameMode, setGameMode] = useState<GameMode | null>(null);

  useEffect(() => {
    // Pre-cache bot avatars
    if (gameMode === GameMode.VS_BOTS) {
      const botNames = ["Bot 1", "Bot 2", "Bot 3"];
      botNames.forEach(name => {
        generateAvatar(`A cool, confident card player, cinematic, ${name}`);
      });
    }
  }, [gameMode]);


  const handleGameStart = async (playerData: { name: string, avatar: string }, mode: GameMode, numBots: number) => {
    const humanPlayer: Player = {
      ...playerData,
      id: 'human',
      hand: [],
      playedCards: [],
      isHuman: true,
      score: 0,
    };

    const botPlayers: Player[] = [];
    for (let i = 1; i <= numBots; i++) {
        const botName = `Bot ${i}`;
        const botAvatar = await generateAvatar(`A cool, confident card player, cinematic, ${botName}`);
        botPlayers.push({
            id: `bot-${i}`,
            name: botName,
            avatar: botAvatar,
            hand: [],
            playedCards: [],
            isHuman: false,
            score: 0,
        });
    }
    
    setPlayers([humanPlayer, ...botPlayers]);
    setGameMode(mode);
  };

  const handleQuit = () => {
    setPlayers([]);
    setGameMode(null);
  }

  return (
    <div className="bg-gray-800 text-white min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-5xl font-bold mb-8">Gurch</h1>
      {players.length === 0 ? (
        <GameLobby onGameStart={handleGameStart} />
      ) : (
        <GameBoard players={players} onQuit={handleQuit} />
      )}
    </div>
  );
}

export default App;