const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function resolvePath(urlPath) {
    const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
    const relative = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '');
    const fullPath = path.resolve(ROOT, relative);
    return fullPath.startsWith(ROOT) ? fullPath : path.join(ROOT, 'index.html');
}

http.createServer((req, res) => {
    const filePath = resolvePath(req.url || '/');
    fs.readFile(filePath, (error, data) => {
        if (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
    });
}).listen(PORT, () => {
    console.log(`Lutheus static panel listening on ${PORT}`);
});
