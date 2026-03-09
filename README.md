<p align="center">
  <h1 align="center">🐄 Pashu Aadhaar — AI-Powered Livestock Identity Platform</h1>
  <p align="center">
    A production-grade, full-stack digital identity system for livestock in rural India.<br/>
    Muzzle-print biometrics · GenAI Veterinary Copilot · Fraud Detection · Outbreak Monitoring
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.2-61DAFB?logo=react" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-5.2-3178C6?logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/AWS_SAM-Serverless-FF9900?logo=amazonaws" alt="AWS SAM"/>
  <img src="https://img.shields.io/badge/Amazon_Bedrock-Nova_Lite-232F3E?logo=amazonaws" alt="Bedrock"/>
  <img src="https://img.shields.io/badge/DynamoDB-NoSQL-4053D6?logo=amazondynamodb" alt="DynamoDB"/>
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License"/>
</p>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [AI & ML Pipeline](#ai--ml-pipeline)
- [Fraud Detection System](#fraud-detection-system)
- [Seed Data](#seed-data)
- [Internationalization](#internationalization)
- [License](#license)

---

## Overview

**Pashu Aadhaar** (पशु आधार — "Animal Identity") creates unique biometric identities for cattle using deep-learning-based muzzle-print recognition, analogous to fingerprints for humans. The platform serves **six stakeholder roles** — farmers, enrollment agents, veterinarians, insurance companies, banks, and government agencies — each with tailored dashboards, workflows, and access controls.

The system combines **computer vision** (YOLOv8 + custom muzzle detection running in-browser via ONNX Runtime), **vector similarity search** (SageMaker CLIP embeddings + OpenSearch), and **generative AI** (Amazon Bedrock Nova Lite) to deliver a comprehensive livestock management ecosystem.

---

## Key Features

### 🔐 Biometric Enrollment & Verification
- **In-browser YOLOv8 cow detection** and **custom muzzle detection** via ONNX Runtime Web — zero server cost for inference
- **Multi-step agent enrollment workflow** with guided capture (cow → muzzle → body texture → agent selfie)
- **Real-time detection overlays** with bounding boxes and confidence scores
- **SageMaker CLIP embeddings** for muzzle-print vectorization (80% muzzle + 15% body + 5% texture weighting)
- **OpenSearch cosine similarity** matching with 0.85 threshold for identity verification
- GPS location tracking, device fingerprinting, and video recording during enrollment

### 🤖 GenAI Veterinary Copilot
- **AI Vet Assistant** — ask animal health questions, get expert veterinary advice powered by Amazon Bedrock (Nova Lite)
- **AI Chat Mode** — contextual conversations with animal health data awareness
- **Voice-to-Voice Communication** — speak queries via microphone (Web Speech API), hear AI responses auto-read aloud (SpeechSynthesis)
- **Floating Chatbot Widget** — persistent AI copilot accessible from any page, expand/minimize, unread badge

### 📋 AI Health Report Generator
- One-click **comprehensive health report** generation from stored animal data
- Aggregates health records, milk yields, insurance status, and enrollment metadata
- Professional structured report with AI-powered analysis, concerns, and recommendations
- Text-to-speech playback of full report

### 🦠 Disease Outbreak Monitoring
- **Automated outbreak detection** via EventBridge (scans every 10 minutes)
- Clusters health records by disease, location, and time window
- AI-generated risk assessments and containment recommendations
- Manual scan trigger for on-demand analysis

### 🛡️ Fraud Detection & Scoring
- **Five sub-score system** (0–100): agent behavior, device trust, location consistency, image quality, duplicate embedding
- Risk levels: Low / Medium / High / Critical
- **"Why this score?" modal** — detailed breakdown with visual sub-score bars (admin/government only)
- Fraud score hidden from owner, agent, and veterinarian roles

### 📊 Government Analytics Dashboard
- State-wise enrollment heatmap on interactive India SVG map
- Breed distribution, enrollment trends, fraud analytics, agent performance
- Summary metrics with Recharts-powered visualizations

### 💼 Additional Features
- **Insurance management** — policy creation, tracking, and claims
- **Loan collateral tracking** — animals as bank loan collateral
- **Milk yield recording** — daily production tracking with analytics
- **QR code generation & scanning** — instant animal identification
- **Role-based access control** — 6 roles with granular permissions
- **Access request system** — farmers can grant/revoke data access to other stakeholders
- **Multi-language support** — 7 languages (English, Hindi, Telugu, Tamil, Kannada, Marathi, Bengali)
- **Voice accessibility toggle** — global text-to-speech for all content

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CloudFront CDN                              │
│                    (S3 Static Website Hosting)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   React 18 + TypeScript + Vite                                      │
│   ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌───────────────┐   │
│   │ ONNX     │  │ Web Speech│  │ Cognito    │  │ Chatbot       │   │
│   │ Runtime  │  │ API       │  │ Auth       │  │ Widget        │   │
│   │ (YOLOv8) │  │ (Voice)   │  │ (JWT)      │  │ (AI Copilot)  │   │
│   └──────────┘  └───────────┘  └─────┬──────┘  └───────────────┘   │
│                                       │                             │
├──────────────────────────────────────┼──────────────────────────────┤
│              API Gateway (REST)  +  Cognito Authorizer              │
├──────────────────────────────────────┼──────────────────────────────┤
│                                       │                             │
│   AWS Lambda Functions (Node.js 20.x, esbuild)                     │
│   ┌───────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────┐   │
│   │ Enroll    │ │ Animals  │ │ GenAI     │ │ Outbreak Monitor │   │
│   │ (SageMaker│ │ (CRUD +  │ │ (Bedrock  │ │ (EventBridge     │   │
│   │ + Search) │ │ health)  │ │ Nova Lite)│ │  scheduled)      │   │
│   └─────┬─────┘ └────┬─────┘ └─────┬─────┘ └────────┬─────────┘   │
│         │            │             │                │               │
├─────────┼────────────┼─────────────┼────────────────┼───────────────┤
│         ▼            ▼             ▼                ▼               │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐      │
│   │ SageMaker│ │ DynamoDB │ │ Bedrock  │ │ EventBridge     │      │
│   │ (CLIP)   │ │ (13+     │ │ (Nova    │ │ (10-min cron)   │      │
│   └────┬─────┘ │ tables)  │ │ Lite)    │ └─────────────────┘      │
│        │       └──────────┘ └──────────┘                           │
│        ▼                                                            │
│   ┌──────────┐  ┌──────────┐                                       │
│   │OpenSearch│  │ S3       │                                        │
│   │(vectors) │  │ (images) │                                        │
│   └──────────┘  └──────────┘                                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18.2 · TypeScript 5.2 · Vite 5.1 |
| **Backend** | AWS Lambda (Node.js 20.x) · esbuild · AWS SAM |
| **Database** | Amazon DynamoDB (13+ tables) |
| **Auth** | Amazon Cognito (User Pool + JWT Authorizer) |
| **AI/ML** | Amazon Bedrock (Nova Lite v1:0) · SageMaker (CLIP embeddings) · YOLOv8n (ONNX Runtime Web) |
| **Search** | Amazon OpenSearch (cosine kNN vectors) |
| **Storage** | Amazon S3 (images + static site) |
| **CDN** | Amazon CloudFront |
| **Scheduling** | Amazon EventBridge (10-min outbreak scans) |
| **Observability** | AWS X-Ray (active tracing on all Lambdas) |
| **Charting** | Recharts 3.8 |
| **Voice** | Web Speech API (SpeechRecognition + SpeechSynthesis) |
| **i18n** | 7 languages — English, Hindi, Telugu, Tamil, Kannada, Marathi, Bengali |

---

## Project Structure

```
Pashu-Aadhar-AI/
├── template.yaml              # AWS SAM — all infrastructure (Lambda, API GW, DynamoDB, IAM, etc.)
├── samconfig.toml             # SAM deployment config (stack name, region, params)
├── deploy.sh                  # Frontend → S3 + CloudFront deploy script
│
├── frontend/                  # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── AgentLiveCapture/   # Real-time YOLOv8 detection overlay
│   │   │   ├── AgentStepCapture    # Multi-step guided enrollment
│   │   │   ├── CameraCapture/      # Camera photo capture
│   │   │   ├── ChatbotWidget       # Floating AI copilot (global)
│   │   │   ├── EnrollmentResult/   # Enrollment result display
│   │   │   ├── ImageUpload/        # Drag-and-drop upload
│   │   │   ├── IndiaMap/           # SVG India heatmap
│   │   │   ├── LanguageSelector/   # 7-language picker
│   │   │   ├── QRCodeCard          # QR code generator
│   │   │   ├── QRScanner           # QR code scanner
│   │   │   ├── SpeakButton         # Text-to-speech button
│   │   │   └── VoiceToggle         # Voice accessibility toggle
│   │   ├── pages/
│   │   │   ├── Home.tsx            # Landing page
│   │   │   ├── Login.tsx / Signup.tsx
│   │   │   ├── Dashboard.tsx       # Farmer dashboard
│   │   │   ├── Enrollment.tsx      # Quick enrollment
│   │   │   ├── AgentEnrollment.tsx # Agent multi-step workflow
│   │   │   ├── AnimalDetail.tsx    # Full animal profile
│   │   │   ├── AnimalVerification  # Identity verification
│   │   │   ├── AiAssistant.tsx     # GenAI Vet + Chat + Voice
│   │   │   ├── OutbreakAlerts.tsx  # Disease monitoring
│   │   │   ├── GovDashboard.tsx    # Government analytics
│   │   │   └── Profile.tsx         # User profile
│   │   ├── hooks/                  # useAnimalDetection, useCowDetection, useMuzzleDetection
│   │   ├── services/               # api.ts, auth.ts, s3.ts
│   │   ├── context/                # AuthContext, LanguageContext, VoiceContext
│   │   ├── i18n/                   # Translation files (7 languages)
│   │   ├── config/                 # Enrollment config, model weights
│   │   └── styles/                 # Component CSS
│   └── public/models/              # ONNX models (YOLOv8, muzzle, cow)
│
├── backend/                   # Lambda function handlers
│   ├── getUploadUrl/          # Presigned S3 URL generation
│   ├── enroll/                # SageMaker embedding + OpenSearch enrollment
│   ├── animals/               # CRUD: animals, health, milk, insurance, loans
│   ├── profile/               # User profile (Cognito + DynamoDB)
│   ├── post-confirmation/     # Cognito trigger — auto-create owner record
│   ├── access-requests/       # Access request management
│   ├── enrollment-sessions/   # Full enrollment workflow engine
│   ├── analytics/             # Government dashboard aggregations
│   ├── genai/                 # AI Assistant, Chat, Health Reports, Fraud Reasons, Outbreaks
│   └── shared/                # Constants, utilities, fraud config
│
├── seed-data/                 # DynamoDB seeding (300 animals, 20 states, 16 breeds)
├── local-server/              # Mock API for offline development
├── scripts/                   # Setup: Cognito users, OpenSearch, SageMaker, ONNX conversion
└── images/                    # Training data (Face/Muzzle splits)
```

---

## Getting Started

### Prerequisites

- **Node.js 20+** and **npm 9+**
- **AWS CLI** configured (`aws configure`)
- **AWS SAM CLI** — [Install guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)

### Local Development (No AWS Required)

The included `local-server` mocks all AWS services (S3, SageMaker, OpenSearch) so you can develop the full UI flow without cloud credentials.

```bash
# Install all workspace dependencies
npm run install:all

# Start mock API (port 3001) + Vite dev server (port 3000)
npm run dev
```

Open **http://localhost:3000** in your browser.

### Manual Start (Two Terminals)

```bash
# Terminal 1 — Mock API
cd local-server && npm install && npm start

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev
```

---

## Deployment

### Backend (AWS SAM)

```bash
# Build all Lambda functions
sam build

# First-time deploy (interactive)
sam deploy --guided

# Subsequent deploys
sam deploy --no-confirm-changeset
```

**SAM Parameters:**

| Parameter | Description |
|-----------|-------------|
| `Stage` | Environment (`prod`) |
| `S3BucketName` | Animal image storage bucket |
| `SageMakerEndpointName` | CLIP embedding endpoint |
| `OpenSearchEndpoint` | Vector search domain URL |
| `AllowedOrigin` | CloudFront domain for CORS |
| `CognitoUserPoolId` | Cognito User Pool ID |
| `CognitoUserPoolArn` | Cognito User Pool ARN |

### Frontend (S3 + CloudFront)

```bash
cd frontend
npm run build

# Sync to S3 with caching
aws s3 sync dist/ s3://pashu-aadhaar-website-prod \
  --exclude "index.html" --cache-control "max-age=31536000"
aws s3 cp dist/index.html s3://pashu-aadhaar-website-prod/index.html \
  --cache-control "no-cache"

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> --paths "/*"
```

---

## API Reference

### Upload & Enrollment
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/upload-url` | Presigned S3 URL for image upload |
| `POST` | `/enroll` | Enroll animal (SageMaker + OpenSearch) |
| `POST` | `/verify` | Verify identity by photo |

### Animals CRUD
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/animals` | List animals |
| `GET/POST` | `/animals/{id}` | Get / update animal |
| `GET/POST` | `/animals/{id}/health` | Health records |
| `GET/POST` | `/animals/{id}/milk` | Milk yield records |
| `GET/POST` | `/animals/{id}/insurance` | Insurance policies |
| `GET/POST` | `/animals/{id}/loans` | Loan collateral |

### Enrollment Workflow
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/enrollment-requests` | Create enrollment request |
| `GET` | `/enrollment-requests` | List requests |
| `POST` | `/enrollment-requests/{id}/accept` | Agent accepts request |
| `POST/GET` | `/enrollment-sessions` | Create/list sessions |
| `POST` | `/enrollment-sessions/{id}/step` | Submit enrollment step |
| `POST` | `/enrollment-sessions/{id}/complete` | Finalize enrollment |

### Access Control
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/access-requests` | Request access to animal data |
| `GET` | `/access-requests` | List sent requests |
| `GET` | `/access-requests/incoming` | List incoming requests |
| `POST` | `/access-requests/{id}/resolve` | Approve/deny request |

### Analytics (Government)
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/analytics/summary` | Overview metrics |
| `GET` | `/analytics/states` | State-wise enrollment |
| `GET` | `/analytics/trends` | Enrollment trends |
| `GET` | `/analytics/breeds` | Breed distribution |
| `GET` | `/analytics/fraud` | Fraud statistics |
| `GET` | `/analytics/agents` | Agent performance |

### GenAI
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/ai-assistant` | AI Vet Assistant query |
| `POST` | `/ai-chat` | Conversational AI chat |
| `GET` | `/ai-assistant/outbreaks` | Get active outbreak alerts |
| `POST` | `/ai-assistant/outbreaks/scan` | Trigger outbreak scan |
| `GET` | `/ai/animal-report/{animal_id}` | Generate AI health report |
| `GET` | `/ai/fraud-reasons/{animal_id}` | Fraud score breakdown (admin/gov) |

### Profile
| Method | Route | Description |
|--------|-------|-------------|
| `GET/POST` | `/me` | Get / update user profile |

---

## AI & ML Pipeline

### In-Browser Detection (Zero Server Cost)
1. **YOLOv8n** — detects cow presence in camera feed via ONNX Runtime Web
2. **Custom Muzzle Model** — locates muzzle region within detected cow
3. Both models run entirely in the browser — no API calls needed

### Server-Side Processing
4. **SageMaker CLIP** — generates 512-dimension embedding vectors from muzzle images
5. **OpenSearch kNN** — cosine similarity search against enrolled embeddings (threshold: 0.85)

### Embedding Weights
| Source | Weight |
|--------|--------|
| Muzzle print | 80% |
| Cow body | 15% |
| Body texture | 5% |

### GenAI (Amazon Bedrock — Nova Lite v1:0)
- **Vet Assistant** — contextual veterinary advice
- **Chat Mode** — multi-turn conversations
- **Health Reports** — structured analysis from DynamoDB records
- **Outbreak Analysis** — AI-powered risk assessment and containment recommendations
- **Fraud Explanations** — human-readable reasons for fraud scores

---

## Fraud Detection System

Five sub-scores combined into `fraud_risk_score` (0–100):

| Sub-Score | What It Measures |
|-----------|------------------|
| `agent_behavior_score` | Enrollment rate limiting, suspicious patterns |
| `device_trust_score` | Device fingerprint reuse across accounts |
| `location_consistency_score` | GPS coordinates vs registered address |
| `image_quality_score` | Detection confidence scores during capture |
| `duplicate_embedding_score` | Similarity to previously enrolled animals |

**Risk Levels:** Low (0–25) · Medium (26–50) · High (51–75) · Critical (76–100)

Fraud scores are **only visible to government and admin roles**. A detailed "Why this score?" modal shows sub-score breakdown with visual progress bars.

---

## Seed Data

The `seed-data/` module populates all 13+ DynamoDB tables with realistic Indian-context data:

- **300 animals** across 20 Indian states, 16 breeds
- **75+ farmers**, 10 agents, veterinarians, insurers
- Health records, milk yields, insurance policies, loan collateral
- Breed-state affinity mapping (70% native breed probability)

```bash
cd seed-data
npm install

# Dry run (preview only)
npm run seed:dry-run

# Seed all tables
npm run seed

# Seed with embeddings
npm run seed:embeddings

# Clear all data
npm run clear:all
```

---

## Internationalization

The platform supports **7 languages** with full UI translations:

| Language | Code |
|----------|------|
| English | `en` |
| Hindi | `hi` |
| Telugu | `te` |
| Tamil | `ta` |
| Kannada | `kn` |
| Marathi | `mr` |
| Bengali | `bn` |

Users can switch languages via the language selector in the navigation bar. Voice accessibility (text-to-speech) works across all supported languages.

---

## Role-Based Access Control

| Role | Capabilities |
|------|-------------|
| **Farmer (owner)** | Register animals, view own animals, track milk/health, request enrollment |
| **Agent** | Accept enrollment requests, conduct multi-step enrollment sessions |
| **Veterinarian** | View animal health data, add health records, AI assistant |
| **Insurance** | View insured animals, manage policies, fraud score access |
| **Bank** | View loan collateral animals |
| **Government** | Full analytics dashboard, all animals, fraud scoring, outbreak monitoring |
| **Admin** | Full system access, all roles combined |

---

## License

This project is licensed under the [MIT License](LICENSE).

