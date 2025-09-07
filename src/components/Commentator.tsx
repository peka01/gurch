
import React, { useState, useRef } from 'react';
import { Player } from '../types';

interface CommentatorProps {
    commentary: string[];
    players: Player[];
}

const Commentator: React.FC<CommentatorProps> = ({ commentary, players }) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 });
    const dragRef = useRef<HTMLDivElement>(null);

    // Calculate optimal initial position to avoid overlapping with players
    const getOptimalPosition = () => {
        const humanIndex = players.findIndex(p => p.isHuman);
        if (humanIndex === -1) return { x: 16, y: 16 }; // Fallback if no human player found
        
        const playerCount = players.length;
        
        if (playerCount === 2) {
            // Human at bottom, bot at top - use top-right corner
            return { x: 16, y: 16 };
        }
        
        if (playerCount === 3) {
            // Human at bottom, bots at right and left - use top-right to avoid Cards in Play display
            return { x: 16, y: 16 };
        }
        
        if (playerCount === 4) {
            // Human at bottom, bots at top, left, right - use bottom-right corner
            return { x: 16, y: window.innerHeight - 200 };
        }
        
        // Default fallback
        return { x: 16, y: 16 };
    };

    // Set initial position on mount
    React.useEffect(() => {
        const initialPos = getOptimalPosition();
        setPosition(initialPos);
        setInitialPosition(initialPos);
    }, [players.length]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setInitialPosition(position);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        
        setPosition({
            x: Math.max(0, Math.min(window.innerWidth - 300, initialPosition.x + deltaX)),
            y: Math.max(0, Math.min(window.innerHeight - 200, initialPosition.y + deltaY))
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    React.useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragStart, initialPosition]);

    return (
        <div 
            ref={dragRef}
            className={`absolute w-56 md:w-72 bg-black/50 p-3 rounded-lg shadow-lg z-30 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} select-none`}
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: 'none'
            }}
            onMouseDown={handleMouseDown}
        >
            <h3 className="text-lg font-bold mb-2 text-cyan-300 border-b border-cyan-300/50 pb-1 flex items-center">
                <i className="fas fa-comment-dots mr-2"></i>Commentary
                <span className="ml-auto text-xs opacity-50">Drag to move</span>
            </h3>
            <ul className="space-y-2 text-sm">
                {commentary.map((line, index) => (
                    <li key={index} className={`transition-opacity duration-500 ${index === 0 ? 'opacity-100 font-semibold text-white' : 'opacity-60'}`}>
                        {line}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Commentator;
