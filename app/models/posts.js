// get an instance of mongoose and mongo
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model and pass it using
// module.exports

module.exports = mongoose.model('Posts', new Schema({
 name: String,
 description: String,
 owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
 },
}));