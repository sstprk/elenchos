# Elenchos

Elenchos is a web-based multi-LLM debate platform where users can propose a topic and watch different AI personas (modeled after famous philosophers) debate the subject in real-time. A designated "Judge" LLM evaluates each round, scoring convergence, and summarizing agreements and disagreements.

Built with [Next.js](https://nextjs.org/), React, Tailwind CSS, and Supabase.

## Overview

Elenchos explores dialectical reasoning by pitting multiple large language models against each other. Each debater acts under a specific persona and uses a distinct model, providing diverse viewpoints on the given topic. The debate proceeds in rounds, with a judge evaluating the progress towards convergence or highlighting the core disagreements.

## Features

- **Multi-LLM Debates:** Watch different models (e.g., Llama 3, Gemma 3, Nemotron) debate complex topics.
- **Philosopher Personas:** Debaters are styled as historical philosophers, each bringing their unique rhetorical approach.
- **Judge Evaluation:** An independent judge model assesses the debate, providing convergence scores (0-10) and identifying key agreements/disagreements.
- **Real-time Streaming:** Debates are streamed in real-time using Server-Sent Events (SSE) for an interactive experience.
- **User Steering:** Users can guide the direction of the debate between rounds.
- **Bring Your Own Key (BYOK):** Users can securely provide their own API keys (OpenRouter, OpenAI, Anthropic, Gemini) stored locally.
- **Authentication & History:** Optional user authentication via Supabase to save and revisit past debates.
- **Bilingual Support:** Interface available in both English and Turkish.

## Getting Started

### Prerequisites

- Node.js (v20 or newer recommended)
- npm, yarn, pnpm, or bun
- A Supabase project (if you wish to enable authentication and history features)

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

2. Set up your environment variables (see below).

3. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Configuration

Users can customize the debate parameters directly from the UI:

- **Rounds:** Set the minimum and maximum number of debate rounds.
- **Convergence Threshold:** The debate can automatically conclude if the judge's convergence score reaches a certain threshold.
- **Context Window:** Choose how much of the previous debate history is passed to the models in subsequent rounds (e.g., last round, last N rounds, or full history).
- **Debaters & Judge:** Configure which persona and which specific model each debater and the judge will use.

## Environment Variables

To run Elenchos locally, you will need to set up the following environment variables. Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Default API Keys for server-side fallback (if BYOK is not strictly enforced)
OPENROUTER_API_KEY=your_openrouter_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GEMINI_API_KEY=your_gemini_api_key
```

If you are using Supabase for the first time, make sure to apply the migrations in the `supabase/migrations` folder to set up the necessary tables for saving debates.

## How It Works (LLM Debate Functionality)

1. **Initialization:** The user submits a topic. The frontend initializes a debate session and connects to the backend via an SSE stream.
2. **Debate Rounds:**
   - **Debaters Speak:** Each configured debater generates a response based on the topic and the context of previous rounds. This is done in parallel or sequentially depending on the backend pipeline, streaming their arguments back to the client.
   - **Judge Evaluation:** After all debaters have spoken in a round, the Judge model analyzes their arguments. It produces a structured evaluation including a convergence score, rationale, agreements, and disagreements.
3. **Steering (Optional):** If the debate hasn't converged, the user may be prompted to provide "steering" (additional context, questions, or guidance) for the next round.
4. **Conclusion:** The debate ends when the maximum number of rounds is reached, or if the judge's convergence score meets or exceeds the configured threshold. The final verdict is displayed.
