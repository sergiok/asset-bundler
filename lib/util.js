/*!
 * Copyright(c) 2012 Sergio Kuba <sk@skdev.me>
 * MIT Licensed
 */

var fs = require('fs'),
    yaml = require('js-yaml');

var exports = module.exports;

exports.extendObj = function(obj, newObj) {
    for (x in newObj) {
        obj[x] = newObj[x];
    }

    return obj;
};

exports.fileExists = function(filename) {
    try {
        fs.statSync(filename);
    } catch(e) {
        return false;
    }

    return true;
};

exports.getConfigContents = function(filename) {
    var configFile;

    if (this.fileExists(filename)) {
        configFile = require(filename);

        return configFile.length ? require(filename).shift() : configFile;
    } else {
        throw new Error('bad or missing config file.');
    }
};

exports.filterFiles = function(filename, files) {
    return files.filter(function(file) {
        return (file !== filename);
    });
};


/**
 * recursive mkdir
 * functionality was taken from https://github.com/bpedro/node-fs
 * by Bruno Pedro https://github.com/bpedro
 * I wasn't comfortable with overriding fs.mkdir :)
 */
exports.rMakeDir = function(path, mode, callback, position) {
    /**
     * Offers functionality similar to mkdir -p
     *
     * Asynchronous operation. No arguments other than a possible exception
     * are given to the completion callback.
     */
    var osSep = process.platform === 'win32' ? '\\' : '/',
        parts = require('path').normalize(path).split(osSep),
        self = this;

    mode = mode || process.umask();
    position = position || 0;
  
    if (position >= parts.length) {
        return callback();
    }
  
    var directory = parts.slice(0, position + 1).join(osSep) || osSep;
    fs.stat(directory, function(err) {    
        if (err === null) {
            self.rMakeDir(path, mode, callback, position + 1);
        } else {
            fs.mkdir(directory, mode, function (err) {
                if (err && err.errno != 17) {
                    return callback(err);
                } else {
                    self.rMakeDir(path, mode, callback, position + 1);
                }
            });
        }
    });
}; 