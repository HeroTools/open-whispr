import React, { useEffect } from "react";
import { Settings, Mic, Brain, User, Sparkles, UserCircle, Wrench, BookOpen, ShieldCheck } from "lucide-react";
import SidebarModal, { SidebarItem } from "./ui/SidebarModal";
import SettingsPage, { SettingsSectionType } from "./SettingsPage";

export type { SettingsSectionType };

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: SettingsSectionType;
}

export default function SettingsModal({ open, onOpenChange, initialSection }: SettingsModalProps) {
  const sidebarItems: SidebarItem<SettingsSectionType>[] = [
    {
      id: "account",
      label: "Account",
      icon: UserCircle,
      description: "Sign in & usage",
      group: "Profile",
    },
    {
      id: "general",
      label: "General",
      icon: Settings,
      description: "Appearance, hotkey & startup",
      group: "App",
    },
    {
      id: "transcription",
      label: "Transcription",
      icon: Mic,
      description: "Speech-to-text engine",
      group: "Speech",
    },
    {
      id: "dictionary",
      label: "Dictionary",
      icon: BookOpen,
      description: "Custom words & phrases",
      group: "Speech",
    },
    {
      id: "aiModels",
      label: "AI Models",
      icon: Brain,
      description: "Text cleanup & enhancement",
      group: "Intelligence",
    },
    {
      id: "agentConfig",
      label: "Agent",
      icon: User,
      description: "Voice agent setup",
      group: "Intelligence",
    },
    {
      id: "prompts",
      label: "Prompts",
      icon: Sparkles,
      description: "System prompt studio",
      group: "Intelligence",
    },
    {
      id: "permissions",
      label: "Permissions",
      icon: ShieldCheck,
      description: "Microphone & accessibility",
      group: "System",
    },
    {
      id: "developer",
      label: "Developer",
      icon: Wrench,
      description: "Logs, diagnostics & data",
      group: "System",
    },
  ];

  const [activeSection, setActiveSection] = React.useState<SettingsSectionType>("account");

  // Navigate to initial section when modal opens
  useEffect(() => {
    if (open && initialSection) {
      setActiveSection(initialSection);
    }
  }, [open, initialSection]);

  return (
    <SidebarModal<SettingsSectionType>
      open={open}
      onOpenChange={onOpenChange}
      title="Settings"
      sidebarItems={sidebarItems}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      <SettingsPage activeSection={activeSection} />
    </SidebarModal>
  );
}
