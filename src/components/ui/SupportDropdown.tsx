import React from "react";
import { Button } from "./button";
import { HelpCircle, Mail, Bug } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

interface SupportDropdownProps {
  className?: string;
}

export default function SupportDropdown({ className }: SupportDropdownProps) {
  const handleContactSupport = async () => {
    try {
      const result = await window.electronAPI?.openExternal(
        "mailto:support@openwispr.com"
      );
      if (!result?.success) {
        console.error("Failed to open email client:", result?.error);
        // Fallback: try opening the email as a web URL
        await window.electronAPI?.openExternal(
          "https://mail.google.com/mail/?view=cm&to=support@openwhispr.com"
        );
      }
    } catch (error) {
      console.error("Error opening email client:", error);
    }
  };

  const handleSubmitBug = async () => {
    try {
      const result = await window.electronAPI?.openExternal(
        "https://github.com/HeroTools/open-whispr/issues"
      );
      if (!result?.success) {
        console.error("Failed to open GitHub issues:", result?.error);
      }
    } catch (error) {
      console.error("Error opening GitHub issues:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className}>
          <HelpCircle size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-white border border-gray-200 shadow-lg"
      >
        <DropdownMenuItem
          onClick={handleContactSupport}
          className="cursor-pointer hover:bg-gray-50 focus:bg-gray-50"
        >
          <Mail className="mr-2 h-4 w-4" />
          Contact Support
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleSubmitBug}
          className="cursor-pointer hover:bg-gray-50 focus:bg-gray-50"
        >
          <Bug className="mr-2 h-4 w-4" />
          Submit Bug
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
