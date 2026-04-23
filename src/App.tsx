/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, ChangeEvent } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import { 
  FileText, 
  Upload, 
  Bot, 
  CheckCircle2, 
  Loader2, 
  Download, 
  BookOpen,
  AlertCircle,
  FolderArchive,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = "gemini-3-flash-preview";

interface FileStatus {
  file: File;
  status: "pending" | "processing" | "completed" | "error";
  progress: string;
}

interface Concept {
  name: string;
  source: string;
  summary: string;
}

interface WikiPage {
  name: string;
  content: string;
}

export default function App() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        status: "pending" as const,
        progress: "Ready"
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String.split(",")[1]);
      };
      reader.onerror = error => reject(error);
    });
  };

  const processWiki = async () => {
    if (files.length === 0) return;
    setIsGenerating(true);
    setError(null);
    setDownloadUrl(null);
    const allConcepts: Concept[] = [];
    const updatedFiles = [...files];

    try {
      // Step 1: Concept Extraction from each PDF
      for (let i = 0; i < updatedFiles.length; i++) {
        const f = updatedFiles[i];
        f.status = "processing";
        f.progress = "Analyzing PDF structure & extracting concepts...";
        setFiles([...updatedFiles]);

        const base64 = await fileToBase64(f.file);
        
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: base64
                  }
                },
                {
                  text: `Analyze this PDF. Extract a list of key concepts, technical terms, or main topics found within. 
                  Handle potential OCR needs by looking at the visual content if text is missing.
                  Support multi-language analysis.
                  Return the result as a JSON array of objects with 'name', 'summary' (brief 2-3 sentences), and 'tags' (array of strings).`
                }
              ]
            }
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["name", "summary"]
              }
            }
          }
        });

        const extracted = JSON.parse(response.text || "[]");
        extracted.forEach((c: any) => {
          allConcepts.push({
            name: c.name,
            summary: c.summary,
            source: f.file.name
          });
        });

        f.status = "completed";
        f.progress = `Found ${extracted.length} concepts.`;
        setFiles([...updatedFiles]);
      }

      setConcepts(allConcepts);
      
      // Step 2: Global Cross-Referencing & Page Generation
      // We group by unique concept name to avoid duplicates and merge summaries if needed.
      const uniqueConceptNames = Array.from(new Set(allConcepts.map(c => c.name)));
      const wikiFiles: WikiPage[] = [];

      for (const conceptName of uniqueConceptNames) {
        const relevantConcepts = allConcepts.filter(c => c.name === conceptName);
        const combinedContext = relevantConcepts.map(c => `${c.source}: ${c.summary}`).join("\n");
        const otherConcepts = uniqueConceptNames.filter(n => n !== conceptName);

        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              parts: [
                {
                  text: `Write a detailed Markdown wiki page for the concept: "${conceptName}".
                  
                  Context from sources:
                  ${combinedContext}
                  
                  Acknowledge that this content is extracted from: ${relevantConcepts.map(c => c.source).join(", ")}.
                  
                  IMPORTANT - Obsidian Linking:
                  You are aware of the following other existing concepts in this wiki:
                  ${otherConcepts.slice(0, 100).join(", ")}
                  
                  Whenever you mention any of these other concepts in the text, you MUST wrap them in Obsidian brackets, e.g., [[Concept Name]].
                  
                  Structure the page with:
                  # ${conceptName}
                  ## Overview
                  (detailed explanation)
                  ## Key Details
                  (points from context)
                  ## Related
                  (links to other concepts)
                  
                  Use clean, academic Markdown formatting.`
                }
              ]
            }
          ]
        });

        wikiFiles.push({
          name: conceptName,
          content: response.text || `# ${conceptName}\n\nNo content generated.`
        });
      }

      // Step 3: Zip it via backend
      const zipResponse = await fetch("/api/zip-wiki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: wikiFiles })
      });

      if (!zipResponse.ok) throw new Error("Failed to generate ZIP on server");

      const blob = await zipResponse.blob();
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans relative overflow-hidden">
      {/* Background Mesh Gradients */}
      <div className="mesh-gradient-1" />
      <div className="mesh-gradient-2" />

      {/* Main Container */}
      <div className="relative z-10 grid grid-cols-12 gap-8 p-8 h-screen max-w-[1600px] mx-auto">
        
        {/* Sidebar Column (4) */}
        <div className="col-span-4 flex flex-col gap-6 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <BookOpen size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Wiki Genie <span className="text-indigo-400">AI</span></h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Extraction Engine</p>
            </div>
          </div>

          {/* Upload Card */}
          <div className="backdrop-blur-xl bg-white/10 border border-indigo-400/20 rounded-3xl p-8 flex flex-col items-center justify-center border-dashed border-2 grow cursor-pointer hover:bg-white/15 transition-all group overflow-hidden relative"
               onClick={() => document.getElementById('file-upload')?.click()}>
            <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10 group-hover:border-indigo-400/30 transition-colors">
              <Upload size={32} className="text-indigo-300 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-lg font-bold text-white">Drop PDF Research</p>
            <p className="text-xs text-slate-400 mt-2 uppercase tracking-widest font-mono">Multi-file support active</p>
            <input 
              id="file-upload"
              type="file" 
              className="hidden" 
              multiple 
              accept=".pdf" 
              onChange={onFileChange}
              disabled={isGenerating}
            />
          </div>

          {/* Statistics/Status Bar */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Queue Size</p>
              <p className="text-2xl font-bold">{files.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider mb-1">Concepts</p>
              <p className="text-2xl font-bold text-indigo-400">{concepts.length}</p>
            </div>
          </div>

          {/* Queue List */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 overflow-hidden flex flex-col min-h-[250px]">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Processing Queue</h3>
                {files.length > 0 && (
                  <span className="text-[10px] font-mono text-indigo-300 px-2 py-0.5 bg-indigo-500/10 rounded border border-indigo-500/20">
                    {files.filter(f => f.status === 'completed').length}/{files.length}
                  </span>
                )}
             </div>
             <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
                {files.length === 0 ? (
                  <div className="h-full flex items-center justify-center opacity-20 flex-col gap-2 mt-10">
                    <FileText size={32} />
                    <p className="text-xs">No files staged</p>
                  </div>
                ) : (
                  files.map((file, idx) => (
                    <motion.div 
                      key={idx} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/5"
                    >
                      <div className="shrink-0">
                        {file.status === 'completed' ? (
                          <CheckCircle2 size={16} className="text-green-500" />
                        ) : file.status === 'processing' ? (
                          <Loader2 size={16} className="text-indigo-400 animate-spin" />
                        ) : (
                          <FileText size={16} className="text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate text-slate-200">{file.file.name}</p>
                        <p className="text-[9px] text-slate-500 truncate font-mono uppercase">{file.progress}</p>
                      </div>
                    </motion.div>
                  ))
                )}
             </div>
          </div>
        </div>

        {/* Main Content Column (8) */}
        <div className="col-span-8 flex flex-col gap-6 overflow-hidden">
          
          {/* Top Monitoring Board */}
          <div className="grow backdrop-blur-xl bg-white/5 border border-white/10 rounded-[2.5rem] relative overflow-hidden flex flex-col">
            {/* Terminal Header Decoration */}
            <div className="absolute top-0 left-0 right-0 h-12 border-b border-white/5 flex items-center px-8 gap-2 bg-white/[0.02]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/30" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/30" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/30" />
              <span className="ml-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">knowledge_graph_visualizer.sh</span>
              
              <div className="ml-auto flex items-center gap-4">
                {isGenerating && (
                  <div className="flex items-center gap-2">
                    <Loader2 size={12} className="text-indigo-400 animate-spin" />
                    <span className="text-[10px] font-mono text-indigo-400 animate-pulse uppercase">Mapping Semantic Connections</span>
                  </div>
                )}
              </div>
            </div>

            {/* Grid Pattern Background */}
            <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none" />

            {/* Content Area */}
            <div className="mt-12 p-8 overflow-y-auto flex-1 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {!isGenerating && concepts.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center text-center space-y-6 py-20"
                  >
                    <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                      <BookOpen size={48} className="text-white/20" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Knowledge Base Empty</h3>
                      <p className="text-slate-500 text-sm max-w-sm mt-2">Upload research papers to start generating semantics and building your cross-referenced wiki.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence>
                  {concepts.map((concept, idx) => (
                    <motion.div
                      key={`${concept.name}-${idx}`}
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      layout
                      className="group backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all hover:border-indigo-500/30 cursor-default"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-[9px] font-mono font-bold text-indigo-400/70 border border-indigo-400/20 px-1.5 py-0.5 rounded uppercase">Entity Mapped</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 group-hover:animate-ping" />
                      </div>
                      <h3 className="text-white font-bold tracking-tight mb-2 group-hover:text-indigo-300 transition-colors">{concept.name}</h3>
                      <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-3 font-medium">{concept.summary}</p>
                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                         <span className="text-[9px] text-slate-500 font-mono truncate max-w-[120px]">{concept.source}</span>
                         <ArrowRight size={10} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="grid grid-cols-12 gap-6 items-center">
            <div className="col-span-8">
              <button
                id="generate-button"
                onClick={processWiki}
                disabled={files.length === 0 || isGenerating}
                className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 font-bold tracking-tight text-lg transition-all group overflow-hidden relative ${
                  isGenerating 
                    ? 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-2xl shadow-indigo-500/20'
                }`}
              >
                {isGenerating && <div className="absolute inset-0 bg-white/5 animate-pulse" />}
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    Processing Knowledge Set...
                  </>
                ) : (
                  <>
                    Synthesize Wiki Archive
                    <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
            
            <div className="col-span-4 h-full">
              {downloadUrl ? (
                <motion.a
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  href={downloadUrl}
                  download="wiki.zip"
                  className="w-full h-full py-5 rounded-2xl flex items-center justify-center gap-3 font-bold tracking-tight bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-all shadow-xl"
                >
                  <Download size={22} />
                  Get ZIP Package
                </motion.a>
              ) : (
                <div className="w-full h-full flex items-center justify-center rounded-2xl border border-white/5 bg-white/2 px-6 text-center opacity-40">
                  <p className="text-[10px] uppercase tracking-widest font-bold">Archive generation pending</p>
                </div>
              )}
            </div>
          </div>

          {/* Errors */}
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3 items-start">
                  <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">System Fault Detected</h4>
                    <p className="text-xs text-red-100 uppercase tracking-wider mb-1 opacity-80 leading-snug">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
