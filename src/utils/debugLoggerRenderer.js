// Shared debug logger for renderer process
const createDebugLogger = (prefix = "REASONING") => {
  return {
    isDebugMode: null, // Cache debug mode status

    async checkDebugMode() {
      if (
        this.isDebugMode === null &&
        typeof window !== "undefined" &&
        window.electronAPI?.getDebugMode
      ) {
        try {
          this.isDebugMode = await window.electronAPI.getDebugMode();
        } catch {
          this.isDebugMode = false;
        }
      }
      return this.isDebugMode || false;
    },

    async logReasoning(stage, details) {
      // Only log if debug mode is enabled
      const debugEnabled = await this.checkDebugMode();
      if (!debugEnabled) return;

      if (typeof window !== "undefined" && window.electronAPI?.logReasoning) {
        try {
          await window.electronAPI.logReasoning(stage, details);
        } catch (error) {
          console.error("Failed to log reasoning:", error);
        }
      } else {
        // Fallback to console if IPC not available
        console.log(`🤖 [${prefix} ${stage}]`, details);
      }
    },

    clearCache() {
      this.isDebugMode = null;
    },
  };
};

export default createDebugLogger;
