# /design-doc:create - Create Design Documents from Tasks

**Purpose**: Generate a structured design document for OpenWhispr feature development, following the architecture patterns from CLAUDE.md.

**Usage**: `/design-doc:create [ows-XX]` or `/design-doc:create` (interactive)

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

1. **If user provided task number** (e.g., `/design-doc:create ows-36`):
   - Extract the OWS-XX identifier
   - Normalize to uppercase for display (e.g., "ows-36" -> "OWS-36")
   - Proceed to Step 2

2. **If no task number provided** (e.g., `/design-doc:create`):
   - Ask user: "What task are you creating a design document for? (e.g., OWS-36 or describe the feature)"
   - Wait for response
   - Extract and normalize the task number
   - Proceed to Step 2

### Step 2: Gather Task Details

**Ask user for task information**:

1. "What is the title/summary of this task?"
2. "What problem does this solve or what feature does it add?"
3. "Are there any specific requirements or constraints?"

**If task details are minimal**:
- Ask clarifying questions
- Gather enough context to write a meaningful design

### Step 3: Read Project Architecture Document

**Always read**: `CLAUDE.md`

**Extract relevant context**:
- Overall architecture (Electron main/renderer, preload)
- Technology stack (React, TypeScript, Tailwind, whisper.cpp)
- Component structure (src/components/, src/hooks/, src/helpers/)
- Database schema (if relevant)
- Settings storage patterns

**Identify which area** the task relates to:
- UI Components (`src/components/`) - React components, settings, dialogs
- Hooks (`src/hooks/`) - Custom React hooks
- Main Process (`src/helpers/`) - Electron main process modules
- Services (`src/services/`) - Business logic services
- Audio Processing - Recording, transcription pipeline
- Settings/Storage - localStorage, database
- Platform Integration - Hotkeys, clipboard, accessibility

### Step 4: Generate Short Description

**From the task title**, generate a URL-friendly short description:

1. Take the task title
2. Convert to lowercase
3. Replace spaces with hyphens
4. Remove special characters
5. Truncate to ~30 chars if needed

**Examples**:
- "Add Dark Mode Toggle" -> `dark-mode-toggle`
- "Improve Recording Quality" -> `recording-quality`
- "Add Export History Feature" -> `export-history`

### Step 5: Generate Design Document

**Create file**: `docs/design-docs/ows-XX-[short-description].md`

**Required format**:

```markdown
# OWS-XX: [Task Title]

**Status**: Draft
**Author**: [User or "OpenWhispr Team"]
**Created**: [Current Date]
**Architecture Reference**: CLAUDE.md

---

## Summary

[2-3 sentence summary of what this task accomplishes and why it's needed]

---

## Background

[Context about the problem or feature]
[How this fits into the OpenWhispr architecture]
[Any relevant prior discussions or decisions]

---

## Architecture

### Component Overview

[Describe where this component fits in the overall architecture]

### Affected Files

| File/Module | Change Type | Description |
|-------------|-------------|-------------|
| `src/components/[name]` | New/Modified | [What changes] |
| `src/hooks/[name]` | New/Modified | [What changes] |
| `src/helpers/[name]` | New/Modified | [What changes] |

### Dependencies

- **Internal Modules**: [Other modules this depends on]
- **External Packages**: [NPM packages needed]
- **Platform APIs**: [Electron APIs, browser APIs]

---

## Detailed Design

### Component Structure

```tsx
// Key component structure or interface definitions
```

### Data Flow

[Describe how data flows through the system for this feature]

### State Management

[How state will be managed - localStorage, React state, context]

---

## Platform Considerations

[How this feature behaves on different platforms]

| Platform | Behavior | Notes |
|----------|----------|-------|
| macOS | [Notes] | |
| Windows | [Notes] | |
| Linux | [Notes] | |

---

## Implementation Plan

### Phase 1: [Phase Name]

- [ ] Task 1
  - [ ] Subtask 1.1
  - [ ] Subtask 1.2
- [ ] Task 2

### Phase 2: [Phase Name]

- [ ] Task 3
- [ ] Task 4

### Phase 3: Testing & Validation

- [ ] Unit tests pass
- [ ] Manual testing on target platforms
- [ ] Build succeeds (`npm run build`)

---

## Security Considerations

[Security implications of this change]

- **Data Privacy**: [How user data is handled]
- **API Keys**: [If applicable]
- **File Access**: [If applicable]

---

## Acceptance Criteria

- [ ] [Specific, measurable criterion 1]
- [ ] [Specific, measurable criterion 2]
- [ ] Build passes without errors
- [ ] No regression in existing functionality
- [ ] Works on all target platforms

---

## Rollback Plan

[How to rollback if something goes wrong]

1. [Step 1]
2. [Step 2]

---

## Open Questions

- [ ] [Any unresolved questions]

---

## References

- [Architecture Reference](./CLAUDE.md)
- [Electron Documentation](https://www.electronjs.org/docs)
```

### Step 6: Customize Based on Component Type

**Adjust template sections** based on component type:

#### For UI Components:
- Add wireframe/mockup section
- Include accessibility considerations
- Reference existing UI patterns (shadcn/ui)

#### For Audio Processing:
- Add audio pipeline details
- Include FFmpeg considerations
- Reference whisper.cpp integration

#### For Settings/Storage:
- Add database schema changes
- Include migration considerations
- Reference localStorage patterns

#### For Electron Main Process:
- Add IPC channel definitions
- Include preload bridge updates
- Reference security considerations (context isolation)

### Step 7: Create Git Branch

**Create a git branch** following the naming convention:

**Branch naming format**: `feature/ows-<number>-<slugified-title>`

**Create and checkout the branch**:
```bash
git checkout -b feature/ows-<number>-<short-description>
```

**Example**:
```bash
git checkout -b feature/ows-6-dark-mode-toggle
```

### Step 8: Confirm to User

```
SUCCESS: Design document created!

File: docs/design-docs/ows-XX-[description].md
Branch: feature/ows-XX-[description]

Document sections:
- Summary
- Background
- Architecture
- Detailed Design
- Platform Considerations
- Implementation Plan
- Acceptance Criteria

Next steps:
1. Review: docs/design-docs/ows-XX-[description].md
2. Update open questions
3. Get design review/approval
4. Push branch: git push -u origin feature/ows-XX-[description]
5. Begin implementation
```

---

## Special Cases

### Case 1: docs/design-docs/ folder doesn't exist

- Create folder: `mkdir -p docs/design-docs`

### Case 2: Design doc already exists

```
Design document already exists: docs/design-docs/ows-XX-[description].md

Options:
1. [overwrite] - Regenerate and overwrite
2. [open] - Open existing document (exit command)
3. [cancel] - Exit without changes

Your choice:
```

### Case 3: Task has no description

```
WARNING: Task has minimal description

The design document will need more context. You can:
1. [continue] - Create design doc with minimal context (fill in later)
2. [cancel] - Exit and gather more requirements first

Your choice:
```

If continue: Generate template with placeholders for user to fill in.

---

## Example Execution

**User input**: `/design-doc:create ows-10`

**Command execution**:

1. Extract task: OWS-10
2. Ask user for task details
3. User provides: "Add dark mode toggle to settings"
4. Read CLAUDE.md for architecture context
5. Identify component: UI Components (src/components/)
6. Generate short description: `dark-mode-toggle`
7. Create: `docs/design-docs/ows-10-dark-mode-toggle.md`
8. Create branch: `git checkout -b feature/ows-10-dark-mode-toggle`
9. Confirm: "SUCCESS: Design document created!"

---

## Implementation Notes

- Use `Read` tool to read CLAUDE.md
- Use `Write` tool to create design document
- Use `Bash` with `mkdir -p` to create directories if needed
- Follow branch naming: `feature/ows-XX-description`
