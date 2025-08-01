const dbPromise = require("../../routes/db.config");

const CountAllMyItems = async (req,res) =>{
    try{
        
        const [result] = await dbPromise.query('SELECT COUNT(*) AS total FROM portfolio_items WHERE user_id = ?', [req.user.user_id]);
        return res.json({ total: result[0].total });
    }catch (error) {
        console.error('Error counting portfolio items:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = CountAllMyItems;