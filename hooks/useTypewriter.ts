import { useState, useEffect } from 'react';

export const useTypewriter = (text: string, speed: number = 30): string => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    // When the target text changes, reset the displayed text.
    setDisplayedText('');

    if (text) {
      let index = 0;
      const intervalId = setInterval(() => {
        if (index < text.length) {
          setDisplayedText((prev) => prev + text.charAt(index));
          index++;
        } else {
          clearInterval(intervalId);
        }
      }, speed);

      // Cleanup function to clear the interval when the component unmounts or text changes.
      return () => clearInterval(intervalId);
    }
  }, [text, speed]);

  return displayedText;
};
