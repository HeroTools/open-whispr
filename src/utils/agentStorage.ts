import { Agent, AgentConfig } from '../types/agent';
import { validateAgentConfig } from './agentValidation';

const STORAGE_KEY = 'agentsConfig';
const ACTIVE_AGENT_KEY = 'activeAgentId';
const DEFAULT_VERSION = 1;

/**
 * Charge la configuration des agents depuis localStorage
 */
export function loadAgents(): AgentConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {
        agents: [],
        version: DEFAULT_VERSION
      };
    }

    const config: AgentConfig = JSON.parse(stored);

    // Validation basique
    if (!config.agents || !Array.isArray(config.agents)) {
      console.error('Invalid agent config structure');
      return {
        agents: [],
        version: DEFAULT_VERSION
      };
    }

    return config;
  } catch (error) {
    console.error('Failed to load agents from localStorage:', error);
    return {
      agents: [],
      version: DEFAULT_VERSION
    };
  }
}

/**
 * Sauvegarde la configuration des agents dans localStorage
 */
export function saveAgents(config: AgentConfig): void {
  try {
    // Valider avant de sauvegarder
    const validation = validateAgentConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid agent configuration: ${validation.errors.join(', ')}`);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save agents to localStorage:', error);
    throw error;
  }
}

/**
 * Récupère l'agent par défaut
 */
export function getDefaultAgent(): Agent | null {
  const config = loadAgents();
  return config.agents.find(agent => agent.isDefault) || null;
}

/**
 * Récupère un agent par son ID
 */
export function getAgentById(id: string): Agent | null {
  const config = loadAgents();
  return config.agents.find(agent => agent.id === id) || null;
}

/**
 * Récupère un agent par son nom (case-insensitive)
 */
export function getAgentByName(name: string): Agent | null {
  const config = loadAgents();
  const normalizedName = name.trim().toLowerCase();
  return config.agents.find(agent => agent.name.toLowerCase() === normalizedName) || null;
}

/**
 * Ajoute un nouvel agent
 */
export function addAgent(agent: Agent): void {
  const config = loadAgents();

  // Si c'est le premier agent ou marqué comme défaut, s'assurer qu'il est le seul défaut
  if (agent.isDefault || config.agents.length === 0) {
    config.agents.forEach(a => a.isDefault = false);
    agent.isDefault = true;
  }

  config.agents.push(agent);
  saveAgents(config);
}

/**
 * Met à jour un agent existant
 */
export function updateAgent(updatedAgent: Agent): void {
  const config = loadAgents();
  const index = config.agents.findIndex(agent => agent.id === updatedAgent.id);

  if (index === -1) {
    throw new Error(`Agent with id ${updatedAgent.id} not found`);
  }

  // Si on marque cet agent comme défaut, retirer le flag des autres
  if (updatedAgent.isDefault) {
    config.agents.forEach(agent => {
      if (agent.id !== updatedAgent.id) {
        agent.isDefault = false;
      }
    });
  }

  config.agents[index] = updatedAgent;
  saveAgents(config);
}

/**
 * Supprime un agent
 */
export function deleteAgent(id: string): void {
  const config = loadAgents();
  const agent = config.agents.find(a => a.id === id);

  if (!agent) {
    throw new Error(`Agent with id ${id} not found`);
  }

  // Ne peut pas supprimer l'agent par défaut s'il y a d'autres agents
  if (agent.isDefault && config.agents.length > 1) {
    throw new Error('Cannot delete default agent. Please set another agent as default first.');
  }

  // Ne peut pas supprimer le dernier agent
  if (config.agents.length === 1) {
    throw new Error('Cannot delete the last remaining agent');
  }

  config.agents = config.agents.filter(a => a.id !== id);
  saveAgents(config);
}

/**
 * Définit un agent comme agent par défaut
 */
export function setDefaultAgent(id: string): void {
  const config = loadAgents();
  const agent = config.agents.find(a => a.id === id);

  if (!agent) {
    throw new Error(`Agent with id ${id} not found`);
  }

  // Retirer le flag de tous les agents
  config.agents.forEach(a => a.isDefault = false);

  // Définir le nouvel agent par défaut
  agent.isDefault = true;

  saveAgents(config);
}

/**
 * Récupère l'ID de l'agent actif dans l'UI
 */
export function getActiveAgentId(): string | null {
  return localStorage.getItem(ACTIVE_AGENT_KEY);
}

/**
 * Définit l'agent actif dans l'UI
 */
export function setActiveAgentId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_AGENT_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_AGENT_KEY);
  }
}

/**
 * Génère un UUID simple
 */
export function generateAgentId(): string {
  return 'agent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
