const express = require('express');
const { transferttirdparties, transferFunds } = require('../controllers/paymentController');
const authenticate = require('../middlewares/authenticate');
const router = express.Router();


router.post('/transfer', transferFunds);
router.post('/transferthirdparties', authenticate, transferttirdparties);

module.exports = router;