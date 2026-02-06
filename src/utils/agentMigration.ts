import { Agent, AgentConfig } from '../types/agent';
import { loadAgents, saveAgents, generateAgentId } from './agentStorage';
import { getAgentName } from './agentName';

const LEGACY_AGENT_NAME_KEY = 'agentName';
const AGENTS_CONFIG_KEY = 'agentsConfig';

/**
 * Migre depuis l'ancien système single-agent vers le nouveau système multi-agents
 */
export function migrateFromLegacySingleAgent(): AgentConfig | null {
  try {
    // Vérifier si la migration a déjà été effectuée
    const existingConfig = localStorage.getItem(AGENTS_CONFIG_KEY);
    if (existingConfig) {
      console.log('Agent config already exists, skipping migration');
      return null;
    }

    // Vérifier si l'ancien système existe
    const legacyAgentName = localStorage.getItem(LEGACY_AGENT_NAME_KEY);
    if (!legacyAgentName) {
      console.log('No legacy agent name found, skipping migration');
      return null;
    }

    console.log('Migrating from legacy single-agent system...');

    // Récupérer les paramètres actuels du localStorage
    const reasoningModel = localStorage.getItem('reasoningModel') || 'gpt-4.1-mini';
    const reasoningProvider = localStorage.getItem('reasoningProvider') || 'openai';
    const customInstructions = localStorage.getItem('agentInstructions') || undefined;

    // Créer un agent par défaut avec les données existantes
    const defaultAgent: Agent = {
      id: generateAgentId(),
      name: legacyAgentName,
      isDefault: true,
      aiProvider: reasoningProvider,
      aiModel: reasoningModel,
      customInstructions: customInstructions,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Créer la nouvelle configuration
    const config: AgentConfig = {
      agents: [defaultAgent],
      version: 1
    };

    // Sauvegarder la nouvelle configuration
    saveAgents(config);

    console.log(`Successfully migrated agent: ${legacyAgentName}`);
    console.log(`  - Provider: ${reasoningProvider}`);
    console.log(`  - Model: ${reasoningModel}`);
    if (customInstructions) {
      console.log(`  - Custom instructions: ${customInstructions.substring(0, 50)}...`);
    }

    // Supprimer l'ancienne clé après migration réussie
    // Note: On garde l'ancienne clé pour compatibilité temporaire
    // localStorage.removeItem(LEGACY_AGENT_NAME_KEY);

    return config;
  } catch (error) {
    console.error('Failed to migrate from legacy single-agent system:', error);
    return null;
  }
}

/**
 * Vérifie si une migration est nécessaire
 */
export function needsMigration(): boolean {
  const existingConfig = localStorage.getItem(AGENTS_CONFIG_KEY);
  const legacyAgentName = localStorage.getItem(LEGACY_AGENT_NAME_KEY);

  return !existingConfig && !!legacyAgentName;
}

/**
 * Effectue toutes les migrations nécessaires au démarrage de l'application
 */
export function runMigrations(): void {
  if (needsMigration()) {
    console.log('Running agent migrations...');
    migrateFromLegacySingleAgent();
  }
}
