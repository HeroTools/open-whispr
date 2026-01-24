# /plan:implement - Implement Plans Step-by-Step with Progress Tracking

**Purpose**: Execute implementation plans from `docs/plans/` by running tasks phase-by-phase, updating progress dynamically, and creating commits. Optimized for Electron/React desktop app development.

**Usage**:
- `/plan:implement [ows-XX]` - Implement specific task plan
- `/plan:implement` - Interactive mode

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

1. **If user provided task number** (e.g., `/plan:implement ows-36`):
   - Extract the OWS-XX identifier
   - Normalize to uppercase for display (e.g., "ows-36" -> "OWS-36")
   - Keep lowercase for file matching (e.g., "ows-36")
   - Proceed to Step 2

2. **If no task number provided** (e.g., `/plan:implement`):
   - Ask user: "Which task plan do you want to implement? (e.g., OWS-36)"
   - Wait for response
   - Extract and normalize the task number
   - Proceed to Step 2

### Step 2: Locate Required Files

**Plan File (REQUIRED)**:

1. Search for plan file: `docs/plans/ows-XX-*.md`
2. **If NOT found**:
   - Display error: "Plan file not found matching: docs/plans/ows-XX-*.md"
   - Suggest: "Run `/plan:create ows-XX` first to generate the implementation plan"
   - Exit command
3. **If found**: Extract full filename, continue

**Design Document (OPTIONAL)**:

1. Search for design doc: `docs/design-docs/ows-XX-*.md`
2. **If found**: Will use for context during implementation
3. **If NOT found**: Continue with warning
   - Display: "Design document not found. Will implement based on plan file only."

**Architecture Reference (ALWAYS READ)**:

1. Read `CLAUDE.md`
2. Use for architecture context, patterns, and validation

**Status File (AUTO-CREATE & AUTO-UPDATE)**:

1. Check if status file exists: `docs/status/ows-XX-*.md`
2. **If found**: Read to understand current progress and decisions
3. **If NOT found**: **Create immediately before starting execution**

**Proceed to Step 2.5: Initialize Status File**

### Step 2.5: Initialize Status File

**CRITICAL: Create status file before any implementation work begins.**

**Create directory if needed**:
```bash
mkdir -p docs/status
```

**If status file doesn't exist**, create `docs/status/ows-XX-[description].md`:

```markdown
# OWS-XX: [Task Title]

**Plan File**: docs/plans/ows-XX-[description].md
**Design Document**: docs/design-docs/ows-XX-[description].md (or "N/A")
**Started**: [Current Date/Time]
**Last Updated**: [Current Date/Time]

---

## Current Status: In Progress

**Overall Progress**: 0% (0/[total] tasks)
**Current Phase**: Phase 1 - [Name]

---

## Session Log

### Session 1 - [Date]

**Started**: [Time]
**Branch**: feature/ows-XX-[description]

#### Tasks Completed This Session

[Will be populated as tasks complete]

---

## Completed Phases

[Will be populated as phases complete]

---

## Technical Decisions

[Key decisions made during implementation]

---

## Important Findings

[Insights discovered during implementation]

---

## Questions & Blockers

[Open questions or blocking issues]

---

## Next Steps

[What needs to happen next]
```

**If status file already exists**:
- Read current state
- Add new session entry

**Proceed to Step 3**

### Step 3: Parse Plan File and Build Execution Queue

**Read plan file** and extract:

1. **Current progress line**: `Overall Progress: X% (Y/Z tasks completed)`
2. **All tasks with status markers**:
   - `[ ]` = To do (queue for execution)
   - `[~]` = In progress (resume from here)
   - `[x]` = Done (skip)
   - `[!]` = Blocked (skip, needs manual intervention)

**Calculate statistics**:

```
Total tasks: Count all checkboxes ([ ], [~], [x], [!])
Completed tasks: Count [x] only
Pending tasks: Count [ ] and [~]
Blocked tasks: Count [!]
Progress percentage: (completed / total) * 100
```

**Build execution queue** (phase-by-phase):

```
Phase 1: [Phase Name]
  - [x] Task 1.1 [SKIP - already done]
  - [ ] Task 1.2 [QUEUE - add to execution list]
  - [ ] Task 1.3 [QUEUE - add to execution list]

Phase 2: [Phase Name]
  - [ ] Task 2.1 [QUEUE - add to execution list]
```

**Display execution summary to user**:

```
PLAN ANALYSIS: OWS-XX

Total tasks: 20
Completed: 8 (40%)
Pending: 11
Blocked: 1

Next execution queue: 11 tasks across 3 phases

Phases to execute:
- Phase 2: UI Components (1 in progress, 2 pending)
- Phase 3: Testing & Validation (4 pending)
- Phase 4: Finalization (4 pending)

Blocked tasks (will skip):
- Phase 2: External API integration (marked [!])

Ready to start implementation? (yes/no)
```

### Step 3.5: Git Branch Management

**Purpose**: Ensure work happens on a feature branch.

**Branch naming convention**:
- Features: `feature/ows-XX-short-description`
- Bug fixes: `fix/ows-XX-short-description`

#### Check Current Branch

```bash
git rev-parse --abbrev-ref HEAD
```

#### Branch Decision Logic

**Case A: On main branch**

```
BRANCH CHECK: Currently on main

Implementation will create commits for OWS-XX.
These commits should be on a feature branch, not main.

Suggested branch name: feature/ows-XX-[short-description]

Options:
1. [create] - Create feature branch and switch to it (recommended)
2. [stay] - Stay on main (NOT recommended)
3. [cancel] - Exit command

Your choice:
```

**Case B: On feature branch matching task**

```
BRANCH CHECK: Currently on feature/ows-10-dark-mode

This matches task OWS-10. Continuing implementation on this branch.
```

Continue to Step 4.

### Step 4: Phase-by-Phase Execution Loop

**For each phase** in the execution queue:

#### Phase Start

1. **Display phase overview**:

   ```
   ========================================
   PHASE: Phase 2 - UI Components
   ========================================

   Tasks in this phase:
   1. [~] Create theme context (IN PROGRESS - resuming)
   2. [ ] Add toggle component
   3. [ ] Update settings page

   Completed tasks (will skip):
   - [x] Define theme types

   Architecture section: src/components/
   ```

2. **Request phase approval**:
   - Ask user: "Ready to execute Phase 2? (yes/no/skip)"
   - **yes**: Proceed with task execution
   - **no**: Stop command completely
   - **skip**: Skip phase, proceed to next

#### Task Execution Loop

**For each task** in the approved phase:

##### Task 1: Mark Task as In Progress

1. Update plan file: Change `[ ]` to `[~]`
2. Update progress percentage
3. Save plan file
4. Display: "Starting: [Task name]"

##### Task 2: Read Context

**If design doc exists**:
1. Search for relevant section
2. Extract technical details, component patterns, acceptance criteria

**Always read**:
- `CLAUDE.md` for architecture patterns
- Existing code in relevant files for conventions

##### Task 3: Execute Implementation

**Based on task type**, use appropriate approach:

**React Component Tasks**:

```tsx
// Follow existing patterns in codebase
// Use shadcn/ui components
// Follow TypeScript conventions
```

- Use `Read` to understand existing component patterns
- Use `Edit` or `Write` to implement
- Follow project conventions (see CLAUDE.md)

**Electron Main Process Tasks**:

- Create or update files in `src/helpers/`
- Add IPC handlers to `ipcHandlers.js`
- Update preload.js if needed

**Hook Tasks**:

- Follow existing hook patterns in `src/hooks/`
- Use TypeScript for type safety

**Validation Tasks**:

```bash
# Build the project
npm run build

# Run linter
npm run lint
```

##### Task 4: Handle Errors

**If any step fails**:

1. **Mark task as blocked**: Update plan file `[~]` -> `[!]`
2. **Document error**:

   ```markdown
   - [!] Create theme context
     - BLOCKED: TypeScript error
     - Error: "Type 'Theme' is not assignable..."
     - Needs: Fix type definition
   ```

3. **Ask user**:

   ```
   ERROR: Task failed during execution

   Task: Create theme context
   Error: TypeScript compilation error

   How would you like to proceed?
   1. [retry] - Try again (after fixing)
   2. [skip] - Mark as blocked and continue
   3. [stop] - Stop execution completely

   Your choice:
   ```

##### Task 5: Validate Completion

**Run validation commands**:

```bash
# Check for TypeScript errors
npm run build

# Check for lint errors
npm run lint
```

**If validation fails**: Ask user to fix or continue

##### Task 6: Mark Task as Complete

1. Update plan file: `[~]` -> `[x]`
2. Recalculate progress
3. Save plan file

##### Task 7: Create Git Commit

**Commit format** (conventional commits):

| Task Type | Commit Type |
|-----------|-------------|
| New feature | `feat(OWS-XX):` |
| Bug fix | `fix(OWS-XX):` |
| Configuration | `chore(OWS-XX):` |
| Documentation | `docs(OWS-XX):` |
| Refactor | `refactor(OWS-XX):` |

**Commit message template**:

```
feat(OWS-XX): implement [concise description]

- [Specific change 1]
- [Specific change 2]

Related: docs/plans/ows-XX-[description].md
```

**Execute commit**:

```bash
git add <modified files>
git commit -m "$(cat <<'EOF'
feat(OWS-XX): implement [task]

- [Details...]

Related: docs/plans/ows-XX-[description].md
EOF
)"
```

##### Task 8: Update Status File (MANDATORY)

**ALWAYS update the status file after each task completion.**

**Add completed task entry to current session**:

```markdown
#### Tasks Completed This Session

- [x] [Task name from plan]
  - **Time**: [HH:MM]
  - **Files Modified**: [List of files]
  - **Commit**: [SHA or "pending"]
  - **Notes**: [Brief implementation notes]
```

##### Task 9: Display Task Completion

```
COMPLETED: [Task name]

Files changed: [count]
Commit: [SHA]
Validation: PASS

Phase 2 progress: 2/3 tasks complete
Overall progress: 45% (9/20 tasks)
```

**Continue to next task**

#### Phase Completion

**After all tasks in phase complete**:

1. **Update Status File with Phase Summary**

2. **Display phase summary**:

   ```
   ========================================
   PHASE 2 COMPLETE: UI Components
   ========================================

   Completed: 3/3 tasks
   Blocked: 0 tasks
   Commits created: 3

   Overall progress: 55% (11/20 tasks)

   Status file updated: docs/status/ows-XX-[description].md

   Next phase: Phase 3 - Testing & Validation (4 tasks)
   ```

### Step 5: Handle Completion or Interruption

**ALWAYS update status file before ending any session.**

#### Case 1: All Tasks Complete (100%)

**Display to user**:

```
========================================
IMPLEMENTATION COMPLETE: OWS-XX
========================================

Total tasks: 20
Completed: 20 (100%)
Phases completed: 4/4

Files updated:
- Plan: docs/plans/ows-XX-[description].md (100%)
- Status: docs/status/ows-XX-[description].md (Final)

Commits created: 20

Next steps:
1. Run final validation: npm run build && npm run lint
2. Push branch: git push origin feature/ows-XX-description
3. Create PR: gh pr create --title "feat(OWS-XX): [description]"
```

#### Case 2: User Stopped Mid-Execution

**Display to user**:

```
========================================
IMPLEMENTATION PAUSED: OWS-XX
========================================

Reason: User requested stop

Progress: 55% (11/20 tasks)
Last completed: "Add toggle component"
Current phase: Phase 3 (0/4 tasks)

Status file updated: docs/status/ows-XX-[description].md

To resume: Run `/plan:implement ows-XX`
```

#### Case 3: Blocked by Errors

**Display to user**:

```
========================================
IMPLEMENTATION BLOCKED: OWS-XX
========================================

Progress: 55% (11/20 tasks)
Blocked: 2 tasks

Blocked tasks:
1. [!] Configure theme provider
   - Error: Missing dependency
   - Needs: Install @radix-ui/react-slot

2. [!] Add persistence
   - Error: localStorage API issue
   - Needs: Fix electron context

Status file updated: docs/status/ows-XX-[description].md
(See status file for full error details)

Next steps:
1. Resolve blockers (see docs/status/ows-XX-[description].md)
2. Update plan: Change [!] to [ ]
3. Re-run: /plan:implement ows-XX
```

---

## Special Cases

### Case 1: Plan File Doesn't Exist

```
ERROR: Plan file not found

Expected: docs/plans/ows-XX-*.md

Run: /plan:create ows-XX
```

Exit command.

### Case 2: All Tasks Already Complete

```
PLAN STATUS: Fully implemented (100%)

All 20 tasks are marked [x].

Options:
1. Review completed work
2. Re-execute all tasks (reset to 0%)
3. Exit

Your choice:
```

### Case 3: Git Working Directory Not Clean

```
WARNING: Uncommitted changes detected

Uncommitted files:
[list]

Please commit or stash changes first, then re-run.
```

Exit command.

---

## Command Philosophy

**This command is designed to**:

1. **Automate implementation**: Follow patterns from architecture doc
2. **Maintain quality**: Validate after each task
3. **Track progress**: Update plan file and status in real-time
4. **Be resumable**: Continue where you left off
5. **Document thoroughly**: Create comprehensive status files
6. **Follow conventions**: Conventional commits, TypeScript, no emojis

**This command does NOT**:

1. **Make architecture decisions**: Follows plan and architecture doc
2. **Skip validation**: Always runs build/lint checks
3. **Hide errors**: Surfaces failures immediately
4. **Bypass pre-commit hooks**: Always runs hooks
