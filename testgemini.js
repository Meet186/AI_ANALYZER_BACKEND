const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
    path: path.resolve(__dirname, ".env")
});

const { GoogleGenAI } = require("@google/genai");

console.log("----------------------------------------");
console.log("Gemini Test");
console.log("----------------------------------------");

console.log("API key loaded:", !!process.env.GEMINI_API_KEY);
console.log(
    "API key prefix:",
    process.env.GEMINI_API_KEY?.substring(0, 10)
);
console.log("Model:", process.env.GEMINI_MODEL);

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

async function test() {
    try {
        console.log("----------------------------------------");
        console.log("Calling Gemini...");
        console.log("----------------------------------------");

        const response = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
            contents: "Say hello in one sentence."
        });

        console.log("----------------------------------------");
        console.log("SUCCESS!");
        console.log("----------------------------------------");
        console.log(response.text);

    } catch (error) {
        console.log("----------------------------------------");
        console.log("FAILED!");
        console.log("----------------------------------------");
        console.error(error);
    }
}

test();