
var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var path = require('path');
var fs = require('fs');
let https = require('https')


// Express server settings
var app = express();
app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));
app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());
app.set('views', __dirname + '/');
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');

// Just a function to generate a rondom string
function GenerateMessage() {
    var length = 12;
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}


// Authentification step 1
// A password check in a DB could be added...
app.post('/auth', function(request, response) {

  // Get the BTCZ address, generate a rondom message and get Date/Time
  // The messageTime is not used yet.
  // But a date/time validity should be added so that the message is valide during a time periode.
	var btczAddress = request.body.btczAddress;
  var message = GenerateMessage();
  var messageTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

	if (btczAddress) {

    // Set the session variable with the Btc address and the generated message
    request.session.btczAddress = btczAddress;
    request.session.message = message;
    request.session.messageTime = messageTime; // Not used yet
    response.redirect('/sign');

	}

});


//Authentification step 2
// Ask for the signature
app.get('/sign', function(request, response) {
  response.render("sign.html",{btczAddress: request.session.btczAddress, message: request.session.message});
});


// Authentification step 3
// Verification on the Insight API -
// (Could also be a RPC on a node)
app.post('/verify', function(request, response) {

  var btczAddress = request.session.btczAddress;
  var message = request.session.message;
  var messageTime = request.session.messageTime; // Not used yet
  var signature = request.body.signature;

  // GET methode (can also be done by POST)
  let options = 'https://explorer.btcz.app/api/messages/verify?address='+btczAddress+'&signature='+encodeURIComponent(signature)+'&message='+message;
  let req = https.request(options, res => {

    let data ='';
    res.on('data', (d) => {data +=d;});

    // Check return code...
    if (res.statusCode == 200){

      res.on('end', () => {
        let jdata = JSON.parse(data);
        if (jdata.result) {
          request.session.loggedin=true;
          response.redirect('/home');
        } else {
          response.send('<div style="color:red;">The signature is not correct !</div></br><a href="/">Return to login.</a>');
        }
      });

    } else {
      response.send('<div style="color:red;">Bad server response ('+res.statusCode+') :-(</div>Error: Probably wrong address or signature format.</br></br><a href="/">Return to login.</a>');
    }

  });

  req.on('error', error => {
    console.error(error)
    response.send('<div style="color:red;">Something went wrong :-(</div>ERROR: '+error+'</br></br><a href="/">Return to login.</a>');
  })

  req.end()

});


// Root url...
app.get('/', function(request, response) {
  if (request.session.loggedin) {response.redirect('/home');} // redirect to home if already loggedin
	response.sendFile(path.join(__dirname + '/login.html'));
});


// Home URL ...
app.get('/home', function(request, response) {
	if (request.session.loggedin) {
		response.send('<div style="color:green;">Welcome back, ' + request.session.btczAddress + '!</div></br><a href="/logout">Logout</a>');
	} else {
    response.redirect('/');
	}
	response.end();
});


// Logout  url...
app.get('/logout', function(request, response) {
  request.session.destroy();
  response.redirect('/');
});


// Self-signed SSL certs for proxy through CF
// created with 'openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout sign.btcz.rocks.key -out sign.btcz.rocks.crt'

var key = fs.readFileSync('sign.btcz.rocks.key');
var cert = fs.readFileSync('sign.btcz.rocks.crt');
var listen_http = 3002;
var listen_https = 3003;

var options = {
  key: key,
  cert: cert
};

// Start app
app.listen(listen_http);
console.log('Listening on NON-SSL ' + listen_http);

https.createServer(options, app).listen(listen_https);
console.log('Listening on SSL ' + listen_https);

