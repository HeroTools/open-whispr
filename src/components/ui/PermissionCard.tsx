import React from "react";
import { Button } from "./button";
import { Check, LucideIcon, Settings } from "lucide-react";

interface PermissionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  granted: boolean;
  onRequest: () => void;
  buttonText?: string;
  onOpenSettings?: () => void;
  openSettingsText?: string;
}

export default function PermissionCard({
  icon: Icon,
  title,
  description,
  granted,
  onRequest,
  buttonText = "Grant Access",
  onOpenSettings,
  openSettingsText = "Open Settings",
}: PermissionCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Icon className="w-6 h-6 text-indigo-600" />
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
        {granted ? (
          <div className="text-green-600">
            <Check className="w-5 h-5" />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button onClick={onRequest} size="sm">
              {buttonText}
            </Button>
            {onOpenSettings && (
              <Button onClick={onOpenSettings} size="sm" variant="outline">
                <Settings className="w-4 h-4 mr-1" />
                {openSettingsText}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
