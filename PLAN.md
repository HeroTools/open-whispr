# OpenWhispr: AI-Powered Slack Webhook Integration

**Goal**: Enhance existing webhook implementation with AI-powered natural language parsing

**Timeline**: 2-3 hours focused session

**Date**: 2025-11-07

**Git Remote**: https://github.com/parthavshergill/open-whispr.git

---

## Overview

Transform the current regex-based Slack webhook command ("slack message: text") into an AI-powered natural language parser that understands flexible phrasing like:
- "slack message: deploy is complete"
- "send to slack: meeting in 5 minutes"
- "post to slack deploy complete"
- "slack: all systems operational"

---

## Current State

✅ **Already Working:**
- Webhook URL storage in .env
- IPC handlers for webhook execution (main process)
- CommandService pattern detection
- CommandToast countdown UI
- Webhook POST via HTTPS from main process

❌ **Current Limitations:**
- Fixed regex pattern: `slack message[:.;,\s]+(.+)`
- Extracts everything after trigger as message
- No intelligence in parsing
- Brittle to variations in speech

---

## Proposed Architecture

```
Voice → Whisper → "slack message deploy complete"
                        ↓
                  CommandService.detectCommand()
                  (broad pattern match)
                        ↓
                  CommandParserService.parse()
                  (AI extracts message)
                        ↓
                  { message: "deploy complete" }
                        ↓
                  executeSlackWebhook(message, webhookUrl)
                        ↓
                  Slack API (existing code)
```

---

## Implementation Plan

### Phase 1: Create CommandParserService (30 mins)

**Objective**: Build AI parsing service with configurable model support

**Task 1.1: Create CommandParserService.ts**
- File: `src/services/CommandParserService.ts` (NEW)
- Method: `parseSlackCommand(userInput, model)`
- Default model: `gemini-2.5-flash-lite`
- System prompt for message extraction
- Return: `{ message: string }`
- Error handling with fallback

**Task 1.2: Add ReasoningService Wrapper (if needed)**
- Check if `ReasoningService.processWithModel()` exists
- If not, create wrapper method
- Accept: prompt, systemPrompt, model
- Route to correct provider (Gemini/OpenAI/Anthropic)

**Commit**: `feat: add CommandParserService for AI-powered command parsing`

---

### Phase 2: Add Parser Model Settings (20 mins)

**Objective**: Allow users to configure which AI model parses commands

**Task 2.1: Update useSettings Hook**
- File: `src/hooks/useSettings.ts`
- Add: `commandParserModel` localStorage key
- Default: `"gemini-2.5-flash-lite"`

**Task 2.2: Add Settings UI**
- File: `src/components/SettingsPage.tsx`
- Section: "Command Parsing" (near Slack webhook)
- Dropdown with model options:
  - Gemini 2.5 Flash Lite (Fast & Cheap) ← Default
  - Gemini 2.5 Flash (Balanced)
  - GPT-4o Mini (Fast)
  - Claude 3.5 Haiku (Fast)
- Help text: "AI model used to understand voice commands"

**Commit**: `feat: add command parser model selection in settings`

---

### Phase 3: Integrate AI Parsing into CommandService (30 mins)

**Objective**: Replace simple regex extraction with AI parsing

**Task 3.1: Update CommandService Pattern**
- File: `src/services/CommandService.ts`
- Broaden pattern to: `/^slack.+$/i` (match anything starting with "slack")
- Keep existing countdown logic

**Task 3.2: Add AI Parsing to Execution Flow**
- In `executeCommand()`, after countdown:
  - Get parser model from settings
  - Call `CommandParserService.parseSlackCommand(text, model)`
  - Extract message from result
  - Pass to existing webhook execution

**Task 3.3: Error Handling**
- If AI parsing fails, show error toast
- Log parsing errors to console
- Provide helpful error message to user

**Commit**: `feat: integrate AI parsing into Slack command execution`

---

### Phase 4: Update App.jsx Integration (15 mins)

**Objective**: Pass parser model from settings to command execution

**Task 4.1: Get Parser Model from Settings**
- File: `src/App.jsx`
- Load `commandParserModel` from localStorage or settings
- Pass to `CommandService.executeCommand()`

**Task 4.2: Handle Parsing Errors**
- Update error handling in command flow
- Show specific error messages for parsing failures
- Update CommandToast for new error states

**Commit**: `feat: wire command parser model through App.jsx`

---

### Phase 5: Testing & Refinement (30 mins)

**Objective**: Test with various phrasings and models

**Task 5.1: Manual Testing**
- Test phrases:
  - ✓ "slack message deploy complete"
  - ✓ "send to slack meeting in 5 minutes"
  - ✓ "slack all systems operational"
  - ✓ "post to slack: test"
- Test with different models:
  - ✓ Gemini Flash Lite (default)
  - ✓ GPT-4o Mini
  - ✓ Claude Haiku
- Test error cases:
  - ✓ Invalid API key
  - ✓ Network error
  - ✓ Malformed input

**Task 5.2: Debug Logging**
- Add comprehensive logs:
  - `[CommandParser] Parsing with model: {model}`
  - `[CommandParser] Input: {userInput}`
  - `[CommandParser] Extracted message: {message}`
  - `[CommandParser] ✗ Parsing failed: {error}`

**Task 5.3: Polish**
- Improve system prompt if needed
- Adjust error messages
- Add loading states if parsing takes >1s
- Clean up console logs

**Commit**: `fix: improve command parsing reliability and error handling`

---

### Phase 6: Documentation Updates (15 mins)

**Objective**: Update docs to reflect AI parsing

**Task 6.1: Update CLAUDE.md**
- Document CommandParserService pattern
- Add example of adding new command types
- Update architecture diagrams

**Task 6.2: Update Settings Help Text**
- Add tooltip explaining command parser
- Add example voice commands
- Link to troubleshooting

**Commit**: `docs: update CLAUDE.md with AI command parsing architecture`

---

## File Changes Summary

### Files to CREATE:
1. `src/services/CommandParserService.ts` (~80 lines)

### Files to MODIFY:
1. `src/services/CommandService.ts` (~30 lines changed)
2. `src/services/ReasoningService.ts` (~20 lines added, if needed)
3. `src/hooks/useSettings.ts` (~5 lines added)
4. `src/components/SettingsPage.tsx` (~60 lines added)
5. `src/App.jsx` (~15 lines changed)
6. `CLAUDE.md` (~50 lines added)

**Total New Code**: ~260 lines

---

## Git Commit Strategy

### Atomic Commits:

1. `feat: add CommandParserService for AI-powered command parsing`
   - New file: CommandParserService.ts
   - Self-contained, fully functional service

2. `feat: add command parser model selection in settings`
   - useSettings.ts update
   - SettingsPage.tsx UI
   - User can now configure model

3. `feat: integrate AI parsing into Slack command execution`
   - CommandService.ts changes
   - Uses AI instead of regex
   - Backwards compatible

4. `feat: wire command parser model through App.jsx`
   - App.jsx changes
   - Complete integration
   - End-to-end working

5. `fix: improve command parsing reliability and error handling`
   - Bug fixes from testing
   - Error message improvements
   - Edge case handling

6. `docs: update CLAUDE.md with AI command parsing architecture`
   - Documentation updates
   - Architecture notes
   - Future maintainer guidance

### Commit Message Format:
```
<type>: <description>

<body explaining what and why>

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Testing Strategy

### Unit Testing (Manual):
- [ ] AI parsing extracts correct message
- [ ] Different models work correctly
- [ ] Settings persist across restarts
- [ ] Error handling works
- [ ] Fallback behavior is sensible

### Integration Testing:
- [ ] Voice → Transcription → Parse → Slack
- [ ] Countdown and cancel work
- [ ] Multiple commands in quick succession
- [ ] Network errors handled gracefully

### User Acceptance Testing:
- [ ] Natural phrasing works ("slack meeting at 3")
- [ ] Punctuation variations work
- [ ] Different accents/pronunciations work (via Whisper)
- [ ] Error messages are clear

---

## Success Criteria

✅ **Functional:**
- User can say "slack [message]" in natural language
- AI correctly extracts message content
- Message posts to Slack webhook
- Parser model is configurable in settings
- All existing functionality still works

✅ **Quality:**
- Code follows established patterns (CLAUDE.md)
- Comprehensive error handling
- Good debug logging
- Clean commit history

✅ **User Experience:**
- More flexible voice commands
- Clear error messages
- Settings are discoverable
- No regressions in existing features

---

## Rollback Plan

If AI parsing causes issues:
1. Git revert to last working commit
2. Feature flag: Add `useAiParsing` setting (default: false)
3. Support both regex and AI modes
4. Users can opt-in to AI parsing

---

## Future Enhancements (Out of Scope)

- [ ] Multi-webhook support (send to different channels)
- [ ] Channel name in voice command ("slack to engineering: message")
- [ ] OAuth integration (when backend is ready)
- [ ] Command history and analytics
- [ ] Voice confirmation before sending
- [ ] Rich message formatting
- [ ] Thread support

---

## Dependencies

### Existing (Already Installed):
- `@anthropic-ai/sdk`
- `@google/generative-ai`
- `openai`

### New Dependencies:
- None! We're using existing AI infrastructure

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI parsing unreliable | Medium | High | Fallback to regex, clear errors |
| Model API key missing | Low | Medium | Check for keys, show setup guide |
| Parsing too slow | Low | Medium | Use fast models (Flash Lite) |
| Breaking existing webhooks | Low | High | Careful testing, atomic commits |
| User confusion with settings | Medium | Low | Good help text, tooltips |

---

## Timeline

| Phase | Duration | Cumulative |
|-------|----------|-----------|
| Phase 1: CommandParserService | 30 min | 30 min |
| Phase 2: Settings | 20 min | 50 min |
| Phase 3: CommandService Integration | 30 min | 1h 20m |
| Phase 4: App.jsx Wiring | 15 min | 1h 35m |
| Phase 5: Testing & Polish | 30 min | 2h 5m |
| Phase 6: Documentation | 15 min | 2h 20m |
| **Total** | | **~2.5 hours** |

---

## Subagent Assignment

### Agent 1: AI Parsing Service
- Create CommandParserService.ts
- Add/verify ReasoningService.processWithModel()
- Write comprehensive tests
- **Deliverable**: Commit 1

### Agent 2: Settings UI
- Update useSettings.ts
- Add Settings UI for model selection
- Test persistence
- **Deliverable**: Commit 2

### Agent 3: Command Integration
- Update CommandService.ts
- Integrate AI parsing
- Update App.jsx
- **Deliverable**: Commits 3 & 4

### Agent 4: Testing & Polish
- Test all scenarios
- Fix bugs
- Improve error handling
- Update documentation
- **Deliverable**: Commits 5 & 6

---

## Definition of Done

- [ ] All code committed to git
- [ ] Pushed to remote: https://github.com/parthavshergill/open-whispr.git
- [ ] All tests pass
- [ ] No console errors
- [ ] Documentation updated
- [ ] User can successfully use AI parsing
- [ ] Existing webhook functionality preserved
- [ ] Clean commit history with atomic commits

---

*Plan created: 2025-11-07*
*Ready for execution: YES*
*Estimated completion: 2-3 hours*
