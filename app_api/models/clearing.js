/**
 * Created by j2 on 5/25/16.
 */

var mongoose = require('mongoose');
require('./inference.js');
require('./transaction.js');

var partnerSchema = new mongoose.Schema({
  code: {type: String, required: true},
  createdOn: {type: Date, "default": Date.now},
  type: {type: String, required: true}
});

var clearingSchema = new mongoose.Schema(
  {
    name: {type: String, required: true},
    createdOn: {type: Date, "default": Date.now},
    transaction: {type: Object, ref: 'transactionSchema'},
    map: {type: Object, ref: 'inferenceSetSchema'},
    database: {type: String, required: true},
    partner: partnerSchema,
  },
  { 'strict': false }
);

mongoose.model('clearing', clearingSchema);
