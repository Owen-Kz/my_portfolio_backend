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
}).array("files", 20); // Max 20 files

const uploadDevFiles = async (req, res) => {
    console.log("file upload starting")
  try {
    uploads(req, res, async function (err) {
      if (err) {
        console.error("Upload error:", err);
        return res.status(500).json({ error: err.message });
      }

      const { 
        title, 
        category, 
        type, 
        description, 
        url, 
        previewUrl, 
        status, 
        year, 
        tags, 
        technologies 
      } = req.body;
      
      // Validate required fields
      if (!title || !category || !type || !status || !year) {
        return res.status(400).json({ 
          error: "Title, category, type, status, and year are required" 
        });
      }

      if(req.files && req.files.length > 20) {
        return res.status(400).json({ error: "You can upload a maximum of 20 files" });
      }
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "At least one image is required" });
      }

      // Validate year
      const currentYear = new Date().getFullYear();
      if (year < 2000 || year > currentYear + 1) {
        return res.status(400).json({ 
          error: `Year must be between 2000 and ${currentYear + 1}` 
        });
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
        // 1. Check for duplicate development project by title
        const [existingProjects] = await connection.query(
          "SELECT id FROM dev_portfolio_items WHERE title = ?", 
          [title]
        );

        if (existingProjects.length > 0) {
          await connection.rollback();
          connection.release();
          return res.status(409).json({ 
            error: "A development project with this title already exists" 
          });
        }

        // 2. Create development project
        const projectId = await generateID();
        
        // Prepare data for insertion
        const projectData = {
          id: projectId,
          title,
          description: description || null,
          category,
          type,
          url: url || null,
          preview_url: previewUrl || null,
          status,
          year,
          tags: tags ? JSON.stringify(tags.split(',').map(tag => tag.trim())) : JSON.stringify([]),
          technologies: technologies ? JSON.stringify(technologies.split(',').map(tech => tech.trim())) : JSON.stringify([]),
          images: JSON.stringify([]), // Will be populated with uploaded images
          user_id: req.user.user_id
        };

        await connection.query(
          `INSERT INTO dev_portfolio_items 
          (id, title, description, category, type, url, preview_url, status, year, tags, technologies, images, user_id) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectData.id,
            projectData.title,
            projectData.description,
            projectData.category,
            projectData.type,
            projectData.url,
            projectData.preview_url,
            projectData.status,
            projectData.year,
            projectData.tags,
            projectData.technologies,
            projectData.images,
            projectData.user_id
          ]
        );

        // 3. Upload images to Cloudinary and update project
        const uploadedImages = [];
        
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          
          try {
            // Check for duplicate image by filename
            const [existingImages] = await connection.query(
              "SELECT id FROM dev_images WHERE original_filename = ? AND project_id = ?",
              [file.originalname, projectId]
            );

            if (existingImages.length > 0) {
              await connection.rollback();
              connection.release();
              return res.status(409).json({ 
                error: `An image with the name '${file.originalname}' already exists for this project` 
              });
            }

            const result = await cloudinary.uploader.upload(file.path, {
              folder: `dev-portfolio/${projectId}`,
              resource_type: "auto",
              transformation: [
                { quality: "auto", fetch_format: "auto" }
              ]
            });

            // Store image info in dev_images table
            const imageId = await generateID();
            await connection.query(
              `INSERT INTO dev_images 
              (id, project_id, url, original_filename, alt_text, is_primary, width, height, size, format, cloudinary_public_id) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                imageId,
                projectId,
                result.secure_url,
                file.originalname,
                `${title} - Screenshot ${i + 1}`,
                i === 0, // First image is primary
                result.width,
                result.height,
                result.bytes,
                result.format,
                result.public_id
              ]
            );

            uploadedImages.push({
              url: result.secure_url,
              alt_text: `${title} - Screenshot ${i + 1}`,
              is_primary: i === 0,
              width: result.width,
              height: result.height
            });

            // Delete local file after upload
            fs.unlink(file.path, (err) => {
              if (err) console.error("Error deleting local file:", err);
            });
          } catch (error) {
            console.error("Error uploading to Cloudinary:", error);
            throw error; // Will trigger transaction rollback
          }
        }

        // 4. Update project with image URLs
        await connection.query(
          "UPDATE dev_portfolio_items SET images = ? WHERE id = ?",
          [JSON.stringify(uploadedImages), projectId]
        );

        // Commit transaction
        await connection.commit();
        connection.release();

        return res.json({ 
          success: true,
          message: "Development project uploaded successfully",
          projectId,
          data: {
            ...projectData,
            images: uploadedImages
          }
        });

      } catch (error) {
        // Rollback transaction on error
        await connection.rollback();
        connection.release();
        console.error("Database error:", error);
        return res.status(500).json({ error: "Failed to save development project" });
      }
    });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = uploadDevFiles;