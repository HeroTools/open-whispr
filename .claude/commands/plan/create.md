# /plan:create - Create Implementation Plans from Design Documents

**Purpose**: Analyze design documents to generate step-by-step implementation plans with progress tracking for OpenWhispr development.

**Usage**:
- `/plan:create [ows-XX]` - Create plan for specific task
- `/plan:create` - Interactive mode

---

## Project Context

| Setting | Value |
|---------|-------|
| Issue Prefix | OWS (e.g., OWS-123) |
| Branch Format | `feature/ows-<number>-<description>` |
| Platform | Electron desktop app (macOS, Windows, Linux) |
| Stack | React 19, TypeScript, Electron 36, whisper.cpp |

---

## Command Execution Instructions

When this command is invoked, follow these steps:

### Step 1: Extract Task Number

1. **If user provided task number** (e.g., `/plan:create ows-36`):
   - Extract the OWS-XX identifier
   - Normalize to uppercase for display (e.g., "ows-36" -> "OWS-36")
   - Keep lowercase for file names (e.g., "ows-36")
   - Proceed to Step 2

2. **If no task number provided** (e.g., `/plan:create`):
   - Ask user: "Which task do you want to create a plan for? (e.g., OWS-36)"
   - Wait for response
   - Extract and normalize the task number
   - Proceed to Step 2

### Step 2: Check for Design Document

1. Search for design document: `docs/design-docs/ows-XX-*.md`
2. Use glob pattern: `docs/design-docs/ows-XX-*.md`

**If design document found**:
- Extract full filename (e.g., `ows-36-dark-mode-toggle.md`)
- Read design document for detailed context
- Proceed to **Step 3A: Design Doc Mode**

**If design document NOT found**:
- Display message:

```
DESIGN DOCUMENT CHECK: Not found

No design document exists for OWS-XX.

You can:
1. [create-design] - Create design document first (/design-doc:create ows-XX)
2. [proceed] - Proceed directly to planning (recommended for simpler tasks)
3. [cancel] - Exit command

Your choice:
```

- If **create-design**: Exit and suggest `/design-doc:create ows-XX`
- If **proceed**: Continue to **Step 3B: Direct Mode**
- If **cancel**: Exit command

### Step 3A: Design Doc Mode (Parse Existing Design)

**Read the design document** and extract:

1. **Summary/Overview**: High-level objective
2. **Architecture/Components**: Key files and their relationships
3. **Implementation Steps/Tasks**: Step-by-step tasks
4. **Acceptance Criteria**: Success metrics and validation steps
5. **Dependencies**: Prerequisites and related modules

**Cross-reference with Architecture Document**:

Read `CLAUDE.md` to understand:
- Overall architecture (Electron main/renderer)
- Component structure
- Existing patterns and conventions

**Parse into actionable tasks**:

- Focus on concrete implementation steps
- Group by logical component or phase
- Include validation tasks for each component
- Reference specific files: `src/components/`, `src/hooks/`, etc.

**Proceed to Step 4** (Generate Plan File)

### Step 3B: Direct Mode (No Design Doc)

**Use task information** to create a plan:

**Ask user for details**:
- What is this task about?
- What components are affected?
- What is the expected outcome?

**Read Architecture Document**:

Read `CLAUDE.md` to understand:
- Where this component fits in the architecture
- Related modules and dependencies
- Configuration patterns

**Generate basic plan structure**:

```markdown
## Tasks

### Phase 1: Prerequisites & Setup
- [ ] [Extracted from dependencies]

### Phase 2: Core Implementation
- [ ] [Derived from task description and architecture]

### Phase 3: Testing & Validation
- [ ] Verify build passes
- [ ] Manual testing
- [ ] Cross-platform testing (if applicable)

### Phase 4: Finalization
- [ ] Create PR
```

**Proceed to Step 4**

### Step 4: Generate Plan File

**Determine filename**:
- If design doc exists: Use same base name (e.g., `ows-36-dark-mode-toggle.md`)
- If direct mode: Generate from task description (e.g., `ows-36-feature-name.md`)

**Create plan file**: `docs/plans/ows-XX-[description].md`

**Required format**:

```markdown
# OWS-XX Implementation Plan: [Title]

**Design Document**: docs/design-docs/ows-XX-[description].md (or "Direct mode - no design doc")
**Architecture Reference**: CLAUDE.md
**Created**: [Current Date]
**Overall Progress**: 0% (0/[total] tasks completed)

---

## Architecture Context

[Brief summary of how this task fits into the OpenWhispr architecture from CLAUDE.md]

---

## Tasks

### Phase 1: [Phase Name]

- [ ] Task 1: [Clear, actionable description]
  - [ ] Subtask 1.1: [Specific action with file path]
  - [ ] Subtask 1.2: [Specific action]

- [ ] Task 2: [Clear, actionable description]
  - [ ] Subtask 2.1: [Specific action]

### Phase 2: [Phase Name]

- [ ] Task 3: [Clear, actionable description]
  - [ ] Subtask 3.1: [Specific action]
  - [ ] Subtask 3.2: [Specific action]
  - [ ] Subtask 3.3: [Specific action]

[... additional phases based on design doc or task scope ...]

### Phase N: Testing & Validation

- [ ] Run build: `npm run build`
- [ ] Run linter: `npm run lint`
- [ ] Manual testing on primary platform
- [ ] Cross-platform testing (if applicable)

### Phase N+1: Finalization

- [ ] Create PR with conventional commit message
  - [ ] Verify all commits follow format: type(OWS-XX): description
  - [ ] Push branch: `git push origin feature/ows-XX-description`
  - [ ] Create PR: `gh pr create --title "feat(OWS-XX): [description]" --body "[PR body]"`
  - [ ] Request review

---

## Files to Create/Modify

[List of files that will be created or modified]

- `src/components/[name]` - [Description]
- `src/hooks/[name]` - [Description]
- `src/helpers/[name]` - [Description]

---

## Platform Considerations

[If applicable, note any platform-specific implementation details]

| Platform | Notes |
|----------|-------|
| macOS | [Notes] |
| Windows | [Notes] |
| Linux | [Notes] |

---

## Status Indicators

- `[ ]` = To do
- `[~]` = In progress
- `[x]` = Done
- `[!]` = Blocked (needs manual intervention)

**To update progress**: Edit this file and change checkboxes. The overall percentage will be recalculated based on completed tasks.

---

## Notes

- Keep tasks modular and minimal
- Each task should be independently testable
- Follow existing patterns in codebase
- Reference CLAUDE.md for architecture decisions
- Mark tasks `[~]` when starting, `[x]` when complete
```

**Formatting Rules** (CRITICAL):

- **NO EMOJIS**: Use `[ ]`, `[~]`, `[x]` only
- Use clear, concise language
- Each task = 1-2 sentences max
- Include file paths where applicable
- Group related subtasks under parent tasks
- Calculate total tasks by counting all `[ ]` checkboxes
- **ALWAYS include Testing & Validation phase**
- **ALWAYS include Finalization phase** with PR creation task

### Step 5: Git Branch Management

**Check current branch**:

```bash
git rev-parse --abbrev-ref HEAD
```

**If on main**: Create feature branch

```bash
git checkout -b feature/ows-XX-[short-description]
```

**Branch naming format**: `feature/ows-<number>-<slugified-title>`

### Step 6: Confirm to User

**Output to user**:

```
SUCCESS: Implementation plan created!

File: docs/plans/ows-XX-[description].md
Branch: feature/ows-XX-[description]
Mode: [Design doc / Direct]

Tasks: [X] total

Next steps:
1. Review the plan file: docs/plans/ows-XX-[description].md
2. Start implementation: /plan:implement ows-XX
3. Update checkboxes as work progresses
```

---

## Special Cases

### Case 1: docs/plans/ folder doesn't exist

- Create folder automatically: `mkdir -p docs/plans`

### Case 2: Plan file already exists

```
Plan file already exists: docs/plans/ows-XX-[description].md

Options:
1. [overwrite] - Regenerate and overwrite
2. [open] - View existing plan (exit command)
3. [cancel] - Exit without changes

Your choice:
```

### Case 3: Task has minimal description

```
WARNING: Task has minimal description

The plan will be based on limited information. Consider:
1. [continue] - Create basic plan (can be refined later)
2. [cancel] - Exit and add more detail first

Your choice:
```

If continue: Generate basic template with task title, mark for refinement.

---

## Commit Message Types

| Task Type | Commit Type | Example |
|-----------|-------------|---------|
| New feature | `feat(OWS-XX):` | `feat(OWS-10): add dark mode toggle` |
| Bug fix | `fix(OWS-XX):` | `fix(OWS-15): fix clipboard paste on macOS` |
| Configuration | `chore(OWS-XX):` | `chore(OWS-20): update settings schema` |
| Documentation | `docs(OWS-XX):` | `docs(OWS-10): add usage examples` |
| Refactor | `refactor(OWS-XX):` | `refactor(OWS-25): extract audio hook` |

---

## Example Execution

### Example 1: With Design Document

**User input**: `/plan:create ows-10`

**Command execution**:

1. Extract task: OWS-10
2. Find design doc: `docs/design-docs/ows-10-dark-mode-toggle.md` (exists)
3. Read architecture doc for context
4. Parse design doc:
   - Title: "Dark Mode Toggle"
   - Phases: 4 phases (Setup, Implementation, Testing, Finalization)
   - Tasks: ~15 tasks extracted
5. Generate plan: `docs/plans/ows-10-dark-mode-toggle.md`
6. Create branch: `feature/ows-10-dark-mode-toggle`
7. Confirm to user: "SUCCESS: Implementation plan created!"

### Example 2: Direct Mode (No Design Doc)

**User input**: `/plan:create ows-25`

**Command execution**:

1. Extract task: OWS-25
2. Search design doc: Not found
3. Ask user: "Design doc not found. Proceed directly?"
4. User selects: "proceed"
5. Read architecture doc for context
6. Ask user for task details
7. Generate plan based on user input + architecture
8. Create: `docs/plans/ows-25-feature-name.md`
9. Confirm: "SUCCESS: Plan created in direct mode!"

---

## Implementation Notes

- Use `Read` tool to read design docs and CLAUDE.md
- Use `Write` tool to create plan file
- Use `Bash` with `mkdir -p` to create docs/plans/ if needed
- Calculate percentage: (completed tasks / total tasks) * 100
- **Total task count** must include validation and PR creation tasks
