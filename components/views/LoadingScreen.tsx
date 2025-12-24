
import React, { useState, useEffect } from 'react';

const loadingMessages = [
    "Consulting the ancient maps...",
    "The mists of fate are swirling...",
    "A new path reveals itself...",
    "Waking the spirits of the world...",
    "Deciphering forgotten prophecies...",
    "Generating your next step...",
];

export const LoadingScreen: React.FC = () => {
    const [message, setMessage] = useState(loadingMessages[0]);

    useEffect(() => {
        const interval = setInterval(() => {
            setMessage(prevMessage => {
                const currentIndex = loadingMessages.indexOf(prevMessage);
                const nextIndex = (currentIndex + 1) % loadingMessages.length;
                return loadingMessages[nextIndex];
            });
        }, 3000); // Change message every 3 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="text-center flex flex-col items-center justify-center flex-grow">
            <div className="animate-spin rounded-full h-32 w-32 border-t-4 border-b-4 border-yellow-400"></div>
            <p className="mt-4 text-2xl transition-opacity duration-500">{message}</p>
        </div>
    );
};
