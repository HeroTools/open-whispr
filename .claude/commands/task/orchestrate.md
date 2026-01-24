# /task:orchestrate - Complete Task Lifecycle Management

**Purpose**: Orchestrate the complete lifecycle of a task from design through PR merge. Manages workflow state, coordinates phase transitions, and ensures checkpoints for human validation.

**Usage**:
- `/task:orchestrate OWS-XX` - Start or resume a task workflow
- `/task:orchestrate OWS-XX --status` - Show current workflow state only
- `/task:orchestrate OWS-XX --quick` - Start as quick task (skip design doc)
- `/task:orchestrate` - Interactive mode

---

## Workflow Overview

```
+-------------------------------------------------------------+
|                    Task Lifecycle Phases                     |
+-------------------------------------------------------------+
|  ENTRY (Project Sync)                                        |
|     -> /project:sync --start                                 |
|     -> Validate WIP limit (max 3 active)                     |
|     -> Add to PROJECT.md Active Work                         |
|                                                              |
|  1. DESIGN (Interactive)                                     |
|     -> Create design doc via Q&A                             |
|     -> User validates and approves                           |
|     -> Finalize design document                              |
|                                                              |
|  2. PLAN (Semi-autonomous)                                   |
|     -> Generate implementation plan                          |
|     -> User reviews plan                                     |
|                                                              |
|  3. IMPLEMENT (Autonomous with commits)                      |
|     -> Execute plan phase by phase                           |
|     -> Commit and push after each phase                      |
|     -> Update status file                                    |
|                                                              |
|  4. PR (Semi-autonomous)                                     |
|     -> Create pull request                                   |
|     -> Address feedback                                      |
|     -> User confirms ready to merge                          |
|                                                              |
|  5. COMPLETE (Cleanup)                                       |
|     -> /project:sync --complete                              |
|     -> Move to Recently Completed                            |
|     -> Checkout main, pull merged changes                    |
+-------------------------------------------------------------+
```

---

## Workflow State File

**Location**: `docs/status/ows-XX-workflow.yaml`

This file persists workflow state between sessions, enabling resume capability.

### State File Schema

```yaml
task_id: OWS-XX
title: "Task title"
branch: feature/ows-XX-description
created: 2024-12-28T10:00:00Z
task_type: development  # development | quick

workflow:
  current_phase: design  # design | plan | implement | pr | complete
  status: awaiting_input  # awaiting_input | in_progress | checkpoint | complete | blocked

phases:
  design:
    status: pending  # pending | in_progress | checkpoint | complete | skipped
    design_doc: null  # Path when created
    draft_ready: false
    finalized: false
    review_file: null
    review_verdict: null
    review_completed: false

  plan:
    status: pending
    plan_file: null
    approved: false

  implement:
    status: pending
    current_step: 0
    total_steps: 0
    commits: []
    last_phase_completed: null

  pr:
    status: pending
    pr_url: null
    pr_number: null
    reviews_addressed: 0
    approved: false

  complete:
    status: pending
    aggregation_files_updated: false
    merged_at: null

history:
  - timestamp: 2024-12-28T10:00:00Z
    action: workflow_started
    phase: design
    details: "Workflow initialized"
```

---

## Command Execution Instructions

### Step 1: Parse Arguments

1. **Extract task number** from arguments (e.g., `OWS-9` or `ows-9`)
2. **Check for flags**:
   - `--status`: Display current state and exit
   - `--quick`: Skip design phase (for simpler tasks)
3. **If no task provided**: Ask user interactively

### Step 2: Initialize or Resume Workflow

#### Check for Existing Workflow State

```bash
ls docs/status/ows-XX-workflow.yaml 2>/dev/null
```

**If workflow state exists**:
1. Read `docs/status/ows-XX-workflow.yaml`
2. Display current state summary
3. Ask: "Resume from [current phase]? (yes/restart/cancel)"
   - **yes**: Continue from current phase
   - **restart**: Reset workflow to beginning
   - **cancel**: Exit

**If workflow state does NOT exist**:
1. Create new workflow state file
2. **Classify task type**: Proceed to Step 2.3
3. Initialize phases based on task type
4. Set initial phase and status
5. **Sync project files**: Proceed to Step 2.5

### Step 2.3: Classify Task Type (New Workflow Only)

1. **If `--quick` flag provided**: Set `task_type: quick`

2. **Otherwise, ask user**:
   ```
   TASK TYPE CLASSIFICATION

   Task: OWS-XX - [title]

   What type of workflow should we use?

   1. [development] - Full workflow (design -> plan -> implement -> PR)
      Use for: New features, significant code changes

   2. [quick] - Streamlined workflow (plan -> implement -> PR)
      Use for: Bug fixes, small changes, simple tasks

   Your choice:
   ```

3. **Initialize based on classification**:

   **For Development tasks**:
   ```yaml
   task_type: development
   workflow:
     current_phase: design
     status: awaiting_input
   ```

   **For Quick tasks**:
   ```yaml
   task_type: quick
   workflow:
     current_phase: plan
     status: in_progress
   phases:
     design: { status: skipped, reason: "Quick task" }
   ```

### Step 2.5: Sync Project Aggregation Files (New Workflow Only)

**IMPORTANT**: This step only runs when starting a NEW workflow.

1. **Invoke**: `/project:sync OWS-XX --start`

2. **This validates**:
   - WIP limit (max 3 active tasks)

3. **If validation passes**:
   - PROJECT.md: Task added to "Active Work"
   - ROADMAP.md: Task status changed to "In Progress"

### Step 3: Phase Execution Loop

Based on `workflow.current_phase` and `workflow.status`, execute appropriate action:

---

#### PHASE 1: DESIGN

**Entry conditions**: `current_phase: design`

##### Status: pending or awaiting_input

1. **Check if design doc exists**: `docs/design-docs/ows-XX-*.md`

2. **If design doc does NOT exist**:
   - Display: "Starting design phase. This will be interactive."
   - Update state: `phases.design.status: in_progress`
   - **Invoke**: `/design-doc:create OWS-XX`
   - After completion:
     - `phases.design.design_doc: [path]`
     - `phases.design.draft_ready: true`
   - **Invoke review**: `/design-doc:review OWS-XX`
   - Update state:
     - `phases.design.status: checkpoint`
     - `workflow.status: checkpoint`

3. **If design doc exists but not finalized**:
   - Display: "Design document exists but not finalized."
   - Update state: `phases.design.status: checkpoint`

##### Status: checkpoint

1. Display design document location
2. Display review results (if available)
3. Ask user:
   ```
   DESIGN CHECKPOINT

   Design document: docs/design-docs/ows-XX-[description].md
   Review verdict: [APPROVE | APPROVE_WITH_SUGGESTIONS | NEEDS_REVISION]

   Options:
   1. [approve] - Design is approved, finalize it
   2. [feedback] - I have feedback (will re-enter Q&A)
   3. [pause] - Pause workflow, continue later

   Your choice:
   ```

4. **If approve**:
   - **Invoke**: `/design-doc:finalize OWS-XX`
   - Update state:
     - `phases.design.finalized: true`
     - `phases.design.status: complete`
     - `workflow.current_phase: plan`
     - `workflow.status: in_progress`
   - **Continue to PLAN phase**

5. **If pause**:
   - Save state
   - Exit with resume instructions

---

#### PHASE 2: PLAN

**Entry conditions**: `current_phase: plan`

##### Status: pending or in_progress

1. **Check if plan exists**: `docs/plans/ows-XX-*.md`

2. **If plan does NOT exist**:
   - Display: "Creating implementation plan."
   - Update state: `phases.plan.status: in_progress`
   - **Invoke**: `/plan:create OWS-XX`
   - After completion:
     - `phases.plan.plan_file: [path]`
     - `phases.plan.status: checkpoint`
     - `workflow.status: checkpoint`

3. **If plan exists**:
   - Display: "Implementation plan already exists."
   - Update state: `phases.plan.status: checkpoint`

##### Status: checkpoint

1. Display plan file location and summary
2. Ask user:
   ```
   PLAN CHECKPOINT

   Implementation plan: docs/plans/ows-XX-[description].md
   Total tasks: [X]
   Phases: [Y]

   Options:
   1. [approve] - Plan is approved, start implementation
   2. [regenerate] - Regenerate plan with different approach
   3. [pause] - Pause workflow, continue later

   Your choice:
   ```

3. **If approve**:
   - Update state:
     - `phases.plan.approved: true`
     - `phases.plan.status: complete`
     - `workflow.current_phase: implement`
     - `workflow.status: in_progress`
   - **Continue to IMPLEMENT phase**

---

#### PHASE 3: IMPLEMENT

**Entry conditions**: `current_phase: implement`

##### Status: pending or in_progress

1. Update state: `phases.implement.status: in_progress`
2. **Invoke**: `/plan:implement OWS-XX`

3. After each phase completion:
   - Update workflow state:
     - `phases.implement.last_phase_completed: [phase name]`
     - Add commit SHA to `phases.implement.commits[]`
   - **Push to remote**:
     ```bash
     git push origin feature/ows-XX-description
     ```
   - Add history entry

4. When `/plan:implement` reaches 100%:
   - Update state:
     - `phases.implement.status: complete`
   - **Continue to PR phase**

---

#### PHASE 4: PR

**Entry conditions**: `current_phase: pr`

##### Status: pending or in_progress (no PR exists)

1. **Invoke**: `/pr:create OWS-XX`
2. Update state:
   - `phases.pr.pr_url: [url]`
   - `phases.pr.pr_number: [number]`
   - `phases.pr.status: in_progress`

##### Status: in_progress (PR exists)

1. **Invoke**: `/pr:review OWS-XX` for reviews
2. If reviews addressed:
   - Update `phases.pr.reviews_addressed`
   - Push changes if any

##### Review Cycle

1. After addressing reviews, ask:
   ```
   PR CHECKPOINT

   PR: [url]
   Reviews addressed: [count]

   Options:
   1. [check-again] - Check for new comments
   2. [ready] - PR is approved, ready to merge
   3. [pause] - Pause workflow

   Your choice:
   ```

2. **If ready**:
   - Update state:
     - `phases.pr.approved: true`
     - `phases.pr.status: complete`
     - `workflow.current_phase: complete`
     - `workflow.status: in_progress`
   - **Continue to COMPLETE phase**

---

#### PHASE 5: COMPLETE

**Entry conditions**: `current_phase: complete`

##### Finalization Steps

1. **Ask about merge**:
   ```
   COMPLETION

   PR is approved. Options:
   1. [merge] - Merge the PR now
   2. [manual] - I'll merge manually

   Your choice:
   ```

2. **If merge**:
   - Merge PR: `gh pr merge [number] --squash`
   - Update state: `phases.complete.merged_at: [timestamp]`

3. **Sync project aggregation files**:
   - **Invoke**: `/project:sync OWS-XX --complete "Summary of what was accomplished"`
   - Update state: `phases.complete.aggregation_files_updated: true`

4. **Checkout main and pull**:
   ```bash
   git checkout main
   git pull origin main
   ```

5. **Invoke**: `/pr:finalize OWS-XX`

6. **Final state update**:
   - `phases.complete.status: complete`
   - `workflow.current_phase: complete`
   - `workflow.status: complete`

7. **Display completion summary**:
   ```
   ========================================
   TASK COMPLETE: OWS-XX
   ========================================

   Title: [Task title]
   Branch: feature/ows-XX-description
   PR: [url]
   Merged: [timestamp]

   Documents:
   - Design: docs/design-docs/ows-XX-[description].md
   - Plan: docs/plans/ows-XX-[description].md
   - Status: docs/status/ows-XX-[description].md

   Commits: [count]

   Ready to start next task!
   ```

---

## State Persistence

**CRITICAL**: Update workflow state file after EVERY action.

### Update Pattern

```yaml
history:
  - timestamp: [ISO timestamp]
    action: [action name]
    phase: [current phase]
    details: [what happened]
```

### History Action Types

| Action | Description |
|--------|-------------|
| `workflow_started` | Initial workflow creation |
| `project_sync_start` | Task added to Active Work |
| `design_started` | Design doc creation began |
| `design_draft_ready` | Design doc draft completed |
| `design_review_complete` | Review completed |
| `design_finalized` | Design doc approved |
| `plan_created` | Implementation plan generated |
| `plan_approved` | Plan approved |
| `phase_completed` | Implementation phase finished |
| `commit_created` | Git commit made |
| `pushed_to_remote` | Branch pushed |
| `pr_created` | Pull request created |
| `review_addressed` | PR review feedback addressed |
| `pr_approved` | PR approved for merge |
| `pr_merged` | PR merged to main |
| `project_sync_complete` | Task moved to Recently Completed |
| `workflow_complete` | Full workflow finished |
| `workflow_paused` | User paused workflow |
| `workflow_resumed` | Workflow resumed |
| `workflow_blocked` | Task blocked |

---

## Error Handling

### Blocked State

If any phase encounters a blocker:

1. Update workflow state: `workflow.status: blocked`
2. Add blocker details to history
3. **Display**:
   ```
   WORKFLOW BLOCKED

   Task: OWS-XX
   Phase: [current phase]
   Reason: [description]

   After resolving, run: /task:orchestrate OWS-XX
   ```

### Recovery

When resuming a blocked workflow:

1. Check if blocker is resolved
2. If resolved:
   - Update workflow state: `workflow.status: in_progress`
   - Continue from blocked phase

---

## Status Display (--status flag)

When invoked with `--status`:

```
========================================
WORKFLOW STATUS: OWS-XX
========================================

Title: [Task title]
Type: Development
Current Phase: [phase] ([status])
Overall Progress: [X]%

Phases:
  [x] Design     - Complete (docs/design-docs/ows-XX-[...].md)
  [x] Plan       - Complete (docs/plans/ows-XX-[...].md)
  [~] Implement  - In Progress (60% - Phase 3 of 5)
  [ ] PR         - Pending
  [ ] Complete   - Pending

Recent History:
  - [timestamp] phase_completed: Phase 2 - Core Implementation
  - [timestamp] commit_created: abc1234
  - [timestamp] pushed_to_remote

Files:
  - Workflow: docs/status/ows-XX-workflow.yaml
  - Design: docs/design-docs/ows-XX-[description].md
  - Plan: docs/plans/ows-XX-[description].md
  - Status: docs/status/ows-XX-[description].md

Branch: feature/ows-XX-description
```

---

## Integration with Existing Skills

This orchestrator coordinates these skills:

| Skill | Phase | Purpose |
|-------|-------|---------|
| `/project:sync --start` | Entry | Validate WIP limit, add to Active Work |
| `/design-doc:create` | Design | Interactive design creation |
| `/design-doc:review` | Design | Review design document |
| `/design-doc:finalize` | Design | Mark design as approved |
| `/plan:create` | Plan | Generate implementation plan |
| `/plan:implement` | Implement | Execute plan phases |
| `/pr:create` | PR | Create pull request |
| `/pr:review` | PR | Handle review feedback |
| `/pr:finalize` | Complete | Post-merge cleanup |
| `/project:sync --complete` | Complete | Move to Recently Completed |

---

## Philosophy

**This orchestrator is designed to**:

1. **Provide single entry point**: One command for entire task lifecycle
2. **Enable resume capability**: Pick up where you left off
3. **Ensure human checkpoints**: Validate at critical decision points
4. **Maintain visibility**: Clear status at all times
5. **Coordinate skills**: Chain existing skills intelligently
6. **Track history**: Full audit trail of actions

**This orchestrator does NOT**:

1. **Make architectural decisions**: Uses design docs and plans
2. **Skip validation**: Requires human approval at checkpoints
3. **Force completion**: User can pause anytime
4. **Hide state**: Everything persisted in YAML file
