# Strata — AI-Powered Document Intelligence Platform

**Strata** is an enterprise-grade document intelligence application that transforms unstructured business documents (PDFs, invoices, receipts, contracts, resumes) into structured, queryable data using multi-modal AI, schema-driven containers, confidence verification, and vector-based semantic search.

---

## 🚀 Key Features

* **Overview Landing Screen**: Highlighting the problem of document chaos vs. Strata's automated intelligence containers, complete with an interactive onboarding flow.
* **Smart Document Containers**: Organize document types (Invoices, Contracts, Resumes, Tax Forms) into dedicated containers with custom field schema definitions.
* **Multi-Modal AI Extractions**: Integrates Mistral OCR & LLM structuring to automatically parse key-value pairs, target labels, confidence scores, and source text bounding spans.
* **4-Step Guided Extraction Wizard**:
  1. **Upload**: Drag-and-drop file ingestion into Supabase Storage.
  2. **Extract**: Automated OCR processing & LLM structuring.
  3. **Verify**: Field-level confidence flags (`high` vs `review`) with interactive source text highlights and audit trails.
  4. **Publish**: Save verified records to the structured database.
* **Dual-Mode Query Engine**:
  * **Structured SQL Filters**: Filter fields by key-value parameters.
  * **Semantic Vector Search**: Powered by `pgvector` and Voyage AI (`voyage-3`) 1024-dimensional embeddings for natural language search across document contents.
* **Modern UI & Themes**:
  * **Collapsible Side Navigation**: Persistent state (`localStorage`) with smooth expand/collapse transitions.
  * **Light & Dark Mode Switcher**: Fully-themed glassmorphism interface with toggle controls.

---

## 🛠️ Tech Stack

### **Frontend (`/strata`)**
* **Core**: React 19, TypeScript, Vite
* **Styling**: Tailwind CSS v4, Vanilla CSS variable tokens, Lucide React icons
* **State & Data Fetching**: TanStack React Query v5, React Router v6
* **Feedback**: Sonner Toast notifications

### **Backend & Database (`/supabase`)**
* **Database**: PostgreSQL with `pgvector` extension for vector embeddings & similarity search
* **Storage**: Supabase Storage Buckets for document asset hosting
* **Serverless Functions**: Deno-based Supabase Edge Functions (`extract-and-structure`, `query-router`)
* **AI & Embedding Models**:
  * **Mistral AI**: OCR (`mistral-ocr-latest`) and Chat (`mistral-small-latest`) for field parsing
  * **Voyage AI**: `voyage-3` (1024-dim embeddings) for document indexing

---

## 📂 Project Structure

```text
document_intelligence/
├── README.md                      # Project documentation and setup guide
├── SECRETS.md                     # Detailed environment & API key guide
├── decisions.md                   # Architectural and schema design rationale
├── strata/                        # React + Vite frontend application
│   ├── src/
│   │   ├── components/            # UI components, layout, containers, wizard
│   │   ├── features/              # Feature hooks & state management
│   │   ├── hooks/                 # Document & extraction queries
│   │   ├── lib/                   # Supabase client & ThemeProvider context
│   │   ├── pages/                 # Welcome, Dashboard, Details, Query pages
│   │   └── router.tsx             # React Router routing configuration
│   └── package.json
└── supabase/                      # Supabase backend configuration
    ├── config.toml                # Supabase CLI configuration
    ├── functions/                 # Deno Edge Functions
    │   ├── _shared/               # Shared CORS & Voyage embedding utilities
    │   ├── extract-and-structure/ # OCR & structuring pipeline
    │   └── query-router/          # Vector & SQL search execution
    └── migrations/                # Database schemas & pgvector migration SQL
```

---

## ⚙️ Initial Setup & Installation

### Prerequisites
Make sure you have the following installed on your system:
* [Node.js](https://nodejs.org/) (v18+ recommended)
* [Docker Desktop](https://www.docker.com/) (required for local Supabase development)
* [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase` or `brew install supabase/tap/supabase`)

---

### Step 1: Clone & Install Frontend Dependencies

```bash
cd strata
npm install
```

---

### Step 2: Configure Environment Variables

This project uses two separate environment surfaces:

#### 1. Frontend Environment (`strata/.env.local`)
Create `strata/.env.local` by copying `strata/.env.example`:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### 2. Edge Functions Environment (`supabase/functions/.env`)
Create `supabase/functions/.env` by copying `supabase/functions/.env.example`:

```bash
MISTRAL_API_KEY=your_mistral_api_key
EMBEDDING_API_KEY=your_voyage_ai_api_key
```

> 📖 **Note:** For a complete breakdown of API key retrieval and cloud deployments, refer to [`SECRETS.md`](./SECRETS.md).

---

### Step 3: Start Supabase Backend (Local Development)

Start the local Supabase stack (Postgres database, Storage, and Realtime):

```bash
# Run at root of document_intelligence directory
supabase start
```

This will initialize the local database and automatically apply all SQL migrations in `supabase/migrations/` (including `pgvector` setup, tables, and RPC functions).

---

### Step 4: Serve Edge Functions Locally

Serve the Deno Edge Functions locally:

```bash
supabase functions serve --env-file ./supabase/functions/.env
```

---

### Step 5: Start the Frontend Application

In a new terminal window, start the React development server:

```bash
cd strata
npm run dev
```

Open your browser and navigate to `http://localhost:5173`.

---

## 🗄️ Database & Embeddings Overview

* **Documents Table**: `documents`
* **Fields Table**: `fields`
* **Embeddings Storage**: Stored in `documents.embedding` as a `vector(1024)` column.
* **Vector Match RPC**: `match_documents(query_embedding, match_threshold, match_count)` performs cosine distance vector searches across all document embeddings.

---

## 🛠️ Build & Scripts

From the `strata/` directory:

```bash
# Start local frontend dev server
npm run dev

# TypeScript type-check and Vite production build
npm run build

# Preview production build locally
npm run preview

# Run ESLint checks
npm run lint
```
