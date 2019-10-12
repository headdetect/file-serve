const express = require('express');
const fs = require('fs');
const fsPath = require('path');
const pretty = require('prettysize');
const sass = require('node-sass');

const app = express();
app.set('view engine', 'pug');

require('dotenv').config();

const root = process.env.FILE_ROOT;

const allowDotFiles = process.env.SHOW_DOT_FILES === 'true';

// File options //
const options = {
    dotfiles: allowDotFiles ? 'allow' : 'deny',
    headers: {
        'x-timestamp': Date.now(),
        'x-sent': true
    }
};

// Access raw files //
app.get('/raw/*', function (req, res) {
    const file = req.url.substr('/raw/'.length);
    const path = fsPath.join(root, file);

    const stats = fs.statSync(path);

    if (stats.isDirectory()) {
        res.status(400).send('You need to specify a file');
        return;
    }

    if (!allowDotFiles && file.startsWith('.')) {
        return res.status(404).send('Unknown File');
    }

    fs.access(path, fs.constants.F_OK | fs.constants.R_OK, err => {
        if (!err) {
            res.sendFile(path, options, resErr => {
                if (resErr) {
                    console.log('Error retrieving: ' + path + "(" + resErr + ")");
                } else {
                    console.log('Served: ' + path);
                }
            });
        } else {
            res.status(404).send('Unknown File');
        }
    });
});

app.get(['/browse/*', '/browse/'], function (req, res) {
    const path = req.url.substr('/browse/'.length);

    res.render('index', {
        title: 'File Serve - ' + path,
        root: path,
        parent: fsPath.join('/browse/', path, "../"),
        files: getFilesFromPath(path)
    });
});


app.get(['/json/*', '/json/'], function (req, res) {
    const path = req.url.substr('/json/'.length);

    res.type('application/json');
    res.send({
        path: path,
        files: getFilesFromPath(path)
    });
});

app.get('/local/*', function (req, res) {
    const path = __dirname + req.url;
    const file = req.url.substr('/local/'.length);

    if (file === "") {
        res.status(403).send("Access to root is forbidden");
        return;
    }

    const transform = transformFile(path);

    if (transform) {
        res.type(transform.type);
        res.send(transform.data);
    } else {
        const stats = fs.statSync(path);

        if (stats.isDirectory()) {
            res.status(400).send('You need to specify a file');
            return;
        }

        fs.access(path, fs.constants.F_OK | fs.constants.R_OK, (err) => {
            if (!err) {
                res.sendFile(path, options, resError => {
                    if (resError) {
                        console.log('Error retrieving: ' + path + "(" + err + ")");
                    } else {
                        console.log('Served: ' + path);
                    }
                });
            } else {
                res.status(404).send('Unknown File: ' + path);
            }
        });
    }
});

app.get('/', function (req, res) {
    res.redirect('/browse/');
});

app.listen(process.env.PORT);

function getFilesFromPath(path) {
    const relPath = path;

    path = fsPath.join(root, path);

    if (path.indexOf(root) !== 0 || path.indexOf('\0') !== -1) {
        console.log("Access Denied");
        return []; // Not cool bruh //
    }

    try {
        // Query the entry
        const stats = fs.statSync(path);

        // Is it a directory?
        if (stats.isDirectory()) {
            const directory = [];

            const files = fs.readdirSync(path);

            for (const file of files) {
                const fileStat = fs.statSync(fsPath.join(path, file));

                if (fileStat.isDirectory()) {
                    directory.push({
                        "name": file,
                        "path": relPath === '/' ? file : fsPath.join(relPath, file),
                        "size": pretty(0),
                        "directory": true
                    });
                } else if (fileStat.isFile()) {
                    if (!allowDotFiles && file.startsWith('.')) {
                        continue;
                    }

                    directory.push({
                        "name": file,
                        "path": relPath === '/' ? file : fsPath.join(relPath, file),
                        "size": pretty(fileStat.size),
                        "directory": false
                    });
                }
            }

            return directory.sort(function (entry1, entry2) {
                if (entry1.directory && !entry2.directory) return -1;
                if (!entry1.directory && entry2.directory) return 1;

                if (entry1.name > entry2.name) return 1;
                if (entry1.name < entry2.name) return -1;

                return 0;
            });

        } else if (stats.isFile()) {
            return {
                "name": fsPath.basename(path),
                "path": relPath,
                "size": pretty(stats.size),
                "directory": false
            }
        }
    } catch (e) {
        console.log(e);
    }

    return [];
}

function transformFile(file) {
    const fileInfo = fsPath.parse(file);

    const transforms = {
        ".css": function (_file) {
            const newFile = _file.substr(0, _file.length - "css".length) + "scss"; // Change from .css to .scss //

            if (!fs.existsSync(newFile)) return null;

            const fileData = fs.readFileSync(newFile, {encoding: "utf8"});

            return {
                data: sass.renderSync({
                    data: fileData
                }).css,
                type: "text/css"
            };
        },
    };

    const transformation = transforms[fileInfo.ext];
    if (!transformation || !transformation(file)) return null;
    const compilation = transformation ? {
        data: transformation(file).data,
        type: transformation(file).type
    } : null;
    return compilation && compilation.data ? compilation : null;
}
