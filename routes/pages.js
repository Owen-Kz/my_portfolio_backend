const express = require('express');
const router = express.Router();

const retrieveFiles = require('../controllers/retrieveFiles');
const uploadFiles = require('../controllers/uploadFiles');
const login = require('../controllers/auth/login');
const signup = require('../controllers/auth/signup');
const deleteItem = require('../controllers/helpers/deleteFile');
const ValidateToken = require('../controllers/auth/ValidateToken');
const {retrieveDevFiles, retrieveDevFileById} = require('../controllers/retrieveDevFiles');
const {getDevPortfolioItems} = require('../controllers/helpers/getDevPorfolioItems');
const uploadDevFiles = require('../controllers/uploadDevFiles');

// Import the missing functions
const getPortfolioItems = require('../controllers/helpers/getPorfolioItems');
const getDevPortfolioItems = require('../controllers/helpers/getDevPorfolioItems'); // You already have this, but make sure it's the correct import

// Enable CORS for this router
router.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

router.get("/files", retrieveFiles);
router.post("/login", login)
router.post("/signup", signup)
router.post("/loggedIn", require('../controllers/auth/loggedIn'));

// Fixed routes - use the imported functions directly
router.get("/getMyPortfolioItems", ValidateToken, getPortfolioItems);
router.get("/getDevPortfolioItems", ValidateToken, getDevPortfolioItems);
router.get("/countMyPortfolioItems", ValidateToken, getDevPortfolioItems); // This might be wrong - should it be a different function?
// router.get("/getPortfolioItemById", ValidateToken, require('../controllers/helpers/getPortfolioItemById'));
// router.get("/getPortfolioItemsByCategory", ValidateToken, require('../controllers/helpers/getPortfolioItemsByCategory'));
// router.get("/getPortfolioItemsByTag", ValidateToken, require('../controllers/helpers/getPortfolioItemsByTag'));
// router.get("/getPortfolioItemsBySearch", ValidateToken, require('../controllers/helpers/getPortfolioItemsBySearch'));
// router.get("/getPortfolioItemsByUser", ValidateToken, require('../controllers/helpers/getPortfolioItemsByUser'));
router.post("/deleteItem", ValidateToken, deleteItem)
router.post("/uploadFiles", ValidateToken, uploadFiles);
router.post("/uploadDevFiles", ValidateToken, uploadDevFiles);
router.get("/dev-portfolio", retrieveDevFiles);
router.get("/dev-portfolio/:id", retrieveDevFileById);
router.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to InkCase Backend API' });
});

module.exports = router;