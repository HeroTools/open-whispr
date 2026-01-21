import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { authClient, NEON_AUTH_URL } from "../lib/neonAuth";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AlertCircle, ArrowRight, Sparkles, UserCircle, Mail, Lock, Loader2 } from "lucide-react";

interface AuthenticationStepProps {
  onContinueWithoutAccount: () => void;
  onAuthComplete: () => void;
}

type AuthMode = "sign-in" | "sign-up";

export default function AuthenticationStep({
  onContinueWithoutAccount,
  onAuthComplete,
}: AuthenticationStepProps) {
  const { isSignedIn, isLoaded, user } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      onAuthComplete();
    }
  }, [isLoaded, isSignedIn, onAuthComplete]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authClient) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (authMode === "sign-up") {
        const result = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        });
        if (result.error) {
          setError(result.error.message || "Failed to create account");
        }
      } else {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (result.error) {
          setError(result.error.message || "Invalid email or password");
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [authClient, authMode, email, password, name]);

  const toggleAuthMode = useCallback(() => {
    setAuthMode(mode => mode === "sign-in" ? "sign-up" : "sign-in");
    setError(null);
  }, []);

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
          {authMode === "sign-in" ? "Welcome Back" : "Create Your Account"}
        </h2>
        <p className="text-stone-600">
          {authMode === "sign-in"
            ? "Sign in to sync settings across devices."
            : "Create an account to unlock premium features."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {authMode === "sign-up" && (
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-stone-700">
              Name (optional)
            </label>
            <div className="relative">
              <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10"
                disabled={isSubmitting}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-stone-700">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-stone-700">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              id="password"
              type="password"
              placeholder={authMode === "sign-up" ? "Create a password" : "Enter your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10"
              required
              minLength={authMode === "sign-up" ? 8 : undefined}
              disabled={isSubmitting}
            />
          </div>
          {authMode === "sign-up" && (
            <p className="text-xs text-stone-500">Must be at least 8 characters</p>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting || !email || !password}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {authMode === "sign-in" ? "Signing in..." : "Creating account..."}
            </>
          ) : (
            <>
              {authMode === "sign-in" ? "Sign In" : "Create Account"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>

      <div className="text-center">
        <button
          type="button"
          onClick={toggleAuthMode}
          className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
        >
          {authMode === "sign-in"
            ? "Don't have an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-stone-500">or</span>
        </div>
      </div>

      <Button
        variant="ghost"
        onClick={onContinueWithoutAccount}
        className="w-full text-stone-600 hover:text-stone-900"
      >
        Continue without an account
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
