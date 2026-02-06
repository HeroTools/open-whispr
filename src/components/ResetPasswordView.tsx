import React, { useCallback, useState } from "react";
import { resetPassword, NEON_AUTH_URL, authClient } from "../lib/neonAuth";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AlertCircle, ArrowLeft, Check, Loader2 } from "lucide-react";

interface ResetPasswordViewProps {
  token: string;
  onSuccess: () => void;
  onBack: () => void;
}

export default function ResetPasswordView({ token, onSuccess, onBack }: ResetPasswordViewProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!password || !confirmPassword) return;

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      if (password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }

      setIsSubmitting(true);
      setError(null);

      const result = await resetPassword(password, token);

      if (result.error) {
        setError(result.error.message);
        setIsSubmitting(false);
      } else {
        setIsSuccess(true);
        setIsSubmitting(false);
      }
    },
    [password, confirmPassword, token]
  );

  if (!NEON_AUTH_URL || !authClient) {
    return (
      <div className="space-y-3">
        <div className="bg-warning/5 p-2.5 rounded border border-warning/20">
          <p className="text-[10px] text-warning text-center leading-snug">
            Authentication is not configured.
          </p>
        </div>
        <Button onClick={onBack} variant="outline" className="w-full h-9">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="text-sm font-medium">Go Back</span>
        </Button>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="space-y-3">
        <div className="text-center mb-4">
          <div className="w-10 h-10 mx-auto bg-success/10 rounded-full flex items-center justify-center mb-3">
            <Check className="w-5 h-5 text-success" />
          </div>
          <p className="text-lg font-semibold text-foreground tracking-tight leading-tight">
            Password reset successful
          </p>
          <p className="text-muted-foreground text-sm mt-1.5 leading-snug">
            Your password has been updated. You're now signed in.
          </p>
        </div>

        <Button onClick={onSuccess} className="w-full h-9">
          <span className="text-sm font-medium">Continue</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
      >
        <ArrowLeft className="w-3 h-3" />
        Back to sign in
      </button>

      <div className="text-center mb-4">
        <p className="text-lg font-semibold text-foreground tracking-tight leading-tight">
          Create new password
        </p>
        <p className="text-muted-foreground text-sm mt-1 leading-tight">
          Enter your new password below
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <Input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-9 text-sm"
          required
          minLength={8}
          disabled={isSubmitting}
          autoFocus
        />
        <Input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="h-9 text-sm"
          required
          minLength={8}
          disabled={isSubmitting}
        />

        <p className="text-[9px] text-muted-foreground/70 leading-tight">
          Password must be at least 8 characters
        </p>

        {error && (
          <div className="px-2.5 py-1.5 rounded bg-destructive/5 border border-destructive/20 flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3 text-destructive shrink-0" />
            <p className="text-[10px] text-destructive leading-snug">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting || !password || !confirmPassword}
          className="w-full h-9"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-sm font-medium">Resetting...</span>
            </>
          ) : (
            <span className="text-sm font-medium">Reset Password</span>
          )}
        </Button>
      </form>
    </div>
  );
}
