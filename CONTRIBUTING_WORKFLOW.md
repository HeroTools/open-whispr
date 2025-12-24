# Contributing Workflow - OpenWhispr Fork

This document outlines the best practices for managing your fork and contributing to the upstream repository.

## Repository Setup

Your repository structure:
- **Upstream**: `HeroTools/open-whispr` (original repository)
- **Origin**: `pixelhunter1/open-whispr` (your fork)

Verify remotes:
```bash
git remote -v
# Should show:
# origin    https://github.com/pixelhunter1/open-whispr.git
# upstream  https://github.com/HeroTools/open-whispr.git
```

## Daily Workflow

### 1. Sync Your Fork's Main Branch

**Do this BEFORE starting any new work:**

```bash
# Switch to main branch
git checkout main

# Fetch latest changes from upstream
git fetch upstream

# Merge upstream changes into your main
git merge upstream/main

# Push to your fork to keep it in sync
git push origin main
```

### 2. Create a Feature Branch

**NEVER commit directly to main.** Always create a branch:

```bash
# Make sure you're on updated main
git checkout main
git pull upstream main

# Create and switch to new feature branch
git checkout -b feat/descriptive-name
# Examples:
# git checkout -b fix/translation-api
# git checkout -b feat/new-hotkey-system
# git checkout -b refactor/settings-panel
```

### 3. Make Your Changes

```bash
# Make your code changes
# ...

# Stage and commit
git add .
git commit -m "feat: descriptive commit message"

# Push to YOUR fork
git push origin feat/descriptive-name
```

### 4. Create Pull Request

```bash
# Create PR to upstream repository
gh pr create \
  --repo HeroTools/open-whispr \
  --base main \
  --head pixelhunter1:feat/descriptive-name \
  --title "Feat: Descriptive Title" \
  --body "## Summary
- What changes you made
- Why you made them
- How to test

## Test Plan
- [ ] Tested on macOS
- [ ] Tested on Windows
- [ ] Tested on Linux"
```

### 5. After PR is Merged/Closed

```bash
# Sync your main with upstream
git checkout main
git fetch upstream
git merge upstream/main
git push origin main

# Delete the feature branch locally
git branch -d feat/descriptive-name

# Delete the feature branch remotely
git push origin --delete feat/descriptive-name
```

## Branch Naming Conventions

- `feat/feature-name` - New features
- `fix/bug-name` - Bug fixes
- `refactor/area-name` - Code refactoring
- `docs/what-changed` - Documentation updates
- `perf/optimization-name` - Performance improvements
- `test/what-tested` - Adding tests

## Commit Message Format

Follow conventional commits:

```
type: short description

Longer explanation if needed.

- Bullet points for details
- Multiple changes
```

Types: `feat`, `fix`, `refactor`, `docs`, `perf`, `test`, `chore`

## Multiple Features/Fixes

If working on multiple things simultaneously:

```bash
# Feature 1
git checkout main
git checkout -b feat/feature-one
# ... work and commit ...
git push origin feat/feature-one
# Create PR #1

# Feature 2 (start from clean main)
git checkout main
git pull upstream main
git checkout -b feat/feature-two
# ... work and commit ...
git push origin feat/feature-two
# Create PR #2
```

Each feature = separate branch = separate PR = easier review!

## Common Commands Reference

```bash
# See which branch you're on
git branch

# See status of changes
git status

# See what changed
git diff

# See commit history
git log --oneline -10

# List your PRs
gh pr list --author @me

# View a specific PR
gh pr view 46

# Sync everything
git fetch --all
```

## What NOT to Do

- ❌ Don't commit directly to `main` branch
- ❌ Don't push to `main` when you have local changes
- ❌ Don't mix multiple unrelated features in one branch
- ❌ Don't force push to branches with open PRs unless necessary
- ❌ Don't work on outdated main (always sync first)

## Current Status

You currently have:
- **PR #46**: Open PR with multiple commits from `main` branch
- **Recommendation**: Let this PR get reviewed/merged, then switch to feature branch workflow

After PR #46 is resolved:
1. Sync your main: `git checkout main && git pull upstream main && git push origin main`
2. Start using feature branches for all new work

## Quick Start Checklist

For each new contribution:
- [ ] `git checkout main`
- [ ] `git pull upstream main`
- [ ] `git checkout -b feat/your-feature`
- [ ] Make changes and commit
- [ ] `git push origin feat/your-feature`
- [ ] `gh pr create --repo HeroTools/open-whispr`
- [ ] After merge: sync main and delete branch

## Questions?

- View this guide: `CONTRIBUTING_WORKFLOW.md`
- Check GitHub's fork documentation
- Review upstream project's CONTRIBUTING.md if it exists
