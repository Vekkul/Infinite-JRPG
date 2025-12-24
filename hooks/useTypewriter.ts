
import { useState, useEffect, useRef } from 'react';

export const useTypewriter = (text: string, speed: number = 30): string => {
  const [displayedText, setDisplayedText] = useState('');
  const requestRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const indexRef = useRef<number>(0);

  useEffect(() => {
    setDisplayedText('');
    indexRef.current = 0;
    startTimeRef.current = 0;

    if (!text) return;

    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      
      const elapsed = time - startTimeRef.current;
      
      // Calculate how many characters should be shown based on speed and elapsed time
      const charsToShow = Math.floor(elapsed / speed);
      
      if (charsToShow > indexRef.current) {
        indexRef.current = charsToShow;
        setDisplayedText(text.substring(0, indexRef.current));
      }

      if (indexRef.current < text.length) {
        requestRef.current = requestAnimationFrame(animate);
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(requestRef.current);
  }, [text, speed]);

  return displayedText;
};
