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

      // Notes table for the notes feature
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT,
          content TEXT NOT NULL,
          is_pinned INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tags table for categorizing notes
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          color TEXT DEFAULT '#6366f1',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Junction table for note-tag relationships (many-to-many)
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS note_tags (
          note_id INTEGER NOT NULL,
          tag_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (note_id, tag_id),
          FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )
      `);

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

  // ============= Notes Methods =============

  createNote(title, content) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare(
        "INSERT INTO notes (title, content) VALUES (?, ?)"
      );
      const result = stmt.run(title || null, content);

      const fetchStmt = this.db.prepare("SELECT * FROM notes WHERE id = ?");
      const note = fetchStmt.get(result.lastInsertRowid);

      return { id: result.lastInsertRowid, success: true, note };
    } catch (error) {
      console.error("Error creating note:", error.message);
      throw error;
    }
  }

  updateNote(id, title, content) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare(
        "UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      );
      const result = stmt.run(title || null, content, id);

      if (result.changes === 0) {
        return { success: false, error: "Note not found" };
      }

      const fetchStmt = this.db.prepare("SELECT * FROM notes WHERE id = ?");
      const note = fetchStmt.get(id);

      return { success: true, note };
    } catch (error) {
      console.error("Error updating note:", error.message);
      throw error;
    }
  }

  getNotes(limit = 100) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare(
        "SELECT * FROM notes ORDER BY is_pinned DESC, updated_at DESC LIMIT ?"
      );
      const notes = stmt.all(limit);
      return notes;
    } catch (error) {
      console.error("Error getting notes:", error.message);
      throw error;
    }
  }

  getNote(id) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("SELECT * FROM notes WHERE id = ?");
      const note = stmt.get(id);
      return note || null;
    } catch (error) {
      console.error("Error getting note:", error.message);
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
      console.log(`🗑️ Deleted note ${id}, affected rows: ${result.changes}`);
      return { success: result.changes > 0, id };
    } catch (error) {
      console.error("❌ Error deleting note:", error);
      throw error;
    }
  }

  toggleNotePin(id) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare(
        "UPDATE notes SET is_pinned = NOT is_pinned, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      );
      const result = stmt.run(id);

      if (result.changes === 0) {
        return { success: false, error: "Note not found" };
      }

      const fetchStmt = this.db.prepare("SELECT * FROM notes WHERE id = ?");
      const note = fetchStmt.get(id);

      return { success: true, note };
    } catch (error) {
      console.error("Error toggling note pin:", error.message);
      throw error;
    }
  }

  searchNotes(query, limit = 50) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const searchPattern = `%${query}%`;
      const stmt = this.db.prepare(
        `SELECT * FROM notes
         WHERE title LIKE ? OR content LIKE ?
         ORDER BY is_pinned DESC, updated_at DESC
         LIMIT ?`
      );
      const notes = stmt.all(searchPattern, searchPattern, limit);
      return notes;
    } catch (error) {
      console.error("Error searching notes:", error.message);
      throw error;
    }
  }

  // ============= Tags Methods =============

  createTag(name, color = "#6366f1") {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("INSERT INTO tags (name, color) VALUES (?, ?)");
      const result = stmt.run(name, color);

      const fetchStmt = this.db.prepare("SELECT * FROM tags WHERE id = ?");
      const tag = fetchStmt.get(result.lastInsertRowid);

      return { id: result.lastInsertRowid, success: true, tag };
    } catch (error) {
      if (error.message.includes("UNIQUE constraint failed")) {
        return { success: false, error: "Tag already exists" };
      }
      console.error("Error creating tag:", error.message);
      throw error;
    }
  }

  getTags() {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("SELECT * FROM tags ORDER BY name ASC");
      return stmt.all();
    } catch (error) {
      console.error("Error getting tags:", error.message);
      throw error;
    }
  }

  addTagToNote(noteId, tagId) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare(
        "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)"
      );
      stmt.run(noteId, tagId);
      return { success: true };
    } catch (error) {
      console.error("Error adding tag to note:", error.message);
      throw error;
    }
  }

  removeTagFromNote(noteId, tagId) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare(
        "DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?"
      );
      stmt.run(noteId, tagId);
      return { success: true };
    } catch (error) {
      console.error("Error removing tag from note:", error.message);
      throw error;
    }
  }

  getNoteTags(noteId) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare(`
        SELECT t.* FROM tags t
        INNER JOIN note_tags nt ON t.id = nt.tag_id
        WHERE nt.note_id = ?
        ORDER BY t.name ASC
      `);
      return stmt.all(noteId);
    } catch (error) {
      console.error("Error getting note tags:", error.message);
      throw error;
    }
  }

  getNotesByTag(tagId, limit = 100) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare(`
        SELECT n.* FROM notes n
        INNER JOIN note_tags nt ON n.id = nt.note_id
        WHERE nt.tag_id = ?
        ORDER BY n.is_pinned DESC, n.updated_at DESC
        LIMIT ?
      `);
      return stmt.all(tagId, limit);
    } catch (error) {
      console.error("Error getting notes by tag:", error.message);
      throw error;
    }
  }
}

module.exports = DatabaseManager;
