const dbPromise = require("../../routes/db.config");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const generateId = require("../../utils/generateId");
dotenv.config();

const signup = async (req,res) =>{
    try{
        // Extract user data from request body
        const { username, email, password } = req.body;

        // Validate input data
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user already exists
        const [existingUser] = await dbPromise.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user into the database
        const result = await dbPromise.query('INSERT INTO users (username, email, password_hash, user_id) VALUES (?, ?, ?, ?)', [username, email, hashedPassword, generateId()]);
        if (result.affectedRows === 0) {
            return res.status(500).json({ error: 'Failed to create user' });
        }
        // Create a JWT token for the new user
        const token = jwt.sign({ userId: result.insertId }, process.env.JWT_SECRET, { expiresIn: '1h' });
        // Respond with user data excluding password and include token
        const userData = {
            userId: result.insertId,
            username,
            email,
            token
        };
        // Respond with success message
        return res.status(201).json({ message: 'User created successfully', user: userData });
    }catch(error){
        console.error('Error during signup:', error);
       return res.status(500).json({ error: 'Internal server error' });
    }

}
module.exports = signup;