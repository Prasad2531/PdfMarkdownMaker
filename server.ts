import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import bodyParser from "body-parser";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use body-parser to handle larger JSON payloads for wiki content
  app.use(bodyParser.json({ limit: "50mb" }));

  // API Routes
  app.post("/api/zip-wiki", (req, res) => {
    try {
      const { files } = req.body; // Array of { name: string, content: string }
      
      if (!files || !Array.isArray(files)) {
        return res.status(400).json({ error: "Invalid files format" });
      }

      const zip = new AdmZip();
      
      // We want everything to be inside a 'wiki/' folder in the zip
      files.forEach((file: { name: string; content: string }) => {
        // Sanitize filename or ensure it's valid
        const safeName = file.name.endsWith(".md") ? file.name : `${file.name}.md`;
        zip.addFile(`wiki/${safeName}`, Buffer.from(file.content, "utf8"));
      });

      const buffer = zip.toBuffer();

      res.set({
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="wiki.zip"',
        "Content-Length": buffer.length,
      });

      res.send(buffer);
    } catch (error) {
      console.error("Zipping error:", error);
      res.status(500).json({ error: "Failed to generate zip" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
