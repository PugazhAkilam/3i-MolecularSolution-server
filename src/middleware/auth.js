const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.token; // Access the token from cookies
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
   const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
    
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = authMiddleware;