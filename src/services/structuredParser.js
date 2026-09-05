const {GoogleGenAI,Type} = require("@google/genai");
const {z} = require("zod");
const env = require("../config/env");

const ai = env.geminiApiKey ? new GoogleGenAI({apiKey : env.geminiApiKey} ) : null;

const linkSchema = {
    type : Type.OBJECT,
    required : ["label","url"],
    properties : {
        label : {type : Type.STRING},
        url : {type :Type.STRING},
    },

}

const responseSchema = {
  type: Type.OBJECT,
  required: [
    "basics",
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    "certifications",
    "languages",
    "interests",
  ],

  properties: {
    basics: {
      type: Type.OBJECT,
      required: [
        "name",
        "title",
        "location",
        "email",
        "phone",
        "links",
      ],
      properties: {
        name: { type: Type.STRING },
        title: { type: Type.STRING },
        location: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        links: {
          type: Type.ARRAY,
          items: linkSchema,
        },
      },
    },

    summary: {
      type: Type.STRING,
    },

    experience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["company", "role", "period", "bullets"],
        properties: {
          company: { type: Type.STRING },
          role: { type: Type.STRING },
          location: { type: Type.STRING },
          period: { type: Type.STRING },
          bullets: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
          },
        },
      },
    },

    education: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["degree", "school", "period"],
        properties: {
          degree: { type: Type.STRING },
          school: { type: Type.STRING },
          location: { type: Type.STRING },
          period: { type: Type.STRING },
          details: { type: Type.STRING },
        },
      },
    },

    skills: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
    },

    projects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["name", "description"],
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          tech: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
          },
          links: {
            type: Type.ARRAY,
            items: linkSchema,
          },
        },
      },
    },

    certifications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["name"],
        properties: {
          name: { type: Type.STRING },
          issuer: { type: Type.STRING },
          year: { type: Type.STRING },
        },
      },
    },

    languages: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
    },

    interests: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
    },
  },
};

const validator = z.object({
  basics: z.object({
    name: z.string().default(""),
    title: z.string().default(""),
    location: z.string().default(""),
    email: z.string().default(""),
    phone: z.string().default(""),
    links: z
      .array(
        z.object({
          label: z.string(),
          url: z.string(),
        })
      )
      .default([]),
  }),

  summary: z.string().default(""),

  experience: z
    .array(
      z.object({
        company: z.string().default(""),
        role: z.string().default(""),
        location: z.string().default(""),
        period: z.string().default(""),
        bullets: z.array(z.string()).default([]),
      })
    )
    .default([]),

  education: z
    .array(
      z.object({
        degree: z.string().default(""),
        school: z.string().default(""),
        location: z.string().default(""),
        period: z.string().default(""),
        details: z.string().default(""),
      })
    )
    .default([]),

  skills: z.array(z.string()).default([]),

  projects: z
    .array(
      z.object({
        name: z.string().default(""),
        description: z.string().default(""),
        tech: z.array(z.string()).default([]),
        links: z
          .array(
            z.object({
              label: z.string(),
              url: z.string(),
            })
          )
          .default([]),
      })
    )
    .default([]),

  certifications: z
    .array(
      z.object({
        name: z.string().default(""),
        issuer: z.string().default(""),
        year: z.string().default(""),
      })
    )
    .default([]),

  languages: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
});

function buildPrompt(rawText) {
  return [
    "You are a resume parser. The input is text extracted from a PDF - lines may be jumbled or out of natural reading order.",

    "Extract structured data:",
    "- basics: name, professional title, location, email, phone, social links (LinkedIn / GitHub / portfolio etc.; label like \"LinkedIn\", full URL)",
    "- summary: the professional summary paragraph (rejoin if split across lines)",
    "- experience: jobs most recent first, with company, role, period (preserve original date format), location if available, and bullet points",
    "- education: degree, school, period, location, optional details",
    "- skills: flat array of technical skills",
    "- projects: name, one-sentence description, optional tech tags, optional links",
    "- certifications: name, issuer, year",
    "- languages: flat array",
    "- interests: flat array",

    "Rules:",
    "- Be conservative: omit fields that are not clearly present. Use empty strings/arrays where missing.",
    "- Do not invent or paraphrase — extract verbatim where possible.",
    "- Each experience bullet should read as a complete sentence.",
    "- Preserve original date formats (e.g. 'Jan 2022 - Dec 2023').",

    "RESUME TEXT:",
    "-------------",
    rawText,
    "-------------"
  ].join("\n");
}

const EMPTY = {
    basics : {name : "",title : "", location : "",email : "",phone : "", links : []},
    summary : "",
    experience : [],
    education : [],
    skills : [],
    projects : [],
    certifications : [],
    languages : [],
    interests :[],
};

function splitHeadings(rawText) {
  const normalized = rawText.replace(/\r/g, "").trim();
  if (!normalized) return [];

  const chunks = [];
  let current = { heading: "", lines: [] };

  const pushCurrent = () => {
    if (!current) return;
    const text = current.lines.join("\n").trim();
    if (text || current.heading) {
      chunks.push({ ...current, text });
    }
  };

  for (const line of normalized.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current.lines.length) {
        current.lines.push("");
      }
      continue;
    }

    const lower = trimmed.toLowerCase();
    const isHeading = /^(summary|professional summary|experience|work experience|projects|education|skills|certifications|languages|interests|additional info|technical skills)$/i.test(lower)
      || /^[-*•]?\s*(summary|professional summary|experience|work experience|projects|education|skills|certifications|languages|interests|additional info|technical skills)\s*:?$/i.test(trimmed);

    if (isHeading) {
      pushCurrent();
      current = { heading: trimmed, lines: [] };
      continue;
    }

    current.lines.push(line);
  }

  pushCurrent();
  return chunks;
}

function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function parseLinks(rawText) {
  const urls = [];
  const matches = rawText.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || [];
  for (const match of matches) {
    const url = match.replace(/[),.;]+$/, "");
    const label = url.includes("linkedin.com") ? "LinkedIn" : url.includes("github.com") ? "GitHub" : url.includes("portfolio") ? "Portfolio" : url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    urls.push({ label, url });
  }
  return urls;
}

function parseBasics(rawText) {
  const lines = rawText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);

  const emailMatch = rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = rawText.match(/(?:\+?\d[\d()\- .]{7,}\d)/);
  const locationMatch = rawText.match(/(?:[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)?(?:,\s*[A-Z]{2})?|Remote|Hybrid|On-site)/);

  const name = lines.find((line) => !/^(summary|experience|education|skills|projects|certifications|languages|interests|work|profile|contact)$/i.test(line) && !/[|]/.test(line) && !/\d{4}/.test(line) && !/@/.test(line) && !/https?:\/\//i.test(line) && line.length > 1 && line.length < 80) || "";

  const title = lines.find((line) => line && !lines[0] || false);
  const candidateTitle = lines.find((line) => line && line !== name && !/@/.test(line) && !/https?:\/\//i.test(line) && !/\d/.test(line) && !/^(summary|experience|education|skills|projects|certifications|languages|interests|work|profile|contact)$/i.test(line) && line.length > 2 && line.length < 80 && !/[A-Z][a-z]+,\s*[A-Z]{2}/.test(line));

  return {
    name: cleanText(name || ""),
    title: cleanText(candidateTitle && candidateTitle !== name ? candidateTitle : ""),
    location: cleanText(locationMatch ? locationMatch[0] : ""),
    email: emailMatch ? emailMatch[0] : "",
    phone: phoneMatch ? phoneMatch[0].replace(/\s+/g, " ") : "",
    links: parseLinks(rawText),
  };
}

function parseSectionList(sectionText, lowerHeading) {
  const lines = sectionText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  if (lowerHeading.includes("skills") || lowerHeading.includes("languages") || lowerHeading.includes("interests") || lowerHeading.includes("certifications")) {
    return lines
      .flatMap((line) => line.split(/[,•\n]/))
      .map((entry) => cleanText(entry))
      .filter(Boolean)
      .filter((entry) => !/^(skills|languages|interests|certifications)$/i.test(entry));
  }

  return lines;
}

function parseExperienceSection(sectionText) {
  const blocks = [];
  const entries = sectionText
    .split(/\n(?=(?:[A-Z][^\n]*\|[^\n]*|[A-Z][^\n]*[-–—][^\n]*|[A-Z][^\n]*\s{2,}[^\n]*))/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const rawEntry of entries) {
    const lines = rawEntry.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const header = lines[0];
    const bullets = lines.slice(1).filter((line) => /^[-*•]/.test(line) || line.length > 20)
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);

    const headerParts = header.split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean);
    let company = "";
    let role = "";
    let period = "";
    let location = "";

    if (headerParts.length >= 3) {
      company = headerParts[0];
      role = headerParts[1];
      period = headerParts[2];
    } else if (header.includes(" - ") || header.includes("–") || header.includes("—")) {
      const match = header.match(/^(.*?)(?:\s*(?:-|–|—)\s*)([^\n]+?)\s*(?:\|\s*([A-Za-z0-9 /,.-]+))?$/);
      if (match) {
        company = (match[1] || "").trim();
        role = (match[2] || "").trim();
        period = (match[3] || "").trim();
      } else {
        const segs = header.split(/\s{2,}/);
        if (segs.length > 1) {
          company = segs[0];
          role = segs[1];
        }
      }
    } else {
      const first = lines[0];
      const match = first.match(/^(.*?)(?:\s+\(([^)]+)\))?\s*(?:\|\s*(.*))?$/);
      if (match) {
        company = (match[1] || "").trim();
        location = (match[2] || "").trim();
        period = (match[3] || "").trim();
      }
    }

    const cleanBullets = bullets.length ? bullets : lines.slice(1).filter((line) => !line.toLowerCase().includes("http") && line.length > 20).map((line) => line.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);

    blocks.push({
      company: cleanText(company),
      role: cleanText(role),
      location: cleanText(location),
      period: cleanText(period),
      bullets: cleanBullets.map((b) => cleanText(b)),
    });
  }

  return blocks;
}

function parseEducationSection(sectionText) {
  const entries = [];
  const lines = sectionText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  let current = null;

  for (const line of lines) {
    if (/\b(B\.S\.|B\.A\.|M\.S\.|M\.A\.|Bachelor|Master|Diploma|Certificate|PhD|Associate)\b/i.test(line) || /\bUniversity\b|\bCollege\b|\bSchool\b/i.test(line)) {
      if (current) entries.push(current);
      current = { degree: "", school: "", location: "", period: "", details: "" };
      const degreeMatch = line.match(/^(.*?)(?:,\s*|\s+-\s*)(.*)$/);
      if (degreeMatch) {
        current.degree = cleanText(degreeMatch[1]);
        current.school = cleanText(degreeMatch[2]);
      } else {
        current.school = cleanText(line);
      }
      continue;
    }

    if (!current) {
      current = { degree: "", school: "", location: "", period: "", details: "" };
    }

    if (/\d{4}/.test(line) || /Present|Current/i.test(line)) {
      current.period = cleanText(line);
    } else if (/[,][A-Za-z\s]+(?:,\s*[A-Z]{2})?/.test(line)) {
      current.location = cleanText(line);
    } else {
      current.details = current.details ? `${current.details} ${line}` : line;
    }
  }

  if (current) entries.push(current);

  return entries.map((entry) => ({
    degree: cleanText(entry.degree || ""),
    school: cleanText(entry.school || ""),
    location: cleanText(entry.location || ""),
    period: cleanText(entry.period || ""),
    details: cleanText(entry.details || ""),
  }));
}

function parseFallbackResume(rawText) {
  const sections = splitHeadings(rawText);
  const normalized = rawText.replace(/\r/g, "");
  const basics = parseBasics(normalized);
  const byHeading = new Map();

  for (const section of sections) {
    const heading = (section.heading || "").toLowerCase();
    byHeading.set(heading, section.text);
  }

  const summaryText =
    byHeading.get("summary") ||
    byHeading.get("professional summary") ||
    (() => {
      const match = normalized.match(/(?:summary|professional summary)\s*:?\s*\n+([\s\S]*?)(?=\n\s*(?:experience|work experience|education|skills|projects|certifications|languages|interests)\s*:?)\s*$/i);
      return match ? match[1].trim() : "";
    })();

  const experienceText = byHeading.get("experience") || byHeading.get("work experience") || "";
  const educationText = byHeading.get("education") || "";
  const skillsText = byHeading.get("skills") || byHeading.get("technical skills") || "";
  const projectsText = byHeading.get("projects") || "";
  const certsText = byHeading.get("certifications") || "";
  const languagesText = byHeading.get("languages") || "";
  const interestsText = byHeading.get("interests") || "";

  const fallback = {
    basics: {
      name: basics.name || "",
      title: basics.title || "",
      location: basics.location || "",
      email: basics.email || "",
      phone: basics.phone || "",
      links: basics.links || [],
    },
    summary: cleanText(summaryText || ""),
    experience: parseExperienceSection(experienceText || normalized),
    education: parseEducationSection(educationText || normalized),
    skills: parseSectionList(skillsText || normalized, "skills").slice(0, 30),
    projects: (projectsText ? parseExperienceSection(projectsText) : []).map((project) => ({
      name: cleanText(project.company || project.role || ""),
      description: cleanText(project.bullets.join(" ") || ""),
      tech: [],
      links: [],
    })),
    certifications: parseSectionList(certsText || normalized, "certifications").map((item) => ({ name: cleanText(item), issuer: "", year: "" })),
    languages: parseSectionList(languagesText || normalized, "languages").slice(0, 20),
    interests: parseSectionList(interestsText || normalized, "interests").slice(0, 20),
  };

  if (!fallback.experience.length && /\b(Lead|Senior|Engineer|Developer|Manager)\b/i.test(normalized)) {
    const lines = normalized.split(/\n+/).filter(Boolean);
    const experienceCandidate = [];
    let current = null;

    for (const line of lines) {
      if (/\b(Experience|Work Experience|Professional Experience)\b/i.test(line)) {
        current = { company: "", role: "", location: "", period: "", bullets: [] };
        continue;
      }
      if (current && /^[-*•]/.test(line)) {
        current.bullets.push(line.replace(/^[-*•]\s*/, "").trim());
        continue;
      }
      if (current && /\d{4}|Present|Current/i.test(line)) {
        current.period = cleanText(line);
        continue;
      }
      if (current && /\|/.test(line) && !current.role) {
        const [first, second, third] = line.split("|").map((part) => part.trim());
        current.company = first || current.company;
        current.role = second || current.role;
        current.period = third || current.period;
        continue;
      }
      if (current && current.company && current.role && line && !/^[-*•]/.test(line) && !/\d{4}/.test(line)) {
        current.location = cleanText(line);
      }
      if (current && current.role && current.company && (!line || /\d{4}/.test(line) || /^[-*•]/.test(line) || /\|/.test(line))) {
        if (current.role || current.company || current.bullets.length) {
          experienceCandidate.push(current);
          current = null;
        }
      }
    }

    if (current && (current.role || current.company || current.bullets.length)) {
      experienceCandidate.push(current);
    }

    fallback.experience = experienceCandidate.length ? experienceCandidate : fallback.experience;
  }

  return validator.parse(fallback);
}

async function parseResume(rawText) {
  if (!rawText?.trim()) return EMPTY;

  if (!ai) {
    return parseFallbackResume(rawText);
  }

  const prompt = buildPrompt(rawText);
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: env.geminiModel,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.1,
        },
      });
      const text =
        typeof result.text === "function"
          ? result.text()
          : result.text;
      if (!text) throw new Error("Empty response");
      const parsed = JSON.parse(text);
      return validator.parse(parsed);
    } catch (err) {
      if (attempt === 2) {
        console.error("Structured parse failed:", err.message);
        return parseFallbackResume(rawText);
      }
    }
  }

  return parseFallbackResume(rawText);
}
module.exports = {parseResume}