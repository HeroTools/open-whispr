# /pr:review - Handle PR Review Feedback

**Purpose**: Check for PR review comments, analyze feedback, make necessary changes, and respond to reviewers. Automates the review feedback cycle.

**Usage**:
- `/pr:review OWS-XX` - Check and address reviews for specific task
- `/pr:review` - Interactive mode (detects from branch)

---

## Workflow

```
+-------------------------------------------------------------+
|                    PR Review Cycle                           |
+-------------------------------------------------------------+
|  1. Fetch PR reviews and comments                            |
|  2. Analyze feedback (blocking vs suggestions)               |
|  3. Make code changes to address feedback                    |
|  4. Commit changes with descriptive message                  |
|  5. Reply to review comments                                 |
|  6. Push to branch                                           |
|  7. Repeat if new comments arrive                            |
+-------------------------------------------------------------+
```

---

## Command Execution Instructions

### Step 1: Extract Task and PR Info

1. **Get task number** from argument or branch name
2. **Find PR number**:

```bash
gh pr list --head "feature/ows-XX-description" --json number,url,state
```

**If no PR found**:
```
ERROR: No PR found for OWS-XX

Expected PR from branch: feature/ows-XX-*

Create one first: /pr:create OWS-XX
```
Exit command.

### Step 2: Fetch PR Status

```bash
gh pr view [number] --json state,reviews,reviewDecision,comments,mergeable
```

Extract:
- `state`: open, closed, merged
- `reviews`: List of reviews with state (APPROVED, CHANGES_REQUESTED, COMMENTED)
- `reviewDecision`: Overall decision
- `comments`: General PR comments
- `mergeable`: Whether PR can be merged

**If PR is merged**:
```
PR #[number] is already merged.

Merged at: [timestamp]

No review action needed.
```
Exit command.

### Step 3: Fetch Review Comments

```bash
# Get review comments (inline code comments)
gh api repos/{owner}/{repo}/pulls/[number]/comments --jq '.[] | {id, path, line, body, user: .user.login, created_at}'

# Get review threads
gh api repos/{owner}/{repo}/pulls/[number]/reviews --jq '.[] | {id, state, body, user: .user.login}'

# Get issue comments (general discussion)
gh pr view [number] --json comments --jq '.comments[] | {id, body, author: .author.login}'
```

### Step 4: Categorize Feedback

Group comments by type:

| Category | Priority | Action Required |
|----------|----------|-----------------|
| `CHANGES_REQUESTED` | High | Must address before merge |
| `COMMENTED` (blocking) | Medium | Should address |
| `COMMENTED` (suggestion) | Low | Optional, acknowledge |
| `APPROVED` | None | No action needed |

**Identify blocking feedback**:
- Explicit change requests
- Questions about implementation
- Security concerns
- Bug reports

**Identify non-blocking**:
- Style suggestions
- "Nice to have" improvements
- Positive feedback

### Step 5: Display Review Summary

```
========================================
PR REVIEW STATUS: OWS-XX
========================================

PR #[number]: [title]
State: Open
Mergeable: Yes/No

Reviews:
  - @reviewer1: APPROVED
  - @reviewer2: CHANGES_REQUESTED

Overall Decision: [APPROVED / CHANGES_REQUESTED / PENDING]

Comments to Address: [count]

---

BLOCKING FEEDBACK:

1. @reviewer2 on src/components/ThemeToggle.tsx:45
   "Consider using the existing useLocalStorage hook"
   Status: Unresolved

2. @reviewer2 general comment
   "Please add unit tests for the new component"
   Status: Unresolved

---

SUGGESTIONS (optional):

1. @reviewer1 on src/hooks/useTheme.ts:12
   "Consider adding a loading state"
   Status: Unresolved

---

Options:
1. [address] - Address blocking feedback
2. [address-all] - Address all feedback including suggestions
3. [skip] - Skip for now
4. [details] - Show full comment details

Your choice:
```

### Step 6: Address Feedback

For each piece of blocking feedback:

#### 6.1: Analyze the Comment

Read the comment and:
1. Identify the file and line referenced
2. Understand the requested change
3. Read surrounding code for context
4. Determine the fix

#### 6.2: Make Code Changes

Use appropriate tools to implement the fix:

```bash
# Read the file
Read tool: [file path]

# Make changes
Edit tool: [modifications]

# Validate
npm run build
npm run lint
```

#### 6.3: Track Changes Made

Keep a list of changes for commit message:
- `[file]: [change description]`

### Step 7: Create Review Response Commit

After addressing feedback, commit with descriptive message:

```bash
git add [modified files]
git commit -m "$(cat <<'EOF'
fix(OWS-XX): address PR review feedback

Changes:
- src/components/ThemeToggle.tsx: Use useLocalStorage hook
- src/hooks/useTheme.ts: Add loading state
- tests/ThemeToggle.test.tsx: Add unit tests

Resolves review comments from @reviewer2

Related: PR #[number]
EOF
)"
```

### Step 8: Reply to Comments

For each addressed comment, post a reply:

```bash
# Reply to a review comment
gh api repos/{owner}/{repo}/pulls/[number]/comments/[comment_id]/replies \
  -f body="Fixed in [commit SHA]. [Brief explanation of change]"
```

Example replies:

| Feedback Type | Reply Template |
|---------------|----------------|
| Bug fix | "Fixed in abc1234. Good catch!" |
| Suggestion implemented | "Great suggestion, implemented in abc1234" |
| Suggestion declined | "Considered this, but [reason]. Happy to discuss further." |
| Clarification | "[Explanation]. Let me know if you have questions." |

### Step 9: Push Changes

```bash
git push origin feature/ows-XX-description
```

### Step 10: Re-check Review Status

After pushing, check if new comments appeared:

```bash
gh pr view [number] --json reviews,reviewDecision
```

**If new changes requested**:
```
New feedback received after your push.

[New comments]

Would you like to address these? (yes/no)
```

**If approved**:
```
SUCCESS: PR is now approved!

All reviewers have approved.
Ready to merge.

Next steps:
1. Merge: gh pr merge [number] --squash
2. Or continue with orchestrator: /task:orchestrate OWS-XX
```

### Step 11: Confirm to User

```
========================================
REVIEW FEEDBACK ADDRESSED
========================================

PR #[number]: [title]

Changes Made:
- [file1]: [change]
- [file2]: [change]

Commits: [count]
Pushed: Yes

Comments Resolved: [count]
Remaining: [count]

Review Status:
- @reviewer1: APPROVED
- @reviewer2: CHANGES_REQUESTED -> [pending re-review]

Next steps:
1. Wait for re-review
2. Run /pr:review OWS-XX again if needed
3. After approval: /task:orchestrate OWS-XX
```

---

## Handling Different Feedback Types

### Type 1: Code Change Request

```markdown
Reviewer: "Use the existing useLocalStorage hook"
File: src/components/ThemeToggle.tsx:45

Action:
1. Read src/components/ThemeToggle.tsx
2. Find line 45
3. Replace custom implementation with useLocalStorage
4. Commit and reply
```

### Type 2: Missing Functionality

```markdown
Reviewer: "Please add loading state handling"

Action:
1. Identify the component file
2. Add loading state
3. Update UI to show loading
4. Commit and reply
```

### Type 3: Documentation Request

```markdown
Reviewer: "Add JSDoc comments to the hook"

Action:
1. Find the hook file
2. Add JSDoc comments
3. Commit and reply
```

### Type 4: Question (No Code Change)

```markdown
Reviewer: "Why did you choose this approach?"

Action:
1. Reply with explanation
2. Reference design doc if applicable
3. No code change needed
```

### Type 5: Suggestion (Optional)

```markdown
Reviewer: "Nice to have: could add animation"

Action:
1. Evaluate effort vs value
2. If quick: implement and reply
3. If complex: reply explaining decision to defer
```

---

## Batch Processing

When multiple comments exist:

1. **Group by file**: Address all comments on same file together
2. **Order by priority**: Blocking first, then suggestions
3. **Single commit per file group**: Avoid many small commits
4. **Batch replies**: Reply to all addressed comments

Example commit for batch:

```
fix(OWS-XX): address PR review feedback (batch)

src/components/ThemeToggle.tsx:
- Line 45: Use useLocalStorage hook
- Line 67: Add error boundary

src/hooks/useTheme.ts:
- Add loading state
- Add JSDoc comments

Resolves: 4 review comments from @reviewer2
```

---

## Special Cases

### Case 1: Conflicting Feedback

When two reviewers give conflicting feedback:

```
CONFLICT DETECTED: Reviewers disagree

@reviewer1: "Use context for theme state"
@reviewer2: "Use localStorage for persistence"

Please decide:
1. Follow @reviewer1's suggestion
2. Follow @reviewer2's suggestion
3. Find a compromise (use both)
4. Discuss in PR comments

Your choice:
```

### Case 2: Feedback Requires Design Change

```
SIGNIFICANT CHANGE REQUESTED

@reviewer1: "This should use a completely different architecture"

This feedback suggests changes beyond implementation fixes.

Options:
1. [discuss] - Comment asking for clarification
2. [update-design] - Revisit design document
3. [implement] - Try to implement anyway

Your choice:
```

### Case 3: All Approved

```
SUCCESS: All reviews approved!

No action needed.

PR is ready to merge.

Options:
1. [merge] - Merge the PR
2. [wait] - Wait for more reviews
3. [exit] - Exit (merge manually)

Your choice:
```

---

## Integration Notes

**Called by**: `/task:orchestrate` during PR phase

**Follows**: `/pr:create`

**Precedes**: Merge (via orchestrator or manual)

**Updates**:
- Code files (to address feedback)
- Git repository (commits)
- PR comments (replies)
