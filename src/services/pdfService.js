const { PDFParse } = require("pdf-parse");
const ApiError = require("../utils/ApiError");

async function extractText(buffer) {
    let parser;

    try {
        parser = new PDFParse({
            data: buffer
        });

        const result = await parser.getText();

        const text = (result.text || "").trim();

        if (!text || text.length < 50) {
            throw ApiError.badRequest(
                "Could not extract readable text - is this a scanned/image-only PDF?"
            );
        }

        return {
            text,
            meta: {
                numPages: result.total ?? result.pages?.length ?? null,
            },
        };

    } catch (err) {
        if (err.isOperational) throw err;

        throw ApiError.badRequest(
            "Failed to parse PDF: " + err.message
        );
    } finally {
        try {
            await parser?.destroy();
        } catch (_) {}
    }
}

module.exports = { extractText };