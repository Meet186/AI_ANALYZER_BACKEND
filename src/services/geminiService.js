const { GoogleGenAI, Type } = require("@google/genai");
const { z } = require("zod");

const env = require("../config/env");
const ApiError = require("../utils/ApiError");

console.log("========== GEMINI SERVICE CONFIG ==========");
console.log("API key exists:", !!env.geminiApiKey);
console.log("API key prefix:", env.geminiApiKey?.substring(0, 10));
console.log("Model:", env.geminiModel);
console.log("============================================");

function isValidGeminiApiKey(value) {
    return typeof value === "string" && value.trim().length > 0;
}

const normalizedGeminiKey = env.geminiApiKey?.trim() || "";

if (!isValidGeminiApiKey(normalizedGeminiKey)) {
    console.warn(
        "GEMINI_API_KEY is missing. Gemini analysis is disabled."
    );
}

const ai = isValidGeminiApiKey(normalizedGeminiKey)
    ? new GoogleGenAI({
        apiKey: normalizedGeminiKey,
    })
    : null;


// ======================================================
// Gemini Response Schema
// ======================================================

const responseSchema = {
    type: Type.OBJECT,

    properties: {
        atsScore: {
            type: Type.NUMBER,
            description:
                "Overall ATS score from 0 to 100",
        },

        scoreBreakdown: {
            type: Type.OBJECT,

            properties: {
                keywords: {
                    type: Type.NUMBER,
                    description:
                        "Keyword score from 0 to 25",
                },

                formatting: {
                    type: Type.NUMBER,
                    description:
                        "Formatting score from 0 to 25",
                },

                impact: {
                    type: Type.NUMBER,
                    description:
                        "Impact score from 0 to 25",
                },

                clarity: {
                    type: Type.NUMBER,
                    description:
                        "Clarity score from 0 to 25",
                },
            },

            required: [
                "keywords",
                "formatting",
                "impact",
                "clarity",
            ],
        },

        issues: {
            type: Type.ARRAY,

            items: {
                type: Type.OBJECT,

                properties: {
                    title: {
                        type: Type.STRING,
                    },

                    severity: {
                        type: Type.STRING,

                        enum: [
                            "low",
                            "medium",
                            "high",
                        ],
                    },

                    explanation: {
                        type: Type.STRING,
                    },

                    fix: {
                        type: Type.STRING,
                    },
                },

                required: [
                    "title",
                    "severity",
                    "explanation",
                    "fix",
                ],
            },
        },

        strengths: {
            type: Type.ARRAY,

            items: {
                type: Type.OBJECT,

                properties: {
                    title: {
                        type: Type.STRING,
                    },

                    evidence: {
                        type: Type.STRING,
                    },
                },

                required: [
                    "title",
                    "evidence",
                ],
            },
        },

        bulletRewrites: {
            type: Type.ARRAY,

            items: {
                type: Type.OBJECT,

                properties: {
                    section: {
                        type: Type.STRING,
                    },

                    original: {
                        type: Type.STRING,
                    },

                    rewritten: {
                        type: Type.STRING,
                    },

                    rationale: {
                        type: Type.STRING,
                    },
                },

                required: [
                    "section",
                    "original",
                    "rewritten",
                    "rationale",
                ],
            },
        },

        keywordsPresent: {
            type: Type.ARRAY,

            items: {
                type: Type.STRING,
            },
        },

        keywordsMissing: {
            type: Type.ARRAY,

            items: {
                type: Type.STRING,
            },
        },

        summary: {
            type: Type.STRING,

            description:
                "Short overall resume assessment",
        },
    },

    required: [
        "atsScore",
        "scoreBreakdown",
        "issues",
        "strengths",
        "bulletRewrites",
        "keywordsPresent",
        "keywordsMissing",
        "summary",
    ],
};


// ======================================================
// Zod Validation Schema
// ======================================================

const analysisValidator = z.object({
    atsScore: z
        .number()
        .min(0)
        .max(100),

    scoreBreakdown: z.object({
        keywords: z
            .number()
            .min(0)
            .max(25),

        formatting: z
            .number()
            .min(0)
            .max(25),

        impact: z
            .number()
            .min(0)
            .max(25),

        clarity: z
            .number()
            .min(0)
            .max(25),
    }),

    issues: z.array(
        z.object({
            title: z.string(),

            severity: z.enum([
                "low",
                "medium",
                "high",
            ]),

            explanation: z.string(),

            fix: z.string(),
        })
    ),

    strengths: z.array(
        z.object({
            title: z.string(),
            evidence: z.string(),
        })
    ),

    bulletRewrites: z.array(
        z.object({
            section: z.string(),

            original: z.string(),

            rewritten: z.string(),

            rationale: z.string(),
        })
    ),

    keywordsPresent: z.array(
        z.string()
    ),

    keywordsMissing: z.array(
        z.string()
    ),

    summary: z.string(),
});


// ======================================================
// Build Prompt
// ======================================================

function buildPrompt({
    rawText,
    targetRole,
}) {

    const role = targetRole
        ? targetRole
        : "Software Engineer";

    return `
You are a senior technical recruiter and ATS expert.

Analyze the following resume for the target role:

TARGET ROLE:
${role}

Your task is to evaluate the resume and return structured ATS analysis.

SCORING:

ATS score must be between 0 and 100.

Score breakdown:

- keywords: 0 to 25
- formatting: 0 to 25
- impact: 0 to 25
- clarity: 0 to 25

ISSUES:

Return exactly 5 important resume issues.

Each issue must contain:

- title
- severity
- explanation
- fix

Severity must be one of:

low
medium
high

STRENGTHS:

Return exactly 5 strong points from the resume.

Each strength must contain:

- title
- evidence

BULLET REWRITES:

Rewrite 5 to 10 weak resume bullets.

For every rewrite provide:

- section
- original
- rewritten
- rationale

IMPORTANT:

Do not invent experience.

Do not invent technologies.

Do not invent achievements.

Do not add fake numbers.

Preserve the candidate's original meaning.

Make rewritten bullets concise and ATS-friendly.

KEYWORDS:

Return keywords clearly present in the resume.

Also return important keywords that are missing for the target role.

SUMMARY:

Provide a short overall assessment.

RESUME TEXT:

==================================================

${rawText}

==================================================
`;
}


// ======================================================
// Call Gemini
// ======================================================

async function callGemini(prompt) {

    if (!ai) {
        throw new Error(
            "Gemini API client is not initialized"
        );
    }

    if (!env.geminiModel) {
        throw new Error(
            "GEMINI_MODEL is not configured"
        );
    }

    console.log(
        "----------------------------------------"
    );

    console.log(
        "Calling Gemini..."
    );

    console.log(
        "Model:",
        env.geminiModel
    );

    console.log(
        "Prompt length:",
        prompt.length
    );

    const result =
        await ai.models.generateContent({

            model: env.geminiModel,

            contents: prompt,

            config: {
                responseMimeType:
                    "application/json",

                responseSchema:
                    responseSchema,

                temperature: 0.4,
            },
        });

    console.log(
        "Gemini response received"
    );

    console.log(
        "----------------------------------------"
    );

    const text = result.text;

    if (!text) {
        throw new Error(
            "Gemini returned an empty response"
        );
    }

    return {
        text,

        usage:
            result.usageMetadata || {},
    };
}


function extractKeywords(text) {
    const known = [
        "javascript",
        "typescript",
        "react",
        "node",
        "express",
        "mongodb",
        "sql",
        "postgresql",
        "aws",
        "docker",
        "python",
        "java",
        "html",
        "css",
        "tailwind",
        "graphql",
        "api",
        "product",
        "leadership",
        "agile",
        "testing",
        "figma",
        "azure",
        "kubernetes",
        "git",
    ];

    const lower = (text || "").toLowerCase();
    return known.filter((keyword) => lower.includes(keyword));
}

function buildFallbackAnalysis(rawText, targetRole) {
    const lowerText = (rawText || "").toLowerCase();
    const hasSummary = /summary|profile|about|experience/i.test(lowerText);
    const hasSkills = /skills|javascript|typescript|react|node|python|sql|aws|docker/i.test(lowerText);
    const hasExperience = /experience|work history|employment|professional/i.test(lowerText);
    const hasEducation = /education|degree|bachelor|master|university|college/i.test(lowerText);
    const keywordsPresent = extractKeywords(rawText);
    const targetKeywords = (targetRole || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 8);

    const missingKeywords = targetKeywords.filter((keyword) => !lowerText.includes(keyword));
    const scoreBase = 58 + (hasSummary ? 10 : 0) + (hasSkills ? 14 : 0) + (hasExperience ? 10 : 0) + (hasEducation ? 6 : 0);
    const atsScore = Math.min(94, Math.max(46, scoreBase));

    return {
        atsScore: Math.round(atsScore),
        scoreBreakdown: {
            keywords: Math.min(25, Math.max(8, keywordsPresent.length * 3)),
            formatting: hasSummary && hasSkills && hasExperience && hasEducation ? 22 : 15,
            impact: hasExperience ? 19 : 12,
            clarity: hasSummary ? 18 : 14,
        },
        issues: [
            {
                title: "Gemini API unavailable",
                severity: "low",
                explanation: "The server is not using a valid Google AI Studio API key, so ATS analysis is running in local fallback mode.",
                fix: "Set GEMINI_API_KEY in backend/.env to a valid Google AI Studio API key to enable AI-powered scoring.",
            },
        ],
        strengths: [
            ...(hasSummary ? [{ title: "Professional summary present", evidence: "The resume includes a summary/profile section." }] : []),
            ...(hasSkills ? [{ title: "Skill coverage", evidence: "The resume clearly lists technical skills and tools used for the role." }] : []),
            ...(hasExperience ? [{ title: "Experience history", evidence: "The resume contains work history and scope details." }] : []),
        ],
        bulletRewrites: [],
        keywordsPresent: keywordsPresent,
        keywordsMissing: missingKeywords,
        summary: "Local fallback ATS review: the document is structured, but AI-powered scoring is currently disabled because the Gemini API key is invalid or missing.",
    };
}

// ======================================================
// Analyze Resume
// ======================================================

async function analyzeResume({
    rawText,
    targetRole,
}) {

    if (
        !rawText ||
        typeof rawText !== "string" ||
        !rawText.trim()
    ) {
        throw ApiError.badRequest(
            "Resume text is empty."
        );
    }

    if (!ai) {
        console.warn(
            "GEMINI_API_KEY missing or invalid. Using local fallback analysis."
        );

        return {
            analysis: buildFallbackAnalysis(rawText, targetRole),
            model: "local-fallback",
            promptTokens: 0,
            responseTokens: 0,
        };
    }

    const prompt = buildPrompt({
        rawText,
        targetRole,
    });

    let lastErr = null;

    for (
        let attempt = 1;
        attempt <= 2;
        attempt++
    ) {

        try {

            console.log(
                `Gemini analysis attempt ${attempt}/2`
            );

            // ------------------------------------------
            // Call Gemini
            // ------------------------------------------

            const {
                text,
                usage,
            } = await callGemini(prompt);


            // ------------------------------------------
            // Parse JSON
            // ------------------------------------------

            let parsed;

            try {

                parsed = JSON.parse(text);

            } catch (jsonError) {

                console.error(
                    "Gemini returned invalid JSON:"
                );

                console.error(text);

                throw new Error(
                    `Invalid JSON returned by Gemini: ${jsonError.message}`
                );
            }


            // ------------------------------------------
            // Validate response
            // ------------------------------------------

            const validated =
                analysisValidator.parse(
                    parsed
                );


            // ------------------------------------------
            // Success
            // ------------------------------------------

            console.log(
                "Gemini analysis successful"
            );

            return {
                analysis: validated,

                model:
                    env.geminiModel,

                promptTokens:
                    usage?.promptTokenCount || 0,

                responseTokens:
                    usage?.candidatesTokenCount || 0,
            };

        } catch (err) {

            lastErr = err;

            console.error(
                `Gemini attempt ${attempt} failed`
            );

            console.error(
                err
            );

            const authFailure =
                err?.status === 401 ||
                /invalid authentication credentials|oauth 2 access token|unauthenticated|access_token_type_unsupported/i.test(
                    String(err?.message || "")
                );

            if (authFailure) {
                console.warn(
                    "Gemini auth failed. Falling back to local ATS analysis."
                );

                return {
                    analysis: buildFallbackAnalysis(rawText, targetRole),
                    model: "local-fallback",
                    promptTokens: 0,
                    responseTokens: 0,
                };
            }

            if (attempt === 2) {
                break;
            }
        }
    }


    // ----------------------------------------------
    // All attempts failed
    // ----------------------------------------------

    throw ApiError.internal(
        `Gemini analysis failed: ${
            lastErr?.message ||
            "Unknown Gemini error"
        }`
    );
}


// ======================================================
// Export
// ======================================================

module.exports = {
    analyzeResume,
    isValidGeminiApiKey,
};