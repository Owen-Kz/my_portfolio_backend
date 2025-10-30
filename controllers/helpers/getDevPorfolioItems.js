const dbPromise = require("../../routes/db.config");

const getDevPortfolioItems = async (req, res) => {
  try {
    // Get parameters from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const category = req.query.category;
    const type = req.query.type;
    const status = req.query.status;
    const year = req.query.year;
    const offset = (page - 1) * limit;

    // Base query for items
    let itemsQuery = `
      SELECT 
        dpi.id,
        dpi.title,
        dpi.description,
        dpi.category,
        dpi.type,
        dpi.url,
        dpi.preview_url AS previewUrl,
        dpi.status,
        dpi.year,
        dpi.tags,
        dpi.technologies,
        dpi.images,
        dpi.created_at,
        GROUP_CONCAT(DISTINCT di.url) AS image_urls,
        GROUP_CONCAT(DISTINCT di.alt_text) AS alt_texts,
        GROUP_CONCAT(DISTINCT di.is_primary) AS primary_flags
      FROM dev_portfolio_items dpi
      LEFT JOIN dev_images di ON dpi.id = di.project_id
      WHERE dpi.user_id = ?
    `;

    // Base query for count
    let countQuery = `SELECT COUNT(DISTINCT dpi.id) AS total FROM dev_portfolio_items dpi WHERE dpi.user_id = ?`;
    const queryParams = [req.user.user_id];
    const countParams = [req.user.user_id];

    // Add filters if specified and not 'All'
    if (category && category !== 'All') {
      itemsQuery += ` AND dpi.category = ?`;
      countQuery += ` AND dpi.category = ?`;
      queryParams.push(category);
      countParams.push(category);
    }

    if (type && type !== 'All') {
      itemsQuery += ` AND dpi.type = ?`;
      countQuery += ` AND dpi.type = ?`;
      queryParams.push(type);
      countParams.push(type);
    }

    if (status && status !== 'All') {
      itemsQuery += ` AND dpi.status = ?`;
      countQuery += ` AND dpi.status = ?`;
      queryParams.push(status);
      countParams.push(status);
    }

    if (year && year !== 'All') {
      itemsQuery += ` AND dpi.year = ?`;
      countQuery += ` AND dpi.year = ?`;
      queryParams.push(year);
      countParams.push(year);
    }

    // Complete items query
    itemsQuery += `
      GROUP BY dpi.id
      ORDER BY dpi.created_at DESC
      LIMIT ? OFFSET ?
    `;

    // Execute count query
    const [[{ total }]] = await dbPromise.query(countQuery, countParams);

    // Execute items query with pagination parameters
    const [devPortfolioItems] = await dbPromise.query(
      itemsQuery,
      [...queryParams, limit, offset]
    );

    // Transform the data
    const formattedItems = devPortfolioItems.map(item => {
      // Parse JSON fields
      const tags = item.tags ? JSON.parse(item.tags) : [];
      const technologies = item.technologies ? JSON.parse(item.technologies) : [];
      
      // Process images - use individual images from JOIN or fallback to JSON images
      let images = [];
      
      if (item.image_urls) {
        // Use images from the JOIN with dev_images table
        const urls = item.image_urls.split(',');
        const altTexts = item.alt_texts ? item.alt_texts.split(',') : [];
        const primaryFlags = item.primary_flags ? item.primary_flags.split(',') : [];
        
        urls.forEach((url, index) => {
          if (url && url !== 'null') {
            images.push({
              url: url,
              alt_text: altTexts[index] || `${item.title} - Image ${index + 1}`,
              is_primary: primaryFlags[index] === '1'
            });
          }
        });
      }
      
      // If no images from JOIN, use the JSON images field
      if (images.length === 0 && item.images) {
        images = JSON.parse(item.images);
      }

      return {
        id: item.id,
        title: item.title,
        description: item.description || '',
        category: item.category,
        type: item.type,
        url: item.url || '',
        previewUrl: item.previewUrl || '',
        status: item.status,
        year: item.year,
        tags: tags,
        technologies: technologies,
        images: images,
        createdAt: item.created_at
      };
    });

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
    console.error('Error fetching development portfolio items:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Optional: Function to get a single dev portfolio item by ID for the authenticated user
const getDevPortfolioItemById = async (req, res) => {
  try {
    const { id } = req.params;

    const [items] = await dbPromise.query(
      `SELECT 
        dpi.id,
        dpi.title,
        dpi.description,
        dpi.category,
        dpi.type,
        dpi.url,
        dpi.preview_url AS previewUrl,
        dpi.status,
        dpi.year,
        dpi.tags,
        dpi.technologies,
        dpi.images,
        dpi.created_at,
        GROUP_CONCAT(DISTINCT di.url) AS image_urls,
        GROUP_CONCAT(DISTINCT di.alt_text) AS alt_texts,
        GROUP_CONCAT(DISTINCT di.is_primary) AS primary_flags,
        GROUP_CONCAT(DISTINCT di.width) AS widths,
        GROUP_CONCAT(DISTINCT di.height) AS heights
      FROM dev_portfolio_items dpi
      LEFT JOIN dev_images di ON dpi.id = di.project_id
      WHERE dpi.id = ? AND dpi.user_id = ?
      GROUP BY dpi.id`,
      [id, req.user.user_id]
    );

    if (items.length === 0) {
      return res.status(404).json({ error: "Development portfolio item not found" });
    }

    const item = items[0];

    // Parse JSON fields
    const tags = item.tags ? JSON.parse(item.tags) : [];
    const technologies = item.technologies ? JSON.parse(item.technologies) : [];
    
    // Process images
    let images = [];
    
    if (item.image_urls) {
      const urls = item.image_urls.split(',');
      const altTexts = item.alt_texts ? item.alt_texts.split(',') : [];
      const primaryFlags = item.primary_flags ? item.primary_flags.split(',') : [];
      const widths = item.widths ? item.widths.split(',') : [];
      const heights = item.heights ? item.heights.split(',') : [];
      
      urls.forEach((url, index) => {
        if (url && url !== 'null') {
          images.push({
            url: url,
            alt_text: altTexts[index] || `${item.title} - Image ${index + 1}`,
            is_primary: primaryFlags[index] === '1',
            width: widths[index] ? parseInt(widths[index]) : null,
            height: heights[index] ? parseInt(heights[index]) : null
          });
        }
      });
    }
    
    if (images.length === 0 && item.images) {
      images = JSON.parse(item.images);
    }

    const formattedItem = {
      id: item.id,
      title: item.title,
      description: item.description || '',
      category: item.category,
      type: item.type,
      url: item.url || '',
      previewUrl: item.previewUrl || '',
      status: item.status,
      year: item.year,
      tags: tags,
      technologies: technologies,
      images: images,
      createdAt: item.created_at
    };

    res.status(200).json(formattedItem);
  } catch (error) {
    console.error('Error fetching development portfolio item by ID:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  getDevPortfolioItems,
  getDevPortfolioItemById
};