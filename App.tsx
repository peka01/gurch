import React, { useState } from 'react';
import GameBoard from './src/components/GameBoard';
import GameLobby from './src/components/GameLobby';
import { Player } from './types';
import { generateAvatar } from './src/services/avatarService';
import { GameMode } from './types';
import { useEffect } from 'react';

const App: React.FC = () => {
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.VS_BOTS);
  const [numberOfPlayers, setNumberOfPlayers] = useState<number>(3);
  const [loadingAvatars, setLoadingAvatars] = useState<boolean>(false);

  useEffect(() => {
    // A simple way to inject a style tag for the font
    const style = document.createElement('style');
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
      body {
        font-family: 'Poppins', sans-serif;
      }
    `;
    document.head.appendChild(style);
  }, []);


  const startGame = async (numPlayers: number, mode: GameMode) => {
    setLoadingAvatars(true);
    setNumberOfPlayers(numPlayers);
    setGameMode(mode);

    // FIX: Initialize hand and playedCards for new Player object
    const newPlayers: Player[] = [{ id: 'player1', name: 'You', isHuman: true, avatar: '', hand: [], playedCards: [] }];
    
    const avatarPrompts = [
      "A clever fox in a fantasy tavern, vector art",
      "A wise owl wizard, vector art",
      "A stoic badger knight, vector art"
    ];

    const avatarPromises: Promise<string>[] = [generateAvatar("A heroic human card player, vector art")];

    for (let i = 2; i <= numPlayers; i++) {
      const isBot = mode === GameMode.VS_BOTS;
      // FIX: Initialize hand and playedCards for new Player object
      newPlayers.push({ id: `player${i}`, name: isBot ? `Bot ${i-1}` : `Player ${i}`, isHuman: false, avatar: '', hand: [], playedCards: [] });
      avatarPromises.push(generateAvatar(avatarPrompts[i-2]));
    }

    try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Avatar generation timeout')), 5000)
        );
        
        const avatars = await Promise.race([
            Promise.all(avatarPromises),
            timeoutPromise
        ]) as string[];
        
        newPlayers.forEach((player, index) => {
            player.avatar = avatars[index];
        });
        setPlayers(newPlayers);
        setGameStarted(true);
    } catch (error) {
        console.warn("Avatar generation failed or timed out, using fallback avatars:", error);
        // Fallback avatars - using more reliable sources
        const fallbackAvatars = [
            'https://api.dicebear.com/7.x/avataaars/svg?seed=player1&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf',
            'https://api.dicebear.com/7.x/avataaars/svg?seed=player2&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf',
            'https://api.dicebear.com/7.x/avataaars/svg?seed=player3&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf',
            'https://api.dicebear.com/7.x/avataaars/svg?seed=player4&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf'
        ];
        newPlayers.forEach((player, index) => {
            player.avatar = fallbackAvatars[index];
        });
        setPlayers(newPlayers);
        setGameStarted(true);
    } finally {
        setLoadingAvatars(false);
    }
  };

  const quitGame = () => {
    setGameStarted(false);
    setPlayers([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 text-white p-2 sm:p-4 flex flex-col items-center justify-center">
      <header className="w-full text-center mb-2 sm:mb-4 relative z-50">
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-cyan-400" style={{ textShadow: '0 0 10px rgba(0, 255, 255, 0.7)'}}>
          <i className="fas fa-crown mr-2 sm:mr-3"></i>Gurch Card Game
        </h1>
      </header>
      <main className="w-full max-w-7xl flex-grow">
        {loadingAvatars && (
            <div className="flex flex-col items-center justify-center h-full">
                <div className="animate-spin rounded-full h-24 w-24 sm:h-32 sm:w-32 border-t-2 border-b-2 border-cyan-400"></div>
                <p className="mt-4 text-lg sm:text-xl text-center px-4">Generating amazing avatars...</p>
            </div>
        )}
        {!gameStarted && !loadingAvatars && <GameLobby onStartGame={startGame} />}
        {gameStarted && !loadingAvatars && <GameBoard players={players} onQuit={quitGame} />}
      </main>
    </div>
  );
};

export default App;