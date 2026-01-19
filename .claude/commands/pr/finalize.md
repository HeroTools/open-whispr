# /pr:finalize - Post-Merge Cleanup and Task Completion

**Purpose**: Handle post-merge cleanup after a PR is merged. Updates aggregation files, switches to main branch, and marks the task as complete.

**Usage**:
- `/pr:finalize OWS-XX` - Finalize specific task after merge
- `/pr:finalize` - Interactive mode

---

## When to Use

This command should be run:
1. After PR is merged to main
2. To complete the task lifecycle
3. To update project documentation

---

## Command Execution Instructions

### Step 1: Extract Task Number

1. **Get task number** from argument or detect from context
2. **If not provided**: Ask user or check workflow state

### Step 2: Verify PR is Merged

```bash
gh pr list --head "feature/ows-XX-description" --json number,state,mergedAt
```

**If PR not merged**:
```
PR #[number] is not yet merged.

State: [Open/Closed]

Options:
1. [merge] - Merge the PR now
2. [wait] - Exit and wait for merge
3. [force] - Continue anyway (cleanup without merge)

Your choice:
```

**If PR is merged**: Continue

### Step 3: Switch to Main Branch

```bash
# Check current branch
git rev-parse --abbrev-ref HEAD

# If not on main, switch
git checkout main

# Pull latest changes
git pull origin main
```

Display:
```
Switched to main branch.
Pulled latest changes including merged PR.
```

### Step 4: Delete Feature Branch (Optional)

```bash
# Check if branch exists locally
git branch --list "feature/ows-XX-*"

# Check if branch exists on remote
git branch -r --list "origin/feature/ows-XX-*"
```

Ask user:
```
Feature branch cleanup:

Local branch: feature/ows-XX-description [exists]
Remote branch: origin/feature/ows-XX-description [exists]

Options:
1. [delete-both] - Delete local and remote branch
2. [delete-local] - Delete local only
3. [keep] - Keep branches

Your choice:
```

If delete:
```bash
# Delete local
git branch -d feature/ows-XX-description

# Delete remote
git push origin --delete feature/ows-XX-description
```

### Step 5: Update Aggregation Files

#### 5.1: Update PROJECT.md (if exists)

Read `docs/PROJECT.md` and update:

**Move task from Active Work to Recently Completed**:

Before:
```markdown
## Active Work
| Task | Status | Phase | Blocked By |
|------|--------|-------|------------|
| OWS-XX | In Progress | Implementation | - |
```

After:
```markdown
## Recently Completed
| Task | Completed | Summary |
|------|-----------|---------|
| OWS-XX | [Today's date] | [Brief summary] |
```

#### 5.2: Update ROADMAP.md (if exists)

Read `docs/ROADMAP.md` and update:

**Change task status to Done**:

Before:
```markdown
| OWS-XX | [Title] | In Progress | |
```

After:
```markdown
| OWS-XX | [Title] | Done | |
```

### Step 6: Update Status File

Update `docs/status/ows-XX-[description].md`:

```markdown
**Last Updated**: [Current Date/Time]

## Current Status: Complete

**Overall Progress**: 100% (X/X tasks)
**Completed**: [Date/Time]
**PR Merged**: [Date/Time]

---

## Final Summary

**Implementation**: Successfully completed all tasks.

**Files Created/Modified**:
- [List of files]

**Total Commits**: [count]
**PR**: #[number] (merged)
```

### Step 7: Commit Aggregation File Updates

```bash
git add docs/PROJECT.md docs/ROADMAP.md docs/status/
git commit -m "$(cat <<'EOF'
docs(OWS-XX): update aggregation files for completed task

- PROJECT.md: Moved OWS-XX to Recently Completed
- ROADMAP.md: Updated task status to Done
- Status file: Marked as complete
EOF
)"
git push origin main
```

### Step 8: Display Completion Summary

```
========================================
TASK FINALIZED: OWS-XX
========================================

Title: [Task title]
Status: Complete
PR: #[number] (merged)

Documents:
  - Design: docs/design-docs/ows-XX-[description].md
  - Plan: docs/plans/ows-XX-[description].md
  - Status: docs/status/ows-XX-[description].md

Aggregation Files Updated:
  - docs/PROJECT.md (task moved to Recently Completed)
  - docs/ROADMAP.md (status changed to Done)

Branch Cleanup:
  - Local: [deleted/kept]
  - Remote: [deleted/kept]

========================================

Ready to start next task!
```

---

## Special Cases

### Case 1: Aggregation Files Don't Exist

```
WARNING: Aggregation files not found

Expected files:
- docs/PROJECT.md [missing]
- docs/ROADMAP.md [missing]

Options:
1. [create] - Create missing files from templates
2. [skip] - Skip aggregation updates
3. [cancel] - Cancel finalization

Your choice:
```

### Case 2: Task Not in Aggregation Files

```
NOTE: OWS-XX not found in ROADMAP.md

The task may not have been added to project tracking.

Options:
1. [add] - Add task to files now
2. [skip] - Skip this file
3. [manual] - I'll update manually

Your choice:
```

### Case 3: Merge Conflicts in Aggregation Files

```
WARNING: Aggregation files have conflicts

docs/PROJECT.md has conflicts after git pull.

Options:
1. [resolve] - Attempt auto-resolve
2. [manual] - Exit and resolve manually
3. [skip] - Skip this file

Your choice:
```

---

## Cleanup Checklist

Before marking complete, verify:

- [ ] PR is merged to main
- [ ] Main branch is up-to-date locally
- [ ] Feature branch cleaned up (optional)
- [ ] PROJECT.md updated (if exists)
- [ ] ROADMAP.md updated (if exists)
- [ ] Status file has final summary
- [ ] Aggregation updates committed and pushed

---

## Integration Notes

**Called by**: `/task:orchestrate` as final step

**Follows**: PR merge

**Final step in workflow chain**

**Updates**:
- Git branches (cleanup)
- Aggregation files (if present)
- Status file
