const deleteItem = async (req,res) =>{
    try {
        const itemId = req.body.itemId;
        if (!itemId) {
            return res.status(400).json({ error: 'Item ID is required' });
        }

        // Delete the item from the database
        const result = await dbPromise.query('DELETE FROM portfolio_items WHERE item_id = ? and user_id = ?', [itemId, req.user.user_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Optionally, delete associated images and tags here
        await dbPromise.query('DELETE FROM images WHERE item_id = ?', [itemId]);
        await dbPromise.query('DELETE FROM item_tags WHERE item_id = ?', [itemId]);

        return res.status(200).json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Error deleting item:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }

}

module.exports = deleteItem;