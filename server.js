// get the packages we need

function responseFormater(success, json, error = undefined){
	json.success = success;

	if(error != undefined)
		json.error = error;

	return json;
}
const cors = require('cors');
var express = require('express')
var app = express();

var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');
require('mongoose-double')(mongoose);

var crypto = require('crypto');

var jwt = require('jsonwebtoken');
var config = require('./config');

var User = require('./app/models/user');
var Posts = require('./app/models/posts');
var Device = require('./app/models/device');
var Sensor = require('./app/models/sensor');

// configuration

var port = process.env.PORT || 8082;
mongoose.connect(config.database);

app.use(cors());
app.options('*', cors());

app.set('superSecret', config.secret);

// use body parser so we can get info from POST
// and/or URL parameters
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));

//
// routes
//



// add demo user

app.get('/setup', function (req, res) {
	// create a sample user
	var nick = new User({
		name : 'jahazieljbh',
		password: 'jahazieljbh',
		admin: true
	});

	nick.save(function(err) {
		if (err) throw err;

		console.log('User saved suscessfully');
		res.json({success: true});	
	});
});

// api routes

var apiRoutes = express.Router();

// Sign up a new user

apiRoutes.post('/signup', function(req, res){
	var name = req.body.name;
	var password = req.body.pass;
	var password_confirm = req.body.pass_confirm;

	if(name == undefined || password == undefined || password_confirm == undefined){
		res.json(responseFormater(false, {message:"name, pass and pass_confirm are required"}, "name, pass and pass_confirm are required"));
	}
	else if(password != password_confirm){
		res.json(responseFormater(false, {message:"pass and pass_confirm must match"}, "pass and pass_confirm must match"));
	}
	else{
		name = name.toLowerCase();
		User.count({name : name}, function(error, count){
			console.log(count);
			if(error){
				console.trace("I am here");
				res.json({fatal: "Fallo en querie"});
			}
			else if(count != 0){
				res.json(responseFormater(false, {message:"username already exist. Login or choose another one"}, "username already exist. Login or choose another one"));
			}
			else{
				User.create({name : name, password : password}, function(error, user){
					if(error){
						console.trace("I am here");
						res.json({fatal: "Fallo en querie"});
					}
					else{
						user.password = undefined;
						res.json(responseFormater(true, {user: user, message:"User saved suscessfully"}, ""))
					}
				});
			}
		});
	}
})

// Get a token
apiRoutes.post('/login', function (req, res) {
 
 	res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,contenttype'); // If needed
    //res.setHeader('Access-Control-Allow-Credentials', true); // If needed

    var name = req.body.name;
    var password = req.body.password;

    if(name == undefined || password == undefined){
    	res.json(responseFormater(false, {}, "name and pass are required"));
    	return;
    }

	//find the user
	User.findOne({name: name.toLowerCase()}, function (err, user) 
	{
		if (err) throw err;
	
		if (!user) {
			res.json({success: false, message: 
				'Authentication failed, User not found'});
		}
		else if (user) {
			// check if password matches
			if (user.password != password) {
				res.json({success : false, message : 
					'Authentication failed, wrong password'});
			}
			else {
				// user and password is right
				var id = user._id.toString();
				var token = jwt.sign( {uid : id}, app.get('superSecret'), {
					expiresIn : 60 * 60
				});

				// return the information including token as JSON

				res.json({
					success : true,
					message : 'Enjoy your token !',
					user: name,
					token : token
				});
				
			}
		}
	});
});

// route to middleware to verify a token

apiRoutes.use(function (req, res, next) {
	// check header or url parameters or post parameters for token
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,contenttype'); // If needed
    //res.setHeader('Access-Control-Allow-Credentials', true); // If needed


	var token = req.body.token ||
	 			req.query.token ||
	 			req.headers['x-access-token'];
	// decode token
	if (token)	{
		// verifies secret and checks up
		jwt.verify(token, app.get('superSecret'), function (err, decoded) {
			if (err) {
				return res.json({success: false, message : 'Failed to authenticate token' });

			} else {
				// is everything is good, save to request for use in other routes
				User.findOne({_id : mongoose.Types.ObjectId(decoded.uid) }, function(error, obj){
					if(error){
						res.json(responseFormater(false, {}, "Invalid user. Sorry."));
						return;
					}
					req.user = obj;
					next();
				});
			}
		});
	}else {
		// if there is not token, return an error

		return res.status(403).send( {
			success: false,
			message: 'No token provided'
		});
	}
});

apiRoutes.get('/device', function(req, res){
	Device.find({owner : req.user._id}, function(error, devices){
		res.json(responseFormater(true, {devices:devices}));
	});
});
//add posts
apiRoutes.get('/posts', function(req, res){
	Posts.find({owner : req.user._id}, function(error, posts){
		res.json(responseFormater(true, {posts:posts}));
	});
});

apiRoutes.post('/device', function(req, res){

	var name = req.body.name;
	var desc = req.body.desc;

	if(name == undefined || desc == undefined){
		res.json(responseFormater(false, {}, "name and desc are required"));
	}
	else{
		Device.count({owner : req.user._id, name: name}, function(error, count){

			if(count != 0){
				res.json(responseFormater(false, {}, "That device already exist. Try another name"));
			}
			else{
				Device.create({ name : name, description : desc, owner: req.user._id}, function(error, device){
					if(error){
						console.log(error);
						console.trace();
						res.json(responseFormater(false, {}, "Error while making the query. Please report"));
					}
					else{
						device.owner = undefined;
						res.json(responseFormater(true, {device: device}));
					}
				});
			}
		});
	}
});

apiRoutes.post('/posts', function(req, res){

	var name = req.body.name;
	var desc = req.body.desc;

	if(name == undefined || desc == undefined){
		res.json(responseFormater(false, {}, "name and desc are required"));
	}
	else{
		Posts.count({owner : req.user._id, name: name}, function(error, count){

			if(count != 0){
				res.json(responseFormater(false, {}, "That posts already exist. Try another name"));
			}
			else{
				Posts.create({ name : name, description : desc, owner: req.user._id}, function(error, posts){
					if(error){
						console.log(error);
						console.trace();
						res.json(responseFormater(false, {}, "Error while making the query. Please report"));
					}
					else{
						posts.owner = undefined;
						res.json(responseFormater(true, {posts: posts}));
					}
				});
			}
		});
	}
});

apiRoutes.post('/device/delete', function(req, res){

	var id = req.body.id;

	if(id == undefined ){
		res.json(responseFormater(false, {}, "id is required"));
	}
	else if (!id.match(/^[0-9a-fA-F]{24}$/)) {
		res.json(responseFormater(false, {}, "id is invalid"));
	}
	else{
		Device.findOne({owner : req.user._id, _id: mongoose.Types.ObjectId(id)}, function(error, obj){

			if(obj == null){
				res.json(responseFormater(false, {}, "id is invalid"));
			}
			else{
				Device.remove({ _id: mongoose.Types.ObjectId(id)}, function(error){
					if(error){
						res.json(responseFormater(false, {}, "Please report this incident"));
						console.trace();
					}
					else{
						res.json(responseFormater( true, {msg: "The device is gone"}));
					}
				});	
			}
		});
	}
});

apiRoutes.post('/posts/delete', function(req, res){

	var id = req.body.id;

	if(id == undefined ){
		res.json(responseFormater(false, {}, "id is required"));
	}
	else if (!id.match(/^[0-9a-fA-F]{24}$/)) {
		res.json(responseFormater(false, {}, "id is invalid"));
	}
	else{
		Posts.findOne({owner : req.user._id, _id: mongoose.Types.ObjectId(id)}, function(error, obj){

			if(obj == null){
				res.json(responseFormater(false, {}, "id is invalid"));
			}
			else{
				Posts.remove({ _id: mongoose.Types.ObjectId(id)}, function(error){
					if(error){
						res.json(responseFormater(false, {}, "Please report this incident"));
						console.trace();
					}
					else{
						res.json(responseFormater( true, {msg: "The posts is gone"}));
					}
				});	
			}
		});
	}
});

apiRoutes.post('/device/patch', function(req, res){

	var save = function(device, changed){

		device.save(function(err){
			if(err){
				res.json("Algo salio mal");
			}
			else{
				device.owner = undefined;
				res.json(responseFormater(true, {device: device} ));
			}
		})
	}

	var id = req.body.id;
	var changed = false;

	var name = req.body.name;
	var desc = req.body.desc;

	if(id == undefined ){
		res.json(responseFormater(false, {}, "id is required"));
	}
	else if (!id.match(/^[0-9a-fA-F]{24}$/)) {
		res.json(responseFormater(false, {}, "id is invalid"));
	}
	else{
		Device.findOne({owner : req.user._id, _id: mongoose.Types.ObjectId(id)}, function(error, obj){
			
			if(obj == null){
				res.json(responseFormater(false, {}, "no encontrado"));
				return;
			}

			if(desc != undefined && desc != obj.description){
				obj.description = desc;
				changed = true;
			}

			if(name != undefined && name != obj.name){
				Device.count({owner: req.user._id, name: name}, function(error,count){
					if(count != 0){
						res.json(responseFormater(false, {}, "A device with that name already exists"));
					}
					else{
						obj.name = name;
						save(obj, true);
					}
				});
			}
			else{
				save(obj, changed);
			}

		});
	}
});

apiRoutes.post('/posts/patch', function(req, res){

	var save = function(posts, changed){

		posts.save(function(err){
			if(err){
				res.json("Algo salio mal");
			}
			else{
				posts.owner = undefined;
				res.json(responseFormater(true, {posts: posts} ));
			}
		})
	}

	var id = req.body.id;
	var changed = false;

	var name = req.body.name;
	var desc = req.body.desc;

	if(id == undefined ){
		res.json(responseFormater(false, {}, "id is required"));
	}
	else if (!id.match(/^[0-9a-fA-F]{24}$/)) {
		res.json(responseFormater(false, {}, "id is invalid"));
	}
	else{
		Posts.findOne({owner : req.user._id, _id: mongoose.Types.ObjectId(id)}, function(error, obj){
			
			if(obj == null){
				res.json(responseFormater(false, {}, "no encontrado"));
				return;
			}

			if(desc != undefined && desc != obj.description){
				obj.description = desc;
				changed = true;
			}

			if(name != undefined && name != obj.name){
				Posts.count({owner: req.user._id, name: name}, function(error,count){
					if(count != 0){
						res.json(responseFormater(false, {}, "A Posts with that name already exists"));
					}
					else{
						obj.name = name;
						save(obj, true);
					}
				});
			}
			else{
				save(obj, changed);
			}

		});
	}
});

apiRoutes.post('/device/:id/sensor', function(req, res){
	var id = req.params.id;
	if (id == undefined || !id.match(/^[0-9a-fA-F]{24}$/)) {
		res.json(responseFormater(false, {}, "id is invalid"));
	}
	else{
		Device.findOne({owner : req.user._id, _id: mongoose.Types.ObjectId(id)}, function(error, device){
			if(error){
				res.json(responseFormater(false, {}, "unkknown error"));
				console.trace();
			}
			else if(device == null){
				res.json(responseFormater(false, {}, "unkknown device"));
			}
			else{
				var name = req.body.name;
				var value = req.body.value;

				if(name == undefined || value == undefined || name == ""){
					res.json(responseFormater(false, {}, "name and value must be present"));
				}
				else if(isNaN(value)){
					res.json(responseFormater(false, {}, "Value must be numeric"));
				}
				else{
					Sensor.create({name: name, numericValue: +value, owner: device._id}, function(error, sensor){
						res.json(responseFormater(!error, {}));
					});
				}
			}
		});
	}
});

apiRoutes.post('/device/:id/sensor/img', function(req, res){
	
	var id = req.params.id;
	var label = req.body.label;
	var ref = req.body.ref

	if (id == undefined || !id.match(/^[0-9a-fA-F]{24}$/)) {
		res.json(responseFormater(false, {}, "id is invalid"));
	}
	else if (label == undefined || label == "") {
		res.json(responseFormater(false, {}, "label is invalid"));
	}
	else if (ref == undefined || ref == "") {
		res.json(responseFormater(false, {}, "ref is invalid"));
	}
	else{
		Sensor.findOne({owner : req.user._id, owner: mongoose.Types.ObjectId(id), name : label}, function(error, device){
			if(error || device == undefined || device == null){
				res.json(responseFormater(false, error, "unkknown error"));
			}
			else{
				device.images.push( mongoose.Types.ObjectId(ref) );
				device.save()
				res.json({success: true});	
			}
		});
	}
});


app.use('/api', apiRoutes);
app.disable('etag');

// start the server
app.listen(port);
