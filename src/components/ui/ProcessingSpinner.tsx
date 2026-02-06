import React from 'react';

interface ProcessingSpinnerProps {
  size?: number;
  color?: string;
}

export const ProcessingSpinner: React.FC<ProcessingSpinnerProps> = ({
  size = 20,
  color = 'white'
}) => {
  return (
    <div
      className="animate-processing-spin"
      style={{
        width: size,
        height: size,
        border: `2px solid ${color}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
      }}
    />
  );
};

// Alternative: Voice wave animation for processing
export const VoiceProcessingIndicator: React.FC<{ isActive?: boolean }> = ({
  isActive = true
}) => {
  const bars = [0.15, 0.3, 0.45, 0.6, 0.45, 0.3, 0.15];

  return (
    <div className="flex items-center justify-center gap-0.5 h-5">
      {bars.map((delay, i) => (
        <div
          key={i}
          className="w-0.5 bg-white rounded-full"
          style={{
            height: isActive ? '16px' : '4px',
            animation: isActive ? `voice-bar 0.6s ease-in-out infinite` : 'none',
            animationDelay: `${delay}s`,
            transition: 'height 0.2s ease-out',
          }}
        />
      ))}
    </div>
  );
};
