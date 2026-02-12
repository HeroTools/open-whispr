const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { app } = require("electron");

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
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS custom_dictionary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL DEFAULT 'Untitled Note',
          content TEXT NOT NULL DEFAULT '',
          note_type TEXT NOT NULL DEFAULT 'personal',
          source_file TEXT,
          audio_duration_seconds REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      try {
        this.db.exec("ALTER TABLE notes ADD COLUMN enhanced_content TEXT");
      } catch {}
      try {
        this.db.exec("ALTER TABLE notes ADD COLUMN enhancement_prompt TEXT");
      } catch {}
      try {
        this.db.exec("ALTER TABLE notes ADD COLUMN enhanced_at_content_hash TEXT");
      } catch {}

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          is_default INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const folderCount = this.db.prepare("SELECT COUNT(*) as count FROM folders").get();
      if (folderCount.count === 0) {
        const seedFolder = this.db.prepare(
          "INSERT INTO folders (name, is_default, sort_order) VALUES (?, 1, ?)"
        );
        seedFolder.run("Personal", 0);
        seedFolder.run("Meetings", 1);
      }

      try {
        this.db.exec("ALTER TABLE notes ADD COLUMN folder_id INTEGER REFERENCES folders(id)");
      } catch {}

      const personalFolder = this.db
        .prepare("SELECT id FROM folders WHERE name = 'Personal' AND is_default = 1")
        .get();
      if (personalFolder) {
        this.db
          .prepare("UPDATE notes SET folder_id = ? WHERE folder_id IS NULL")
          .run(personalFolder.id);
      }

      return true;
    } catch (error) {
      console.error("Database initialization failed:", error.message);
      throw error;
    }
  }

  saveTranscription(text) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("INSERT INTO transcriptions (text) VALUES (?)");
      const result = stmt.run(text);

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

  saveNote(
    title,
    content,
    noteType = "personal",
    sourceFile = null,
    audioDuration = null,
    folderId = null
  ) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      if (!folderId) {
        const personal = this.db
          .prepare("SELECT id FROM folders WHERE name = 'Personal' AND is_default = 1")
          .get();
        folderId = personal?.id || null;
      }
      const stmt = this.db.prepare(
        "INSERT INTO notes (title, content, note_type, source_file, audio_duration_seconds, folder_id) VALUES (?, ?, ?, ?, ?, ?)"
      );
      const result = stmt.run(title, content, noteType, sourceFile, audioDuration, folderId);

      const fetchStmt = this.db.prepare("SELECT * FROM notes WHERE id = ?");
      const note = fetchStmt.get(result.lastInsertRowid);

      return { success: true, note };
    } catch (error) {
      console.error("Error saving note:", error.message);
      throw error;
    }
  }

  getNote(id) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("SELECT * FROM notes WHERE id = ?");
      return stmt.get(id) || null;
    } catch (error) {
      console.error("Error getting note:", error.message);
      throw error;
    }
  }

  getNotes(noteType = null, limit = 100, folderId = null) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const conditions = [];
      const params = [];
      if (noteType) {
        conditions.push("note_type = ?");
        params.push(noteType);
      }
      if (folderId) {
        conditions.push("folder_id = ?");
        params.push(folderId);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const stmt = this.db.prepare(`SELECT * FROM notes ${where} ORDER BY updated_at DESC LIMIT ?`);
      params.push(limit);
      return stmt.all(...params);
    } catch (error) {
      console.error("Error getting notes:", error.message);
      throw error;
    }
  }

  updateNote(id, updates) {
    try {
      if (!this.db) throw new Error("Database not initialized");
      const allowedFields = [
        "title",
        "content",
        "enhanced_content",
        "enhancement_prompt",
        "enhanced_at_content_hash",
        "folder_id",
      ];
      const fields = [];
      const values = [];
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key) && value !== undefined) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
      if (fields.length === 0) return { success: false };
      fields.push("updated_at = CURRENT_TIMESTAMP");
      values.push(id);
      const stmt = this.db.prepare(`UPDATE notes SET ${fields.join(", ")} WHERE id = ?`);
      stmt.run(...values);
      const fetchStmt = this.db.prepare("SELECT * FROM notes WHERE id = ?");
      const note = fetchStmt.get(id);
      return { success: true, note };
    } catch (error) {
      console.error("Error updating note:", error.message);
      throw error;
    }
  }

  getFolders() {
    try {
      if (!this.db) throw new Error("Database not initialized");
      return this.db.prepare("SELECT * FROM folders ORDER BY sort_order ASC, created_at ASC").all();
    } catch (error) {
      console.error("Error getting folders:", error.message);
      throw error;
    }
  }

  createFolder(name) {
    try {
      if (!this.db) throw new Error("Database not initialized");
      const trimmed = (name || "").trim();
      if (!trimmed) return { success: false, error: "Folder name is required" };
      const existing = this.db.prepare("SELECT id FROM folders WHERE name = ?").get(trimmed);
      if (existing) return { success: false, error: "A folder with that name already exists" };
      const maxOrder = this.db.prepare("SELECT MAX(sort_order) as max_order FROM folders").get();
      const sortOrder = (maxOrder?.max_order ?? 0) + 1;
      const result = this.db
        .prepare("INSERT INTO folders (name, sort_order) VALUES (?, ?)")
        .run(trimmed, sortOrder);
      const folder = this.db
        .prepare("SELECT * FROM folders WHERE id = ?")
        .get(result.lastInsertRowid);
      return { success: true, folder };
    } catch (error) {
      console.error("Error creating folder:", error.message);
      throw error;
    }
  }

  deleteFolder(id) {
    try {
      if (!this.db) throw new Error("Database not initialized");
      const folder = this.db.prepare("SELECT * FROM folders WHERE id = ?").get(id);
      if (!folder) return { success: false, error: "Folder not found" };
      if (folder.is_default) return { success: false, error: "Cannot delete default folders" };
      const personal = this.db
        .prepare("SELECT id FROM folders WHERE name = 'Personal' AND is_default = 1")
        .get();
      if (personal) {
        this.db.prepare("UPDATE notes SET folder_id = ? WHERE folder_id = ?").run(personal.id, id);
      }
      this.db.prepare("DELETE FROM folders WHERE id = ?").run(id);
      return { success: true, id };
    } catch (error) {
      console.error("Error deleting folder:", error.message);
      throw error;
    }
  }

  renameFolder(id, name) {
    try {
      if (!this.db) throw new Error("Database not initialized");
      const folder = this.db.prepare("SELECT * FROM folders WHERE id = ?").get(id);
      if (!folder) return { success: false, error: "Folder not found" };
      if (folder.is_default) return { success: false, error: "Cannot rename default folders" };
      const trimmed = (name || "").trim();
      if (!trimmed) return { success: false, error: "Folder name is required" };
      const existing = this.db
        .prepare("SELECT id FROM folders WHERE name = ? AND id != ?")
        .get(trimmed, id);
      if (existing) return { success: false, error: "A folder with that name already exists" };
      this.db.prepare("UPDATE folders SET name = ? WHERE id = ?").run(trimmed, id);
      const updated = this.db.prepare("SELECT * FROM folders WHERE id = ?").get(id);
      return { success: true, folder: updated };
    } catch (error) {
      console.error("Error renaming folder:", error.message);
      throw error;
    }
  }

  getFolderNoteCounts() {
    try {
      if (!this.db) throw new Error("Database not initialized");
      return this.db
        .prepare("SELECT folder_id, COUNT(*) as count FROM notes GROUP BY folder_id")
        .all();
    } catch (error) {
      console.error("Error getting folder note counts:", error.message);
      throw error;
    }
  }

  deleteNote(id) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("DELETE FROM notes WHERE id = ?");
      const result = stmt.run(id);
      return { success: result.changes > 0, id };
    } catch (error) {
      console.error("Error deleting note:", error.message);
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
