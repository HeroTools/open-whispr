const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { app } = require("electron");

// Log retention configuration (in days)
const LOG_RETENTION_DAYS = parseInt(process.env.OPENWISPR_LOG_RETENTION_DAYS, 10) || 14;

class DatabaseManager {
  constructor() {
    this.db = null;
    this.initDatabase();
  }

  initDatabase() {
    try {
      const dbFileName =
        process.env.NODE_ENV === "development" ? "transcriptions-dev.db" : "transcriptions.db";

      const dbPath = path.join(app.getPath("userData"), dbFileName);

      this.db = new Database(dbPath);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS transcriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          text TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          duration_seconds REAL DEFAULT NULL
        )
      `);

      // Migration: Add duration_seconds column if it doesn't exist (for existing databases)
      try {
        this.db.exec(`ALTER TABLE transcriptions ADD COLUMN duration_seconds REAL DEFAULT NULL`);
      } catch (e) {
        // Column already exists, ignore
      }

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS custom_dictionary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Run log retention cleanup on startup
      this.cleanupOldTranscriptions();

      return true;
    } catch (error) {
      console.error("Database initialization failed:", error.message);
      throw error;
    }
  }

  /**
   * Delete transcriptions older than the retention period (default 14 days)
   * This is called automatically on startup to maintain database size
   * @param {number} retentionDays - Number of days to keep (default from env or 14)
   * @returns {{ deleted: number, success: boolean }}
   */
  cleanupOldTranscriptions(retentionDays = LOG_RETENTION_DAYS) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }

      // Delete transcriptions older than the retention period
      // SQLite datetime('now', '-N days') calculates N days ago from current time
      const stmt = this.db.prepare(`
        DELETE FROM transcriptions
        WHERE created_at < datetime('now', '-' || ? || ' days')
      `);
      const result = stmt.run(retentionDays);

      if (result.changes > 0) {
        console.log(`🧹 Log retention cleanup: Deleted ${result.changes} transcriptions older than ${retentionDays} days`);
      }

      return { deleted: result.changes, success: true };
    } catch (error) {
      console.error("Error cleaning up old transcriptions:", error.message);
      // Don't throw - cleanup failure shouldn't break the app
      return { deleted: 0, success: false, error: error.message };
    }
  }

  /**
   * Get statistics about transcription storage
   * @returns {{ total: number, oldestDate: string|null, newestDate: string|null }}
   */
  getTranscriptionStats() {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }

      const countStmt = this.db.prepare("SELECT COUNT(*) as total FROM transcriptions");
      const countResult = countStmt.get();

      const rangeStmt = this.db.prepare(`
        SELECT
          MIN(created_at) as oldest,
          MAX(created_at) as newest
        FROM transcriptions
      `);
      const rangeResult = rangeStmt.get();

      return {
        total: countResult.total,
        oldestDate: rangeResult.oldest,
        newestDate: rangeResult.newest,
        retentionDays: LOG_RETENTION_DAYS,
      };
    } catch (error) {
      console.error("Error getting transcription stats:", error.message);
      return { total: 0, oldestDate: null, newestDate: null, retentionDays: LOG_RETENTION_DAYS };
    }
  }

  /**
   * Get dashboard statistics for the Wispr Flow-style dashboard
   * Returns total words, average WPM, and streak count
   * @returns {{ totalWords: number, totalTranscriptions: number, averageWpm: number, streak: number }}
   */
  getDashboardStats() {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }

      // Get total word count (words = spaces + 1 for non-empty text)
      const wordStmt = this.db.prepare(`
        SELECT
          COUNT(*) as totalTranscriptions,
          COALESCE(SUM(
            CASE
              WHEN LENGTH(TRIM(text)) = 0 THEN 0
              ELSE LENGTH(TRIM(text)) - LENGTH(REPLACE(TRIM(text), ' ', '')) + 1
            END
          ), 0) as totalWords
        FROM transcriptions
      `);
      const wordResult = wordStmt.get();

      // Calculate average WPM from actual recording durations
      // WPM = total words / total duration in minutes
      // Only use transcriptions that have duration data
      const wpmStmt = this.db.prepare(`
        SELECT
          COALESCE(SUM(
            CASE
              WHEN LENGTH(TRIM(text)) = 0 THEN 0
              ELSE LENGTH(TRIM(text)) - LENGTH(REPLACE(TRIM(text), ' ', '')) + 1
            END
          ), 0) as wordsWithDuration,
          COALESCE(SUM(duration_seconds), 0) as totalDurationSeconds,
          COUNT(*) as countWithDuration
        FROM transcriptions
        WHERE duration_seconds IS NOT NULL AND duration_seconds > 0
      `);
      const wpmResult = wpmStmt.get();

      let averageWpm = 0;
      if (wpmResult.totalDurationSeconds > 0) {
        // Real WPM calculation: words / (seconds / 60)
        averageWpm = Math.round(wpmResult.wordsWithDuration / (wpmResult.totalDurationSeconds / 60));
      } else if (wordResult.totalTranscriptions > 0) {
        // Fallback for old data without duration: estimate ~130 WPM (average speaking rate)
        // This will be replaced as new transcriptions with duration are added
        averageWpm = 130;
      }

      // Calculate streak - consecutive days with transcriptions ending today or yesterday
      const streakStmt = this.db.prepare(`
        WITH RECURSIVE dates AS (
          SELECT DATE('now', 'localtime') as day
          UNION ALL
          SELECT DATE(day, '-1 day')
          FROM dates
          WHERE EXISTS (
            SELECT 1 FROM transcriptions
            WHERE DATE(created_at, 'localtime') = DATE(dates.day, '-1 day')
          )
        )
        SELECT COUNT(*) as streak FROM dates
        WHERE EXISTS (
          SELECT 1 FROM transcriptions
          WHERE DATE(created_at, 'localtime') = dates.day
        )
      `);
      const streakResult = streakStmt.get();

      return {
        totalWords: wordResult.totalWords || 0,
        totalTranscriptions: wordResult.totalTranscriptions || 0,
        averageWpm: averageWpm,
        streak: streakResult.streak || 0,
      };
    } catch (error) {
      console.error("Error getting dashboard stats:", error.message);
      return { totalWords: 0, totalTranscriptions: 0, averageWpm: 0, streak: 0 };
    }
  }

  /**
   * Get transcriptions grouped by day for the dashboard view
   * @param {number} limit - Maximum number of transcriptions to return
   * @returns {Array<{ id: number, text: string, timestamp: string, created_at: string, day: string }>}
   */
  getTranscriptionsGrouped(limit = 100) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }

      const stmt = this.db.prepare(`
        SELECT
          id,
          text,
          timestamp,
          created_at,
          DATE(created_at, 'localtime') as day
        FROM transcriptions
        ORDER BY created_at DESC
        LIMIT ?
      `);
      return stmt.all(limit);
    } catch (error) {
      console.error("Error getting grouped transcriptions:", error.message);
      return [];
    }
  }

  saveTranscription(text, durationSeconds = null) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("INSERT INTO transcriptions (text, duration_seconds) VALUES (?, ?)");
      const result = stmt.run(text, durationSeconds);

      const fetchStmt = this.db.prepare("SELECT * FROM transcriptions WHERE id = ?");
      const transcription = fetchStmt.get(result.lastInsertRowid);

      return { id: result.lastInsertRowid, success: true, transcription };
    } catch (error) {
      console.error("Error saving transcription:", error.message);
      throw error;
    }
  }

  getTranscriptions(limit = 50) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("SELECT * FROM transcriptions ORDER BY timestamp DESC LIMIT ?");
      const transcriptions = stmt.all(limit);
      return transcriptions;
    } catch (error) {
      console.error("Error getting transcriptions:", error.message);
      throw error;
    }
  }

  clearTranscriptions() {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("DELETE FROM transcriptions");
      const result = stmt.run();
      return { cleared: result.changes, success: true };
    } catch (error) {
      console.error("Error clearing transcriptions:", error.message);
      throw error;
    }
  }

  deleteTranscription(id) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("DELETE FROM transcriptions WHERE id = ?");
      const result = stmt.run(id);
      console.log(`🗑️ Deleted transcription ${id}, affected rows: ${result.changes}`);
      return { success: result.changes > 0, id };
    } catch (error) {
      console.error("❌ Error deleting transcription:", error);
      throw error;
    }
  }

  getDictionary() {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("SELECT word FROM custom_dictionary ORDER BY id ASC");
      const rows = stmt.all();
      return rows.map((row) => row.word);
    } catch (error) {
      console.error("Error getting dictionary:", error.message);
      throw error;
    }
  }

  setDictionary(words) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const transaction = this.db.transaction((wordList) => {
        this.db.prepare("DELETE FROM custom_dictionary").run();
        const insert = this.db.prepare("INSERT OR IGNORE INTO custom_dictionary (word) VALUES (?)");
        for (const word of wordList) {
          const trimmed = typeof word === "string" ? word.trim() : "";
          if (trimmed) {
            insert.run(trimmed);
          }
        }
      });
      transaction(words);
      return { success: true };
    } catch (error) {
      console.error("Error setting dictionary:", error.message);
      throw error;
    }
  }

  cleanup() {
    console.log("Starting database cleanup...");
    try {
      const dbPath = path.join(
        app.getPath("userData"),
        process.env.NODE_ENV === "development" ? "transcriptions-dev.db" : "transcriptions.db"
      );
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log("✅ Database file deleted:", dbPath);
      }
    } catch (error) {
      console.error("❌ Error deleting database file:", error);
    }
  }
}

module.exports = DatabaseManager;
