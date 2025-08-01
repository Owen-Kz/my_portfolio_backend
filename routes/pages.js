const express = require('express');
const router = express.Router();

const retrieveFiles = require('../controllers/retrieveFiles');
const uploadFiles = require('../controllers/uploadFiles');
const login = require('../controllers/auth/login');
const signup = require('../controllers/auth/signup');
const deleteItem = require('../controllers/helpers/deleteFile');
const ValidateToken = require('../controllers/auth/ValidateToken');
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

router.get("/getMyPortfolioItems", ValidateToken, require('../controllers/helpers/getPorfolioItems'));
router.get("/countMyPortfolioItems", ValidateToken, require('../controllers/helpers/getAllMyItems'));
// router.get("/getPortfolioItemById", ValidateToken, require('../controllers/helpers/getPortfolioItemById'));
// router.get("/getPortfolioItemsByCategory", ValidateToken, require('../controllers/helpers/getPortfolioItemsByCategory'));
// router.get("/getPortfolioItemsByTag", ValidateToken, require('../controllers/helpers/getPortfolioItemsByTag'));
// router.get("/getPortfolioItemsBySearch", ValidateToken, require('../controllers/helpers/getPortfolioItemsBySearch'));
// router.get("/getPortfolioItemsByUser", ValidateToken, require('../controllers/helpers/getPortfolioItemsByUser'));
router.post("/deleteItem", ValidateToken, deleteItem)
router.post("/uploadFiles", ValidateToken, uploadFiles);

router.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to InkCase Backend API' });
});

module.exports = router