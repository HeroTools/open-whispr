import { useState } from "react";
import { Brain, Wrench, HardDrive } from "lucide-react";

interface ProviderIconProps {
  provider: string;
  className?: string;
}

export function ProviderIcon({ provider, className = "w-5 h-5" }: ProviderIconProps) {
  const [svgError, setSvgError] = useState(false);

  if (provider === "custom") {
    return <Wrench className={className} />;
  }

  if (provider === "local") {
    return <HardDrive className={className} />;
  }

  const iconPath =
    provider === "whisper"
      ? "/assets/icons/providers/openai.svg"
      : `/assets/icons/providers/${provider}.svg`;

  if (svgError) {
    return <Brain className={className} />;
  }

  return (
    <img
      src={iconPath}
      alt={`${provider} icon`}
      className={className}
      onError={() => setSvgError(true)}
    />
  );
}

export default ProviderIcon;
