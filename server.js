const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const DIR = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DIR, { recursive: true });
const page = fs.readFileSync(path.join(__dirname, "index.html"));
const MAX = 1024 * 1024;
let hits = {};
setInterval(() => { hits = {}; }, 60000);

http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  if (req.method === "GET" && url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(page);
  }

  if (req.method === "POST" && url === "/api/upload") {
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
    hits[ip] = (hits[ip] || 0) + 1;
    if (hits[ip] > 20) { res.writeHead(429); return res.end("Too many uploads. Try again in a minute."); }
    let size = 0, tooBig = false;
    const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > MAX) { tooBig = true; return; }
      chunks.push(c);
    });
    req.on("end", () => {
      if (tooBig) { res.writeHead(413); return res.end("Script is over 1 MB."); }
      if (!size) { res.writeHead(400); return res.end("Empty script."); }
      const id = crypto.randomBytes(6).toString("hex");
      fs.writeFileSync(path.join(DIR, id + ".lua"), Buffer.concat(chunks));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id }));
    });
    return;
  }

  const m = url.match(/^\/raw\/([a-f0-9]{12})$/);
  if (req.method === "GET" && m) {
    fs.readFile(path.join(DIR, m[1] + ".lua"), (err, data) => {
      if (err) { res.writeHead(404); return res.end("Not found"); }
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(data);
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
}).listen(process.env.PORT || 3000);
