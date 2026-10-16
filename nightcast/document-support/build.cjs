const {buildSync}=require('esbuild');
const {copyFileSync}=require('node:fs');
buildSync({entryPoints:[__dirname+'/importer.js'],bundle:true,format:'iife',minify:true,outfile:__dirname+'/document-import.js'});
copyFileSync(require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs'),__dirname+'/pdf.worker.min.mjs');
