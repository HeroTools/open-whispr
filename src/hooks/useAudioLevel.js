import { useState, useEffect, useRef } from 'react';

/**
 * Hook to monitor audio input level in real-time
 * @param {MediaStream} stream - The audio stream to monitor
 * @param {boolean} isActive - Whether to actively monitor the stream
 * @returns {number} Current audio level (0-100)
 */
export function useAudioLevel(stream, isActive = true) {
  const [audioLevel, setAudioLevel] = useState(0);
  const animationFrameRef = useRef(null);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);

  useEffect(() => {
    if (!stream || !isActive) {
      setAudioLevel(0);
      return;
    }

    try {
      // Create audio context and analyser
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 256;

      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);

        // Calculate average volume
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

        // Normalize to 0-100 range with some amplification for better visual feedback
        const normalizedLevel = Math.min(100, (average / 128) * 100 * 1.5);

        setAudioLevel(normalizedLevel);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };
    } catch (error) {
      console.error('Error setting up audio level monitoring:', error);
      setAudioLevel(0);
    }
  }, [stream, isActive]);

  return audioLevel;
}
