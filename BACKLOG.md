# Labor Cue App - Product Backlog

This document organizes all development tasks into an Agile-style backlog with epics, user stories, and acceptance criteria.

## How to Use This Backlog

1. **Pick stories from the current sprint** (start with Sprint 1)
2. **Assign stories to team members** based on skill level and interest
3. **Track progress** by moving stories through: To Do → In Progress → Review → Done
4. **Point values** indicate relative complexity (1=easy, 8=complex)

---

##  EPIC 1: Core Infrastructure
*Foundation work that other features depend on*

### Sprint 1 (Recommended Starting Point)

| Story ID | Title | Points | Priority | File | Assignee |
|----------|-------|--------|----------|------|----------|
| STORY-405 | Create unit tests for analysis functions | 5 | High | `hrvAnalysis.ts` | |
| STORY-801 | Add date picker for due date input | 2 | High | `SetupScreen.tsx` | Emma|
| STORY-802 | Add inline form validation feedback | 2 | High | `SetupScreen.tsx` |Emma |
| STORY-601 | Add error state management to context | 3 | High | `UserContext.tsx` |Roshni |
| STORY-1203 | Add accessibility labels to StatusCard | 2 | High | `StatusCard.tsx` |Leah |

**Sprint 1 Total: 14 points**

---

### Sprint 2

| Story ID | Title | Points | Priority | File | Assignee |
|----------|-------|--------|----------|------|------|
| STORY-401 | Implement sophisticated trend detection | 8 | High | `hrvAnalysis.ts` | Roshni |
| STORY-904 | Time since last reading indicator | 2 | High | `HomeScreen.tsx` |Leah |
| STORY-1001 | Pinch-to-zoom on chart | 5 | High | `DataScreen.tsx` |Aditya |
| STORY-1002 | Add trend line overlay to chart | 3 | High | `DataScreen.tsx` | Leah|

**Sprint 2 Total: 18 points**

---

##  EPIC 2: Data Visualization & Analysis
*Improving how users see and understand their data*

| Story ID | Title | Points | Priority | File | Assignee |
|----------|-------|--------|----------|------|----------|
| STORY-402 | Add confidence intervals to predictions | 5 | High | `hrvAnalysis.ts` | |
| STORY-406 | Implement spline model from paper | 8 | High | `hrvAnalysis.ts` | |
| STORY-1003 | Highlight inflection point on chart | 3 | High | `DataScreen.tsx` |Roshni|
| STORY-1005 | Expected vs actual comparison view | 5 | Medium | `DataScreen.tsx` | |
| STORY-903 | Mini HRV sparkline on home screen | 3 | Medium | `HomeScreen.tsx` | |
| STORY-1009 | Statistical summary panel | 3 | Medium | `DataScreen.tsx` |Roshni |
| STORY-1302 | Show percentage change in trend | 2 | Medium | `TrendIndicator.tsx` |Faduma |
| STORY-1303 | Mini sparkline in trend indicator | 3 | Medium | `TrendIndicator.tsx` | |
| STORY-1004 | Date range filter for chart | 3 | Medium | `DataScreen.tsx` | |

---

##  EPIC 3: User Experience Improvements
*Making the app easier and more pleasant to use*

| Story ID | Title | Points | Priority | File | Assignee |
|----------|-------|--------|----------|------|----------|
| STORY-803 | Multi-step setup with progress bar | 3 | Medium | `SetupScreen.tsx` | |
| STORY-806 | Keyboard avoiding improvements | 2 | Medium | `SetupScreen.tsx` | |
| STORY-704 | Onboarding tutorial carousel | 3 | Medium | `AppNavigator.tsx` | |
| STORY-905 | Educational tooltips (coach marks) | 3 | Medium | `HomeScreen.tsx` | |
| STORY-902 | Animated status transitions | 3 | Medium | `HomeScreen.tsx` | |
| STORY-702 | Custom drawer with user info | 3 | Medium | `AppNavigator.tsx` | |
| STORY-1201 | Pulse animation for urgent status | 2 | Medium | `StatusCard.tsx` | |
| STORY-1008 | Improved tooltip positioning | 2 | Medium | `DataScreen.tsx` | |
| STORY-602 | Optimistic updates in context | 3 | Medium | `UserContext.tsx` | |

---

##  EPIC 4: Data Export & Sharing
*Helping users share data with healthcare providers*

| Story ID | Title | Points | Priority | File | Assignee |
|----------|-------|--------|----------|------|----------|
| STORY-506 | PDF export with charts | 5 | High | `storage.ts` | |
| STORY-1007 | Shareable chart image | 3 | Medium | `DataScreen.tsx` | |
| STORY-1104 | Healthcare provider management | 3 | Medium | `SettingsScreen.tsx` | |
| STORY-504 | Import data from CSV/JSON | 3 | Medium | `storage.ts` | |

---

##  EPIC 5: Device Integration (Future Phase)
*Bluetooth connectivity with wearable device*

| Story ID | Title | Points | Priority | File | Assignee |
|----------|-------|--------|----------|------|----------|
| STORY-103 | BLE communication types | 5 | High | `types/index.ts` | |
| STORY-1101 | Device pairing UI | 8 | High | `SettingsScreen.tsx` | |
| STORY-1102 | Notification scheduling | 5 | High | `SettingsScreen.tsx` | |

---

##  EPIC 6: Data Security & Privacy
*Protecting user health data*

| Story ID | Title | Points | Priority | File | Assignee |
|----------|-------|--------|----------|------|----------|
| STORY-501 | Data encryption at rest | 5 | High | `storage.ts` | |
| STORY-1108 | Account deletion flow | 2 | High | `SettingsScreen.tsx` | |
| STORY-1103 | Privacy policy links | 1 | High | `SettingsScreen.tsx` | |
| STORY-502 | Cloud backup functionality | 8 | Medium | `storage.ts` | |
| STORY-1106 | Manual backup/restore | 5 | Medium | `SettingsScreen.tsx` | |

---

##  EPIC 7: Polish & Extras
*Nice-to-have features*

| Story ID | Title | Points | Priority | File | Assignee |
|----------|-------|--------|----------|------|----------|
| STORY-201 | Dark mode color palette | 2 | Low | `constants/index.ts` | |
| STORY-1105 | Theme selection UI | 3 | Low | `SettingsScreen.tsx` | |
| STORY-907 | Pregnancy milestone celebrations | 2 | Low | `HomeScreen.tsx` | |
| STORY-303 | Pregnancy milestone calculator | 2 | Low | `dateUtils.ts` | |
| STORY-1006 | Data point annotations | 3 | Low | `DataScreen.tsx` | |
| STORY-906 | Quick action buttons | 2 | Low | `HomeScreen.tsx` | |
| STORY-703 | Screen transition animations | 2 | Low | `AppNavigator.tsx` | |
| STORY-701 | Deep linking support | 3 | Low | `AppNavigator.tsx` | |
| STORY-1204 | Status history timeline | 3 | Low | `StatusCard.tsx` | |
| STORY-603 | Undo functionality for deletions | 3 | Low | `UserContext.tsx` | |
| STORY-1109 | Manual HRV entry form | 3 | Medium | `SettingsScreen.tsx` | |

---

##  Unlisted Stories (From Code TODOs)
*These stories are referenced in code comments but are not yet placed into an epic.*

| Story ID | Title | Priority/Points | File |
|----------|-------|-----------------|------|
| STORY-101 | Validation schemas | TBD (see `src/types/index.ts`) | `src/types/index.ts` |
| STORY-102 | Internationalization (i18n) types | TBD (see `src/types/index.ts`) | `src/types/index.ts` |
| STORY-202 | Configurable analysis thresholds | TBD (see `src/constants/index.ts`) | `src/constants/index.ts` |
| STORY-203 | Accessibility constants | TBD (see `src/constants/index.ts`) | `src/constants/index.ts` |
| STORY-301 | Timezone handling | TBD (see `src/utils/dateUtils.ts`) | `src/utils/dateUtils.ts` |
| STORY-302 | Import date range validation | TBD (see `src/utils/dateUtils.ts`) | `src/utils/dateUtils.ts` |
| STORY-403 | Individual baseline adjustment | TBD (see `src/services/hrvAnalysis.ts`) | `src/services/hrvAnalysis.ts` |
| STORY-404 | Outlier detection | TBD (see `src/services/hrvAnalysis.ts`) | `src/services/hrvAnalysis.ts` |
| STORY-503 | Data migrations | TBD (see `src/services/storage.ts`) | `src/services/storage.ts` |
| STORY-505 | Data compression | TBD (see `src/services/storage.ts`) | `src/services/storage.ts` |
| STORY-604 | Split contexts | TBD (see `src/context/UserContext.tsx`) | `src/context/UserContext.tsx` |
| STORY-605 | Sync status indicator | TBD (see `src/context/UserContext.tsx`) | `src/context/UserContext.tsx` |
| STORY-805 | Health app import | TBD (see `src/screens/SetupScreen.tsx`) | `src/screens/SetupScreen.tsx` |
| STORY-901 | Pull-to-refresh haptics | TBD (see `src/screens/HomeScreen.tsx`) | `src/screens/HomeScreen.tsx` |
| STORY-1107 | Contact support | TBD (see `src/screens/SettingsScreen.tsx`) | `src/screens/SettingsScreen.tsx` |
| STORY-1202 | Expandable status card | TBD (see `src/components/StatusCard.tsx`) | `src/components/StatusCard.tsx` |
| STORY-1301 | Animated trend arrow | TBD (see `src/components/TrendIndicator.tsx`) | `src/components/TrendIndicator.tsx` |

---

##  Story Point Summary

| Epic | Total Points | Story Count |
|------|-------------|-------------|
| Core Infrastructure | 14 | 5 |
| Data Visualization | 35 | 9 |
| User Experience | 24 | 9 |
| Export & Sharing | 14 | 4 |
| Device Integration | 18 | 3 |
| Security & Privacy | 21 | 5 |
| Polish & Extras | 28 | 11 |
| **TOTAL** | **154** | **46** |

---

##  Recommended Team Assignments

### For Beginners (1-2 point stories)
- STORY-1203: Accessibility labels
- STORY-1103: Privacy policy links
- STORY-804: Skip option for optional fields
- STORY-1304: Horizontal trend indicator variant

### For Intermediate (2-3 point stories)
- STORY-801: Date picker component
- STORY-802: Form validation UI
- STORY-904: Time since last reading
- STORY-1002: Trend line overlay
- STORY-1302: Percentage change display

### For Advanced (5-8 point stories)
- STORY-401: Sophisticated trend detection
- STORY-406: Spline model implementation
- STORY-501: Data encryption
- STORY-1001: Pinch-to-zoom chart
- STORY-1101: Device pairing UI

---

##  Story Template

When working on a story, create a branch and use this template for your PR:

```markdown
## Story: [STORY-XXX] Title

### Description
Brief description of what this story accomplishes.

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

### Technical Notes
Any technical considerations or decisions made.

### Testing
How to test this feature.

### Screenshots
(If applicable)
```

---

##  Sprint Planning Tips

1. **Velocity**: Start with 15-20 points per sprint for a small team
2. **Mix difficulties**: Include 1-2 easy stories for quick wins
3. **Dependencies**: Check if stories depend on others being done first
4. **Balance**: Mix frontend (screens/components) with backend (services) work
5. **Review together**: Do code reviews to learn from each other
