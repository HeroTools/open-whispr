import { Agent } from '../types/agent';
import { loadAgents, getDefaultAgent } from '../utils/agentStorage';

export interface DetectionResult {
  agentDetected: boolean;
  agent: Agent | null;
  cleanedText: string;           // Texte avec mention de l'agent retirée
  isInstructionMode: boolean;    // Agent explicitement adressé
}

/**
 * Service de détection d'agents dans le texte transcrit
 */
export class AgentDetectionService {
  /**
   * Détecte quel agent doit traiter le texte transcrit
   */
  detectAgent(transcribedText: string): DetectionResult {
    const config = loadAgents();

    if (!transcribedText || config.agents.length === 0) {
      return {
        agentDetected: false,
        agent: getDefaultAgent(),
        cleanedText: transcribedText,
        isInstructionMode: false
      };
    }

    // Patterns de détection: "hey [nom]", "ok [nom]", "[nom],"
    // Case-insensitive, premier match gagne
    const text = transcribedText.trim();

    for (const agent of config.agents) {
      const agentName = agent.name.toLowerCase();
      const lowerText = text.toLowerCase();

      // Pattern 1: "hey [agent]" ou "ok [agent]" au début
      const heyPattern = new RegExp(`^(hey|ok|hi|hello)\\s+${this.escapeRegex(agentName)}\\b`, 'i');
      const heyMatch = text.match(heyPattern);
      if (heyMatch) {
        const cleanedText = text.substring(heyMatch[0].length).trim();
        return {
          agentDetected: true,
          agent: agent,
          cleanedText: cleanedText,
          isInstructionMode: true
        };
      }

      // Pattern 2: "[agent]," au début
      const commaPattern = new RegExp(`^${this.escapeRegex(agentName)}\\s*,`, 'i');
      const commaMatch = text.match(commaPattern);
      if (commaMatch) {
        const cleanedText = text.substring(commaMatch[0].length).trim();
        return {
          agentDetected: true,
          agent: agent,
          cleanedText: cleanedText,
          isInstructionMode: true
        };
      }

      // Pattern 3: "[agent]" seul ou suivi d'espace au début
      const startPattern = new RegExp(`^${this.escapeRegex(agentName)}\\b`, 'i');
      const startMatch = text.match(startPattern);
      if (startMatch) {
        const cleanedText = text.substring(startMatch[0].length).trim();
        return {
          agentDetected: true,
          agent: agent,
          cleanedText: cleanedText,
          isInstructionMode: true
        };
      }
    }

    // Aucun agent détecté → utiliser l'agent par défaut
    return {
      agentDetected: false,
      agent: getDefaultAgent(),
      cleanedText: transcribedText,
      isInstructionMode: false
    };
  }

  /**
   * Échappe les caractères spéciaux pour utilisation dans une regex
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Vérifie si un texte contient une mention d'agent
   */
  hasAgentMention(text: string): boolean {
    const result = this.detectAgent(text);
    return result.agentDetected;
  }

  /**
   * Récupère l'agent mentionné dans le texte (ou null si aucun)
   */
  getDetectedAgent(text: string): Agent | null {
    const result = this.detectAgent(text);
    return result.agentDetected ? result.agent : null;
  }
}

// Export d'une instance singleton
export const agentDetectionService = new AgentDetectionService();
