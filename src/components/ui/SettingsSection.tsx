import React from "react";

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
  className = "",
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
        {description && <p className="mb-4 text-sm text-gray-600">{description}</p>}
      </div>
      {children}
    </div>
  );
};

interface SettingsGroupProps {
  title?: string;
  children: React.ReactNode;
  variant?: "default" | "highlighted";
  className?: string;
}

export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  children,
  variant = "default",
  className = "",
}) => {
  const baseClasses = "space-y-4 p-4 rounded-xl border";
  const variantClasses = {
    default: "bg-gray-50 border-gray-200",
    highlighted: "bg-blue-50 border-blue-200",
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {title && <h4 className="font-medium text-gray-900">{title}</h4>}
      {children}
    </div>
  );
};
