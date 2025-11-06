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
      <div className="flex-grow">
          <p className="animate-fade-in">{displayedText}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        {encounter.choices.map((choice, index) => (
          <button 
            key={index} 
            onClick={() => onChoice(choice)} 
            className="w-full text-lg bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg border-2 border-gray-500 transition-all duration-200 transform hover:scale-105"
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
};
