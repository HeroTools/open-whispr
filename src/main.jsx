import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.jsx";
import ControlPanel from "./components/ControlPanel.tsx";
import OnboardingFlow from "./components/OnboardingFlow.tsx";
import { ToastProvider } from "./components/ui/Toast.tsx";
import { CLERK_PUBLISHABLE_KEY, clerkConfig } from "./lib/clerk.ts";
import "./index.css";

function AppRouter() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if this is the control panel window
  const isControlPanel =
    window.location.pathname.includes("control") ||
    window.location.search.includes("panel=true");

  // Check if this is the dictation panel (main app)
  const isDictationPanel = !isControlPanel;

  useEffect(() => {
    // Check if onboarding has been completed
    const onboardingCompleted =
      localStorage.getItem("onboardingCompleted") === "true";
    const currentStep = parseInt(
      localStorage.getItem("onboardingCurrentStep") || "0"
    );

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

// Wrap the app conditionally with ClerkProvider only if key is available
const AppWithProviders = () => {
  // Only wrap with ClerkProvider if we have a key
  if (CLERK_PUBLISHABLE_KEY) {
    return (
      <ClerkProvider
        publishableKey={CLERK_PUBLISHABLE_KEY}
        appearance={clerkConfig.appearance}
      >
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </ClerkProvider>
    );
  }

  // Without Clerk key, just use ToastProvider
  return (
    <ToastProvider>
      <AppRouter />
    </ToastProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppWithProviders />
  </React.StrictMode>
);
