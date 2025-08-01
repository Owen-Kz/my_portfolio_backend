const dbPromise = require("../../routes/db.config");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const login = async (req, res) => {
  try {
    // Extract email and password from request body
    const { email, password } = req.body;
    

    // Validate input data
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Fetch user from the database
    const [users] = await dbPromise.query('SELECT * FROM users WHERE email = ? OR username = ?', [email, email]);
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Compare provided password with stored hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
        console.log("Invalid password for user:", user.user_id);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Respond with success message and user data (excluding password)
    const { password_hash, ...userData } = user;
    const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    userData.token = token;
    return res.status(200).json({ message: 'Login successful', user: userData, token });

  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


module.exports = login;