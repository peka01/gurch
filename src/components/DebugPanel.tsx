import React from 'react';

interface DebugPanelProps {
  onTestOneCardSwap: () => void;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ onTestOneCardSwap }) => {
  return (
    <div className="absolute bottom-4 right-4 bg-gray-800 bg-opacity-80 p-4 rounded-lg shadow-lg z-50 text-white">
      <h3 className="text-lg font-bold mb-2 border-b border-gray-600 pb-1">Debug Panel</h3>
      <div className="flex flex-col space-y-2">
        <button
          onClick={onTestOneCardSwap}
          className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded"
        >
          Test One-Card Swap
        </button>
      </div>
    </div>
  );
};

export default DebugPanel;
