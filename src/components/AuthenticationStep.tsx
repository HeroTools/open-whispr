import React, { useCallback, useEffect, useState } from "react";
import { AuthView, NeonAuthUIProvider } from "@neondatabase/neon-js/auth/react/ui";
import { useAuth } from "../hooks/useAuth";
import { authClient, NEON_AUTH_URL } from "../lib/neonAuth";
import { Button } from "./ui/button";
import { AlertCircle, ArrowRight, Sparkles, UserCircle } from "lucide-react";

interface AuthenticationStepProps {
  onContinueWithoutAccount: () => void;
  onAuthComplete: () => void;
}

const getAuthPath = (href: string) => {
  try {
    const url = new URL(href, window.location.origin);
    return url.pathname.split("/").pop() || "sign-in";
  } catch {
    return href.split("/").pop() || "sign-in";
  }
};

export default function AuthenticationStep({
  onContinueWithoutAccount,
  onAuthComplete,
}: AuthenticationStepProps) {
  const { isSignedIn, isLoaded, user } = useAuth();
  const [authPath, setAuthPath] = useState("sign-in");

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      onAuthComplete();
    }
  }, [isLoaded, isSignedIn, onAuthComplete]);

  const handleNavigate = useCallback((href: string) => {
    setAuthPath(getAuthPath(href));
  }, []);

  const Link = useCallback(
    ({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) => (
      <a
        href={href}
        className={className}
        onClick={(event) => {
          event.preventDefault();
          handleNavigate(href);
        }}
      >
        {children}
      </a>
    ),
    [handleNavigate]
  );

  if (!NEON_AUTH_URL || !authClient) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">
            Account Features Not Available
          </h2>
          <p className="text-stone-600">
            Account sync is not configured for this installation.
          </p>
        </div>

        <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-200/60">
          <p className="text-sm text-amber-800">
            To enable account features, set VITE_NEON_AUTH_URL in your .env file.
          </p>
        </div>

        <Button
          onClick={onContinueWithoutAccount}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          Continue Setup Without Account
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  if (isLoaded && isSignedIn) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
            <UserCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">
            Welcome back{user?.name ? `, ${user.name}` : ""}!
          </h2>
          <p className="text-stone-600">
            You're signed in and ready to continue setup.
          </p>
        </div>
        <Button
          onClick={onAuthComplete}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          Continue Setup
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-stone-900 mb-2">
          Welcome to OpenWhispr
        </h2>
        <p className="text-stone-600">
          Sign in to sync settings across devices and unlock premium features.
        </p>
      </div>

      <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm">
        <NeonAuthUIProvider
          authClient={authClient}
          basePath=""
          navigate={handleNavigate}
          replace={handleNavigate}
          Link={Link}
        >
          <AuthView pathname={authPath} />
        </NeonAuthUIProvider>
      </div>

      <Button
        variant="ghost"
        onClick={onContinueWithoutAccount}
        className="w-full text-stone-600 hover:text-stone-900"
      >
        Continue without creating an account
      </Button>

      <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-200/60">
        <h4 className="font-medium text-blue-900 mb-2">Benefits of creating an account:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ Sync settings across all your devices</li>
          <li>✓ Access your transcription history anywhere</li>
          <li>✓ Unlock advanced AI features</li>
          <li>✓ Priority support and updates</li>
        </ul>
      </div>
    </div>
  );
}
