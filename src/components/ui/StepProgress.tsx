import React from "react";
import { Check, LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

interface Step {
  title: string;
  icon: LucideIcon;
}

interface StepProgressProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export default function StepProgress({
  steps,
  currentStep,
  className,
}: StepProgressProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <div key={index} className="flex">
            <div
              className={cn(
                "flex items-center gap-2",
                isActive
                  ? "text-primary"
                  : isCompleted
                    ? "text-green-600 dark:text-green-400"
                    : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "size-6 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all duration-200",
                  isActive
                    ? "border-primary bg-primary/10 shadow-sm"
                    : isCompleted
                      ? "border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-950/50 shadow-sm"
                      : "border-muted bg-card"
                )}
              >
                {isCompleted ? (
                  <Check className="size-4" />
                ) : (
                  <Icon className="size-4" />
                )}
              </div>
              <span className="text-xs font-medium hidden md:block truncate">
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-3 rounded-full transition-colors duration-200",
                  isCompleted
                    ? "bg-green-600 dark:bg-green-400"
                    : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
