/**
 * CommandToast - Shows countdown and status for command execution
 */

import React from 'react';
import type { CommandStatus } from '../types/commands';

interface CommandToastProps {
  status: CommandStatus;
  countdown?: number;
  message?: string;
  onCancel: () => void;
}

export function CommandToast({
  status,
  countdown,
  message,
  onCancel
}: CommandToastProps) {
  // Don't render if status is pending (command not detected yet)
  if (status === 'pending') {
    return null;
  }

  const getStatusDisplay = () => {
    switch (status) {
      case 'sending':
        return {
          text: `Sending in ${countdown}...`,
          bgColor: 'bg-blue-600',
          showCancel: true
        };
      case 'sent':
        return {
          text: '✓ Sent!',
          bgColor: 'bg-green-600',
          showCancel: false
        };
      case 'failed':
        return {
          text: '✗ Failed',
          bgColor: 'bg-red-600',
          showCancel: false
        };
      case 'cancelled':
        return {
          text: 'Cancelled',
          bgColor: 'bg-gray-600',
          showCancel: false
        };
      default:
        return null;
    }
  };

  const display = getStatusDisplay();
  if (!display) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className={`
        ${display.bgColor}
        rounded-lg
        px-4 py-2
        flex items-center gap-3
        border-2 border-white/70
        shadow-lg
        backdrop-blur-sm
        transition-all duration-200
      `}>
        {/* Status text */}
        <span className="text-white text-sm font-medium whitespace-nowrap">
          {display.text}
        </span>

        {/* Cancel button (only shown during countdown) */}
        {display.showCancel && (
          <button
            onClick={onCancel}
            className="
              text-white/90 hover:text-white
              text-xs font-medium
              px-2 py-1
              rounded
              bg-white/10 hover:bg-white/20
              transition-colors duration-150
              whitespace-nowrap
            "
          >
            Cancel
          </button>
        )}
      </div>

      {/* Error message (if any) */}
      {status === 'failed' && message && (
        <div className="mt-2 px-4 py-2 bg-red-900/90 rounded-lg text-white text-xs border border-red-700">
          {message}
        </div>
      )}
    </div>
  );
}
