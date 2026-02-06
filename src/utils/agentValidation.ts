import { Agent, AgentConfig } from '../types/agent';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valide le nom d'un agent
 */
export function validateAgentName(name: string, existingAgents: Agent[], currentAgentId?: string): ValidationResult {
  const errors: string[] = [];

  // Vérifier la longueur
  if (!name || name.trim().length < 2) {
    errors.push("Agent name must be at least 2 characters long");
  }
  if (name.trim().length > 50) {
    errors.push("Agent name must be no more than 50 characters long");
  }

  // Vérifier l'unicité (case-insensitive)
  const normalizedName = name.trim().toLowerCase();
  const duplicate = existingAgents.find(
    agent => agent.name.toLowerCase() === normalizedName && agent.id !== currentAgentId
  );
  if (duplicate) {
    errors.push(`An agent with the name "${name}" already exists`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valide la configuration d'un agent
 */
export function validateAgent(agent: Partial<Agent>, existingAgents: Agent[], currentAgentId?: string): ValidationResult {
  const errors: string[] = [];

  // Valider le nom
  if (agent.name) {
    const nameValidation = validateAgentName(agent.name, existingAgents, currentAgentId);
    errors.push(...nameValidation.errors);
  } else {
    errors.push("Agent name is required");
  }

  // Valider le provider AI
  if (!agent.aiProvider) {
    errors.push("AI provider is required");
  }

  // Valider le modèle AI
  if (!agent.aiModel) {
    errors.push("AI model is required");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valide la configuration complète des agents
 */
export function validateAgentConfig(config: AgentConfig): ValidationResult {
  const errors: string[] = [];

  // Vérifier qu'il y a au moins un agent
  if (!config.agents || config.agents.length === 0) {
    errors.push("At least one agent is required");
  }

  // Vérifier qu'il y a exactement un agent par défaut
  const defaultAgents = config.agents.filter(agent => agent.isDefault);
  if (defaultAgents.length === 0) {
    errors.push("Exactly one agent must be marked as default");
  } else if (defaultAgents.length > 1) {
    errors.push("Only one agent can be marked as default");
  }

  // Valider chaque agent individuellement
  config.agents.forEach((agent, index) => {
    const agentValidation = validateAgent(agent, config.agents, agent.id);
    if (!agentValidation.valid) {
      errors.push(`Agent ${index + 1} (${agent.name || 'unnamed'}): ${agentValidation.errors.join(', ')}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Vérifie si un agent peut être supprimé
 */
export function canDeleteAgent(agent: Agent, config: AgentConfig): ValidationResult {
  const errors: string[] = [];

  // Ne peut pas supprimer l'agent par défaut sans réassignation
  if (agent.isDefault && config.agents.length > 1) {
    errors.push("Cannot delete the default agent. Please set another agent as default first.");
  }

  // Ne peut pas supprimer le dernier agent
  if (config.agents.length === 1) {
    errors.push("Cannot delete the last remaining agent");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
