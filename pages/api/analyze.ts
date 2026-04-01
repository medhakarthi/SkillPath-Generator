import type { NextApiRequest, NextApiResponse } from "next";

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

const COMMON_SKILLS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Python",
  "Django",
  "SQL",
  "PostgreSQL",
  "AWS",
  "Docker",
  "Kubernetes",
  "GraphQL",
  "REST",
  "CSS",
  "HTML",
  "Testing",
  "Jest",
  "CI/CD",
  "Linux",
];

export function fallbackExtract(jobText: string): Analysis {
  const lines = jobText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const found = new Set<string>();

  // better bullet detection: lines that start with bullets or contain commas/bullet chars
  const BULLET_LINE = /^[\s\-\u2022*•]/;
  for (const line of lines) {
    if (/requirement|responsibilit|skill/i.test(line) || BULLET_LINE.test(line) || /[,•]/.test(line)) {
      const parts = line.split(/[,•\-–]/).map((p) => p.trim()).filter(Boolean);
      for (const p of parts) {
        for (const s of COMMON_SKILLS) {
          const safe = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const re = new RegExp(`\\b${safe}\\b`, "i");
          if (re.test(p)) found.add(s);
        }
      }
    } else {
      // also scan free text for common skills
      for (const s of COMMON_SKILLS) {
        const safe = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`\\b${safe}\\b`, "i");
        if (re.test(line)) found.add(s);
      }
    }
  }

  // If none found, try extracting capitalized tech words but filter common heading words
  if (found.size === 0) {
    const stop = new Set(["Responsibilities", "Requirements", "Experience", "Senior", "Junior", "Lead", "The", "We", "You", "Must"]);
    const caps = Array.from(new Set(jobText.match(/\b[A-Z][A-Za-z0-9+.#-]{1,}\b/g) || []))
      .filter((w) => w.length > 2 && !stop.has(w));
    caps.slice(0, 8).forEach((c) => found.add(c));
  }

  const skills = Array.from(found).slice(0, 8);

  // Generate a simple roadmap with slightly varied durations
  const roadmap: RoadmapItem[] = skills.map((s, i) => ({
    title: `Learn ${s}`,
    description: `Study ${s} fundamentals and build a small project demonstrating core concepts.`,
    durationWeeks: i < 2 ? 2 : i < 5 ? 3 : 4,
  }));

  const estimatedWeeks = roadmap.reduce((sum, r) => sum + (r.durationWeeks || 0), 0);

  return { skills, roadmap, estimatedWeeks };
}

async function callOpenAI(jobText: string) {
  const prompt = `You are a concise assistant. Given the following job posting, return a JSON object with three fields:
1) "skills": an array of the top required skills (short strings),
2) "roadmap": an array of objects { "title", "description", "durationWeeks" } with actionable steps (projects/courses) for each skill or grouped set of skills,
3) "estimatedWeeks": total estimated weeks to complete the roadmap.
Return only valid JSON, no explanation.

Job posting:
"""${jobText}"""`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 900,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${txt}`);
  }

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error("No reply from OpenAI");
  // try parse as JSON
  try {
    return JSON.parse(reply);
  } catch (e) {
    // attempt to extract JSON substring
    const match = reply.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse OpenAI response as JSON");
    return JSON.parse(match[0]);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }
  const { jobText } = req.body || {};
  if (!jobText || typeof jobText !== "string" || !jobText.trim()) {
    return res.status(400).json({ error: "jobText is required" });
  }

  try {
    let analysis: Analysis;
    if (process.env.OPENAI_API_KEY) {
      try {
        const ai = await callOpenAI(jobText);
        // Basic validation / normalization
        const skills = Array.isArray(ai.skills) ? ai.skills.map(String) : [];
        const roadmap = Array.isArray(ai.roadmap)
          ? ai.roadmap.map((r: any) => ({
              title: String(r.title || "").slice(0, 200),
              description: String(r.description || "").slice(0, 2000),
              durationWeeks: typeof r.durationWeeks === "number" ? r.durationWeeks : undefined,
            }))
          : [];
        const estimatedWeeks = typeof ai.estimatedWeeks === "number" ? ai.estimatedWeeks : roadmap.reduce((s: number, r: any) => s + (r.durationWeeks || 0), 0);
        analysis = { skills, roadmap, estimatedWeeks };
      } catch (err) {
        // fallback if OpenAI fails
        console.error("OpenAI failed, falling back:", (err as Error).message);
        analysis = fallbackExtract(jobText);
      }
    } else {
      analysis = fallbackExtract(jobText);
    }

    return res.status(200).json(analysis);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
