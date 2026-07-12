import express from "express";
import path from "path";
import fs from "fs";
import JSZip from "jszip";

const app = express();

app.use(express.json());

  // API Route to Export to Google Drive
  app.post("/api/export-to-drive", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid Google Drive Access Token." });
      }
      const accessToken = authHeader.substring(7);

      const zip = new JSZip();

      // Recursive file gatherer
      const getFiles = (dir: string, baseDir: string = dir): string[] => {
        let results: string[] = [];
        const list = fs.readdirSync(dir);
        for (const file of list) {
          const absolutePath = path.resolve(dir, file);
          const stat = fs.statSync(absolutePath);
          const relativePath = path.relative(baseDir, absolutePath);

          // Skip unwanted folders/files
          if (
            file === "node_modules" ||
            file === "dist" ||
            file === ".git" ||
            file === ".DS_Store" ||
            file === "tmp" ||
            relativePath === "dist" ||
            relativePath.startsWith("dist/") ||
            relativePath === "node_modules" ||
            relativePath.startsWith("node_modules/")
          ) {
            continue;
          }

          if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(absolutePath, baseDir));
          } else {
            results.push(relativePath);
          }
        }
        return results;
      };

      const rootPath = path.resolve(process.cwd());
      const files = getFiles(rootPath);

      // Add each file to the zip archive
      for (const relativePath of files) {
        const fullPath = path.resolve(rootPath, relativePath);
        const content = fs.readFileSync(fullPath);
        zip.file(relativePath, content);
      }

      // Generate the ZIP buffer
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

      // Build multipart request
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const zipFileName = `GenevaNews_Backup_${timestamp}.zip`;

      const boundary = "-------314159265358979323846";
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const metadata = {
        name: zipFileName,
        mimeType: "application/zip",
        description: "Complete codebase backup of the Geneva News App."
      };

      const metadataPart = 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata);

      const multipartBody = Buffer.concat([
        Buffer.from(delimiter + metadataPart + '\r\n' + delimiter + 'Content-Type: application/zip\r\n\r\n'),
        zipBuffer,
        Buffer.from(closeDelim)
      ]);

      const driveResponse = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": multipartBody.length.toString()
        },
        body: multipartBody
      });

      if (!driveResponse.ok) {
        const errText = await driveResponse.text();
        console.error("Google Drive API error output:", errText);
        return res.status(driveResponse.status).json({ error: `Google Drive upload failed: ${errText}` });
      }

      const driveData = await driveResponse.json();
      return res.json({
        success: true,
        fileId: driveData.id,
        fileName: driveData.name,
        link: driveData.webViewLink
      });

    } catch (err: any) {
      console.error("Export error:", err);
      return res.status(500).json({ error: err.message || "An error occurred while zipping the workspace." });
    }
  });

  // Translation Endpoint powered by server-side Gemini 3.5 Flash
  app.post("/api/translate-news", async (req, res) => {
    try {
      const { title, subtitle, content, targetLanguage } = req.body;
      if (!title || !content || !targetLanguage) {
        return res.status(400).json({ error: "Missing required translation fields." });
      }

      // Check if API key is configured
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY is not defined in environment variables. Returning original news texts.");
        return res.json({ title, subtitle, content, fallback: true });
      }

      // Lazy import GoogleGenAI to ensure Express starts up even if keys aren't present yet
      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `You are a professional news agency translator. Translate the following news article title, subtitle, and body into "${targetLanguage}".
Ensure the tone remains professional, journalistic, highly engaging, and natural to a native reader of ${targetLanguage}.
Do not change facts or structure. Maintain any markdown formatting (such as headings or list items) in the translated content.

Source Title:
${title}

Source Subtitle:
${subtitle}

Source Content:
${content}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              content: { type: Type.STRING }
            },
            required: ["title", "subtitle", "content"]
          }
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No response text received from Gemini API.");
      }

      const parsed = JSON.parse(resultText);
      return res.json(parsed);

    } catch (err: any) {
      console.error("Translation error in server.ts:", err);
      return res.json({ 
        title: req.body.title, 
        subtitle: req.body.subtitle, 
        content: req.body.content, 
        error: err.message || "Failed to translate." 
      });
    }
  });

  // Google Site Verification endpoint
  app.get("/google7c2d5df9354788c6.html", (req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send("google-site-verification: google7c2d5df9354788c6.html");
  });

  // PWA manifest endpoint
  app.get("/manifest.json", (req, res) => {
    res.json({
      short_name: "BOSS.NEWS",
      name: "BOSS.NEWS Global Intelligence",
      icons: [
        {
          src: "/src/assets/images/boss_news_logo_1783871304137.jpg",
          sizes: "512x512",
          type: "image/jpeg",
          purpose: "any maskable"
        }
      ],
      start_url: "/",
      background_color: "#020617",
      theme_color: "#7c3aed",
      display: "standalone",
      orientation: "portrait"
    });
  });

  // PWA Service Worker endpoint
  app.get("/service-worker.js", (req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.send(`
      self.addEventListener('install', (event) => {
        self.skipWaiting();
      });
      self.addEventListener('activate', (event) => {
        event.waitUntil(self.clients.claim());
      });
      self.addEventListener('fetch', (event) => {
        event.respondWith(fetch(event.request));
      });
    `);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    import("vite").then(({ createServer }) => {
      createServer({
        server: { middlewareMode: true },
        appType: "spa",
      }).then((vite) => {
        app.use(vite.middlewares);
      });
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start local listener if not running as a Vercel serverless function
  if (!process.env.VERCEL) {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  }

export default app;
