const dbPromise = require("../routes/db.config");


const retrieveDevFiles = async (req, res) => {
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
        dpi.user_id,
        GROUP_CONCAT(DISTINCT di.url) AS image_urls,
        GROUP_CONCAT(DISTINCT di.alt_text) AS alt_texts,
        GROUP_CONCAT(DISTINCT di.is_primary) AS primary_flags
      FROM dev_portfolio_items dpi
      LEFT JOIN dev_images di ON dpi.id = di.project_id
    `;

    // Base query for count
    let countQuery = `SELECT COUNT(DISTINCT dpi.id) AS total FROM dev_portfolio_items dpi`;
    const queryParams = [];
    const whereConditions = [];

    // Add filters if specified
    if (category && category !== 'All') {
      whereConditions.push(`dpi.category = ?`);
      queryParams.push(category);
    }

    if (type && type !== 'All') {
      whereConditions.push(`dpi.type = ?`);
      queryParams.push(type);
    }

    if (status && status !== 'All') {
      whereConditions.push(`dpi.status = ?`);
      queryParams.push(status);
    }

    if (year && year !== 'All') {
      whereConditions.push(`dpi.year = ?`);
      queryParams.push(year);
    }

    // Add user filter if user_id is available (for user-specific queries)
    if (req.user && req.user.user_id) {
      whereConditions.push(`dpi.user_id = ?`);
      queryParams.push(req.user.user_id);
    }

    // Add WHERE clause if there are conditions
    if (whereConditions.length > 0) {
      const whereClause = ` WHERE ${whereConditions.join(' AND ')}`;
      itemsQuery += whereClause;
      countQuery += whereClause;
    }

    // Complete items query
    itemsQuery += `
      GROUP BY dpi.id
      ORDER BY dpi.created_at DESC
      LIMIT ? OFFSET ?
    `;

    // Execute count query
    const [[{ total }]] = await dbPromise.query(countQuery, queryParams);

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
      const images = item.images ? JSON.parse(item.images) : [];

      // Process individual images from JOIN
      const individualImages = [];
      if (item.image_urls) {
        const urls = item.image_urls.split(',');
        const altTexts = item.alt_texts ? item.alt_texts.split(',') : [];
        const primaryFlags = item.primary_flags ? item.primary_flags.split(',') : [];
        
        urls.forEach((url, index) => {
          if (url) {
            individualImages.push({
              url: url,
              alt_text: altTexts[index] || `${item.title} - Image ${index + 1}`,
              is_primary: primaryFlags[index] === '1'
            });
          }
        });
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
        images: individualImages.length > 0 ? individualImages : images,
        createdAt: item.created_at,
        userId: item.user_id
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
    console.error("Error retrieving development files:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Optional: Function to get a single development project by ID
const retrieveDevFileById = async (req, res) => {
  try {
    const { id } = req.params;

    // Query to get project details
    const [projects] = await dbPromise.query(
      `SELECT 
        dpi.*,
        GROUP_CONCAT(DISTINCT di.url) AS image_urls,
        GROUP_CONCAT(DISTINCT di.alt_text) AS alt_texts,
        GROUP_CONCAT(DISTINCT di.is_primary) AS primary_flags,
        GROUP_CONCAT(DISTINCT di.width) AS widths,
        GROUP_CONCAT(DISTINCT di.height) AS heights,
        GROUP_CONCAT(DISTINCT di.size) AS sizes,
        GROUP_CONCAT(DISTINCT di.format) AS formats
      FROM dev_portfolio_items dpi
      LEFT JOIN dev_images di ON dpi.id = di.project_id
      WHERE dpi.id = ?
      GROUP BY dpi.id`,
      [id]
    );

    if (projects.length === 0) {
      return res.status(404).json({ error: "Development project not found" });
    }

    const project = projects[0];

    // Process images
    const images = [];
    if (project.image_urls) {
      const urls = project.image_urls.split(',');
      const altTexts = project.alt_texts ? project.alt_texts.split(',') : [];
      const primaryFlags = project.primary_flags ? project.primary_flags.split(',') : [];
      const widths = project.widths ? project.widths.split(',') : [];
      const heights = project.heights ? project.heights.split(',') : [];
      const sizes = project.sizes ? project.sizes.split(',') : [];
      const formats = project.formats ? project.formats.split(',') : [];

      urls.forEach((url, index) => {
        if (url) {
          images.push({
            url: url,
            alt_text: altTexts[index] || `${project.title} - Image ${index + 1}`,
            is_primary: primaryFlags[index] === '1',
            width: widths[index] ? parseInt(widths[index]) : null,
            height: heights[index] ? parseInt(heights[index]) : null,
            size: sizes[index] ? parseInt(sizes[index]) : null,
            format: formats[index] || null
          });
        }
      });
    }

    // Parse JSON fields
    const formattedProject = {
      id: project.id,
      title: project.title,
      description: project.description || '',
      category: project.category,
      type: project.type,
      url: project.url || '',
      previewUrl: project.preview_url || '',
      status: project.status,
      year: project.year,
      tags: project.tags ? JSON.parse(project.tags) : [],
      technologies: project.technologies ? JSON.parse(project.technologies) : [],
      images: images.length > 0 ? images : (project.images ? JSON.parse(project.images) : []),
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      userId: project.user_id
    };

    res.status(200).json(formattedProject);
  } catch (error) {
    console.error("Error retrieving development file by ID:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  retrieveDevFiles,
  retrieveDevFileById
};