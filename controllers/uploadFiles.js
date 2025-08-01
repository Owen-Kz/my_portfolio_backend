const multer = require("multer");
const fs = require("fs");
const path = require("path");
const dbPromise = require("../routes/db.config");
const generateID = require("../utils/generateId");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Set up upload folder
const folderPath = path.join(__dirname, "../public/userUploads");
fs.access(folderPath, fs.constants.W_OK, (err) => {
  if (err) console.error(`The folder '${folderPath}' is not writable:`, err);
});

// Allowed file types
const allowedFileTypes = [
  "image/jpeg", "image/png", "image/gif", "image/jpg", "image/webp"
];

// Multer configuration
const storage = multer.diskStorage({
  destination: folderPath,
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    cb(null, uniqueSuffix + fileExtension);
  }
});

const uploads = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
}).array("files", 10); // Max 10 files

const uploadFiles = async (req, res) => {
  try {
    uploads(req, res, async function (err) {
      if (err) {
        console.error("Upload error:", err);
        return res.status(500).json({ error: err.message });
      }

      const { title, category, description, tags } = req.body;
      
      // Validate required fields
      if (!title || !category) {
        return res.status(400).json({ error: "Title and category are required" });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "At least one image is required" });
      }

      // Validate file types
      for (const file of req.files) {
        if (!allowedFileTypes.includes(file.mimetype)) {
          return res.status(400).json({ 
            error: `Unsupported file type: ${file.mimetype}. Only images are allowed.`
          });
        }
      }

      // Start transaction
      const connection = await dbPromise.getConnection();
      await connection.beginTransaction();

      try {
        // 1. Check for duplicate portfolio item by title
        const [existingItems] = await connection.query(
          "SELECT item_id FROM portfolio_items WHERE title = ?", 
          [title]
        );

        if (existingItems.length > 0) {
          await connection.rollback();
          connection.release();
          return res.status(409).json({ 
            error: "A portfolio item with this title already exists" 
          });
        }

        // 2. Check if category exists or create new one
        let [categoryRows] = await connection.query(
          "SELECT category_id FROM categories WHERE name = ?", 
          [category]
        );

        let categoryId;
        if (categoryRows.length === 0) {
          const [result] = await connection.query(
            "INSERT INTO categories (name, slug) VALUES (?, ?)",
            [category, category.toLowerCase().replace(/\s+/g, '-')]
          );
          categoryId = result.insertId;
        } else {
          categoryId = categoryRows[0].category_id;
        }

        // 3. Create portfolio item
        const itemId = await generateID();
        const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
        
        await connection.query(
          "INSERT INTO portfolio_items (item_id, title, description, category_id, slug, user_id) VALUES (?, ?, ?, ?, ?, ?)",
          [itemId, title, description, categoryId, slug, req.user.user_id]
        );

        // 4. Process tags if provided
        if (tags && typeof tags === 'string') {
          const tagNames = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
          
          for (const tagName of tagNames) {
            // Check if tag exists or create new one
            let [tagRows] = await connection.query(
              "SELECT tag_id FROM tags WHERE name = ?", 
              [tagName]
            );

            let tagId;
            if (tagRows.length === 0) {
              const [result] = await connection.query(
                "INSERT INTO tags (name, slug) VALUES (?, ?)",
                [tagName, tagName.toLowerCase().replace(/\s+/g, '-')]
              );
              tagId = result.insertId;
            } else {
              tagId = tagRows[0].tag_id;
            }

            // Link tag to portfolio item
            await connection.query(
              "INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)",
              [itemId, tagId]
            );
          }
        }

        // 5. Upload images to Cloudinary and save to database
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          
          try {
            // Check for duplicate image by filename
            const [existingImages] = await connection.query(
              "SELECT image_id FROM images WHERE url LIKE ?",
              [`%${file.originalname}%`]
            );

            if (existingImages.length > 0) {
              await connection.rollback();
              connection.release();
              return res.status(409).json({ 
                error: `An image with the name '${file.originalname}' already exists` 
              });
            }

            const result = await cloudinary.uploader.upload(file.path, {
              folder: `portfolio/${itemId}`,
              resource_type: "auto"
            });

            await connection.query(
              "INSERT INTO images (item_id, url, alt_text, is_primary, width, height, size, format) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [
                itemId,
                result.secure_url,
                `${title} - Image ${i + 1}`,
                i === 0, // First image is primary
                result.width,
                result.height,
                result.bytes,
                result.format
              ]
            );

            // Delete local file after upload
            fs.unlink(file.path, (err) => {
              if (err) console.error("Error deleting local file:", err);
            });
          } catch (error) {
            console.error("Error uploading to Cloudinary:", error);
            throw error; // Will trigger transaction rollback
          }
        }

        // Commit transaction
        await connection.commit();
        connection.release();

        return res.json({ 
          success: true,
          message: "Portfolio item uploaded successfully",
          itemId
        });

      } catch (error) {
        // Rollback transaction on error
        await connection.rollback();
        connection.release();
        console.error("Database error:", error);
        return res.status(500).json({ error: "Failed to save portfolio item" });
      }
    });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = uploadFiles;