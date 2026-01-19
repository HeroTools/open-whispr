# /project:sync - Synchronize Project Aggregation Files

**Purpose**: Update PROJECT.md, ROADMAP.md, and other aggregation files based on task state changes. Maintains consistency across project documentation.

**Usage**:
- `/project:sync OWS-XX --start` - Task is starting (add to active work)
- `/project:sync OWS-XX --complete` - Task is done (move to completed)
- `/project:sync OWS-XX --complete "Summary text"` - Complete with custom summary
- `/project:sync OWS-XX --block OWS-YY` - Task is blocked by another task
- `/project:sync OWS-XX --unblock` - Task is no longer blocked

---

## File Locations

| File | Path | Purpose |
|------|------|---------|
| PROJECT.md | `docs/PROJECT.md` | Dashboard - current state of all work |
| ROADMAP.md | `docs/ROADMAP.md` | Big picture - phases and milestones |

---

## Command Execution Instructions

### Step 1: Parse Arguments

1. **Extract task ID** from arguments (e.g., `OWS-9` or `ows-9`)
2. **Identify action flag**:
   - `--start`: Task is beginning work
   - `--complete`: Task is finished
   - `--block OWS-YY`: Task is blocked by OWS-YY
   - `--unblock`: Remove task from blocked state
3. **Extract optional summary** for `--complete` action

### Step 2: Check for Aggregation Files

```bash
ls docs/PROJECT.md docs/ROADMAP.md 2>/dev/null
```

**If files don't exist**: Create them from templates or skip with warning.

---

## Action: --start

### Validations

1. **Check WIP Limit** in PROJECT.md (if exists):
   - Read "## Active Work" section
   - Count non-placeholder rows
   - If count >= 3 (configurable):
     ```
     WARNING: WIP LIMIT REACHED

     Active Work currently has 3 tasks:
     - OWS-XX: [title]
     - OWS-YY: [title]
     - OWS-ZZ: [title]

     Options:
     1. Complete or pause one of these tasks first
     2. Override WIP limit (not recommended)

     Which task should be paused to make room?
     ```
   - Wait for user input before proceeding

### Updates

#### 1. Update PROJECT.md

**Add to "## Active Work" table** (if file exists):

```markdown
| OWS-XX | [Title] | In Progress | - |
```

**Remove from "## Up Next" if present**.

#### 2. Update ROADMAP.md

**Find the task row** and update status:

Change:
```markdown
| OWS-XX | Title | Backlog | ... |
```

To:
```markdown
| OWS-XX | Title | In Progress | ... |
```

### Output

```
PROJECT SYNC: OWS-XX Started

Updates made:
- PROJECT.md: Added to Active Work
- ROADMAP.md: Status -> In Progress

Current Active Work (2/3):
- OWS-XX: [Title] (just started)
- OWS-YY: [Title]
```

---

## Action: --complete

### Updates

#### 1. Update PROJECT.md

**Remove from "## Active Work"**:

Find and remove the row containing the task ID.

**Add to "## Recently Completed"**:

Add a new row at the TOP of the table (most recent first):

```markdown
| OWS-XX | [Title] | YYYY-MM-DD | [Summary or "Completed"] |
```

Use today's date in YYYY-MM-DD format.

#### 2. Update ROADMAP.md

**Find the task row** and update status to Done:

Change:
```markdown
| OWS-XX | Title | In Progress | ... |
```

To:
```markdown
| OWS-XX | Title | Done | ... |
```

**Update Summary table** (if exists):

Find the phase row and increment the "Completed" count.

### Output

```
PROJECT SYNC: OWS-XX Completed

Updates made:
- PROJECT.md: Moved to Recently Completed
- ROADMAP.md: Status -> Done

Current Active Work (1/3):
- OWS-AA: [Title]
```

---

## Action: --block OWS-YY

### Validations

1. **Verify blocker task exists**
2. **Check if already blocked** to avoid duplicates

### Updates

#### 1. Update PROJECT.md

**Update "Blocked By" column** in Active Work:

```markdown
| OWS-XX | Title | Blocked | OWS-YY |
```

#### 2. Mark task as blocked

### Output

```
PROJECT SYNC: OWS-XX Blocked

OWS-XX is now blocked by OWS-YY.

Updates made:
- PROJECT.md: Marked as blocked
```

---

## Action: --unblock

### Updates

#### 1. Update PROJECT.md

**Clear "Blocked By" column**:

```markdown
| OWS-XX | Title | In Progress | - |
```

### Output

```
PROJECT SYNC: OWS-XX Unblocked

OWS-XX is now unblocked and ready to continue.

Updates made:
- PROJECT.md: Cleared blocked status
```

---

## Table Formats Reference

### PROJECT.md - Active Work
```markdown
| Task | Title | Status | Blocked By |
|------|-------|--------|------------|
| OWS-XX | Title Here | In Progress | - |
```

### PROJECT.md - Recently Completed
```markdown
| Task | Title | Completed | Summary |
|------|-------|-----------|---------|
| OWS-XX | Title Here | YYYY-MM-DD | Brief summary |
```

### PROJECT.md - Up Next
```markdown
| Priority | Task | Title | Dependencies |
|----------|------|-------|--------------|
| 1 | OWS-XX | Title Here | OWS-YY |
```

### ROADMAP.md - Tasks
```markdown
| Task | Title | Status | Dependencies |
|------|-------|--------|--------------|
| OWS-XX | Title Here | Done/In Progress/Backlog | OWS-YY |
```

---

## Error Handling

### Task Not Found
```
WARNING: Task OWS-XX not found in aggregation files

The task may not have been added to project tracking yet.

Options:
1. [add] - Add task to files now
2. [skip] - Continue without adding
```

### File Update Failed
```
ERROR: Error updating [filename]

The file may have been modified. Please check:
- docs/PROJECT.md
- docs/ROADMAP.md

And retry the sync operation.
```

---

## Update Timestamps

After any successful update, update the "Last Updated" line at the top of each modified file:

```markdown
**Last Updated**: YYYY-MM-DD
```

---

## Philosophy

This command is designed to:

1. **Maintain consistency**: All files stay in sync
2. **Enforce constraints**: WIP limits when configured
3. **Be idempotent**: Safe to run multiple times
4. **Provide visibility**: Clear output showing what changed

This command does NOT:

1. **Make workflow decisions**: Only updates based on explicit actions
2. **Skip validations**: Always checks constraints before updating
3. **Create mandatory files**: Works gracefully when files don't exist
