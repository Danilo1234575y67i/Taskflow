const http = require("http");
const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const runtimePortPath = path.join(dataDir, "runtime-port.txt");
const preferredPort = Number(process.env.PORT) || 3000;
const portSearchLimit = preferredPort + 20;
const fileCache = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

function safePath(urlPath) {
  const target = urlPath === "/" ? "/index.html" : urlPath;
  const resolved = path.normalize(path.join(publicDir, target));
  return resolved.startsWith(publicDir) ? resolved : null;
}

function loadPublicFiles(dir = publicDir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadPublicFiles(fullPath);
      continue;
    }

    const relativePath = `/${path.relative(publicDir, fullPath).replace(/\\/g, "/")}`;
    const stats = fs.statSync(fullPath);
    fileCache.set(relativePath, { data: fs.readFileSync(fullPath), mtimeMs: stats.mtimeMs });
  }
}

function writeRuntimePort(port) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(runtimePortPath, String(port), "utf8");
}

function getCachedFile(resolvedPath) {
  const relativePath = `/${path.relative(publicDir, resolvedPath).replace(/\\/g, "/")}`;
  try {
    const stats = fs.statSync(resolvedPath);
    const cached = fileCache.get(relativePath);
    if (cached && cached.mtimeMs === stats.mtimeMs) {
      return cached.data;
    }

    const data = fs.readFileSync(resolvedPath);
    fileCache.set(relativePath, { data, mtimeMs: stats.mtimeMs });
    return data;
  } catch {
    return null;
  }
}

loadPublicFiles();

const server = http.createServer((req, res) => {
  const resolvedPath = safePath(decodeURIComponent(req.url.split("?")[0]));

  if (!resolvedPath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8", ...noCacheHeaders });
    res.end("Acesso negado");
    return;
  }

  fs.stat(resolvedPath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...noCacheHeaders });
      res.end("Página não encontrada");
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    const cached = getCachedFile(resolvedPath);

    if (cached) {
      res.writeHead(200, { "Content-Type": contentType, ...noCacheHeaders });
      res.end(cached);
      return;
    }

    fs.readFile(resolvedPath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8", ...noCacheHeaders });
        res.end("Erro ao carregar o arquivo");
        return;
      }

      res.writeHead(200, { "Content-Type": contentType, ...noCacheHeaders });
      res.end(data);
    });
  });
});

function listenWithFallback(startPort) {
  const onError = (error) => {
    if (error.code === "EADDRINUSE" && startPort < portSearchLimit) {
      server.removeListener("error", onError);
      server.close(() => listenWithFallback(startPort + 1));
      return;
    }

    console.error(error);
    process.exit(1);
  };

  server.once("error", onError);
  server.listen(startPort, () => {
    writeRuntimePort(startPort);
    console.log(`TaskFlow rodando em http://localhost:${startPort}`);
  });
}

listenWithFallback(preferredPort);
