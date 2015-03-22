var express = require('express');
var fs = require('fs');
var fsPath = require('path');
var pretty = require('prettysize');

var app = express();
app.set('view engine', 'jade');

var root = __dirname + '/files/';

// File options //
var options = {
    dotfiles: 'allow',
    headers: {
        'x-timestamp': Date.now(),
        'x-sent': true
    }
};

// Access raw files //
app.get('/raw/*', function(req, res) {
    var path = fsPath.join(root, req.url.substr('/raw/'.length));

    fs.exists(path, function(exists) {
        if(exists) {
            res.sendFile(path, options, function (err) {
                if (err) {
                    console.log('Error retrieving:' + path + "(" + err + ")");
                }
                else {
                    console.log('Served:' + path);
                }
            });
        } else {
            res.status(404).send('Unknown File');
        }
    });


});

app.get(['/browse/*', '/browse/'], function(req, res) {
    var path = req.url.substr('/browse/'.length);
    res.render('index', { title: 'File Serve - ' + path, root: path, parent: fsPath.join('/browse/', path, "../"), files: getFilesFromPath(path) });
});


app.get(['/json/*', '/json/'], function(req, res) {
    var path = req.url.substr('/json/'.length);

    res.type('application/json');
    res.send({
        path: path,
        files: getFilesFromPath(path)
    });
});


app.get('/', function(req, res) {
    res.redirect('/browse/');
});

app.listen(8000);

function getFilesFromPath(path) {
    var relPath = path;
    path = fsPath.join(root, path);

    if(path.indexOf(root) !== 0 || path.indexOf('\0') !== -1) {
        console.log("Access Denied");
        return []; // Not cool bruh //
    }

    try {
        // Query the entry
        var stats = fs.statSync(path);

        // Is it a directory?
        if (stats.isDirectory()) {
            var directory = [];

            var files = fs.readdirSync(path);

            for(var i in files) {
                var file = fsPath.join(path, files[i]);
                var iStat = fs.statSync(file);
                if (iStat.isDirectory()) {
                    directory.push({
                        "name": files[i],
                        "path": relPath == '/' ? files[i] : fsPath.join(relPath, files[i]),
                        "size": pretty(0),
                        "directory": true
                    });
                } else if(iStat.isFile()) {
                    directory.push({
                        "name": files[i],
                        "path": relPath == '/' ? files[i] : fsPath.join(relPath, files[i]),
                        "size": pretty(iStat.size),
                        "directory": false
                    });
                }
            }

            return directory.sort(function(entry1, entry2) {
                if(entry1.directory && !entry2.directory) return -1;
                if(!entry1.directory && entry2.directory) return 1;

                if(entry1.name > entry2.name) return 1;
                if(entry1.name < entry2.name) return -1;

                return 0;
            });

        } else if(stats.isFile()) {
            return {
                "name": fsPath.basename(path),
                "path": relPath,
                "size": pretty(stats.size),
                "directory": false
            }
        }
    }
    catch (e) {
        console.log(e);
    }

    return [];
}
