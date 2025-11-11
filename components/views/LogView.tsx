import React, { useEffect, useRef } from 'react';

interface LogViewProps {
  isOpen: boolean;
  onClose: () => void;
  log: string[];
}

export const LogView: React.FC<LogViewProps> = ({ isOpen, onClose, log }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, log]);

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in-short"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-lg border-4 border-yellow-600 shadow-2xl w-full max-w-4xl h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b-2 border-yellow-500 flex justify-between items-center">
          <h2 className="text-3xl font-press-start text-yellow-300">Event Log</h2>
          <button 
            onClick={onClose} 
            className="text-3xl font-bold text-gray-400 hover:text-white transition-colors"
            aria-label="Close log"
          >
            &times;
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow bg-black/30">
          <div className="space-y-2 text-lg">
            {log.map((entry, index) => (
              <p key={index} className="text-gray-300">{`> ${entry}`}</p>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
