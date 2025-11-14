import React from 'react';
import { GameAction } from '../../types';
import { useTypewriter } from '../../hooks/useTypewriter';

interface ExploringViewProps {
  storyText: string;
  actions: GameAction[];
  onAction: (action: GameAction) => void;
}

export const ExploringView: React.FC<ExploringViewProps> = ({ storyText, actions, onAction }) => {
  const displayedText = useTypewriter(storyText, 20);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow">
          <p className="animate-fade-in">{displayedText}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        {actions.map((action, index) => (
          <button 
            key={index} 
            onClick={() => onAction(action)} 
            className={`w-full text-lg text-white font-bold py-3 px-4 rounded-lg border-2 transition-all duration-200 transform hover:scale-105 ${
                action.type === 'move'
                ? 'bg-green-700 hover:bg-green-600 border-green-500'
                : 'bg-gray-700 hover:bg-gray-600 border-gray-500'
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};
