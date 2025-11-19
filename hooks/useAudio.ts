import { useState, useRef, useCallback, useEffect } from 'react';
import { generateSpeech } from '../services/geminiService';
import { GameState } from '../types';

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const useAudio = (storyText: string, gameState: GameState) => {
    const [isTtsEnabled, setIsTtsEnabled] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const currentSpeechSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const spokenTextRef = useRef<string>('');

    const playSpeech = useCallback(async (text: string) => {
        if (!text || !audioContextRef.current) return;

        // Stop any previous speech
        if (currentSpeechSourceRef.current) {
            currentSpeechSourceRef.current.stop();
            currentSpeechSourceRef.current = null;
        }

        setIsSpeaking(true);
        spokenTextRef.current = text;

        const { audio, isFallback } = await generateSpeech(text);
        if (isFallback || !audio) {
            console.error("Failed to generate or received empty audio.");
            setIsSpeaking(false);
            return;
        }

        try {
            // Check if context is suspended (browser policy)
             if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }
            
            const audioBuffer = await decodeAudioData(
                decode(audio),
                audioContextRef.current,
                24000,
                1,
            );
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.start();

            currentSpeechSourceRef.current = source;
            source.onended = () => {
                if (currentSpeechSourceRef.current === source) {
                    currentSpeechSourceRef.current = null;
                }
                setIsSpeaking(false);
            };
        } catch (error) {
            console.error("Error playing audio:", error);
            setIsSpeaking(false);
        }
    }, []);

    const toggleTts = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }

        setIsTtsEnabled(prev => {
            const willBeEnabled = !prev;
            if (willBeEnabled) {
                spokenTextRef.current = ''; // Reset to trigger current text
            } else {
                if (currentSpeechSourceRef.current) {
                    currentSpeechSourceRef.current.stop();
                    currentSpeechSourceRef.current = null;
                }
                setIsSpeaking(false);
            }
            return willBeEnabled;
        });
    }, []);

    useEffect(() => {
        const canPlaySpeech = isTtsEnabled && storyText &&
            gameState !== GameState.LOADING &&
            gameState !== GameState.START_SCREEN &&
            gameState !== GameState.CHARACTER_CREATION;

        if (canPlaySpeech) {
            if (storyText !== spokenTextRef.current) {
                playSpeech(storyText);
            }
        } else {
            // If we navigate away or disable logic, stop speech
            if (currentSpeechSourceRef.current && !isTtsEnabled) {
                currentSpeechSourceRef.current.stop();
                currentSpeechSourceRef.current = null;
                 if (isSpeaking) setIsSpeaking(false);
            }
        }
    }, [storyText, isTtsEnabled, gameState, playSpeech, isSpeaking]);

    // Cleanup
    useEffect(() => {
        return () => {
             if (currentSpeechSourceRef.current) {
                currentSpeechSourceRef.current.stop();
            }
        }
    }, []);

    return { isTtsEnabled, isSpeaking, toggleTts };
};