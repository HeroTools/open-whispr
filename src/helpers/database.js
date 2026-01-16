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

      // Projects table for organizing todos
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          color TEXT DEFAULT '#6366f1',
          icon TEXT DEFAULT 'folder',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert default projects if they don't exist
      const defaultProjects = [
        { name: 'Personal', color: '#10b981', icon: 'user' },
        { name: 'Work', color: '#6366f1', icon: 'briefcase' },
        { name: 'Side Project', color: '#f59e0b', icon: 'rocket' },
      ];
      const insertProject = this.db.prepare(`
        INSERT OR IGNORE INTO projects (name, color, icon) VALUES (?, ?, ?)
      `);
      for (const proj of defaultProjects) {
        insertProject.run(proj.name, proj.color, proj.icon);
      }

      // Tags table for categorizing todos
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          color TEXT DEFAULT '#94a3b8',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Todos table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS todos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          completed BOOLEAN DEFAULT 0,
          due_date DATETIME,
          priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
          progress TEXT DEFAULT 'not_started' CHECK(progress IN ('not_started', 'in_progress', 'blocked', 'completed')),
          project_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
        )
      `);

      // Todo-Tag junction table for many-to-many relationship
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS todo_tags (
          todo_id INTEGER NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (todo_id, tag_id),
          FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
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

  // ==================== PROJECT METHODS ====================

  createProject(name, color = '#6366f1', icon = 'folder') {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare(
        "INSERT INTO projects (name, color, icon) VALUES (?, ?, ?)"
      );
      const result = stmt.run(name, color, icon);
      const project = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(result.lastInsertRowid);
      return { success: true, project };
    } catch (error) {
      console.error("Error creating project:", error.message);
      return { success: false, error: error.message };
    }
  }

  getProjects() {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const projects = this.db.prepare("SELECT * FROM projects ORDER BY name ASC").all();
      return { success: true, projects };
    } catch (error) {
      console.error("Error getting projects:", error.message);
      return { success: false, error: error.message, projects: [] };
    }
  }

  updateProject(id, updates) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const fields = [];
      const values = [];
      if (updates.name !== undefined) { fields.push("name = ?"); values.push(updates.name); }
      if (updates.color !== undefined) { fields.push("color = ?"); values.push(updates.color); }
      if (updates.icon !== undefined) { fields.push("icon = ?"); values.push(updates.icon); }
      fields.push("updated_at = CURRENT_TIMESTAMP");
      values.push(id);

      const stmt = this.db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`);
      stmt.run(...values);
      const project = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
      return { success: true, project };
    } catch (error) {
      console.error("Error updating project:", error.message);
      return { success: false, error: error.message };
    }
  }

  deleteProject(id) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("DELETE FROM projects WHERE id = ?");
      const result = stmt.run(id);
      return { success: result.changes > 0, id };
    } catch (error) {
      console.error("Error deleting project:", error.message);
      return { success: false, error: error.message };
    }
  }

  // ==================== TAG METHODS ====================

  createTag(name, color = '#94a3b8') {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("INSERT INTO tags (name, color) VALUES (?, ?)");
      const result = stmt.run(name, color);
      const tag = this.db.prepare("SELECT * FROM tags WHERE id = ?").get(result.lastInsertRowid);
      return { success: true, tag };
    } catch (error) {
      console.error("Error creating tag:", error.message);
      return { success: false, error: error.message };
    }
  }

  getTags() {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const tags = this.db.prepare("SELECT * FROM tags ORDER BY name ASC").all();
      return { success: true, tags };
    } catch (error) {
      console.error("Error getting tags:", error.message);
      return { success: false, error: error.message, tags: [] };
    }
  }

  updateTag(id, updates) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const fields = [];
      const values = [];
      if (updates.name !== undefined) { fields.push("name = ?"); values.push(updates.name); }
      if (updates.color !== undefined) { fields.push("color = ?"); values.push(updates.color); }
      values.push(id);

      const stmt = this.db.prepare(`UPDATE tags SET ${fields.join(", ")} WHERE id = ?`);
      stmt.run(...values);
      const tag = this.db.prepare("SELECT * FROM tags WHERE id = ?").get(id);
      return { success: true, tag };
    } catch (error) {
      console.error("Error updating tag:", error.message);
      return { success: false, error: error.message };
    }
  }

  deleteTag(id) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stmt = this.db.prepare("DELETE FROM tags WHERE id = ?");
      const result = stmt.run(id);
      return { success: result.changes > 0, id };
    } catch (error) {
      console.error("Error deleting tag:", error.message);
      return { success: false, error: error.message };
    }
  }

  // ==================== TODO METHODS ====================

  createTodo(todoData) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const { title, description, due_date, priority, progress, project_id, tag_ids } = todoData;

      const stmt = this.db.prepare(`
        INSERT INTO todos (title, description, due_date, priority, progress, project_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        title,
        description || null,
        due_date || null,
        priority || 'medium',
        progress || 'not_started',
        project_id || null
      );

      // Add tags if provided
      if (tag_ids && tag_ids.length > 0) {
        const tagStmt = this.db.prepare("INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)");
        for (const tagId of tag_ids) {
          tagStmt.run(result.lastInsertRowid, tagId);
        }
      }

      const todo = this.getTodoById(result.lastInsertRowid);
      return { success: true, todo };
    } catch (error) {
      console.error("Error creating todo:", error.message);
      return { success: false, error: error.message };
    }
  }

  getTodoById(id) {
    const todo = this.db.prepare(`
      SELECT t.*, p.name as project_name, p.color as project_color, p.icon as project_icon
      FROM todos t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
    `).get(id);

    if (todo) {
      const tags = this.db.prepare(`
        SELECT tg.* FROM tags tg
        INNER JOIN todo_tags tt ON tg.id = tt.tag_id
        WHERE tt.todo_id = ?
      `).all(id);
      todo.tags = tags;
    }
    return todo;
  }

  getTodos(options = {}) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }

      const {
        limit = 100,
        project_id,
        completed,
        priority,
        progress,
        sort_by = 'created_at',
        sort_order = 'DESC'
      } = options;

      let query = `
        SELECT t.*, p.name as project_name, p.color as project_color, p.icon as project_icon
        FROM todos t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE 1=1
      `;
      const params = [];

      if (project_id !== undefined) {
        query += " AND t.project_id = ?";
        params.push(project_id);
      }
      if (completed !== undefined) {
        query += " AND t.completed = ?";
        params.push(completed ? 1 : 0);
      }
      if (priority !== undefined) {
        query += " AND t.priority = ?";
        params.push(priority);
      }
      if (progress !== undefined) {
        query += " AND t.progress = ?";
        params.push(progress);
      }

      const validSortFields = ['created_at', 'updated_at', 'due_date', 'priority', 'title'];
      const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
      const order = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      query += ` ORDER BY t.${sortField} ${order} LIMIT ?`;
      params.push(limit);

      const todos = this.db.prepare(query).all(...params);

      // Fetch tags for each todo
      const tagStmt = this.db.prepare(`
        SELECT tg.* FROM tags tg
        INNER JOIN todo_tags tt ON tg.id = tt.tag_id
        WHERE tt.todo_id = ?
      `);
      for (const todo of todos) {
        todo.tags = tagStmt.all(todo.id);
      }

      return { success: true, todos };
    } catch (error) {
      console.error("Error getting todos:", error.message);
      return { success: false, error: error.message, todos: [] };
    }
  }

  updateTodo(id, updates) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }

      const fields = [];
      const values = [];

      if (updates.title !== undefined) { fields.push("title = ?"); values.push(updates.title); }
      if (updates.description !== undefined) { fields.push("description = ?"); values.push(updates.description); }
      if (updates.due_date !== undefined) { fields.push("due_date = ?"); values.push(updates.due_date); }
      if (updates.priority !== undefined) { fields.push("priority = ?"); values.push(updates.priority); }
      if (updates.progress !== undefined) { fields.push("progress = ?"); values.push(updates.progress); }
      if (updates.project_id !== undefined) { fields.push("project_id = ?"); values.push(updates.project_id); }
      if (updates.completed !== undefined) {
        fields.push("completed = ?");
        values.push(updates.completed ? 1 : 0);
        if (updates.completed) {
          fields.push("completed_at = CURRENT_TIMESTAMP");
          fields.push("progress = ?");
          values.push('completed');
        } else {
          fields.push("completed_at = NULL");
        }
      }

      fields.push("updated_at = CURRENT_TIMESTAMP");
      values.push(id);

      if (fields.length > 1) {
        const stmt = this.db.prepare(`UPDATE todos SET ${fields.join(", ")} WHERE id = ?`);
        stmt.run(...values);
      }

      // Update tags if provided
      if (updates.tag_ids !== undefined) {
        this.db.prepare("DELETE FROM todo_tags WHERE todo_id = ?").run(id);
        if (updates.tag_ids.length > 0) {
          const tagStmt = this.db.prepare("INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)");
          for (const tagId of updates.tag_ids) {
            tagStmt.run(id, tagId);
          }
        }
      }

      const todo = this.getTodoById(id);
      return { success: true, todo };
    } catch (error) {
      console.error("Error updating todo:", error.message);
      return { success: false, error: error.message };
    }
  }

  deleteTodo(id) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      // Tags will be automatically deleted due to CASCADE
      const stmt = this.db.prepare("DELETE FROM todos WHERE id = ?");
      const result = stmt.run(id);
      return { success: result.changes > 0, id };
    } catch (error) {
      console.error("Error deleting todo:", error.message);
      return { success: false, error: error.message };
    }
  }

  toggleTodoComplete(id) {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const todo = this.db.prepare("SELECT completed FROM todos WHERE id = ?").get(id);
      if (!todo) {
        return { success: false, error: "Todo not found" };
      }
      const newCompleted = !todo.completed;
      return this.updateTodo(id, { completed: newCompleted });
    } catch (error) {
      console.error("Error toggling todo:", error.message);
      return { success: false, error: error.message };
    }
  }

  getTodoStats() {
    try {
      if (!this.db) {
        throw new Error("Database not initialized");
      }
      const stats = this.db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN priority = 'urgent' AND completed = 0 THEN 1 ELSE 0 END) as urgent,
          SUM(CASE WHEN due_date < datetime('now') AND completed = 0 THEN 1 ELSE 0 END) as overdue
        FROM todos
      `).get();
      return { success: true, stats };
    } catch (error) {
      console.error("Error getting todo stats:", error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = DatabaseManager;
