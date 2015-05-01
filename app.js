//dependencies for each module used
var express = require('express');
var passport = require('passport');
var InstagramStrategy = require('passport-instagram').Strategy;
var FitbitStrategy = require('passport-fitbit').Strategy;
var http = require('http');
var path = require('path');
var handlebars = require('express-handlebars');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var dotenv = require('dotenv');
var mongoose = require('mongoose');
var Instagram = require('instagram-node-lib');
var async = require('async');
var app = express();

//local dependencies
var models = require('./models');

//client id and client secret here, taken from .env
dotenv.load();
var INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID;
var INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET;
var INSTAGRAM_CALLBACK_URL = process.env.INSTAGRAM_CALLBACK_URL;
Instagram.set('client_id', INSTAGRAM_CLIENT_ID);
Instagram.set('client_secret', INSTAGRAM_CLIENT_SECRET);
// fitbit env stuff
var FITBIT_CLIENT_ID = process.env.FITBIT_CLIENT_ID;
var FITBIT_CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET;
var FITBIT_CALLBACK_URL = process.env.FITBIT_CALLBACK_URL;


//connect to database
mongoose.connect(process.env.MONGOLAB_URI || 'mongodb://localhost/db');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
  console.log("Database connected succesfully.");
});

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Instagram profile is
//   serialized and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the InstagramStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Instagram
//   profile), and invoke a callback with a user object.
passport.use(new InstagramStrategy({
    clientID: INSTAGRAM_CLIENT_ID,
    clientSecret: INSTAGRAM_CLIENT_SECRET,
    callbackURL: INSTAGRAM_CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
   models.User.findOne({
    "ig_id": profile.id
   }, function(err, user) {
      if (err) {
        return done(err); 
      }
      
      //didnt find a user
      if (!user) {
        newUser = new models.User({
          name: profile.username, 
          ig_id: profile.id,
          ig_access_token: accessToken
        });

        newUser.save(function(err) {
          if(err) {
            console.log(err);
          } else {
            console.log('user: ' + newUser.name + " created.");
          }
          return done(null, newUser);
        });
      } else {
        //update user here
        user.ig_access_token = accessToken;
        user.save();
        process.nextTick(function () {

          //
          // returns user from db
          //

          return done(null, user);
        });
      }
   });
  }
));



//begin fitbit strategy

passport.use(new FitbitStrategy({
    consumerKey: FITBIT_CLIENT_ID,
    consumerSecret: FITBIT_CLIENT_SECRET,
    callbackURL: FITBIT_CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
   models.User.findOne({
    "fit_id": profile.id
   }, function(err, user) {
      if (err) {
        return done(err); 
      }
      console.log(user.name + " has logged in!");
      //didnt find a user
      if (!user) {
        newUser = new models.User({
          name: profile.displayName, 
          fit_id: profile.id,
          fit_access_token: accessToken
        });

        newUser.save(function(err) {
          if(err) {
            console.log(err);
          } else {
            console.log('user: ' + newUser.name + " created.");
          }
          return done(null, newUser);
        });
      } else {
        //update user here
        user.fit_access_token = accessToken;
        user.name = profile.displayName;
        user.save();
        process.nextTick(function () {

          //
          // returns user from db
          //

          return done(null, user);
        });
      }
   });
  }
));

//end fitbit strategy 


//Configures the Template engine
app.engine('handlebars', handlebars({defaultLayout: 'layout'}));
app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({ secret: 'keyboard cat',
                  saveUninitialized: true,
                  resave: true}));
app.use(passport.initialize());
app.use(passport.session());

//set environment ports and start application
app.set('port', process.env.PORT || 3000);

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { 
    return next(); 
  }
  res.redirect('/login');
}


function ensureAuthenticatedInstagram(req, res, next) {
  if (req.isAuthenticated() && !!req.user.ig_id) { 
    return next(); 
  }
  res.redirect('/login');
}


//routes
app.get('/', function(req, res){
  res.render('login');
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', {user: req.user});
});

app.get('/igphotos', ensureAuthenticatedInstagram, function(req, res){
  var query  = models.User.where({ ig_id: req.user.ig_id });
  query.findOne(function (err, user) {
    if (err) return err;
    if (user) {
      // doc may be null if no document matched
      Instagram.users.liked_by_self({
        access_token: user.ig_access_token,
        complete: function(data) {
          console.log(data);
          //Map will iterate through the returned data obj
          var imageArr = data.map(function(item) {
            //create temporary json object
            tempJSON = {};
            tempJSON.url = item.images.low_resolution.url;
            //insert json object into image array
            return tempJSON;
          });
          res.render('photos', {photos: imageArr});
        }
      }); 
    }
  });
});

app.get('/igMediaCounts', ensureAuthenticatedInstagram, function(req, res){
  var query  = models.User.where({ ig_id: req.user.ig_id });
  query.findOne(function (err, user) {
    if (err) return err;
    if (user) {
      Instagram.users.follows({ 
        user_id: user.ig_id,
        access_token: user.ig_access_token,
        complete: function(data) {
          // an array of asynchronous functions
          var asyncTasks = [];
          var mediaCounts = [];
           
          data.forEach(function(item){
            asyncTasks.push(function(callback){
              // asynchronous function!
              Instagram.users.info({ 
                  user_id: item.id,
                  access_token: user.ig_access_token,
                  complete: function(data) {
                    mediaCounts.push(data);
                    callback();
                  }
                });            
            });
          });
          
          // Now we have an array of functions, each containing an async task
          // Execute all async tasks in the asyncTasks array
          async.parallel(asyncTasks, function(err){
            // All tasks are done now
            if (err) return err;
            return res.json({users: mediaCounts});        
          });
        }
      });   
    }
  });
});

app.get('/igColors', ensureAuthenticatedInstagram, function(req, res){
  var query  = models.User.where({ ig_id: req.user.ig_id });
  query.findOne(function (err, user) {
    if (err) return err;
    if (user) {
      Instagram.tags.info({ 
        name: 'blue',
        user_id: user.ig_id,
        access_token: user.ig_access_token,
        complete: function(data) {
          // an array of asynchronous functions
          var asyncTasks = [];
          var blueCount = data;
        
        Instagram.tags.info({ 
        name: 'red',
        user_id: user.ig_id,
        access_token: user.ig_access_token,
        complete: function(data) {

          var redCount = data;

        Instagram.tags.info({ 
        name: 'yellow',
        user_id: user.ig_id,
        access_token: user.ig_access_token,
        complete: function(data) {

          var yellowCount = data;

        Instagram.tags.info({ 
        name: 'green',
        user_id: user.ig_id,
        access_token: user.ig_access_token,
        complete: function(data) {

          var greenCount = data;

        Instagram.tags.info({ 
        name: 'purple',
        user_id: user.ig_id,
        access_token: user.ig_access_token,
        complete: function(data) {

          var purpleCount = data;

        Instagram.tags.info({ 
        name: 'white',
        user_id: user.ig_id,
        access_token: user.ig_access_token,
        complete: function(data) {

          var whiteCount = data;

        Instagram.tags.info({ 
        name: 'black',
        user_id: user.ig_id,
        access_token: user.ig_access_token,
        complete: function(data) {

        var blackCount = data;



        var counts = [blueCount,redCount,yellowCount,greenCount,purpleCount,whiteCount,blackCount]
        console.log(counts);
        res.render('newvisualization', {count: counts});
        }

        });}});}});}});}});}});}});}});});


app.get('/visualization', ensureAuthenticatedInstagram, function (req, res){
  res.render('visualization');
}); 

app.get('/newvisualization', ensureAuthenticatedInstagram, function (req, res){
  res.render('newvisualization');
}); 



app.get('/c3visualization', ensureAuthenticatedInstagram, function (req, res){
  res.render('c3visualization');
}); 

app.get('/auth/instagram',
  passport.authenticate('instagram'),
  function(req, res){
    // The request will be redirected to Instagram for authentication, so this
    // function will not be called.
  });

app.get('/auth/instagram/callback', 
  passport.authenticate('instagram', { failureRedirect: '/login'}),
  function(req, res) {
    res.redirect('/account');
  });

//fitbit gets

app.get('/auth/fitbit',
  passport.authenticate('fitbit'),
  function(req, res){
    // The request will be redirected to Instagram for authentication, so this
    // function will not be called.
  });

app.get('/auth/fitbit/callback', 
  passport.authenticate('fitbit', { failureRedirect: '/login'}),
  function(req, res) {
    res.redirect('/account');
  });


//end fitbit gets

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
