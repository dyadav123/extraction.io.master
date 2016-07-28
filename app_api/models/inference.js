/**
 * Created by j2 on 1/2/16.
 */
var mongoose = require('mongoose');

var conceptSchema = new mongoose.Schema({
    name: String,
    in: Object,
    out: Object,
    type: String,
    isRef: Boolean,
    isOutRef: Boolean,
    comment: String,
    concepts: [{ type: Object, ref: 'conceptSchema' }],
    // outputs: [{ type: Object, ref: 'conceptSchema' }],
    predicate: { type: Object, ref: 'conceptSchema' },
    predicates: { type: Object, ref: 'conceptSchema' }
});

var inferenceSchema = new mongoose.Schema({
    name: {type: String, required: true},
    family: String,
    createdOn: {type: Date, "default": Date.now},
    inputs:[conceptSchema],
    outputs:[conceptSchema],
    concepts: [conceptSchema]
});

var inferenceSchema = new mongoose.Schema({
    name: {type: String, required: true},
    family: String,
    createdOn: {type: Date, "default": Date.now},
    inputs:[conceptSchema],
    outputs:[conceptSchema],
    concepts: [conceptSchema]
});

var inferenceSetSchema = new mongoose.Schema({
  name: {type: String, required: true},
  family: String,
  createdOn: {type: Date, "default": Date.now},
  inferences: [inferenceSchema]
});

mongoose.model('inference', inferenceSchema);
mongoose.model('inferenceSet', inferenceSetSchema);
