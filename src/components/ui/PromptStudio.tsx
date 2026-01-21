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
  Zap,
  TestTube,
  AlertTriangle,
} from "lucide-react";
import { AlertDialog } from "./dialog";
import { useDialogs } from "../../hooks/useDialogs";
import { useAgentName } from "../../utils/agentName";
import ReasoningService, { DEFAULT_PROMPTS } from "../../services/ReasoningService";
import { getModelProvider } from "../../models/ModelRegistry";

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
  const [activeTab, setActiveTab] = useState<"current" | "edit" | "test">("current");
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
      const reasoningModel = localStorage.getItem("reasoningModel") || "";
      // Determine provider from the model name, falling back to openai if needed
      const reasoningProvider = reasoningModel ? getModelProvider(reasoningModel) : "openai";

      if (!useReasoningModel) {
        setTestResult(
          "⚠️ AI text enhancement is disabled. Enable it in AI Models settings to test prompts."
        );
        return;
      }

      if (!reasoningModel) {
        setTestResult("⚠️ No reasoning model selected. Choose one in AI Models settings.");
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

      // Note: API key validation is handled by ReasoningService which uses Electron IPC
      // to fetch keys from the environment. We skip localStorage validation here.

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
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-blue-600" />
          Current AI Prompts
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          These are the exact prompts currently being sent to your AI models. Understanding these
          helps you see how OpenWhispr thinks!
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-purple-600" />
            Agent Mode Prompt (when you say "Hey {agentName}")
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 border rounded-lg p-4 font-mono text-sm">
            <pre className="whitespace-pre-wrap">
              {editedAgentPrompt.replace(/\{\{agentName\}\}/g, agentName)}
            </pre>
          </div>
          <Button
            onClick={() => copyPrompt(editedAgentPrompt)}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Prompt
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="w-4 h-4 text-green-600" />
            Regular Mode Prompt (for automatic cleanup)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 border rounded-lg p-4 font-mono text-sm">
            <pre className="whitespace-pre-wrap">{editedRegularPrompt}</pre>
          </div>
          <Button
            onClick={() => copyPrompt(editedRegularPrompt)}
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

  const renderEditPrompts = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-indigo-600" />
          Customize Your AI Prompts
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Edit these prompts to change how your AI behaves. Use <code>{"{{agentName}}"}</code> and{" "}
          <code>{"{{text}}"}</code> as placeholders.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent Mode Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={editedAgentPrompt}
            onChange={(e) => setEditedAgentPrompt(e.target.value)}
            rows={12}
            className="font-mono text-sm"
            placeholder="Enter your custom agent prompt..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regular Mode Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={editedRegularPrompt}
            onChange={(e) => setEditedRegularPrompt(e.target.value)}
            rows={12}
            className="font-mono text-sm"
            placeholder="Enter your custom regular prompt..."
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={savePrompts} className="flex-1">
          <Save className="w-4 h-4 mr-2" />
          Save Custom Prompts
        </Button>
        <Button onClick={resetToDefaults} variant="outline">
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
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
            Test Your Prompts
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Test your custom prompts with the actual AI model to see real results.
          </p>
        </div>

        {!useReasoningModel && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-800 font-medium">AI Text Enhancement Disabled</p>
                <p className="text-sm text-amber-700 mt-1">
                  Enable AI text enhancement in the AI Models settings to test prompts.
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
                <span className="ml-2 font-medium">{reasoningModel}</span>
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
                rows={3}
                placeholder="Enter text to test with your custom prompts..."
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500">
                  Try including "{agentName}" in your text to test agent mode prompts
                </p>
                {testText && (
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
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
              <Play className="w-4 h-4 mr-2" />
              {isLoading ? "Processing with AI..." : "Test Prompt with AI"}
            </Button>

            {testResult && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">AI Response</label>
                  <Button onClick={() => copyPrompt(testResult)} variant="ghost" size="sm">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div
                  className={`border rounded-lg p-4 text-sm max-h-60 overflow-y-auto ${
                    testResult.startsWith("⚠️") || testResult.startsWith("❌")
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
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
          { id: "current", label: "Current Prompts", icon: Eye },
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
      {activeTab === "current" && renderCurrentPrompts()}
      {activeTab === "edit" && renderEditPrompts()}
      {activeTab === "test" && renderTestPlayground()}
    </div>
  );
}
