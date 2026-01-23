import React, { useState, useEffect } from "react";
import { Button } from "./button";
import { Textarea } from "./textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import {
  Eye,
  Edit3,
  Play,
  Save,
  RotateCcw,
  Copy,
  Sparkles,
  TestTube,
  AlertTriangle,
  Info,
} from "lucide-react";
import { AlertDialog } from "./dialog";
import { useDialogs } from "../../hooks/useDialogs";
import { useAgentName } from "../../utils/agentName";
import ReasoningService from "../../services/ReasoningService";
import { getModelProvider } from "../../models/ModelRegistry";
import logger from "../../utils/logger";
import { UNIFIED_SYSTEM_PROMPT, LEGACY_PROMPTS } from "../../config/prompts";

interface PromptStudioProps {
  className?: string;
}

type ProviderConfig = {
  label: string;
  apiKeyStorageKey?: string;
  baseStorageKey?: string;
};

const PROVIDER_CONFIG: Record<string, ProviderConfig> = {
  openai: { label: "OpenAI", apiKeyStorageKey: "openaiApiKey" },
  anthropic: { label: "Anthropic", apiKeyStorageKey: "anthropicApiKey" },
  gemini: { label: "Gemini", apiKeyStorageKey: "geminiApiKey" },
  custom: {
    label: "Custom endpoint",
    apiKeyStorageKey: "openaiApiKey",
    baseStorageKey: "cloudReasoningBaseUrl",
  },
  local: { label: "Local" },
};

/**
 * Get the current prompt being used - either custom or default unified prompt
 */
function getCurrentPrompt(): string {
  const customPrompt = localStorage.getItem("customUnifiedPrompt");
  if (customPrompt) {
    try {
      return JSON.parse(customPrompt);
    } catch {
      return UNIFIED_SYSTEM_PROMPT;
    }
  }
  return UNIFIED_SYSTEM_PROMPT;
}

export default function PromptStudio({ className = "" }: PromptStudioProps) {
  const [activeTab, setActiveTab] = useState<"current" | "edit" | "test">("current");
  const [editedPrompt, setEditedPrompt] = useState(UNIFIED_SYSTEM_PROMPT);
  const [testText, setTestText] = useState(
    "um so like I was thinking we should probably you know schedule a meeting for next week to discuss the the project timeline"
  );
  const [testResult, setTestResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { alertDialog, showAlertDialog, hideAlertDialog } = useDialogs();
  const { agentName } = useAgentName();

  // Load saved custom prompt from localStorage
  useEffect(() => {
    // Migrate legacy two-prompt system (customPrompts → customUnifiedPrompt)
    const legacyPrompts = localStorage.getItem("customPrompts");
    if (legacyPrompts && !localStorage.getItem("customUnifiedPrompt")) {
      try {
        const parsed = JSON.parse(legacyPrompts);
        // Use agent prompt as base (it's more comprehensive than regular prompt)
        if (parsed.agent) {
          localStorage.setItem("customUnifiedPrompt", JSON.stringify(parsed.agent));
          localStorage.removeItem("customPrompts");
          console.log("Migrated legacy custom prompts to unified format");
        }
      } catch (e) {
        console.error("Failed to migrate legacy custom prompts:", e);
      }
    }

    // Load current custom prompt
    const customPrompt = localStorage.getItem("customUnifiedPrompt");
    if (customPrompt) {
      try {
        setEditedPrompt(JSON.parse(customPrompt));
      } catch (error) {
        console.error("Failed to load custom prompt:", error);
      }
    }
  }, []);

  const savePrompt = () => {
    localStorage.setItem("customUnifiedPrompt", JSON.stringify(editedPrompt));
    showAlertDialog({
      title: "Prompt Saved!",
      description:
        "Your custom prompt has been saved and will be used for all future AI processing.",
    });
  };

  const resetToDefault = () => {
    setEditedPrompt(UNIFIED_SYSTEM_PROMPT);
    localStorage.removeItem("customUnifiedPrompt");
    showAlertDialog({
      title: "Reset Complete",
      description: "Prompt has been reset to the default value.",
    });
  };

  const testPrompt = async () => {
    if (!testText.trim()) return;

    setIsLoading(true);
    setTestResult("");

    try {
      const useReasoningModel = localStorage.getItem("useReasoningModel") === "true";
      const reasoningModel = localStorage.getItem("reasoningModel") || "";
      const reasoningProvider = reasoningModel ? getModelProvider(reasoningModel) : "openai";
      const customBaseUrl = localStorage.getItem("cloudReasoningBaseUrl") || "";

      logger.debug(
        "PromptStudio test starting",
        {
          useReasoningModel,
          reasoningModel,
          reasoningProvider,
          customBaseUrl: customBaseUrl ? `${customBaseUrl.substring(0, 50)}...` : "(none)",
          testTextLength: testText.length,
          agentName,
        },
        "prompt-studio"
      );

      if (!useReasoningModel) {
        logger.debug("PromptStudio test aborted: AI enhancement disabled", {}, "prompt-studio");
        setTestResult(
          "AI text enhancement is disabled. Enable it in AI Text Cleanup settings to test prompts."
        );
        return;
      }

      if (!reasoningModel) {
        logger.debug("PromptStudio test aborted: no model selected", {}, "prompt-studio");
        setTestResult("No reasoning model selected. Choose one in AI Text Cleanup settings.");
        return;
      }

      const providerConfig = PROVIDER_CONFIG[reasoningProvider] || {
        label: reasoningProvider.charAt(0).toUpperCase() + reasoningProvider.slice(1),
      };
      const providerLabel = providerConfig.label;

      if (providerConfig.baseStorageKey) {
        const baseUrl = (localStorage.getItem(providerConfig.baseStorageKey) || "").trim();
        if (!baseUrl) {
          logger.debug(
            "PromptStudio test aborted: missing base URL for custom endpoint",
            { provider: reasoningProvider },
            "prompt-studio"
          );
          setTestResult(`${providerLabel} base URL missing. Add it in AI Text Cleanup settings.`);
          return;
        }
      }

      // Save the current edited prompt temporarily for the test
      const currentCustomPrompt = localStorage.getItem("customUnifiedPrompt");
      localStorage.setItem("customUnifiedPrompt", JSON.stringify(editedPrompt));

      const startTime = Date.now();

      try {
        if (reasoningProvider === "local") {
          logger.debug(
            "PromptStudio: sending to local model",
            { model: reasoningModel, textLength: testText.length },
            "prompt-studio"
          );

          const result = await window.electronAPI.processLocalReasoning(
            testText,
            reasoningModel,
            agentName,
            {}
          );

          const processingTime = Date.now() - startTime;

          if (result.success) {
            const resultText = result.text || "";
            logger.debug(
              "PromptStudio: local model success",
              {
                processingTimeMs: processingTime,
                resultLength: resultText.length,
                resultPreview: resultText.substring(0, 100),
              },
              "prompt-studio"
            );
            setTestResult(resultText);
          } else {
            logger.debug(
              "PromptStudio: local model error",
              { processingTimeMs: processingTime, error: result.error },
              "prompt-studio"
            );
            setTestResult(`Local model error: ${result.error}`);
          }
        } else {
          logger.debug(
            "PromptStudio: sending to cloud provider",
            {
              provider: reasoningProvider,
              model: reasoningModel,
              textLength: testText.length,
              isCustomEndpoint: reasoningProvider === "custom",
              customBaseUrl: customBaseUrl || "(default)",
            },
            "prompt-studio"
          );

          const result = await ReasoningService.processText(
            testText,
            reasoningModel,
            agentName,
            {}
          );

          const processingTime = Date.now() - startTime;

          logger.debug(
            "PromptStudio: cloud provider success",
            {
              provider: reasoningProvider,
              processingTimeMs: processingTime,
              resultLength: result.length,
              resultPreview: result.substring(0, 100),
            },
            "prompt-studio"
          );

          setTestResult(result);
        }
      } finally {
        // Restore original prompt
        if (currentCustomPrompt) {
          localStorage.setItem("customUnifiedPrompt", currentCustomPrompt);
        } else {
          localStorage.removeItem("customUnifiedPrompt");
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        "PromptStudio test failed",
        {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        },
        "prompt-studio"
      );
      setTestResult(`Test failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    showAlertDialog({
      title: "Copied!",
      description: "Prompt copied to clipboard.",
    });
  };

  // Check if the test text contains the agent name
  const isAgentAddressed = testText.toLowerCase().includes(agentName.toLowerCase());

  const renderCurrentPrompt = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-blue-600" />
          Current System Prompt
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          This is the exact prompt sent to your AI model. It handles both text cleanup and
          instruction detection in a single, unified approach.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-purple-600" />
            Unified System Prompt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>
                    <strong>Cleanup mode (default)</strong>: Cleans transcribed speech - removes
                    filler words, fixes grammar, punctuation
                  </li>
                  <li>
                    <strong>Instruction mode</strong>: When you directly address "{agentName}" with
                    a command, it executes the instruction AND cleans up the text
                  </li>
                  <li>The AI intelligently detects which mode to use based on context</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border rounded-lg p-4 font-mono text-sm max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap">
              {getCurrentPrompt().replace(/\{\{agentName\}\}/g, agentName)}
            </pre>
          </div>
          <Button
            onClick={() => copyPrompt(getCurrentPrompt())}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Prompt
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderEditPrompt = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-indigo-600" />
          Customize System Prompt
        </h3>
        <p className="text-sm text-gray-600 mb-2">
          Edit the system prompt to change how your AI processes speech. Use{" "}
          <code className="bg-gray-100 px-1 rounded">{"{{agentName}}"}</code> as a placeholder for
          your agent's name.
        </p>
        <p className="text-sm text-amber-600 mb-6">
          <strong>Caution:</strong> Modifying this prompt may affect transcription quality. The
          default prompt has been carefully crafted for optimal results.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            rows={20}
            className="font-mono text-sm"
            placeholder="Enter your custom system prompt..."
          />
          <p className="text-xs text-gray-500 mt-2">
            Your agent name is: <strong>{agentName}</strong>
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={savePrompt} className="flex-1">
          <Save className="w-4 h-4 mr-2" />
          Save Custom Prompt
        </Button>
        <Button onClick={resetToDefault} variant="outline">
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Default
        </Button>
      </div>
    </div>
  );

  const renderTestPlayground = () => {
    const useReasoningModel = localStorage.getItem("useReasoningModel") === "true";
    const reasoningModel = localStorage.getItem("reasoningModel") || "";
    const reasoningProvider = reasoningModel ? getModelProvider(reasoningModel) : "openai";
    const providerConfig = PROVIDER_CONFIG[reasoningProvider] || {
      label: reasoningProvider.charAt(0).toUpperCase() + reasoningProvider.slice(1),
    };
    const providerLabel = providerConfig.label;
    const providerEndpoint = providerConfig.baseStorageKey
      ? (localStorage.getItem(providerConfig.baseStorageKey) || "").trim()
      : "";

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TestTube className="w-5 h-5 text-green-600" />
            Test Your Prompt
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Test how the AI processes different types of input. Try both regular dictation and
            addressing your agent directly.
          </p>
        </div>

        {!useReasoningModel && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-800 font-medium">AI Text Enhancement Disabled</p>
                <p className="text-sm text-amber-700 mt-1">
                  Enable AI text enhancement in the AI Text Cleanup settings to test prompts.
                </p>
              </div>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Current Model:</span>
                <span className="ml-2 font-medium">{reasoningModel || "None selected"}</span>
              </div>
              <div>
                <span className="text-gray-600">Provider:</span>
                <span className="ml-2 font-medium capitalize">{providerLabel}</span>
                {providerConfig.baseStorageKey && (
                  <div className="text-xs text-gray-500 mt-1 break-all">
                    Endpoint: {providerEndpoint || "Not configured"}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Test Input</label>
              <Textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                rows={4}
                placeholder="Enter text to test..."
              />
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Try: "um so like I think we should uh schedule a meeting" (cleanup mode)</p>
                  <p>
                    Try: "Hey {agentName}, make this more formal: gonna send the report tomorrow"
                    (instruction mode)
                  </p>
                </div>
                {testText && (
                  <span
                    className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ml-4 ${
                      isAgentAddressed
                        ? "bg-purple-100 text-purple-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {isAgentAddressed ? "May trigger instruction mode" : "Cleanup mode"}
                  </span>
                )}
              </div>
            </div>

            <Button
              onClick={testPrompt}
              disabled={!testText.trim() || isLoading || !useReasoningModel}
              className="w-full"
            >
              <Play className="w-4 h-4 mr-2" />
              {isLoading ? "Processing..." : "Test with AI"}
            </Button>

            {testResult && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">AI Output</label>
                  <Button onClick={() => copyPrompt(testResult)} variant="ghost" size="sm">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="border rounded-lg p-4 text-sm max-h-60 overflow-y-auto bg-gray-50 border-gray-200">
                  <pre className="whitespace-pre-wrap">{testResult}</pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className={className}>
      <AlertDialog
        open={alertDialog.open}
        onOpenChange={(open) => !open && hideAlertDialog()}
        title={alertDialog.title}
        description={alertDialog.description}
        onOk={() => {}}
      />

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        {[
          { id: "current", label: "Current Prompt", icon: Eye },
          { id: "edit", label: "Customize", icon: Edit3 },
          { id: "test", label: "Test", icon: TestTube },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "current" && renderCurrentPrompt()}
      {activeTab === "edit" && renderEditPrompt()}
      {activeTab === "test" && renderTestPlayground()}
    </div>
  );
}
