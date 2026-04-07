# Nexus Swarm Dashboard

AI-Powered Pipeline Simulation Dashboard built with Next.js 14.

## Features
- **3-Panel Layout**: Chat Commander, Robot Office, Device Preview
- **5 Robot Agents**: UI/UX, Frontend, Backend, QA/Security, DevOps
- **Animated Pipeline**: SVG cable data-flow animations between robot nodes
- **QA Security Loop**: XSS detection, rejection, patching, re-approval cycle
- **Device Preview**: Mobile/Tablet/Desktop responsive preview
- **Execution Tracker**: Real-time step progress tracking

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- PM2 (production)

## Setup

```bash
npm install
cp .env.local.example .env.local
# Fill in your API keys in .env.local
npm run build
npm start
```

## Environment Variables
Create `.env.local`:
```
GEMINI_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here
COHERE_API_KEY=your_key_here
MISTRAL_API_KEY=your_key_here
```

## Development
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint check
```

## Deployment
Production server runs on port 3000 via PM2:
```bash
pm2 start ecosystem.config.cjs
```
