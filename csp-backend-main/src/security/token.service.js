const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_TTL = "30m";
const PRE_AUTH_TOKEN_TTL = "5m";
const TOKEN_ISSUER = process.env.JWT_ISSUER || "csp-control-plane";
const REFRESH_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

if (!JWT_SECRET) {
    throw new Error("JWT configuration missing");
}

/* ACCESS TOKEN */

function signAccessToken(userId, role = "user") {
    return jwt.sign(
        { role, type: "access" },
        JWT_SECRET,
        {
            expiresIn: ACCESS_TOKEN_TTL,
            issuer: TOKEN_ISSUER,
            subject: String(userId),
            algorithm: "HS256"
        }
    );
}

function signPreAuthToken(userId) {
    return jwt.sign(
        { stage: "pre-auth", type: "pre-auth" },
        JWT_SECRET,
        {
            expiresIn: PRE_AUTH_TOKEN_TTL,
            issuer: TOKEN_ISSUER,
            subject: String(userId),
            algorithm: "HS256"
        }
    );
}

function verifyPreAuthToken(token) {
    return jwt.verify(token, JWT_SECRET, {
        issuer: TOKEN_ISSUER,
        algorithms: ["HS256"]
    });
}

/* REFRESH TOKEN */

function generateRefreshToken() {
    return crypto.randomBytes(64).toString("hex");
}

function hashRefreshToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function refreshExpiryDate() {
    return new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS);
}

/* TOKEN GENERATOR (THIS WAS MISSING) */

function generateTokens(userId, role = "user") {
    const accessToken = signAccessToken(userId, role);
    const refreshToken = generateRefreshToken();

    return {
        accessToken,
        refreshToken
    };
}

module.exports = {
    ACCESS_TOKEN_TTL,
    PRE_AUTH_TOKEN_TTL,
    TOKEN_ISSUER,
    signAccessToken,
    signPreAuthToken,
    verifyPreAuthToken,
    generateRefreshToken,
    hashRefreshToken,
    refreshExpiryDate,
    generateTokens
};
