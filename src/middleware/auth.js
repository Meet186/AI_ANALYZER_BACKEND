const env = require("../config/env");
const {verifyToken} = require("../utils/jwt");
const ApiError = require("../utils/ApiError");
const User = require("../models/User");

async function requireAuth(req, res, next) {
    try {
        console.log("Cookies:", req.cookies);
        console.log("Authorization:", req.headers.authorization);

        const authHeader = req.headers.authorization || "";
        const bearerToken = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : null;

        const token =
            req.cookies?.[env.cookieName] ||
            bearerToken;

        console.log("Token:", token);

        if (!token) {
            return next(ApiError.unauthorized("Token missing"));
        }

        const payload = verifyToken(token);
        console.log("Payload:", payload);

        const user = await User.findById(payload.sub);
        console.log("User:", user);

        if (!user) {
            return next(ApiError.unauthorized("User not found"));
        }

        req.user = user;
        next();

    } catch (err) {
        console.log(err);
        next(err);
    }
}
module.exports = {requireAuth};
