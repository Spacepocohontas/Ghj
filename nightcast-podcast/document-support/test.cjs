const { chromium } = require('playwright');
const PDFDocument = require('pdfkit');
const {zipSync,strToU8}=require('fflate');
const fs=require('fs');
(async()=>{
 const dir=__dirname+'/fixtures';fs.mkdirSync(dir,{recursive:true});
 const doc=new PDFDocument();const out=fs.createWriteStream(dir+'/Raven.pdf');doc.pipe(out);doc.text('Raven is a witty podcast host.');doc.end();await new Promise(r=>out.on('finish',r));
 const zip=(name,files)=>fs.writeFileSync(dir+'/'+name,zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8(v)]))));
 zip('Raven.docx',{'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>','_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>','word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Raven is a witty podcast host.</w:t></w:r></w:p></w:body></w:document>'});
 zip('Raven.epub',{'META-INF/container.xml':'<container><rootfiles><rootfile full-path="OEBPS/book.opf"/></rootfiles></container>','OEBPS/book.opf':'<package><manifest><item id="c1" href="chapter.xhtml"/></manifest><spine><itemref idref="c1"/></spine></package>','OEBPS/chapter.xhtml':'<html><body><p>Raven is a witty podcast host.</p></body></html>'});
 zip('Raven.odt',{'content.xml':'<office:document-content xmlns:office="urn:o" xmlns:text="urn:t"><office:body><text:p>Raven is a witty podcast host.</text:p></office:body></office:document-content>'});
 fs.writeFileSync(dir+'/Raven.txt','Raven is a witty podcast host.');fs.writeFileSync(dir+'/Raven.rtf','{\\rtf1\\ansi Raven is a witty podcast host.\\par Loves jazz.}');
 const http=require('http');
 const server=http.createServer((req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<script src="/document-import.js"></script>');}const name=req.url.slice(1);if(!['document-import.js','pdf.worker.min.mjs'].includes(name)){res.statusCode=404;return res.end();}res.setHeader('Content-Type','text/javascript');fs.createReadStream(__dirname+'/'+name).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 for(const ext of ['txt','pdf','docx','epub','odt','rtf']){
  const bytes=Array.from(fs.readFileSync(dir+'/Raven.'+ext));
  const result=await page.evaluate(async({bytes,ext})=>window.DocumentImport.read(new File([new Uint8Array(bytes)],'Raven.'+ext)),{bytes,ext});
  if(!result.includes('Raven is a witty podcast host.'))throw Error(ext+': '+result);console.log('PASS '+ext+' text extraction');
 }
 const rejected=await page.evaluate(async()=>{try{await window.DocumentImport.read(new File([new Uint8Array([0,2,5,8])],'audio.mp3'));return false}catch(e){return e.message.includes('cannot be read')}});if(!rejected)throw Error('binary not rejected');console.log('PASS unsupported binary rejected');
 const tooLarge=await page.evaluate(async()=>{try{await window.DocumentImport.read(new File([new Uint8Array(26*1024*1024)],'huge.txt'));return false}catch(e){return e.message.includes('25 MB')}});if(!tooLarge)throw Error('oversize file not rejected');console.log('PASS size limit');
 const html=await page.evaluate(async()=>window.DocumentImport.read(new File(['<p>Raven</p><script>window.injected=true</script>'],'host.html')));if(!html.includes('Raven')||html.includes('window.injected'))throw Error('unsafe HTML not stripped');console.log('PASS HTML extracts text only');
 if(errors.length)throw Error('Browser errors: '+errors.join('; '));console.log('PASS no uncaught browser errors');await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
