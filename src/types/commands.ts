/**
 * Command system types for OpenWhispr
 */

export interface CommandDetectionResult {
  isCommand: boolean;
  type?: string;
  message?: string;
  error?: string;
}

export interface CommandExecutionResult {
  success: boolean;
  message?: string;
  error?: string;
}

export type CommandStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface CommandState {
  status: CommandStatus;
  countdown?: number;
  message?: string;
  error?: string;
}
