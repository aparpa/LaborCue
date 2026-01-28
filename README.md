# Labor Cue App

A mobile application for tracking maternal heart rate variability (HRV) to detect potential early indicators of preterm labor, based on research by Jasinski et al. (2024).

##  Overview

Labor Cue uses wearable-derived HRV data to monitor pregnancy health. The app tracks the characteristic HRV inflection point that occurs approximately 7 weeks before delivery. An early inflection may indicate preterm labor risk, prompting timely medical consultation.

##  Quick Start

### Prerequisites

1. **Node.js** (v20 LTS recommended): https://nodejs.org/
2. **Git**: https://git-scm.com/
3. **VS Code** (recommended): https://code.visualstudio.com/
4. **Expo Go app** on your phone (iOS/Android)

### Setup Instructions

```bash
# 1. Clone or download this project
cd labor-cue-app

# 2. Install dependencies
npm install

# 3. Start the development server
npx expo start

# 4. Scan the QR code with Expo Go (Android) or Camera (iOS)
```

### Testing (Start Here)

If you only read one testing document, read `TESTING.md`.

It explains:
- what tests are
- how to write them
- how to run them on Windows and macOS/Linux
- how to tell if they passed or failed

### Node Version Manager (Windows + Mac/Linux)

If npm is not working or you need to switch Node versions, use a Node version manager.

**Windows (nvm-windows)**
- Download the installer: https://github.com/coreybutler/nvm-windows/releases
- Install Node 20:
```
nvm install 20
nvm use 20
node -v
```
 - Install dependencies and run tests:
```
npm install
npm run verify
```

**macOS / Linux (nvm)**
```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
nvm alias default 20
node -v
```
Then:
```
npm install
npm run verify
```

### VS Code Extensions (Recommended)

- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter
- ESLint
- React Native Tools

##  Project Structure

```
labor-cue-app/
├── App.tsx                     # Main entry point
├── ARCHITECTURE.md             # Detailed architecture documentation
├── src/
│   ├── components/             # Reusable UI components
│   │   ├── StatusCard.tsx      # Status display card
│   │   └── TrendIndicator.tsx  # HRV trend visualization
│   ├── constants/              # App-wide constants
│   │   └── index.ts            # Colors, sizes, thresholds
│   ├── context/                # React Context for state
│   │   └── UserContext.tsx     # Global user state
│   ├── navigation/             # Navigation configuration
│   │   └── AppNavigator.tsx    # Screen navigation
│   ├── screens/                # App screens
│   │   ├── SetupScreen.tsx     # First-time setup
│   │   ├── HomeScreen.tsx      # Main dashboard
│   │   ├── DataScreen.tsx      # HRV chart view
│   │   └── SettingsScreen.tsx  # User settings
│   ├── services/               # Business logic
│   │   ├── hrvAnalysis.ts      # HRV analysis algorithms
│   │   └── storage.ts          # Data persistence
│   ├── types/                  # TypeScript definitions
│   │   └── index.ts            # All type interfaces
│   └── utils/                  # Helper functions
│       └── dateUtils.ts        # Date manipulation
└── package.json
```


### Week 1: Understanding the Foundation

1. **Study `src/types/index.ts`** - Learn the data structures used throughout the app
2. **Review `src/constants/index.ts`** - Understand configurable values

### Week 2: Core Logic

3. **Analyze `src/utils/dateUtils.ts`** - Date calculations for pregnancy tracking
4. **Study `src/services/hrvAnalysis.ts`** - The core algorithm (this is the most important file!)
5. **Review `src/services/storage.ts`** - How data is saved and loaded

### Week 3: User Interface

6. **Understand `src/context/UserContext.tsx`** - State management pattern
7. **Study `src/navigation/AppNavigator.tsx`** - Navigation flow
8. **Build out screens in order**: Setup → Home → Data → Settings

### Week 4: Components & Polish

9. **Create/modify components** - StatusCard, TrendIndicator
10. **Add features** - Export functionality, notifications
11. **Test with sample data** - Use the Settings screen to add test data

## 🔬 Key Concepts from the Paper

### HRV Inflection Point

- HRV typically **decreases** from week 24 through most of pregnancy
- Approximately **7 weeks before delivery**, HRV shows an **inflection** (starts increasing)
- This inflection is tied to **time until birth**, not gestational age
- Early inflection (before ~33 weeks) may indicate preterm labor risk

### Statistical Significance

- The paper found that "weeks until birth" was a significantly better predictor than "gestational age"
- Relative log-likelihood ratios: 279.5 (term) and 859.4 (preterm) in favor of weeks-until-birth model

## Key Technologies

| Technology | Purpose | Documentation |
|------------|---------|---------------|
| React Native | Cross-platform mobile development | https://reactnative.dev/ |
| Expo | Development toolkit & deployment | https://docs.expo.dev/ |
| TypeScript | Type-safe JavaScript | https://www.typescriptlang.org/ |
| React Navigation | Screen navigation | https://reactnavigation.org/ |
| AsyncStorage | Simple data persistence | https://react-native-async-storage.github.io/ |
| SQLite | Structured data storage | https://docs.expo.dev/versions/latest/sdk/sqlite/ |

##Testing the App

Since we don't have actual wearable data yet, use the **Settings screen** to add sample test data:

1. Complete the setup flow
2. Navigate to Settings
3. Tap "Add Sample Test Data"
4. View the generated data in the Data screen

The sample data generator simulates the typical HRV pattern with a decreasing trend followed by an inflection.


## 🤝 Contributing

When contributing:

1. Create a branch for your feature
2. Write clear commit messages
3. Add comments explaining complex logic
4. Test on both iOS and Android if possible
5. Update documentation as needed

## Important Disclaimers

**This app is for informational purposes only.**

- It does NOT provide medical advice, diagnosis, or treatment
- Always consult with healthcare providers for medical decisions
- The algorithm is based on research but requires clinical validation
- Do not rely on this app for clinical decision-making

## References

1. Jasinski SR, Rowan S, Presby DM, Claydon EA, Capodilupo ER (2024). Wearable-derived maternal heart rate variability as a novel digital biomarker of preterm birth. PLoS ONE 19(1): e0295899.

2. Rowan SP, Lilly CL, Claydon EA, et al. (2022). Monitoring one heart to help two: heart rate variability and resting heart rate using wearable technology in active women across the perinatal period. BMC Pregnancy Childbirth 22, 887.

## 📧 Support

For questions about:
- **App development**: Consult React Native and Expo documentation
- **HRV analysis**: Review the research paper and `hrvAnalysis.ts`
- **Project architecture**: See `ARCHITECTURE.md`

---
