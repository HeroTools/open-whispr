import React from "react";
import { Check, LucideIcon } from "lucide-react";

interface Step {
  title: string;
  icon: LucideIcon;
}

interface StepProgressProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export default function StepProgress({ steps, currentStep, className = "" }: StepProgressProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <div key={index} className="flex">
            <div
              className={`flex items-center gap-2 ${
                isActive ? "text-blue-600" : isCompleted ? "text-green-600" : "text-stone-400"
              }`}
              style={{ fontFamily: "Noto Sans, sans-serif" }}
            >
              <div
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                  isActive
                    ? "border-blue-600 bg-blue-50 shadow-sm"
                    : isCompleted
                      ? "border-green-600 bg-green-50 shadow-sm"
                      : "border-stone-300 bg-white"
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className="hidden truncate text-xs font-medium md:block">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`mx-3 h-0.5 flex-1 rounded-full transition-colors duration-200 ${
                  isCompleted ? "bg-green-600" : "bg-stone-300"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
