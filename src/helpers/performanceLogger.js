

class PerformanceLogger {
    constructor() {
        this.currentSession = null;
        this.isEnabled = true;
    }

    startSession(filename, fileSize = 0) {
        if (!this.isEnabled) return;

        this.currentSession = {
            timestamp: new Date().toISOString(),
            audio_file: filename || 'unknown_audio',
            file_size_bytes: fileSize,
            file_size_mb: parseFloat((fileSize / (1024 * 1024)).toFixed(2)),
            steps: {},
            total_time_ms: 0,
            success: false,
            start_time: performance.now(),
            absolute_start_time: Date.now() // For calculating total time across async boundaries
        };

        console.log(`[Perf] Started session for ${this.currentSession.audio_file}`);
    }

    startStep(stepName, metadata = {}) {
        if (!this.currentSession) return;

        this.currentSession.steps[stepName] = {
            start_time: performance.now(),
            ...metadata
        };
        console.log(`[Perf] Started step: ${stepName}`);
    }

    endStep(stepName, metadata = {}) {
        if (!this.currentSession || !this.currentSession.steps[stepName]) return;

        const step = this.currentSession.steps[stepName];
        const endTime = performance.now();
        const duration = parseFloat((endTime - step.start_time).toFixed(2));

        this.currentSession.steps[stepName] = {
            ...step,
            ...metadata,
            duration_ms: duration
        };
        delete this.currentSession.steps[stepName].start_time; // Clean up temp data

        console.log(`[Perf] Completed step: ${stepName} in ${duration}ms`);
    }

    endSession(success = true, error = null) {
        if (!this.currentSession) return;

        const endTime = performance.now();
        this.currentSession.total_time_ms = parseFloat((endTime - this.currentSession.start_time).toFixed(2));
        this.currentSession.success = success;
        if (error) {
            this.currentSession.error = error;
        }

        // Calculate breakdown
        const breakdown = {};
        let totalStepTime = 0;
        for (const [name, step] of Object.entries(this.currentSession.steps)) {
            if (step.duration_ms) {
                totalStepTime += step.duration_ms;
            }
        }

        if (totalStepTime > 0) {
            for (const [name, step] of Object.entries(this.currentSession.steps)) {
                if (step.duration_ms) {
                    breakdown[name] = parseFloat(((step.duration_ms / totalStepTime) * 100).toFixed(1));
                }
            }
        }
        this.currentSession.breakdown_percent = breakdown;

        // Log to console
        console.log('[Perf] Session Complete:', JSON.stringify(this.currentSession, null, 2));

        // Send to main process to write to file
        if (window.electronAPI && window.electronAPI.logPerformance) {
            window.electronAPI.logPerformance(this.currentSession);
        } else {
            console.warn('[Perf] electronAPI.logPerformance not available');
        }

        const session = this.currentSession;
        this.currentSession = null;
        return session;
    }
}

export default new PerformanceLogger();
