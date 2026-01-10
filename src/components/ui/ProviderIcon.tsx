import React, { useState } from 'react';
import { Brain, Zap, Globe, Cpu, Wrench } from 'lucide-react';

interface ProviderIconProps {
  provider: string;
  className?: string;
}

export function ProviderIcon({ provider, className = "w-5 h-5" }: ProviderIconProps) {
  const [svgError, setSvgError] = useState(false);

  if (provider === 'custom') {
    return <Wrench className={className} />;
  }

  const getFallbackIcon = () => {
    switch (provider) {
      // Cloud providers
      case 'openai': return <Brain className={className} />;
      case 'anthropic': return <Zap className={className} />;
      case 'gemini': return <Globe className={className} />;
      case 'groq': return <Zap className={className} />;
      // Local providers
      case 'qwen': return <Brain className={className} />;
      case 'mistral': return <Zap className={className} />;
      case 'llama': return <Cpu className={className} />;
      case 'openai-oss': return <Globe className={className} />;
      default: return <Brain className={className} />;
    }
  };

  if (svgError) {
    return getFallbackIcon();
  }

  return (
    <img
      src={`/assets/icons/providers/${provider}.svg`}
      alt={`${provider} icon`}
      className={className}
      onError={() => setSvgError(true)}
    />
  );
}

export default ProviderIcon;
