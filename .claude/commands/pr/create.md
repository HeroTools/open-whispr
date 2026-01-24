# /pr:create - Create Pull Requests

**Purpose**: Create a pull request for a completed task implementation. Generates comprehensive PR description from design docs, plans, and commits.

**Usage**:
- `/pr:create OWS-XX` - Create PR for specific task
- `/pr:create` - Interactive mode (detects from branch name)

---

## Prerequisites

Before creating a PR:
- [ ] Implementation is complete (plan at 100%)
- [ ] All commits are pushed to feature branch
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] Branch is up-to-date with main

---

## Command Execution Instructions

### Step 1: Extract Task Number

1. **If user provided task number** (e.g., `/pr:create ows-9`):
   - Normalize formats
   - Proceed to Step 2

2. **If no task number provided**:
   - Check current branch name for `ows-XX` pattern
   - If found: Use extracted task number
   - If not found: Ask user

### Step 2: Verify Branch State

```bash
# Check current branch
git rev-parse --abbrev-ref HEAD

# Verify on feature branch
# Expected: feature/ows-XX-*
```

**If on main**:
```
ERROR: Currently on main branch

PRs must be created from feature branches.
Expected: feature/ows-XX-*

Please checkout your feature branch first.
```
Exit command.

**Verify branch matches task**:
```bash
# Branch should contain ows-XX
git rev-parse --abbrev-ref HEAD | grep -i "ows-XX"
```

### Step 3: Check Uncommitted Changes

```bash
git status --porcelain
```

**If uncommitted changes exist**:
```
WARNING: Uncommitted changes detected

[list of files]

Options:
1. [commit] - Commit changes first
2. [stash] - Stash changes and continue
3. [continue] - Create PR anyway (changes won't be included)
4. [cancel] - Cancel

Your choice:
```

### Step 4: Verify Remote Push

```bash
# Check if branch is pushed
git status -sb
# Look for "ahead" indicator
```

**If not pushed or ahead of remote**:
```bash
git push origin feature/ows-XX-description
```

Display: "Pushed [X] commits to remote."

### Step 5: Check for Existing PR

```bash
gh pr list --head "feature/ows-XX-description" --json number,url,state
```

**If PR already exists**:
```
PR already exists for this branch.

PR #[number]: [title]
URL: [url]
State: [open/merged/closed]

Options:
1. [view] - View existing PR
2. [recreate] - Close and create new PR
3. [cancel] - Cancel

Your choice:
```

### Step 6: Gather PR Content

#### Read Design Document

```bash
# Find design doc
ls docs/design-docs/ows-XX-*.md
```

Extract:
- Summary section
- Architecture decisions
- Key components

#### Read Plan File

```bash
# Find plan file
ls docs/plans/ows-XX-*.md
```

Extract:
- Total tasks and phases
- Key implementation details

#### Read Status File

```bash
# Find status file
ls docs/status/ows-XX-*.md
```

Extract:
- Technical decisions made
- Important findings

#### Analyze Commits

```bash
# Get commits on this branch not in main
git log main..HEAD --oneline
```

#### Get Diff Stats

```bash
git diff main --stat
```

### Step 7: Generate PR Title

Format: `feat(OWS-XX): [Short description from task title]`

Examples:
- `feat(OWS-9): add dark mode toggle`
- `feat(OWS-10): improve audio recording quality`
- `fix(OWS-15): resolve clipboard paste on macOS`

### Step 8: Generate PR Body

```markdown
## Summary

[2-3 sentences from design doc summary]

## Changes

### Files Modified
- `src/components/[name]` - [description]
- `src/hooks/[name]` - [description]
- `src/helpers/[name]` - [description]

### Key Decisions
- [Decision 1 from status file]
- [Decision 2]

## Platform Support

| Platform | Tested | Notes |
|----------|--------|-------|
| macOS | [ ] | |
| Windows | [ ] | |
| Linux | [ ] | |

## Testing

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] Manual testing on primary platform
- [ ] Cross-platform testing (if applicable)

## Commits

[List of commit messages]

## Related

- **Design Doc**: docs/design-docs/ows-XX-[description].md
- **Plan**: docs/plans/ows-XX-[description].md
- **Status**: docs/status/ows-XX-[description].md
```

### Step 9: Create PR

```bash
gh pr create \
  --title "feat(OWS-XX): [description]" \
  --body "$(cat <<'EOF'
[Generated PR body]
EOF
)" \
  --base main \
  --head feature/ows-XX-description
```

Capture PR URL and number from output.

### Step 10: Confirm to User

```
SUCCESS: Pull request created!

PR #[number]: feat(OWS-XX): [description]
URL: [url]

Summary:
- Files changed: [count]
- Commits: [count]
- Lines: +[added] -[removed]

Next steps:
1. Wait for review
2. Address feedback: /pr:review OWS-XX
3. After approval, merge and finalize

Or continue with orchestrator: /task:orchestrate OWS-XX
```

---

## PR Body Template (Full)

```markdown
## Summary

[Extracted from design doc summary section]

## Background

[Brief context - why this change is needed]

## Changes

### New/Modified Files

| File | Type | Description |
|------|------|-------------|
| `src/components/[name]` | New | [What it does] |
| `src/hooks/[name]` | Modified | [What changed] |

### Key Implementation Details

- [Detail 1]
- [Detail 2]

## Architecture

[If applicable, include relevant diagram or reference to design doc]

## Platform Support

| Platform | Tested | Notes |
|----------|--------|-------|
| macOS | [ ] | Primary development platform |
| Windows | [ ] | |
| Linux | [ ] | |

## Testing

### Build & Lint
- [x] `npm run build` - Build passes
- [x] `npm run lint` - No lint errors

### Manual Testing
- [ ] Feature works as expected
- [ ] No regression in existing functionality
- [ ] UI renders correctly

### Cross-Platform (if applicable)
- [ ] Tested on macOS
- [ ] Tested on Windows
- [ ] Tested on Linux

## Commits

<details>
<summary>Commit history ([count] commits)</summary>

```
[git log output]
```

</details>

## Related

- **Design Document**: `docs/design-docs/ows-XX-[description].md`
- **Implementation Plan**: `docs/plans/ows-XX-[description].md`
- **Status Log**: `docs/status/ows-XX-[description].md`
- **Architecture Reference**: `CLAUDE.md`

## Checklist

- [ ] Code follows project conventions
- [ ] TypeScript types are correct
- [ ] All tests pass
- [ ] Documentation updated (if needed)
- [ ] Design doc referenced
```

---

## Special Cases

### Case 1: No design document

If design doc doesn't exist:
```
WARNING: No design document found

PR will be created with limited context.
Consider creating a design doc for better documentation.

Continue? (yes/no)
```

### Case 2: Implementation incomplete

If plan shows < 100%:
```
WARNING: Implementation appears incomplete

Plan progress: 75% (15/20 tasks)

Creating a PR for incomplete work is not recommended.

Options:
1. [continue] - Create PR anyway (draft)
2. [complete] - Return to implementation
3. [cancel] - Cancel

Your choice:
```

If continue, add `--draft` flag to `gh pr create`.

### Case 3: Branch behind main

```bash
git fetch origin main
git log HEAD..origin/main --oneline
```

If commits exist:
```
WARNING: Branch is behind main

Your branch is [X] commits behind main.

Options:
1. [rebase] - Rebase on main first
2. [continue] - Create PR anyway (may have conflicts)
3. [cancel] - Cancel

Your choice:
```

---

## Integration Notes

**Called by**: `/task:orchestrate` after implementation complete

**Follows**: `/plan:implement`

**Precedes**: `/pr:review`

**Updates**:
- Git repository (push if needed)
- GitHub (PR creation)
