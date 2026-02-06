export interface Agent {
  id: string;                    // UUID
  name: string;                  // Nom d'affichage (ex: "Jarvis", "Assistant Code")
  isDefault: boolean;            // Un seul agent peut être par défaut

  // Configuration AI
  aiProvider: string;            // "openai" | "anthropic" | "gemini" | "groq" | "local"
  aiModel: string;               // ID du modèle (ex: "gpt-5", "claude-sonnet-4-5")

  // Instructions personnalisées (optionnel)
  customInstructions?: string;   // Instructions ajoutées au prompt système

  // Métadonnées
  createdAt: number;
  updatedAt: number;
}

export interface AgentConfig {
  agents: Agent[];
  version: number;               // Pour migrations futures
}
