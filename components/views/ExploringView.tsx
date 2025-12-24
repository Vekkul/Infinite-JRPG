
import React from 'react';
import { GameAction } from '../../types';
import { useTypewriter } from '../../hooks/useTypewriter';

interface ExploringViewProps {
  storyText: string;
  actions: GameAction[];
  onAction: (action: GameAction) => void;
}

export const ExploringView: React.FC<ExploringViewProps> = ({ storyText, actions, onAction }) => {
  const displayedText = useTypewriter(storyText, 30);

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-2 pb-2">
          <p className="animate-fade-in text-lg md:text-xl leading-relaxed">{displayedText}</p>
      </div>
      
      {/* Fixed Bottom Actions */}
      <div className="flex-shrink-0 pt-2 border-t border-gray-700/50 mt-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
          {actions.map((action, index) => (
            <button 
              key={index} 
              onClick={() => onAction(action)} 
              className={`w-full text-base md:text-lg text-white font-bold py-3 md:py-4 px-4 rounded-lg border-2 shadow-lg active:transform active:scale-95 transition-all duration-200 ${
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
    </div>
  );
};
