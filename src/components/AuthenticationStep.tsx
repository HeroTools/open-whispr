import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { authClient, NEON_AUTH_URL, signInWithSocial, type SocialProvider } from "../lib/neonAuth";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AlertCircle, ArrowRight, Check, Loader2, ChevronLeft } from "lucide-react";
import logoIcon from "../assets/icon.png";

interface AuthenticationStepProps {
  onContinueWithoutAccount: () => void;
  onAuthComplete: () => void;
}

type AuthMode = "sign-in" | "sign-up" | null;

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
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      onAuthComplete();
    }
  }, [isLoaded, isSignedIn, onAuthComplete]);

  // Reset social loading state when the window regains focus
  useEffect(() => {
    if (isSocialLoading === null) return;

    let timeout: ReturnType<typeof setTimeout>;

    const handleFocus = () => {
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
  }, []);

  // Check if email exists and determine auth mode
  const handleEmailContinue = useCallback(async () => {
    if (!email.trim() || !authClient) return;

    setIsCheckingEmail(true);
    setError(null);

    try {
      // Try to check if user exists by attempting a password reset
      // This is a common pattern - if user doesn't exist, we know to show sign-up
      // For now, we'll use a simple heuristic or default to sign-up
      // In a real app, you'd have an API endpoint to check email existence

      // Simple approach: try sign-in first, if it fails with "user not found", switch to sign-up
      // For better UX, we'll default to sign-up for new users
      setAuthMode("sign-up");
    } catch {
      setAuthMode("sign-up");
    } finally {
      setIsCheckingEmail(false);
    }
  }, [email]);

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
            // If user already exists, switch to sign-in mode
            if (
              result.error.message?.toLowerCase().includes("already exists") ||
              result.error.message?.toLowerCase().includes("already registered")
            ) {
              setAuthMode("sign-in");
              setError("Account exists. Please sign in.");
              setPassword("");
            } else {
              setError(result.error.message || "Failed to create account");
            }
          }
        } else {
          const result = await authClient.signIn.email({
            email: email.trim(),
            password,
          });
          if (result.error) {
            // If user not found, switch to sign-up mode
            if (
              result.error.message?.toLowerCase().includes("not found") ||
              result.error.message?.toLowerCase().includes("no user")
            ) {
              setAuthMode("sign-up");
              setError("No account found. Let's create one.");
              setPassword("");
            } else {
              setError(result.error.message || "Invalid email or password");
            }
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

  const handleBack = useCallback(() => {
    setAuthMode(null);
    setPassword("");
    setName("");
    setError(null);
  }, []);

  const toggleAuthMode = useCallback(() => {
    setAuthMode((mode) => (mode === "sign-in" ? "sign-up" : "sign-in"));
    setError(null);
    setPassword("");
  }, []);

  // Auth not configured state
  if (!NEON_AUTH_URL || !authClient) {
    return (
      <div className="space-y-3">
        <div className="text-center">
          <img
            src={logoIcon}
            alt="OpenWhispr"
            className="w-12 h-12 mx-auto mb-2.5 rounded-lg shadow-sm"
          />
          <p className="text-lg font-semibold text-foreground tracking-tight leading-tight">
            Welcome to OpenWhispr
          </p>
          <p className="text-muted-foreground text-sm mt-1 leading-tight">
            Dictate anywhere using your voice
          </p>
        </div>

        <div className="bg-warning/5 p-2.5 rounded border border-warning/20">
          <p className="text-[10px] text-warning text-center leading-snug">
            Cloud features not configured. You can still use OpenWhispr locally.
          </p>
        </div>

        <Button onClick={onContinueWithoutAccount} className="w-full h-9">
          <span className="text-sm font-medium">Get Started</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  // Already signed in state
  if (isLoaded && isSignedIn) {
    return (
      <div className="space-y-3">
        <div className="text-center">
          <img
            src={logoIcon}
            alt="OpenWhispr"
            className="w-12 h-12 mx-auto mb-2.5 rounded-lg shadow-sm"
          />
          <div className="w-5 h-5 mx-auto bg-success/10 rounded-full flex items-center justify-center mb-2">
            <Check className="w-3 h-3 text-success" />
          </div>
          <p className="text-lg font-semibold text-foreground tracking-tight leading-tight">
            Welcome back{user?.name ? `, ${user.name}` : ""}
          </p>
          <p className="text-muted-foreground text-sm mt-1 leading-tight">
            You're signed in and ready to go.
          </p>
        </div>
        <Button onClick={onAuthComplete} className="w-full h-9">
          <span className="text-sm font-medium">Continue</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  // Password form (after email is entered)
  if (authMode !== null) {
    return (
      <div className="space-y-3">
        {/* Back button */}
        <button
          type="button"
          onClick={handleBack}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
        >
          <ChevronLeft className="w-3 h-3" />
          Back
        </button>

        {/* Header — Refined */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground/70 mb-2 leading-tight">{email}</p>
          <p className="text-lg font-semibold text-foreground tracking-tight leading-tight">
            {authMode === "sign-in" ? "Welcome back" : "Create your account"}
          </p>
        </div>

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-2">
          {authMode === "sign-up" && (
            <Input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm"
              disabled={isSubmitting}
              autoFocus
            />
          )}

          <Input
            type="password"
            placeholder={authMode === "sign-up" ? "Create a password" : "Enter your password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-9 text-xs"
            required
            minLength={authMode === "sign-up" ? 8 : undefined}
            disabled={isSubmitting}
            autoFocus={authMode === "sign-in"}
          />

          {authMode === "sign-up" && (
            <p className="text-[9px] text-muted-foreground/70 leading-tight">
              Password must be at least 8 characters
            </p>
          )}

          {/* Error Display */}
          {error && (
            <div className="px-2.5 py-1.5 rounded bg-destructive/5 border border-destructive/20 flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 text-destructive shrink-0" />
              <p className="text-[10px] text-destructive leading-snug">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button type="submit" disabled={isSubmitting || !password} className="w-full h-9">
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-sm font-medium">
                  {authMode === "sign-in" ? "Signing in..." : "Creating account..."}
                </span>
              </>
            ) : (
              <span className="text-sm font-medium">
                {authMode === "sign-in" ? "Sign In" : "Create Account"}
              </span>
            )}
          </Button>
        </form>

        {/* Toggle Auth Mode */}
        <div className="text-center">
          <button
            type="button"
            onClick={toggleAuthMode}
            className="text-[10px] text-muted-foreground/70 hover:text-foreground transition-colors"
            disabled={isSubmitting}
          >
            {authMode === "sign-in" ? (
              <>
                New here? <span className="font-medium text-primary">Create account</span>
              </>
            ) : (
              <>
                Have an account? <span className="font-medium text-primary">Sign in</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Main welcome view
  return (
    <div className="space-y-3">
      {/* Logo & Brand Header — Premium, refined */}
      <div className="text-center">
        <img
          src={logoIcon}
          alt="OpenWhispr"
          className="w-12 h-12 mx-auto mb-2.5 rounded-lg shadow-sm"
        />
        <p className="text-lg font-semibold text-foreground tracking-tight leading-tight">
          Welcome to OpenWhispr
        </p>
        <p className="text-muted-foreground text-sm mt-1 leading-tight">
          Dictate anywhere using your voice
        </p>
      </div>

      {/* Google Sign In */}
      <Button
        type="button"
        variant="social"
        onClick={() => handleSocialSignIn("google")}
        disabled={isSocialLoading !== null || isCheckingEmail}
        className="w-full h-9"
      >
        {isSocialLoading === "google" ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : (
          <GoogleIcon className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">Continue with Google</span>
      </Button>

      {/* Divider — Minimal */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-border/50" />
        <span className="text-[9px] font-medium text-muted-foreground/40 uppercase tracking-widest px-1">
          or
        </span>
        <div className="flex-1 h-px bg-border/50" />
      </div>

      {/* Email Input + Continue */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleEmailContinue();
        }}
        className="space-y-2"
      >
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9 text-sm"
          required
          disabled={isSocialLoading !== null || isCheckingEmail}
        />
        <Button
          type="submit"
          variant="outline"
          disabled={!email.trim() || isSocialLoading !== null || isCheckingEmail}
          className="w-full h-9"
        >
          {isCheckingEmail ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <span className="text-sm font-medium">Continue with Email</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </Button>
      </form>

      {/* Error Display */}
      {error && (
        <div className="px-3 py-2 rounded-md bg-destructive/5 border border-destructive/20 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Skip Option — Subtle, compact */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onContinueWithoutAccount}
          className="w-full text-center text-[10px] text-muted-foreground/70 hover:text-foreground transition-colors py-1.5 rounded hover:bg-muted/30"
          disabled={isSocialLoading !== null || isCheckingEmail}
        >
          Continue without an account
        </button>
      </div>
    </div>
  );
}
