// middleware/adminMiddleware.js
module.exports = function (req, res, next) {
    // This runs AFTER authMiddleware, so req.user already exists
    if (req.user && req.user.role === 'admin') {
        next(); // They are an admin, let them pass
    } else {
        res.status(403).json({ message: 'Access Denied: Commander clearance required.' });
    }
};