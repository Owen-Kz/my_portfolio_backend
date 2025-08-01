const dbPromise = require("../../routes/db.config");

const getPortfolioItems = async (req, res) => {
  try {
    // Get parameters from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const category = req.query.category;
    const offset = (page - 1) * limit;

    // Base query for items
    let itemsQuery = `
      SELECT 
        pi.item_id AS id,
        pi.title,
        pi.description,
        c.name AS category,
        GROUP_CONCAT(DISTINCT t.name) AS tags,
        GROUP_CONCAT(DISTINCT i.url) AS images
      FROM portfolio_items pi
      LEFT JOIN categories c ON pi.category_id = c.category_id
      LEFT JOIN item_tags it ON pi.item_id = it.item_id
      LEFT JOIN tags t ON it.tag_id = t.tag_id
      LEFT JOIN images i ON pi.item_id = i.item_id
      WHERE pi.user_id = ?
    `;

    // Base query for count
    let countQuery = `SELECT COUNT(DISTINCT pi.item_id) AS total FROM portfolio_items pi WHERE pi.user_id = ?`;
    const queryParams = [req.user.user_id];

    // Add category filter if specified and not 'All'
    if (category && category !== 'All') {
      itemsQuery += ` AND c.name = ?`;
      countQuery = `SELECT COUNT(DISTINCT pi.item_id) AS total 
                   FROM portfolio_items pi
                   JOIN categories c ON pi.category_id = c.category_id
                   WHERE pi.user_id = ? AND c.name = ?`;
      queryParams.push(category);
    }

    // Complete items query
    itemsQuery += `
      GROUP BY pi.item_id
      ORDER BY pi.created_at DESC
      LIMIT ? OFFSET ?
    `;

    // Parameters for count query
    const countParams = category && category !== 'All' 
      ? [req.user.user_id, category] 
      : [req.user.user_id];

    // Execute count query
    const [[{ total }]] = await dbPromise.query(countQuery, countParams);

    // Execute items query with pagination parameters
    const [portfolioItems] = await dbPromise.query(
      itemsQuery,
      [...queryParams, limit, offset]
    );

    // Transform the data
    const formattedItems = portfolioItems.map(item => ({
      id: item.id,
      title: item.title,
      category: item.category,
      description: item.description || '',
      tags: item.tags ? item.tags.split(',') : [],
      images: item.images ? item.images.split(',') : []
    }));

    res.status(200).json({
      items: formattedItems,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Error fetching portfolio items:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = getPortfolioItems;