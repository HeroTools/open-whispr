import React, { useState, useEffect } from "react";
import { Button } from "./button";
import { Textarea } from "./textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import {
  Eye,
  Edit3,
  Play,
  Save,
  RotateCcw,
  Copy,
  Sparkles,
  Zap,
  TestTube,
  AlertTriangle,
} from "lucide-react";
import { AlertDialog } from "./dialog";
import { useDialogs } from "../../hooks/useDialogs";
import { useAgentName } from "../../utils/agentName";
import ReasoningService, { DEFAULT_PROMPTS } from "../../services/ReasoningService";

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

export default function PromptStudio({ className = "" }: PromptStudioProps) {
  const [editedAgentPrompt, setEditedAgentPrompt] = useState(DEFAULT_PROMPTS.agent);
  const [editedRegularPrompt, setEditedRegularPrompt] = useState(DEFAULT_PROMPTS.regular);
  const [testText, setTestText] = useState(
    "Hey Assistant, make this more professional: This is a test message that needs some work."
  );
  const [testResult, setTestResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { alertDialog, showAlertDialog, hideAlertDialog } = useDialogs();
  const { agentName } = useAgentName();

  // Load saved custom prompts from localStorage
  useEffect(() => {
    const savedPrompts = localStorage.getItem("customPrompts");
    if (savedPrompts) {
      try {
        const parsed = JSON.parse(savedPrompts);
        setEditedAgentPrompt(parsed.agent || DEFAULT_PROMPTS.agent);
        setEditedRegularPrompt(parsed.regular || DEFAULT_PROMPTS.regular);
      } catch (error) {
        console.error("Failed to load custom prompts:", error);
      }
    }
  }, []);

  const savePrompts = () => {
    const customPrompts = {
      agent: editedAgentPrompt,
      regular: editedRegularPrompt,
    };

    localStorage.setItem("customPrompts", JSON.stringify(customPrompts));
    showAlertDialog({
      title: "Prompts Saved!",
      description:
        "Your custom prompts have been saved and will be used for all future AI processing.",
    });
  };

  const resetToDefaults = () => {
    setEditedAgentPrompt(DEFAULT_PROMPTS.agent);
    setEditedRegularPrompt(DEFAULT_PROMPTS.regular);
    localStorage.removeItem("customPrompts");
    showAlertDialog({
      title: "Reset Complete",
      description: "Prompts have been reset to default values.",
    });
  };

  const testPrompt = async () => {
    if (!testText.trim()) return;

    setIsLoading(true);
    setTestResult("");

    try {
      // Check if reasoning model is enabled and if we have the necessary settings
      const useReasoningModel = localStorage.getItem("useReasoningModel") === "true";
      const reasoningModel = localStorage.getItem("reasoningModel") || "gpt-4o-mini";
      const reasoningProvider = localStorage.getItem("reasoningProvider") || "openai";

      if (!useReasoningModel) {
        setTestResult(
          "⚠️ AI text enhancement is disabled. Enable it in AI Models settings to test prompts."
        );
        return;
      }

      const providerConfig = PROVIDER_CONFIG[reasoningProvider] || {
        label: reasoningProvider.charAt(0).toUpperCase() + reasoningProvider.slice(1),
      };
      const providerLabel = providerConfig.label;

      if (providerConfig.baseStorageKey) {
        const baseUrl = (localStorage.getItem(providerConfig.baseStorageKey) || "").trim();
        if (!baseUrl) {
          setTestResult(`⚠️ ${providerLabel} base URL missing. Add it in AI Models settings.`);
          return;
        }
      }

      if (providerConfig.apiKeyStorageKey) {
        const apiKey = localStorage.getItem(providerConfig.apiKeyStorageKey);
        if (!apiKey || apiKey.trim() === "") {
          setTestResult(`⚠️ No ${providerLabel} API key found. Add it in AI Models settings.`);
          return;
        }
      }

      // Save current prompts temporarily so the test uses them
      const currentCustomPrompts = localStorage.getItem("customPrompts");
      localStorage.setItem(
        "customPrompts",
        JSON.stringify({
          agent: editedAgentPrompt,
          regular: editedRegularPrompt,
        })
      );

      try {
        // For local models, use a different approach
        if (reasoningProvider === "local") {
          // Call local reasoning directly
          const result = await window.electronAPI.processLocalReasoning(
            testText,
            reasoningModel,
            agentName,
            {
              customPrompts: {
                agent: editedAgentPrompt,
                regular: editedRegularPrompt,
              },
            }
          );

          if (result.success) {
            setTestResult(result.text);
          } else {
            setTestResult(`❌ Local model error: ${result.error}`);
          }
        } else {
          // Call the AI - ReasoningService will automatically use the custom prompts
          const result = await ReasoningService.processText(testText, reasoningModel, agentName, {
            customPrompts: {
              agent: editedAgentPrompt,
              regular: editedRegularPrompt,
            },
          });
          setTestResult(result);
        }
      } finally {
        // Restore original prompts
        if (currentCustomPrompts) {
          localStorage.setItem("customPrompts", currentCustomPrompts);
        } else {
          localStorage.removeItem("customPrompts");
        }
      }
    } catch (error) {
      console.error("Test failed:", error);
      setTestResult(`❌ Test failed: ${error.message}`);
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

  const renderCurrentPrompts = () => (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-semibold text-primary-900">
          Current AI Prompts
        </h3>
        <p className="mb-6 text-sm text-secondary-500">
          These are the exact prompts currently being sent to your AI models. Understanding these
          helps you see how OpenWhispr thinks!
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
        <h4 className="font-medium text-primary-900">Agent Mode Prompt (when you say "Hey {agentName}")</h4>
        <div className="rounded-lg border border-primary-200 bg-white p-4 font-mono text-sm text-primary-900">
          <pre className="whitespace-pre-wrap">
            {editedAgentPrompt.replace(/\{\{agentName\}\}/g, agentName)}
          </pre>
        </div>
        <Button
          onClick={() => copyPrompt(editedAgentPrompt)}
          variant="outline"
          size="sm"
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy Prompt
        </Button>
      </div>

      <div className="space-y-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
        <h4 className="font-medium text-primary-900">Regular Mode Prompt (for automatic cleanup)</h4>
        <div className="rounded-lg border border-primary-200 bg-white p-4 font-mono text-sm text-primary-900">
          <pre className="whitespace-pre-wrap">{editedRegularPrompt}</pre>
        </div>
        <Button
          onClick={() => copyPrompt(editedRegularPrompt)}
          variant="outline"
          size="sm"
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy Prompt
        </Button>
      </div>
    </div>
  );

  const renderEditPrompts = () => (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-semibold text-primary-900">
          Customize Your AI Prompts
        </h3>
        <p className="mb-6 text-sm text-secondary-500">
          Edit these prompts to change how your AI behaves. Use <code className="text-primary-900">{"{{agentName}}"}</code> and{" "}
          <code className="text-primary-900">{"{{text}}"}</code> as placeholders.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
        <h4 className="font-medium text-primary-900">Agent Mode Prompt</h4>
        <Textarea
          value={editedAgentPrompt}
          onChange={(e) => setEditedAgentPrompt(e.target.value)}
          rows={12}
          className="font-mono text-sm"
          placeholder="Enter your custom agent prompt..."
        />
      </div>

      <div className="space-y-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
        <h4 className="font-medium text-primary-900">Regular Mode Prompt</h4>
        <Textarea
          value={editedRegularPrompt}
          onChange={(e) => setEditedRegularPrompt(e.target.value)}
          rows={12}
          className="font-mono text-sm"
          placeholder="Enter your custom regular prompt..."
        />
      </div>

      <div className="flex gap-3">
        <Button onClick={savePrompts} className="flex-1">
          <Save className="mr-2 h-4 w-4" />
          Save Custom Prompts
        </Button>
        <Button onClick={resetToDefaults} variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );

  const renderTestPlayground = () => {
    const useReasoningModel = localStorage.getItem("useReasoningModel") === "true";
    const reasoningModel = localStorage.getItem("reasoningModel") || "gpt-4o-mini";
    const reasoningProvider = localStorage.getItem("reasoningProvider") || "openai";
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
          <h3 className="mb-4 text-lg font-semibold text-primary-900">
            Test Your Prompts
          </h3>
          <p className="mb-6 text-sm text-secondary-500">
            Test your custom prompts with the actual AI model to see real results.
          </p>
        </div>

        {!useReasoningModel && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800">AI Text Enhancement Disabled</p>
                <p className="mt-1 text-sm text-amber-700">
                  Enable AI text enhancement in the AI Models settings to test prompts.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-secondary-500">Current Model:</span>
                <span className="ml-2 font-medium text-primary-900">{reasoningModel}</span>
              </div>
              <div>
                <span className="text-secondary-500">Provider:</span>
                <span className="ml-2 font-medium capitalize text-primary-900">{providerLabel}</span>
                {providerConfig.baseStorageKey && (
                  <div className="mt-1 text-xs break-all text-secondary-500">
                    Endpoint: {providerEndpoint || "Not configured"}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-primary-900">Test Input</label>
              <Textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                rows={3}
                placeholder="Enter text to test with your custom prompts..."
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-secondary-500">
                  Try including "{agentName}" in your text to test agent mode prompts
                </p>
                {testText && (
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      testText.toLowerCase().includes(agentName.toLowerCase())
                        ? "bg-purple-100 text-purple-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {testText.toLowerCase().includes(agentName.toLowerCase())
                      ? "🤖 Agent Mode"
                      : "✨ Regular Mode"}
                  </span>
                )}
              </div>
            </div>

            <Button
              onClick={testPrompt}
              disabled={!testText.trim() || isLoading || !useReasoningModel}
              className="w-full"
            >
              <Play className="mr-2 h-4 w-4" />
              {isLoading ? "Processing with AI..." : "Test Prompt with AI"}
            </Button>

            {testResult && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-primary-900">AI Response</label>
                  <Button onClick={() => copyPrompt(testResult)} variant="ghost" size="sm">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div
                  className={`max-h-60 overflow-y-auto rounded-lg border p-4 text-sm ${
                    testResult.startsWith("⚠️") || testResult.startsWith("❌")
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-primary-200 bg-white text-primary-900"
                  }`}
                >
                  <pre className="whitespace-pre-wrap">{testResult}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
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

      <Tabs defaultValue="current" className="w-full">
        <TabsList className="mb-6 !bg-white border border-primary-200">
          <TabsTrigger value="current" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Current Prompts
          </TabsTrigger>
          <TabsTrigger value="edit" className="flex items-center gap-2">
            <Edit3 className="h-4 w-4" />
            Customize
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Test
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="mt-0">
          {renderCurrentPrompts()}
        </TabsContent>

        <TabsContent value="edit" className="mt-0">
          {renderEditPrompts()}
        </TabsContent>

        <TabsContent value="test" className="mt-0">
          {renderTestPlayground()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
