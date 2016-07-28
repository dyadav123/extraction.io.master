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

var dictionarySchema = new mongoose.Schema({
  key: {type: String, required: true},
  input: {type: String, required: true},
  normalized: {type: String, required: true}
});

var fieldSchema = new mongoose.Schema({
  key: {type: String, required: true},
  value: String,
  type:
  {
    type: String,
    enum : ['F7', 'client', 'partner'],
    default : 'F7'
  },
  source:
  {
    type: String,
    enum : ['collection', 'transaction', 'value'],
    default : 'collection'
  }
});

var operatorSchema = new mongoose.Schema({
  op:
  {
    type: String,
    enum : ['$eq', '$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin',
      '$or', '$and', '$not', '$nor', '$exists', '$type',
      '$mod', '$regex', '$text', '$where',
      '$geoWithin', '$geoIntersects', '$near', '$nearSphere',
      '$all', '$elemMatch', '$size',
      '$bitsAllSet', '$bitsAnySet', '$bitsAllClear', '$bitsAnyClear',
      '$comment', '$elemMatch', '$meta', '$slice'],
    default : '$eq'
  },
  category:
  {
    type: String,
    enum : ['comparison', 'logical', 'element', 'evaluation', 'geospatial', 'array', 'bitwise', 'comment', 'projection'],
    default : 'comparison'
  }
});

var expressionSchema = new mongoose.Schema({
  comment: String,
  fields: [fieldSchema],
  // expressions: [{ type: Object, ref: 'expressionSchema', required: false}],
  operator: {type: operatorSchema, required: false}
});

expressionSchema.add({ expressions: [expressionSchema] });

var refMetaSchema = new mongoose.Schema({
  coll: {type: String, required: true},
  expression: expressionSchema
});

var referenceSchema = new mongoose.Schema({
  name: {type: String, required: true},
  createdOn: {type: Date, "default": Date.now},
  partner: partnerSchema,
  dictionary: [dictionarySchema],
  refMeta: [refMetaSchema]
});

var enrichmentSchema = new mongoose.Schema({
  name: {type: String, required: true},
  createdOn: {type: Date, "default": Date.now},
  transaction: {type: Object, ref: 'transactionSchema'},
  reference: referenceSchema,
  map: {type: Object, ref: 'inferenceSetSchema'},
  database: String,
});

mongoose.model('enrichment', enrichmentSchema);
mongoose.model('enrichmentReference', referenceSchema);
mongoose.model('enrichmentPartner', partnerSchema);
