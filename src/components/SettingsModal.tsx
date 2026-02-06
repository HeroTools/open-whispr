import React, { useEffect } from "react";
import { Settings, Mic, Brain, User, Sparkles, Wrench, BookOpen, ShieldCheck, Sliders } from "lucide-react";
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
      id: "general",
      label: "General",
      icon: Settings,
      description: "Updates, hotkeys & startup",
      group: "App",
    },
    {
      id: "preferences",
      label: "Preferences",
      icon: Sliders,
      description: "Behavior & notifications",
      group: "App",
    },
    {
      id: "transcription",
      label: "Transcription",
      icon: Mic,
      description: "Speech recognition",
      group: "Speech",
    },
    {
      id: "dictionary",
      label: "Dictionary",
      icon: BookOpen,
      description: "Custom vocabulary",
      group: "Speech",
    },
    {
      id: "aiModels",
      label: "AI Enhancement",
      icon: Brain,
      description: "Text cleanup & polish",
      group: "Intelligence",
    },
    {
      id: "agentConfig",
      label: "Voice Assistant",
      icon: User,
      description: "Agent configuration",
      group: "Intelligence",
    },
    {
      id: "prompts",
      label: "Prompts",
      icon: Sparkles,
      description: "System instructions",
      group: "Intelligence",
    },
    {
      id: "permissions",
      label: "Permissions",
      icon: ShieldCheck,
      description: "System access",
      group: "System",
    },
    {
      id: "developer",
      label: "Developer",
      icon: Wrench,
      description: "Advanced tools",
      group: "System",
    },
  ];

  const [activeSection, setActiveSection] = React.useState<SettingsSectionType>("general");

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
