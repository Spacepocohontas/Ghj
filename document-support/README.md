Local document extraction for TXT, Markdown, JSON, HTML, CSV, subtitles, PDF, DOCX, EPUB, ODT and RTF. No uploaded content leaves the browser. Maximum 25 MB, 500 PDF pages and 500,000 extracted characters. Scanned PDFs need OCR; encrypted and legacy binary DOC formats need conversion.

Build importer.js with esbuild, using pdfjs-dist 4.10.38, mammoth 1.11.0, fflate 0.8.2. The PDF worker must remain beside document-import.js. Bundled dependency notices are in document-import.js.LEGAL.txt.

To rebuild: `npm install` then `npm run build` in this directory. Run `npm test` for Chromium PDF/DOCX/EPUB/ODT/RTF/text extraction, HTML safety, unsupported binary and size-limit checks. Set CHROMIUM_PATH if Chromium is installed elsewhere.
