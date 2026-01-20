# Labor Cue App - Architecture Document

## Overview

Labor Cue is a mobile application designed to track maternal heart rate variability (HRV) during pregnancy and detect potential early indicators of preterm labor based on HRV trend inversions.

## Scientific Basis

Based on Jasinski et al. (2024), maternal HRV follows a predictable pattern during pregnancy:
- HRV generally **decreases** from week 24 through most of pregnancy
- Approximately **7 weeks before delivery**, HRV shows an **inflection point** (begins increasing)
- This inflection is tied to time-until-birth, not gestational age
- An early inflection (before ~33 weeks gestational age) may indicate preterm labor risk

## App Architecture

```
labor-cue-app/
├── App.tsx                 # Main entry point
├── src/
│   ├── navigation/
│   │   └── AppNavigator.tsx    # Navigation structure
│   │
│   ├── screens/
│   │   ├── SetupScreen.tsx     # First-time user setup
│   │   ├── HomeScreen.tsx      # Main dashboard
│   │   ├── DataScreen.tsx      # HRV graph and data view
│   │   └── SettingsScreen.tsx  # User preferences
│   │
│   ├── components/
│   │   ├── StatusCard.tsx      # HRV status display
│   │   ├── TrendIndicator.tsx  # Visual trend indicator
│   │   ├── HRVChart.tsx        # Interactive HRV graph
│   │   ├── DataPointTooltip.tsx # Tooltip for chart points
│   │   └── ExportButton.tsx    # Data export functionality
│   │
│   ├── context/
│   │   └── UserContext.tsx     # Global user state management
│   │
│   ├── services/
│   │   ├── hrvAnalysis.ts      # HRV trend analysis algorithms
│   │   ├── storage.ts          # Local data persistence
│   │   └── dataExport.ts       # Export functionality
│   │
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   │
│   ├── utils/
│   │   ├── dateUtils.ts        # Date manipulation helpers
│   │   └── colorUtils.ts       # Status color calculations
│   │
│   └── constants/
│       └── index.ts            # App-wide constants
│
├── assets/                 # Images, fonts, etc.
├── package.json
└── tsconfig.json
```

## Data Flow

```
┌─────────────────┐
│  Wearable       │
│  Device         │
└────────┬────────┘
         │ (Every 2 nights)
         ▼
┌─────────────────┐
│  Data Import    │
│  (Future: BLE)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  HRV Analysis   │◄──────── hrvAnalysis.ts
│  Service        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Local Storage  │◄──────── SQLite / AsyncStorage
│  (SQLite)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Context   │◄──────── React Context API
│  (State)        │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│ Home  │ │ Data  │
│Screen │ │Screen │
└───────┘ └───────┘
```

## Screen Specifications

### 1. Setup Screen (First Launch Only)
- **Purpose:** Collect initial user information
- **Fields:**
  - Name (optional)
  - Weeks pregnant OR estimated due date
  - Healthcare provider name (optional)
  - Healthcare provider contact (optional)
- **Actions:** Save and proceed to Home

### 2. Home Screen
- **Purpose:** Dashboard showing current status
- **Components:**
  - Welcome message with user name
  - Status Card showing:
    - Current HRV trend (increased/decreased/insufficient data)
    - Inversion status (color-coded)
    - Predicted delivery window
  - "View Data" button
- **Navigation:** Hamburger menu to other screens

### 3. Data Screen
- **Purpose:** Detailed HRV visualization
- **Components:**
  - Interactive line chart (HRV vs Date)
  - Clickable data points with tooltips
  - Trend line (shown after sufficient data)
  - Export button
- **Features:**
  - Pan and zoom on chart
  - Data point details on tap
  - Export to PDF/CSV

### 4. Settings Screen
- **Purpose:** Modify user preferences
- **Options:**
  - Edit profile information
  - Notification preferences
  - Data management (clear, backup)
  - About/Help

## HRV Analysis Logic

### Status Categories

```typescript
enum InversionStatus {
  ON_TRACK = 'on_track',           // No inversion detected, proceeding normally
  POSSIBLE_INVERSION = 'possible', // Early signs, low confidence
  PROBABLE_INVERSION = 'probable'  // High confidence inversion detected
}
```

### Color Coding
- **Green:** On track (no inversion before expected)
- **Yellow:** Possible inversion (needs monitoring)
- **Red:** Probable inversion (consult physician)

### Trend Detection Algorithm (Simplified)

1. **Minimum Data Requirement:** At least 2 weeks of data (7+ data points)
2. **Trend Calculation:** 
   - Calculate 7-day rolling average
   - Compare current week average to previous week
   - Detect sustained increase (3+ consecutive higher averages)
3. **Inversion Detection:**
   - If trend was decreasing and now increasing for 2+ weeks
   - Compare timing to expected 33-week gestational threshold
   - Calculate confidence based on data consistency

```typescript
function detectInversion(hrvData: HRVReading[]): InversionResult {
  // Require minimum data points
  if (hrvData.length < 7) {
    return { status: 'insufficient_data' };
  }
  
  // Calculate rolling averages
  const weeklyAverages = calculateWeeklyAverages(hrvData);
  
  // Detect trend change
  const trendChange = findTrendInflection(weeklyAverages);
  
  // Determine status based on gestational age at inflection
  if (trendChange && trendChange.gestationalWeek < 30) {
    return { status: 'probable', confidence: 'high' };
  } else if (trendChange && trendChange.gestationalWeek < 33) {
    return { status: 'possible', confidence: 'medium' };
  }
  
  return { status: 'on_track' };
}
```

## Data Storage Schema

### User Profile
```typescript
interface UserProfile {
  id: string;
  name?: string;
  pregnancyStartDate: Date;    // Calculated from weeks pregnant
  estimatedDueDate: Date;
  healthcareProvider?: {
    name: string;
    contact: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### HRV Reading
```typescript
interface HRVReading {
  id: string;
  timestamp: Date;
  hrvValue: number;            // RMSSD in milliseconds
  gestationalWeek: number;     // Calculated from pregnancy start
  source: 'manual' | 'device';
  metadata?: {
    sleepQuality?: number;
    notes?: string;
  };
}
```

## Future Considerations

### Bluetooth Integration
When ready to integrate with actual wearable device:
```typescript
// Placeholder for BLE integration
interface DeviceConnection {
  connect(): Promise<void>;
  disconnect(): void;
  syncData(): Promise<HRVReading[]>;
  getDeviceInfo(): DeviceInfo;
}
```

### Data Export Formats
- **CSV:** For healthcare providers to import into their systems
- **PDF:** Formatted report with graphs for consultations
- **FHIR:** Future standard for health data interoperability

## Security Considerations

- All health data stored locally on device
- Optional cloud backup with encryption
- Healthcare provider sharing requires explicit consent
- No analytics on health data without permission

## Testing Strategy

1. **Unit Tests:** HRV analysis algorithms
2. **Component Tests:** UI component behavior
3. **Integration Tests:** Data flow and storage
4. **Manual Testing:** User experience validation

## Development Phases

### Phase 1: Core Functionality
- [ ] Project setup with Expo
- [ ] Navigation structure
- [ ] Setup screen
- [ ] Basic home screen with mock data
- [ ] Local storage implementation

### Phase 2: Data Visualization
- [ ] HRV chart component
- [ ] Interactive data points
- [ ] Trend line calculation
- [ ] Status indicators

### Phase 3: Analysis Features
- [ ] HRV trend analysis
- [ ] Inversion detection
- [ ] Status color coding
- [ ] Confidence calculations

### Phase 4: Polish & Export
- [ ] Data export functionality
- [ ] Settings screen
- [ ] Error handling
- [ ] UI/UX refinement

### Phase 5: Device Integration (Future)
- [ ] Bluetooth connectivity
- [ ] Automatic data sync
- [ ] Real device testing
