
import React from 'react';
import { SocialEncounter, SocialChoice } from '../../types';
import { useTypewriter } from '../../hooks/useTypewriter';

interface SocialEncounterViewProps {
  encounter: SocialEncounter;
  onChoice: (choice: SocialChoice) => void;
}

export const SocialEncounterView: React.FC<SocialEncounterViewProps> = ({ encounter, onChoice }) => {
  const displayedText = useTypewriter(encounter.description, 30);

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-2 pb-2">
          <p className="animate-fade-in text-lg md:text-xl leading-relaxed">{displayedText}</p>
      </div>
      
      {/* Fixed Bottom Choices */}
      <div className="flex-shrink-0 pt-2 border-t border-gray-700/50 mt-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
          {encounter.choices.map((choice, index) => (
            <button 
              key={index} 
              onClick={() => onChoice(choice)} 
              className="w-full text-base md:text-lg bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 md:py-4 px-4 rounded-lg border-2 border-gray-500 active:scale-95 transition-all duration-200"
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
