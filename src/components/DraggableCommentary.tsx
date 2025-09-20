import React, { useState, useRef, useEffect } from 'react';

interface DraggableCommentaryProps {
  commentary: string[];
}

const DraggableCommentary: React.FC<DraggableCommentaryProps> = ({ commentary }) => {
  const [position, setPosition] = useState({ x: window.innerWidth - 350, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === dragRef.current || (dragRef.current && dragRef.current.contains(e.target as Node))) {
      const rect = dragRef.current!.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Keep within viewport bounds
      const maxX = window.innerWidth - 320; // Updated for larger box (w-80)
      const maxY = window.innerHeight - (isMinimized ? 40 : 160); // Updated for larger height
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
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
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={dragRef}
      className={`fixed z-50 bg-black/80 backdrop-blur-sm rounded-lg border border-amber-500/30 shadow-xl transition-all duration-200 ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      } ${isMinimized ? 'w-60' : 'w-80'}`}
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.8)', // Fallback black/80
        backdropFilter: 'blur(4px)', // Fallback backdrop blur
        left: position.x,
        top: position.y,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header - draggable area */}
      <div className="flex items-center justify-between p-2 border-b border-amber-500/20">
        <div className="flex items-center text-cyan-300 text-sm font-semibold">
          <span className="mr-1">💬</span> Commentary
        </div>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-amber-300 hover:text-white transition-colors text-sm px-1"
        >
          {isMinimized ? '▼' : '▲'}
        </button>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="p-3">
          <div className="space-y-2 max-h-32 overflow-y-auto text-sm">
            {commentary.slice(0, 4).map((line, index) => (
              <div key={index} className={`transition-opacity duration-500 ${
                index === 0 ? 'opacity-100 font-semibold text-white' : 'opacity-70 text-gray-300'
              }`}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DraggableCommentary;
