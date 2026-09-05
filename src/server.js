const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

const env = require("./config/env");
const { connectDB } = require("./config/db");

const {
    notFound,
    errorHandler,
} = require("./middleware/errorHandler");

const healthRouter = require("./routes/health");
const authRouter = require("./routes/auth");
const resumesRouter = require("./routes/resumes");

const dashboardRouter = require("./routes/dashboard");
const insightsRouter = require("./routes/insights");
const versionRouter = require("./routes/version");
const historyRouter = require("./routes/history");



const app = express();

app.set("trust proxy", 1);


// CORS
app.use(
  cors({
        origin: env.clientOrigins,
        credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
  })
);


// Body Parser
app.use(
    express.json({
        limit: "1mb",
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb",
    })
);


// Cookie Parser
app.use(cookieParser());


// Logger
if (!env.isprod) {
    app.use(morgan("dev"));
}


// Routes
app.use("/api/health", healthRouter);
app.use("/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/auth", authRouter);
app.use("/api/resumes",resumesRouter);
app.use("/resumes", resumesRouter);
app.use("/api/dashboard",dashboardRouter);
app.use("/dashboard", dashboardRouter);
app.use("/api/insights",insightsRouter);
app.use("/insights", insightsRouter);
app.use("/api/versions",versionRouter);
app.use("/versions", versionRouter);
app.use("/api/history",historyRouter);
app.use("/history", historyRouter);


// Compatibility redirect for the typoed client path
app.all("/api/auth.register", (req, res) => {
    res.redirect(307, "/api/auth/register");
});



// Error Middleware
app.use(notFound);
app.use(errorHandler);


// Start Server
async function start() {
    try {
        await connectDB();

        app.listen(env.port, () => {
            console.log(
                `Server listening on http://localhost:${env.port} ${env.nodeEnv}`
            );
        });

    } catch (err) {

        console.log(
            "Failed to start server:",
            err.message
        );

        process.exit(1);
    }
}


// Global Promise Error Handler
process.on(
    "unhandledRejection",
    (reason) => {
        console.log(
            "Unhandled Rejection:",
            reason
        );
    }
);


start();


module.exports = app;