const dbPromise = require("../../routes/db.config");
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const ValidateToken = async (req,res, next) =>{
    try {
   const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Verify the token
        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(401).json({ error: 'Invalid token' });
            }
            const userData = await dbPromise.query('SELECT user_id, username, email FROM users WHERE user_id = ?', [decoded.userId]);
            if (userData.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            // Token is valid, respond with user data
            const user = userData[0];
            req.user = user[0]; // Attach user data to request object
            return next();
        });
    } catch (error) {
        console.error('Error during ValidateToken check:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }

}

module.exports = ValidateToken;