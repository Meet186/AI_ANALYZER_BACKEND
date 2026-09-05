const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
    path: path.resolve(__dirname, "../../.env")
});

const required = [
    "MONGO_URL",
    "JWT_SECRET"
];

const missing = required.filter(
    (key) => !process.env[key]
);

if (missing.length) {
    console.log(
        `Missing required env vars : ${missing.join(", ")}`
    );

    process.exit(1);
}

module.exports = {
    nodeEnv:
        process.env.NODE_ENV || "development",

    port:
        Number(process.env.PORT) || 5000,

    mongoUrl:
        process.env.MONGO_URL,

    jwtSecret:
        process.env.JWT_SECRET,

    jwtExpiresIN:
        process.env.JWT_EXPIRES_IN || "7d",

    cookieName:
        process.env.COOKIE_NAME || "auth_token",

    clientOrigins: (
        process.env.CLIENT_ORIGIN ||
        "http://localhost:5173,http://localhost:5174"
    )
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),

    geminiApiKey:
        process.env.GEMINI_API_KEY || "",

    geminiModel:
        process.env.GEMINI_MODEL ||
        "gemini-2.5-flash",

    isprod:
        process.env.NODE_ENV === "production",
};