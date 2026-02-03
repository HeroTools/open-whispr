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
    <div className={`flex items-center justify-center gap-1 ${className}`}>
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <React.Fragment key={index}>
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-all duration-200 ${
                isActive
                  ? "bg-primary/15 text-primary"
                  : isCompleted
                    ? "text-success"
                    : "text-muted-foreground/50"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                  isActive
                    ? "bg-primary text-white shadow-sm"
                    : isCompleted
                      ? "bg-success/20 text-success"
                      : "bg-white/5 text-muted-foreground/50"
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3 h-3" strokeWidth={2.5} />
                ) : (
                  <Icon className="w-3 h-3" />
                )}
              </div>
              <span
                className={`text-[11px] font-medium hidden md:block ${
                  isActive
                    ? "text-primary"
                    : isCompleted
                      ? "text-success"
                      : "text-muted-foreground/50"
                }`}
              >
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-4 h-px transition-colors duration-200 ${
                  isCompleted ? "bg-success/50" : "bg-white/10"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
