import React, { useState } from "react";

type RoadmapItem = {
  title: string;
  description: string;
  durationWeeks?: number;
};

type Analysis = {
  skills: string[];
  roadmap: RoadmapItem[];
  estimatedWeeks?: number;
};

export default function Home() {
  const [jobText, setJobText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobText }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Analyze failed");
      }
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1 className="title">Skill Path Generator</h1>
          <div className="subtitle">
            Paste a job posting → get required skills, an actionable roadmap, and an estimated timeline.
          </div>
        </div>
      </div>

      <div className="panel">
        <div style={{ display: "flex", gap: 16, flexDirection: "column" }}>
          <textarea
            className="textarea"
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="Paste job description here (e.g., Senior React developer with Next.js, TypeScript, GraphQL)..."
          />

            <div className="controls">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setJobText("");
                  setResult(null);
                  setError(null);
                }}
                aria-label="Clear"
              >
                Clear
              </button>

              <button
                className="btn btn-primary"
                onClick={analyze}
                disabled={loading || !jobText.trim()}
                aria-label="Generate Roadmap"
              >
                {loading ? (
                  <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <span className="spinner" /> Analyzing...
                  </span>
                ) : (
                  "Generate Roadmap"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="panel card" style={{ borderLeft: "4px solid #f87171" }}>
          <strong>Error:</strong> <span style={{ marginLeft: 8 }}>{error}</span>
        </div>
      )}

      {result && (
        <div className="results">
          <div className="card">
            <h3 style={{ margin: 0 }}>Skills</h3>
            <div className="pills" style={{ marginTop: 10 }}>
              {result.skills.length ? (
                result.skills.map((s) => (
                  <div key={s} className="pill">
                    {s}
                  </div>
                ))
              ) : (
                <div style={{ color: "var(--muted)" }}>No skills identified.</div>
              )}
            </div>

            <div className="total">Estimated total: {result.estimatedWeeks ?? "—"} week(s)</div>
          </div>

          <div>
            <div className="card">
              <h3 style={{ margin: 0 }}>Roadmap</h3>
              <div className="roadmap" style={{ marginTop: 12 }}>
                {result.roadmap.map((r, idx) => (
                  <div key={idx} className="step">
                    <div style={{ flex: 1 }}>
                      <div className="step-title">{r.title}</div>
                      <div className="step-desc">{r.description}</div>
                    </div>
                    {r.durationWeeks != null && <div className="duration">{r.durationWeeks} wk</div>}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="card">
              <h4 style={{ margin: 0 }}>Notes</h4>
              <div style={{ color: "var(--muted)", marginTop: 8, fontSize: 13 }}>
                This output is generated automatically. If OpenAI is not configured, a simple fallback parser is used.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
