var express = require('express');
var router = express.Router();

var jwt = require('express-jwt');
var auth = jwt({
    secret: process.env.JWT_SECRET,
    userProperty: 'payload'
});


var ctrlExtraction = require('../controllers/extraction');
var ctrlTransaction = require('../controllers/transaction');


// Extraction
router.post('/extractions/execute', ctrlExtraction.extractionsExecute);

// Transaction
router.post('/transactions/insert', ctrlTransaction.transactionsInsert);

module.exports = router;
