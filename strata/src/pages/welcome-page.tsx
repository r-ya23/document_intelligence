import { useNavigate } from "react-router-dom";
import {
  ArrowRightIcon,
  SparklesIcon,
  FileTextIcon,
  LayersIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  ShieldCheckIcon,
  ZapIcon,
  SearchIcon,
  XCircleIcon,
  CheckIcon,
  LayoutGridIcon,
} from "lucide-react";

export function WelcomePage() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FCFCFA" }}>
      {/* ── Top Header Navigation Bar (No Sidebar) ───────────────────────── */}
      <header className="border-b sticky top-0 z-50 backdrop-blur-md bg-[#FCFCFA]/90" style={{ borderColor: "#E5E2DA" }}>
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
              Strata
            </span>
            <span className="size-2 rounded-full" style={{ background: "#CCFF01" }} />
            <span className="ml-2 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md"
              style={{ background: "#F5F3EE", color: "#6B6B6B", border: "1px solid #E5E2DA" }}>
              Doc Intelligence
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGetStarted}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 shadow-sm"
              style={{ background: "#1A1A1A" }}
            >
              <span>Go to Dashboard</span>
              <ArrowRightIcon className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ───────────────────────────────────────── */}
      <main className="flex-1 mx-auto max-w-5xl px-6 py-12 space-y-16">
        {/* ── Hero Section ────────────────────────────────────────────────── */}
        <section className="text-center space-y-6 pt-4">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium"
            style={{ background: "#F0EDE5", color: "#5A7A00", border: "1px solid #E5E2DA" }}>
            <SparklesIcon className="size-3.5 text-[#5A7A00]" />
            <span>Next-Generation Document Intelligence</span>
          </div>

          <h1
            className="text-4xl sm:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-tight"
            style={{ color: "#1A1A1A", letterSpacing: "-0.03em" }}
          >
            Transform Unstructured Documents into Structured Intelligence
          </h1>

          <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "#6B6B6B" }}>
            Strata solves the pain of manual document processing. Automatically organize, extract,
            and query critical business data trapped inside PDFs, invoices, and financial reports.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              type="button"
              onClick={handleGetStarted}
              className="flex items-center gap-2 rounded-lg px-6 py-3.5 text-base font-semibold text-white transition-all shadow-md hover:opacity-90"
              style={{ background: "#1A1A1A" }}
            >
              <LayoutGridIcon className="size-5 text-[#CCFF01]" />
              <span>Get Started</span>
              <ArrowRightIcon className="size-5" />
            </button>
          </div>
        </section>

        {/* ── Problem vs Solution ────────────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* The Problem */}
          <div
            className="rounded-2xl p-6 sm:p-8 space-y-4"
            style={{ background: "#FDF8F7", border: "1px solid #F3DDD9" }}
          >
            <div className="flex items-center gap-2" style={{ color: "#DC4727" }}>
              <XCircleIcon className="size-5 shrink-0" />
              <h2 className="text-sm font-bold uppercase tracking-wider">The Problem</h2>
            </div>
            <h3 className="text-xl font-semibold" style={{ color: "#1A1A1A" }}>
              Document Chaos & Manual Overhead
            </h3>
            <ul className="space-y-3 text-sm" style={{ color: "#555" }}>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 size-1.5 rounded-full shrink-0" style={{ background: "#DC4727" }} />
                <span><strong>Trapped Data:</strong> Over 80% of enterprise data is locked in static PDFs, scanned receipts, and invoices.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 size-1.5 rounded-full shrink-0" style={{ background: "#DC4727" }} />
                <span><strong>Slow & Error-Prone:</strong> Manual data entry causes costly delays, typos, and compliance bottlenecks.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 size-1.5 rounded-full shrink-0" style={{ background: "#DC4727" }} />
                <span><strong>Fragile Legacy OCR:</strong> Traditional template rule engines break standard extractions whenever layout formatting changes.</span>
              </li>
            </ul>
          </div>

          {/* The Solution */}
          <div
            className="rounded-2xl p-6 sm:p-8 space-y-4 relative overflow-hidden"
            style={{ background: "#F7FAEF", border: "1px solid #DCE6C4" }}
          >
            <div className="flex items-center gap-2" style={{ color: "#5A7A00" }}>
              <CheckCircle2Icon className="size-5 shrink-0" />
              <h2 className="text-sm font-bold uppercase tracking-wider">The Strata Solution</h2>
            </div>
            <h3 className="text-xl font-semibold" style={{ color: "#1A1A1A" }}>
              Automated Intelligence Containers
            </h3>
            <ul className="space-y-3 text-sm" style={{ color: "#4A5239" }}>
              <li className="flex items-start gap-2.5">
                <CheckIcon className="size-4 text-[#5A7A00] shrink-0 mt-0.5" />
                <span><strong>Smart Document Containers:</strong> Group similar documents with custom target schema definitions.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckIcon className="size-4 text-[#5A7A00] shrink-0 mt-0.5" />
                <span><strong>AI Multi-Modal Extractions:</strong> Extract structured key-value pairs with exact page coordinates & confidence scores.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckIcon className="size-4 text-[#5A7A00] shrink-0 mt-0.5" />
                <span><strong>Natural Language Query:</strong> Ask questions across hundreds of documents instantly with verified source citations.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* ── How It Works ───────────────────────────────────────────────── */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "#1A1A1A" }}>
              How Strata Works
            </h2>
            <p className="text-sm sm:text-base" style={{ color: "#6B6B6B" }}>
              Three simple steps from unstructured files to actionable data
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="rounded-xl p-6 space-y-3" style={{ background: "#F5F3EE", border: "1px solid #E5E2DA" }}>
              <div className="size-10 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: "#1A1A1A", color: "#CCFF01" }}>
                01
              </div>
              <div className="flex items-center gap-2">
                <LayersIcon className="size-4 text-[#1A1A1A]" />
                <h3 className="font-semibold text-base" style={{ color: "#1A1A1A" }}>Create Container</h3>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#6B6B6B" }}>
                Define document types (e.g. Purchase Orders, Tax Forms) and set up the schema fields you need extracted.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl p-6 space-y-3" style={{ background: "#F5F3EE", border: "1px solid #E5E2DA" }}>
              <div className="size-10 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: "#1A1A1A", color: "#CCFF01" }}>
                02
              </div>
              <div className="flex items-center gap-2">
                <BrainCircuitIcon className="size-4 text-[#1A1A1A]" />
                <h3 className="font-semibold text-base" style={{ color: "#1A1A1A" }}>Ingest & Extract</h3>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#6B6B6B" }}>
                Upload single files or bulk batches. Strata automatically parses fields, assigns confidence scores, and flags anomalies.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl p-6 space-y-3" style={{ background: "#F5F3EE", border: "1px solid #E5E2DA" }}>
              <div className="size-10 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: "#1A1A1A", color: "#CCFF01" }}>
                03
              </div>
              <div className="flex items-center gap-2">
                <SearchIcon className="size-4 text-[#1A1A1A]" />
                <h3 className="font-semibold text-base" style={{ color: "#1A1A1A" }}>Query & Analyze</h3>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#6B6B6B" }}>
                Search across your entire document repository, view verified source snippets, and integrate with downstream workflows.
              </p>
            </div>
          </div>
        </section>

        {/* ── Key Value Props Banner ──────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-5 rounded-xl" style={{ background: "#F5F3EE", border: "1px solid #E5E2DA" }}>
            <ShieldCheckIcon className="size-6 shrink-0" style={{ color: "#5A7A00" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Verified Accuracy</p>
              <p className="text-xs" style={{ color: "#6B6B6B" }}>Field-level confidence scoring</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-5 rounded-xl" style={{ background: "#F5F3EE", border: "1px solid #E5E2DA" }}>
            <ZapIcon className="size-6 shrink-0 text-[#1A1A1A]" />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Instant Processing</p>
              <p className="text-xs" style={{ color: "#6B6B6B" }}>Automated extraction pipelines</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-5 rounded-xl" style={{ background: "#F5F3EE", border: "1px solid #E5E2DA" }}>
            <FileTextIcon className="size-6 shrink-0 text-[#1A1A1A]" />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Audit Trails</p>
              <p className="text-xs" style={{ color: "#6B6B6B" }}>Trace back to original document text</p>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t py-8 text-center text-xs" style={{ borderColor: "#E5E2DA", color: "#9B9B9B" }}>
        <p>Strata v0.1 · Document Intelligence Platform</p>
      </footer>
    </div>
  );
}
