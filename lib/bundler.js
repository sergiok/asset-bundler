/*!
 * Copyright(c) 2012 Sergio Kuba <sk@skdev.me>
 * MIT Licensed
 */
var util = require('./util.js'),
    fs = require('fs'),
    exec = require('child_process').exec;

var exports = module.exports,
    RDIR = process.cwd();

// default module config
var _settings = {
    debug: false,
    deployDir: './',
    fileEncoding: 'utf8',
    isDevelopment: false,
    license: '',
    postfix: '',
    prefix: '',
    sourceDir: './',
    staticCSS: '/css',
    staticJS: '/js'
};
var _packages = {};

var _log = function(msg) {
    if (_settings.debug) {
        console.log(msg);
    }
};

var configure = function(config) {
    if (typeof config === "string") {
        config = util.getConfigContents(RDIR + '/' + config);
        
        if (config.packages) {
            setPackages(config.packages);
        }

        config = config.config;
    }

    if (config.license) {
        config.license = ['/*!'].concat(config.license.split('\n').map(function(line) {
            return ' * ' + line;
        }));
        config.license.push(' */');
        config.license = config.license.join('\n');
    }
    util.extendObj(_settings, config);
};

var setPackages = function(packages) {
    if (typeof packages === "string") {
        packages = util.getConfigContents(RDIR + '/' + packages);
    }

    util.extendObj(_packages, packages);
};

var _processsDevelopmentFiles = function(pkgName, pkg, type, callback) {
    var pkg = pkg[type],
        srcFiles = pkg.sources,
        scripts = [],
        staticPath = _settings['static' + type.toUpperCase()] + (pkg.baseDir ? pkg.baseDir + '/' : '/'),
        filesDir = RDIR + _settings.sourceDir + staticPath,
        regexp = new RegExp("\." + type + "$", "i");

    fs.readdir(filesDir, function(err, files) {
        var srcFile;

        for (var i = 0, srcFilesCount = srcFiles.length; i < srcFilesCount; i++) {
            srcFile = srcFiles[i].split(':');

            if (srcFile[0] === "*") {
                for (var j = 0, filesCount = files.length; j < filesCount; j++) {
                    if ( !regexp.test(files[j]) ) {
                        continue;
                    }
                    scripts.push(staticPath + files[j]);
                }
            
            } else {
                scripts.push(staticPath + srcFile[0]);
                files = util.filterFiles(srcFile[0], files);
            }
        }
        pkg.files = scripts;

        callback();
    });
};

var _processPkgFiles = function(pkgName, pkg, type, callback) {
    var pkg = pkg[type],
        srcFiles = pkg.sources,
        scripts = [],
        staticPath = _settings['static' + type.toUpperCase()] + (pkg.baseDir ? pkg.baseDir + '/' : '/'),
        filesDir = RDIR + _settings.sourceDir + staticPath,
        packedData = [],
        regexp = new RegExp("\." + type + "$", "i");
        
    pkg.asyncScriptsCount = pkg.asyncProcessedCount = 0;

    var packFile = function(filename, compress, scriptIndex) {
        if (compress) {
            _log("------ PACKAGE " + pkgName + ": " + type.toUpperCase() + " compressing " + filename + ".");
            exec('java -jar ' + __dirname + '/yuicompressor-2.4.7.jar ' + filename, function(err, stdout, stderr) {
                _log("------ PACKAGE " + pkgName + ": finished " + type.toUpperCase() + " compressing " + filename + ".");
                packedData[scriptIndex] = stdout;
                pkg.asyncProcessedCount++;

                checkPackComplete();
            });
        
        } else {
            _log("------ PACKAGE " + pkgName + ": " + type.toUpperCase() + " appending " + filename + ".");
            fs.readFile(filename, _settings.fileEncoding, function(err, data) {
                _log("------ PACKAGE " + pkgName + ": finished " + type.toUpperCase() + " appending " + filename + ".");
                packedData[scriptIndex] = data;
                pkg.asyncProcessedCount++;
                                
                checkPackComplete();
            });
        }
    };

    var checkPackComplete = function() {
        if (pkg.asyncScriptsCount === pkg.asyncProcessedCount) {
            var packedFileName = _settings['static' + type.toUpperCase()] + '/' + _settings.prefix + pkgName + _settings.postfix + '.' + type;

            util.rMakeDir(RDIR + _settings.deployDir + _settings['static' + type.toUpperCase()], 0755, function(err) {
                if (err) throw err;

                packedData = (type === "js" && _settings.license ? _settings.license + '\n' : '') + packedData.join('\n');
                fs.writeFile(RDIR + _settings.deployDir + packedFileName, packedData, _settings.fileEncoding, function(err) {
                    if (err) throw err;

                    scripts.push(packedFileName);
                    pkg.files = scripts;

                    callback();
                });
            });
        }
    };

    fs.readdir(filesDir, function(err, files) {
        var srcFile;

        for (var i = 0, srcFilesCount = srcFiles.length; i < srcFilesCount; i++) {
            srcFile = srcFiles[i].split(':');

            if (srcFile.length > 1 && srcFile[1] === "nocompression") {
                if (srcFile[0] === "*") {
                    for (var j = 0, filesCount = files.length; j < filesCount; j++) {
                        if ( !regexp.test(files[j]) ) {
                            continue;
                        }

                        pkg.asyncScriptsCount++;
                        packFile(filesDir + files[j], false, pkg.asyncScriptsCount);
                    }
                
                } else {
                    pkg.asyncScriptsCount++;
                    packFile(filesDir + srcFile[0], false, pkg.asyncScriptsCount);
                    files = util.filterFiles(srcFile[0], files);
                }
            
            } else {
                if (srcFile[0] === "*") {
                    for (var j = 0, filesCount = files.length; j < filesCount; j++) {
                        if ( !regexp.test(files[j]) ) {
                            continue;
                        }

                        pkg.asyncScriptsCount++;
                        packFile(filesDir + files[j], true, pkg.asyncScriptsCount);
                    }
                
                } else {
                    pkg.asyncScriptsCount++;
                    packFile(filesDir + srcFile[0], true, pkg.asyncScriptsCount);
                    files = util.filterFiles(srcFile[0], files);
                };
            }
        }

        if (pkg.asyncScriptsCount === 0) {
            pkg.files = [];
            callback();
        }
    });
};

var _processPackage = function(pkgName, pkg, cb) {
    var processCount = 0,
        processingFn;

    var processCallback = function(assetType) {
        processCount--;

        _log("---- finished processing " + pkgName + " " + assetType.toUpperCase() + " files.");
        if (processCount === 0) {
            _log("-- finished processing PACKAGE: " + pkgName + ".");
            cb();
        }
    };

    if (_settings.isDevelopment) {
        processingFn = _processsDevelopmentFiles;
    } else {
        processingFn = _processPkgFiles;
    }


    for (var assetType in pkg) {
        processCount++;
        _log("---- processing " + pkgName + " " + assetType.toUpperCase() + " files.");
        processingFn(pkgName, pkg, assetType, (function(assetType) {
            return function() {
                processCallback(assetType);
            }
        })(assetType));
    }
};

var _noProcessAssets = function() {
    var noprocess = _packages.noprocess,
        fileRegexp,
        srcFiles,
        assetType,
        filesDir,
        deployFilesDir;

    for (assetType in noprocess) {
        fileRegexp = new RegExp("\." + assetType + "$", "i");
        filesDir = RDIR + _settings.sourceDir + _settings['static' + assetType.toUpperCase()] + (noprocess[assetType].baseDir ? noprocess[assetType].baseDir + '/' : '/');
        deployFilesDir = RDIR + _settings.deployDir + _settings['static' + assetType.toUpperCase()] + '/';
        srcFiles = noprocess[assetType].sources;

        util.rMakeDir(deployFilesDir, 0755, function(err) {
            fs.readdir(filesDir, function(err, files) {
                var i = 0,
                    srcFilesCount = srcFiles.length;

                while (srcFiles[i]) {
                    if (srcFiles[i] === "*") {
                        for (var j = 0, filesCount = files.length; j < filesCount; j++) {
                            if ( !fileRegexp.test(files[j]) ) {
                                continue;
                            }

                            fs.link(filesDir + files[i], deployFilesDir + files[i]);
                        }
                    
                    } else {
                        fs.link(filesDir + srcFiles[i], deployFilesDir + srcFiles[i]);
                        files = util.filterFiles(srcFiles[i], files);
                        
                    };

                    i += 1;
                }
            });
        });
    }
};

var init = function(cb) {
    var pkgCount = pkgProcessed = 0;

    if (_packages.noprocess) {
        _noProcessAssets();
    }

    for (var pkgName in _packages) {
        pkgCount++;

        _log("-- processing PACKAGE: " + pkgName + ".");
        _processPackage(pkgName, _packages[pkgName], function() {
            pkgProcessed++;
            if (pkgCount === pkgProcessed) {
                cb && cb();
            }
        });
    }
};

var getFiles = function(pkgName, type) {
    var files = [];

    pkgName = (typeof pkgName === "string") ? [pkgName] : pkgName;

    for (var i=0, len=pkgName.length; i<len; i++) {
        files = files.concat(_packages[pkgName[i]][type].files);
    }

    return files;
};

// look for default configuration file and configure module
try {
    configure('assets.yml');
} catch(e) {
}

exports.configure = configure;
exports.setPackages = setPackages;
exports.init = init;
exports.getFiles = getFiles;