import { useState } from "react";

const AGENT_NAME_KEY = "agentName";
const DEFAULT_AGENT_NAME = "OpenWhispr";

export const getAgentName = (): string => {
  return localStorage.getItem(AGENT_NAME_KEY) || DEFAULT_AGENT_NAME;
};

export const setAgentName = (name: string): void => {
  localStorage.setItem(AGENT_NAME_KEY, name);
};

export const setAgentNameIfEmpty = (name: string): void => {
  if (!localStorage.getItem(AGENT_NAME_KEY)) {
    localStorage.setItem(AGENT_NAME_KEY, name);
  }
};

export const clearAgentName = (): void => {
  localStorage.removeItem(AGENT_NAME_KEY);
};

export const useAgentName = () => {
  const [agentName, setAgentNameState] = useState<string>(getAgentName());

  const updateAgentName = (name: string) => {
    setAgentName(name);
    setAgentNameState(name);
  };

  return { agentName, setAgentName: updateAgentName };
};
