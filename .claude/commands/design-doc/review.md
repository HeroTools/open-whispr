# /design-doc:review - Review Design Documents

**Purpose**: Review design documents to identify architectural issues, gaps, and provide actionable feedback before implementation.

**Usage**:
- `/design-doc:review OWS-XX` - Review specific design document
- `/design-doc:review` - Interactive mode

---

## When to Use

This command is typically invoked:
1. Automatically by `/task:orchestrate` after `/design-doc:create` completes
2. Manually when requesting a review of any design document

---

## Command Execution Instructions

### Step 1: Extract Task Number

1. **If user provided task number** (e.g., `/design-doc:review ows-21`):
   - Normalize to both formats (OWS-21 for display, ows-21 for files)
   - Proceed to Step 2

2. **If no task number provided**:
   - Ask: "Which design document do you want to review? (e.g., OWS-21)"
   - Wait for response

### Step 2: Locate Design Document

Search for design document:
```bash
ls docs/design-docs/ows-XX-*.md
```

**If NOT found**:
```
ERROR: Design document not found

Expected: docs/design-docs/ows-XX-*.md

Create one first: /design-doc:create OWS-XX
```
Exit command.

**If found**: Note the full filename (e.g., `ows-21-dark-mode-toggle.md`)

### Step 3: Read Design Document

Read the full design document content for review.

### Step 4: Read Context Files

Read the project architecture document:
- `CLAUDE.md` - Master architecture document

### Step 5: Create Reviews Directory

Ensure the reviews directory exists:
```bash
mkdir -p docs/reviews
```

### Step 6: Perform Review

**Review the design document against these criteria**:

#### 1. COMPLETENESS (check all sections are present and meaningful)
- Summary: Clear problem statement and solution
- Background: Sufficient context
- Architecture: Component overview and affected files
- Detailed Design: Component structure and data flow
- Implementation Plan: Phased approach with clear tasks
- Acceptance Criteria: Testable success metrics

#### 2. ARCHITECTURE QUALITY
- Follows Electron best practices (main/renderer separation)
- Appropriate use of IPC for cross-process communication
- Context isolation maintained
- Scalability considerations
- Platform compatibility addressed

#### 3. CODE QUALITY
- Components properly structured
- Hooks follow React patterns
- TypeScript types well-defined
- State management appropriate

#### 4. SECURITY POSTURE
- No sensitive data exposed to renderer without need
- IPC channels properly secured
- API keys handled securely
- File access minimized

#### 5. OPERATIONAL READINESS
- Error handling considered
- Logging/debugging approach
- Rollback plan exists

#### 6. ARCHITECTURAL ALIGNMENT
- Aligns with CLAUDE.md patterns
- Follows existing codebase conventions
- Uses established patterns (shadcn/ui, hooks)

### Step 7: Generate Review Output

Write review to: `docs/reviews/ows-XX-design-review.md`

**Format**:
```markdown
# Design Review: OWS-XX - [Title from design doc]

**Reviewed**: [Current Date YYYY-MM-DD]
**Reviewer**: Claude
**Design Document**: docs/design-docs/ows-XX-[description].md

---

## 1. Completeness Check

[List sections present/missing with brief assessment]

## 2. Architecture Assessment

**Strengths**: [What's done well]
**Concerns**: [Issues to address]

## 3. Architectural Alignment

**CLAUDE.md Compliance**: [Does it align with project patterns?]
**Codebase Conventions**: [Does it follow existing patterns?]

## 4. Security Review

[Assessment of security posture]

## 5. Implementation Concerns

[Feedback on implementation plan]

## 6. Platform Considerations

[Review of cross-platform behavior]

## 7. Verdict

[One of: APPROVE | APPROVE_WITH_SUGGESTIONS | NEEDS_REVISION]

## 8. Actionable Feedback

[Prioritized list of specific, actionable items]

---

*This review provides feedback based on the project architecture and best practices.*
```

### Step 8: Return Summary

Display structured output:

```
========================================
DESIGN REVIEW COMPLETE
========================================

Design Document: docs/design-docs/ows-XX-[description].md
Review File: docs/reviews/ows-XX-design-review.md
Verdict: [APPROVE | APPROVE_WITH_SUGGESTIONS | NEEDS_REVISION]

Key Findings:
1. [Top finding]
2. [Second finding]
3. [Third finding]

Full review saved to: docs/reviews/ows-XX-design-review.md
```

---

## Error Handling

### Design Document Not Found
```
ERROR: Design document not found

Expected: docs/design-docs/ows-XX-*.md

Create one first: /design-doc:create OWS-XX
```

---

## Output Files

| File | Purpose |
|------|---------|
| `docs/reviews/ows-XX-design-review.md` | Full review output |

---

## Integration Notes

**Called by**: `/task:orchestrate` after `/design-doc:create` completes

**Creates**: `docs/reviews/ows-XX-design-review.md`

**Updates**: Nothing (read-only analysis)
