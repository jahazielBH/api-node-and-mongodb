// get an instance of mongoose and mongo
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
require('mongoose-double')(mongoose);

// set up a mongoose model and pass it using
// module.exports

module.exports = mongoose.model('Sensor', new Schema({
 name: String,
 numericValue: Schema.Types.Double,
 owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device'
 },
 date: { type: Date, default: Date.now },
 images: [{ type : mongoose.Schema.Types.ObjectId }]
 
}));