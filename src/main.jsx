import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ControlPanel from "./components/ControlPanel.tsx";
import OnboardingFlow from "./components/OnboardingFlow.tsx";
import { ToastProvider } from "./components/ui/Toast.tsx";
import "./index.css";

// OAuth callback handler: when the browser redirects back from Google/Neon Auth
// with a session verifier, redirect to the openwhispr:// protocol so Electron
// can capture it and complete authentication. This check runs before React
// mounts — if we detect we're in the system browser with a verifier, we
// redirect immediately and skip mounting the app entirely.
function isOAuthBrowserRedirect() {
  const params = new URLSearchParams(window.location.search);
  const verifier = params.get("neon_auth_session_verifier");
  const isInElectron = typeof window.electronAPI !== "undefined";

  if (verifier && !isInElectron) {
    // We're in the system browser after OAuth — redirect to Electron via deep link
    window.location.href = `openwhispr://auth/callback?neon_auth_session_verifier=${encodeURIComponent(verifier)}`;
    // Show a message while the redirect happens
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;color:#666">
        <div style="text-align:center">
          <p style="font-size:18px;margin-bottom:8px">Redirecting back to OpenWhispr...</p>
          <p style="font-size:14px">You can close this tab.</p>
        </div>
      </div>
    `;
    return true;
  }
  return false;
}

if (!isOAuthBrowserRedirect()) {
  mountApp();
}

function AppRouter() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if this is the control panel window
  const isControlPanel =
    window.location.pathname.includes("control") || window.location.search.includes("panel=true");

  // Check if this is the dictation panel (main app)
  const isDictationPanel = !isControlPanel;

  useEffect(() => {
    // Check if onboarding has been completed
    const onboardingCompleted = localStorage.getItem("onboardingCompleted") === "true";
    // Clamp step to valid range (0-5) for current 6-step onboarding
    const rawStep = parseInt(localStorage.getItem("onboardingCurrentStep") || "0");
    const currentStep = Math.max(0, Math.min(rawStep, 5));

    if (isControlPanel && !onboardingCompleted) {
      // Show onboarding for control panel if not completed
      setShowOnboarding(true);
    }

    // Hide dictation panel window unless onboarding is complete or we're past the permissions step
    if (isDictationPanel && !onboardingCompleted && currentStep < 4) {
      window.electronAPI?.hideWindow?.();
    }

    setIsLoading(false);
  }, [isControlPanel, isDictationPanel]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    localStorage.setItem("onboardingCompleted", "true");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading OpenWhispr...</p>
        </div>
      </div>
    );
  }

  if (isControlPanel && showOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return isControlPanel ? <ControlPanel /> : <App />;
}

function mountApp() {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ToastProvider>
        <AppRouter />
      </ToastProvider>
    </React.StrictMode>
  );
}
