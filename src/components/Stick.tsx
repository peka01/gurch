import React from 'react';

interface StickProps {
  position: { x: number; y: number };
  isAnimating?: boolean;
  className?: string;
}

const Stick: React.FC<StickProps> = ({ position, isAnimating = false, className = '' }) => {
  return (
    <div
      className={`absolute transition-all duration-1500 ease-in-out ${className}`}
      style={{
        left: position.x - 15,
        top: position.y - 30,
        transform: isAnimating ? 'scale(1.5) rotate(15deg)' : 'scale(1) rotate(0deg)',
        zIndex: 70,
        filter: isAnimating ? 'drop-shadow(0 0 30px rgba(255,215,0,1))' : 'drop-shadow(0 0 10px rgba(0,0,0,0.5))'
      }}
    >
      {/* Stick body */}
      <div className="relative">
        {/* Main stick */}
        <div className="w-8 h-24 bg-gradient-to-b from-amber-600 to-amber-800 rounded-full shadow-lg border-2 border-amber-700">
          {/* Stick tip */}
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-amber-500 rounded-full border border-amber-600"></div>
          
          {/* Decorative bands */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-amber-400 rounded-full"></div>
          <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-amber-400 rounded-full"></div>
          <div className="absolute top-12 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-amber-400 rounded-full"></div>
          
          {/* Bottom cap */}
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-4 bg-amber-700 rounded-full border border-amber-800"></div>
        </div>
        
        {/* Enhanced glow effect when animating */}
        {isAnimating && (
          <>
            <div className="absolute inset-0 w-8 h-24 bg-yellow-400/40 rounded-full animate-pulse"></div>
            <div className="absolute -inset-2 w-12 h-28 bg-yellow-300/20 rounded-full animate-ping"></div>
            <div className="absolute -inset-4 w-16 h-32 bg-orange-300/10 rounded-full animate-ping" style={{animationDelay: '0.5s'}}></div>
          </>
        )}
      </div>
    </div>
  );
};

export default Stick;
