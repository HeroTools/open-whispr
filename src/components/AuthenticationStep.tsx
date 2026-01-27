import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { authClient, NEON_AUTH_URL, signInWithSocial, type SocialProvider } from "../lib/neonAuth";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AlertCircle, ArrowRight, Check, Mail, Lock, Loader2, User } from "lucide-react";

interface AuthenticationStepProps {
  onContinueWithoutAccount: () => void;
  onAuthComplete: () => void;
}

type AuthMode = "sign-in" | "sign-up";

// Custom SVG icons for social providers (clean, modern style)
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

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
  const [isSocialLoading, setIsSocialLoading] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      onAuthComplete();
    }
  }, [isLoaded, isSignedIn, onAuthComplete]);

  // Reset social loading state when the window regains focus,
  // which happens if the user closed or cancelled the OAuth browser window.
  useEffect(() => {
    if (isSocialLoading === null) return;

    let timeout: ReturnType<typeof setTimeout>;

    const handleFocus = () => {
      // Small delay to allow the oauth-callback IPC to arrive first
      timeout = setTimeout(() => {
        setIsSocialLoading(null);
      }, 1000);
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      clearTimeout(timeout);
    };
  }, [isSocialLoading]);

  const handleSocialSignIn = useCallback(async (provider: SocialProvider) => {
    setIsSocialLoading(provider);
    setError(null);

    const result = await signInWithSocial(provider);

    if (result.error) {
      setError(result.error.message || `Failed to sign in with ${provider}`);
      setIsSocialLoading(null);
    }
    // If successful, the page will redirect to the OAuth provider
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
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
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred. Please try again.";
        setError(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    },
    [authMode, email, password, name]
  );

  const toggleAuthMode = useCallback(() => {
    setAuthMode((mode) => (mode === "sign-in" ? "sign-up" : "sign-in"));
    setError(null);
  }, []);

  // Auth not configured state
  if (!NEON_AUTH_URL || !authClient) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center mb-5 shadow-sm">
            <AlertCircle className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-2xl font-semibold text-neutral-900 mb-2 tracking-tight">
            Account Features Unavailable
          </h2>
          <p className="text-neutral-500 text-sm leading-relaxed max-w-sm mx-auto">
            Account sync is not configured for this installation. You can still use OpenWhispr
            locally.
          </p>
        </div>

        <div className="bg-amber-50/80 backdrop-blur-sm p-4 rounded-xl border border-amber-200/50">
          <p className="text-sm text-amber-700 text-center">
            To enable accounts, set{" "}
            <code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">
              VITE_NEON_AUTH_URL
            </code>{" "}
            in your .env file.
          </p>
        </div>

        <Button onClick={onContinueWithoutAccount} size="lg" className="w-full">
          Continue Without Account
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  // Already signed in state
  if (isLoaded && isSignedIn) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto bg-gradient-to-br from-emerald-100 to-green-100 rounded-2xl flex items-center justify-center mb-5 shadow-sm">
            <Check className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-semibold text-neutral-900 mb-2 tracking-tight">
            Welcome back{user?.name ? `, ${user.name}` : ""}
          </h2>
          <p className="text-neutral-500 text-sm">You're signed in and ready to continue.</p>
        </div>
        <Button onClick={onAuthComplete} size="lg" className="w-full">
          Continue Setup
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-neutral-900 mb-2 tracking-tight">
          {authMode === "sign-in" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="text-neutral-500 text-sm">
          {authMode === "sign-in"
            ? "Sign in to sync your settings across devices"
            : "Get started with OpenWhispr"}
        </p>
      </div>

      {/* Social Login Buttons */}
      <div className="space-y-3">
        <Button
          type="button"
          variant="social"
          size="lg"
          onClick={() => handleSocialSignIn("google")}
          disabled={isSocialLoading !== null || isSubmitting}
          className="w-full"
        >
          {isSocialLoading === "google" ? (
            <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
          ) : (
            <GoogleIcon className="w-5 h-5" />
          )}
          <span>Continue with Google</span>
        </Button>
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-4 text-xs font-medium text-neutral-400 bg-white uppercase tracking-wider">
            or continue with email
          </span>
        </div>
      </div>

      {/* Email Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {authMode === "sign-up" && (
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
              Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10 h-12 rounded-xl border-neutral-200 bg-neutral-50/50 focus:bg-white transition-colors"
                disabled={isSubmitting || isSocialLoading !== null}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 rounded-xl border-neutral-200 bg-neutral-50/50 focus:bg-white transition-colors"
              required
              disabled={isSubmitting || isSocialLoading !== null}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              id="password"
              type="password"
              placeholder={authMode === "sign-up" ? "Create a password" : "Enter your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12 rounded-xl border-neutral-200 bg-neutral-50/50 focus:bg-white transition-colors"
              required
              minLength={authMode === "sign-up" ? 8 : undefined}
              disabled={isSubmitting || isSocialLoading !== null}
            />
          </div>
          {authMode === "sign-up" && (
            <p className="text-xs text-neutral-400 mt-1.5">Must be at least 8 characters</p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50/80 border border-red-100 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting || isSocialLoading !== null || !email || !password}
          className="w-full mt-2"
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

      {/* Toggle Auth Mode */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={toggleAuthMode}
          className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
          disabled={isSubmitting || isSocialLoading !== null}
        >
          {authMode === "sign-in" ? (
            <>
              Don't have an account? <span className="font-medium text-neutral-900">Sign up</span>
            </>
          ) : (
            <>
              Already have an account? <span className="font-medium text-neutral-900">Sign in</span>
            </>
          )}
        </button>
      </div>

      {/* Skip Option */}
      <div className="pt-4 border-t border-neutral-100">
        <button
          type="button"
          onClick={onContinueWithoutAccount}
          className="w-full text-center text-sm text-neutral-400 hover:text-neutral-600 transition-colors py-2"
          disabled={isSubmitting || isSocialLoading !== null}
        >
          Continue without an account
        </button>
      </div>

      {/* Benefits */}
      <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 p-5 rounded-2xl border border-indigo-100/50">
        <h4 className="font-medium text-neutral-900 mb-3 text-sm">Why create an account?</h4>
        <ul className="text-sm text-neutral-600 space-y-2">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Sync settings across all your devices
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Access your transcription history anywhere
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Unlock advanced AI features
          </li>
        </ul>
      </div>
    </div>
  );
}
