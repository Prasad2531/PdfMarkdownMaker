
This is an app that will create wiki pages :) You can then use the wiki pages as a form of highly accurate RAG, Karpathy-style..

simply upload a PDF or PDFs, click 'Generate Knowledge Base', and wait/watch while the AI chomps through the pdf(s), identifies concepts, creates pages for each, and cross-links them! Up until now, 
such a step (unstructured knowledge -> knowledge graph) has NOT been this simple.

In the future, you can use an agent (eg Claude Code) go through the pages, and answer your plaintext questions! Overall we've built a tool/toy that can digest PDFs and create a browsable (by humans AND AI!!) wiki. Also in the future, DO set this up: https://github.com/Ar9av/obsidian-wiki.

Some Screenshots.
<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="./PromptImage.png" />
</div>



<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/680da8f1-74c8-4584-9e2b-3a17e75513cc

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
