import React from "react";
import { Settings, Mic, Brain, User, Sparkles, Wrench, BookOpen } from "lucide-react";
import SidebarModal, { SidebarItem } from "./ui/SidebarModal";
import SettingsPage, { SettingsSectionType } from "./SettingsPage";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const sidebarItems: SidebarItem<SettingsSectionType>[] = [
    { id: "general", label: "General", icon: Settings },
    { id: "transcription", label: "Transcription Mode", icon: Mic },
    { id: "dictionary", label: "Custom Dictionary", icon: BookOpen },
    { id: "aiModels", label: "AI Text Cleanup", icon: Brain },
    { id: "agentConfig", label: "Agent Configuration", icon: User },
    { id: "prompts", label: "AI Prompts", icon: Sparkles },
    { id: "developer", label: "Troubleshooting", icon: Wrench },
  ];

  const [activeSection, setActiveSection] = React.useState<SettingsSectionType>("general");

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
