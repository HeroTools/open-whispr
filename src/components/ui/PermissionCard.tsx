import React from "react";
import { Button } from "./button";
import { Check, LucideIcon } from "lucide-react";

interface PermissionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  granted: boolean;
  onRequest: () => void;
  buttonText?: string;
}

export default function PermissionCard({
  icon: Icon,
  title,
  description,
  granted,
  onRequest,
  buttonText = "Grant Access",
}: PermissionCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6 text-indigo-600" />
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
        {granted ? (
          <div className="text-green-600">
            <Check className="h-5 w-5" />
          </div>
        ) : (
          <Button onClick={onRequest} size="sm">
            {buttonText}
          </Button>
        )}
      </div>
    </div>
  );
}
