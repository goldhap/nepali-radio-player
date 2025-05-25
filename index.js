// index.js
const express = require("express");
const cors = require("cors");
const request = require("request");

const app = express();
app.use(cors());

app.get("/stream", (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl || !targetUrl.startsWith("http://")) {
    return res.status(400).send("Invalid or missing 'url' parameter.");
  }

  // Stream the audio data
  req.pipe(request(targetUrl)).pipe(res);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}`);
});

