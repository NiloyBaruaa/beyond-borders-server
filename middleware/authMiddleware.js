// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    // 1. Get token from header
    const token = req.header('x-auth-token') || req.header('Authorization')?.split(' ')[1];

    // 2. Check if no token
    if (!token) {
        return res.status(401).json({ message: 'No key found. Access denied.' });
    }

    // 3. Verify token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next(); // Token is valid, let them pass!
    } catch (err) {
        res.status(401).json({ message: 'Key is invalid or expired.' });
    }
};