# Neuro - Your Mind, Visualized

A complete EEG toolkit with real-time brain monitoring, AI-powered therapy, and comprehensive analytics. Built with React, Three.js, and Firebase.

![Neuro](https://img.shields.io/badge/Neuro-EEG%20Toolkit-5AC8FA)

## Features

### 🧠 Brain - EEG Capture
- Real-time EEG data acquisition via Web Bluetooth
- Support for Muse 2/S, OpenBCI Ganglion, and generic BLE EEG devices
- Live frequency band analysis (Delta, Theta, Alpha, Beta, Gamma)
- Signal quality monitoring
- Session recording and cloud storage

### 💬 Therapist - AI Conversation
- Voice-first AI therapy interface
- EEG-aware responses that adapt to your mental state
- DeepSeek API integration for intelligent responses
- Conversation history and insights
- Real-time brain state context

### 📊 Archive - Analytics & Care
- Visual session history as a neural galaxy
- State distribution analysis
- Weekly trend tracking
- AI-generated insights
- Data export (CSV/PDF)

### 🔬 Model - Research Prediction Model
- XGBoost classifier (healthy control vs mood disorder) trained on the public BRMH EEG dataset
- Runs in the browser: the exported trees score 73 held-out subjects (80.82% on the project report's split)
- Honest evaluation: 10 x 5-fold cross-validation, balanced accuracy and ROC-AUC shown next to the held-out score
- Per-subject SHAP contributions and the four EEG biomarkers vs group medians
- Educational research demo, not a diagnostic tool

### AI Therapist setup
The therapist chat calls `/api/therapist`, a Vercel Edge Function that talks to OpenRouter.
Set `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`) in the Vercel project settings.
Without a key, the chat falls back to clearly labelled scripted replies.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript |
| 3D | Three.js + React Three Fiber |
| Styling | Tailwind CSS |
| State | Zustand |
| EEG | Web Bluetooth API |
| Processing | Web Worker + FFT |
| Database | Firebase |
| AI | DeepSeek API |

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase project (for backend)
- DeepSeek API key (optional, for AI therapist)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/neuro.git
cd neuro
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Add your Firebase and DeepSeek credentials to `.env`

5. Start development server:
```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

## Project Structure

```
neuro/
├── public/
│   └── models/          # 3D models (brain, therapist, archive)
├── src/
│   ├── components/
│   │   ├── 3d/          # Three.js components
│   │   ├── instruments/ # Full-screen interfaces
│   │   └── ui/          # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities and services
│   │   ├── firebase.ts  # Firebase configuration
│   │   └── eegBluetooth.ts # Bluetooth EEG manager
│   ├── stores/          # Zustand state stores
│   ├── types/           # TypeScript definitions
│   └── workers/         # Web Workers (FFT processing)
├── tailwind.config.js
└── vite.config.ts
```

## EEG Hardware Support

### Supported Devices
- **Muse 2 / Muse S** (Primary)
  - 4 channels (TP9, AF7, AF8, TP10)
  - 256Hz sampling rate
  
- **OpenBCI Ganglion** (Secondary)
  - 4 channels
  - 200Hz sampling rate
  
- **Generic BLE EEG**
  - Minimum 4 channels
  - 256Hz sampling rate recommended

### Connection Protocol
1. Click "Connect Headset" in the Brain interface
2. Select your EEG device from the Bluetooth pairing dialog
3. Wait for connection confirmation
4. Start recording your session

## Brain States

| State | Frequency | Description |
|-------|-----------|-------------|
| Delta | 0.5-4 Hz | Deep sleep, unconscious processing |
| Theta | 4-8 Hz | Meditation, creativity, emotional processing |
| Alpha | 8-13 Hz | Relaxation, calm focus, flow state |
| Beta | 13-30 Hz | Active thinking, potential anxiety |
| Gamma | 30-100 Hz | Peak cognition, insight, transcendence |

## Firebase Collections

### `/users/{uid}`
User profiles and preferences

### `/sessions/{sessionId}`
EEG session data and summaries

### `/conversations/{conversationId}`
Therapy conversation history

### `/analytics/{userId}`
Aggregated user analytics

## API Integration

### DeepSeek AI Therapist
The AI therapist uses DeepSeek's API to generate context-aware responses. The system prompt includes EEG state information for personalized interactions.

```typescript
// Example context sent to AI
{
  role: 'user',
  content: "How am I feeling? [Current EEG State: THETA dominant, Quality: 92%]"
}
```

## Offline Capability

- EEG recording works fully offline
- Data is buffered locally (5-minute rolling window)
- Automatic sync when connection restored
- Conflict resolution via timestamp

## Browser Support

- Chrome 89+ (recommended)
- Edge 89+
- Opera 75+

**Note:** Web Bluetooth requires HTTPS in production.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Three.js community for 3D graphics
- React Three Fiber team for React integration
- Firebase for backend infrastructure
- DeepSeek for AI capabilities

---

**Neuro** - Your mind. Finally visible.
