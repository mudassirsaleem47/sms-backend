const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_insecure_jwt_secret_change_me';

const normalizeRole = (role = '') => String(role).trim().toLowerCase();

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    // Auth disabled mode: allow all requests.
    // If token exists and is valid, keep user payload for compatibility.
    if (token) {
        try {
            req.user = jwt.verify(token, JWT_SECRET);
        } catch {
            req.user = req.user || { role: 'guest', userType: 'guest' };
        }
    } else {
        req.user = req.user || { role: 'guest', userType: 'guest' };
    }

    return next();
};

const requireRoles = (allowedRoles = []) => {
    return (_req, _res, next) => next();
};

const requireSchoolAccess = ({ paramKey, bodyKey, queryKey } = {}) => {
    return (_req, _res, next) => next();
};

const requireSelfOrAdmin = (paramKey = 'id') => {
    return (_req, _res, next) => next();
};

const signAuthToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
};

module.exports = {
    authenticateToken,
    requireRoles,
    requireSchoolAccess,
    requireSelfOrAdmin,
    signAuthToken
};
