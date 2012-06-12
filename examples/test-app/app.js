/**
 * asset-bundler test app
 * starting configuration is loaded from the ./assets.yml file
 * we could specify a different file by passing a string to the configure method with the path to the file
 * eg:
 *		asssetBundler('./conf/assetConfig.yml')
 *
 * we can make further .configure calls to set environment specific values
 */

var express = require('express'),
	assetBundler = require('asset-bundler'),
	fs = require('fs');

var app = express.createServer();

app.configure(function() {
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
});

app.configure('development', function() {
	app.use(express.static(__dirname + '/static/dev'));
	app.use(express.logger());
	app.use(express.errorHandler({
		dumpExceptions: true,
		showStack: true
	}));

	/**
	 * assets-bundler
	 * setup development values:
	 *	isDevelopment: true ==> generates asset array with separate files, suited for development environments
	 *  debug: true ==> outputs packing log
	 */
	assetBundler.configure({
		debug: true,
		isDevelopment: true
	});
});

app.configure('production', function() {
	app.use(express.static(__dirname + '/static/prod'));

	/**
	 * assets-bundler
	 * setup production values:
	 *	license: String ==> we can pass an optional license text and it will be wrapped in a comment and inserted on top of the genereated js bundles
	 *  postfix: value ==> value that will be appended to the filename generated.
	 */
	var license = fs.readFileSync('LICENSE', 'utf8');
	assetBundler.configure({
		license: license,
		postfix: new Date().getTime()
	});
});

assetBundler.init(function() {
	// we begin to listen after the bundles have been generated
	console.log("asset builder test app started");
	app.listen(8001);
});

app.get('/', function(req, res) {
	res.render('home', {
		styles: assetBundler.getFiles('home', 'css'),
		scripts: assetBundler.getFiles('home', 'js')
	});
});

app.get('/other', function(req, res) {
	res.render('otherPage', {
		styles: assetBundler.getFiles('otherPage', 'css'),
		scripts: assetBundler.getFiles('otherPage', 'js')
	});
});