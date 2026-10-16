import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth/mammoth.browser.js';
import { unzipSync, strFromU8 } from 'fflate';
const scriptBase = document.currentScript?.src || new URL('document-import.js', location.href).href;
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', scriptBase).href;
const ACCEPT = '.txt,.md,.markdown,.json,.csv,.tsv,.html,.htm,.xml,.yaml,.yml,.log,.srt,.vtt,.pdf,.docx,.epub,.odt,.rtf';
const LIMIT = 25 * 1024 * 1024;
function markupText(text, xml = false) {
  const doc = new DOMParser().parseFromString(text, xml ? 'application/xml' : 'text/html');
  doc.querySelectorAll('script,style,iframe,object').forEach(el => el.remove());
  doc.querySelectorAll('p,div,br,h1,h2,h3,li,tr,section').forEach(el => el.append('\n'));
  return doc.documentElement.textContent || '';
}
function rtfText(text) {
  return text.replace(/\{\\\*?[\\a-z]+[^{}]*\{[^{}]*\}[^{}]*\}/gi, '')
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => new TextDecoder('windows-1252').decode(Uint8Array.of(parseInt(h, 16))))
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(Number(n) < 0 ? Number(n) + 65536 : Number(n)))
    .replace(/\\(?:par|line)\b ?/g, '\n').replace(/\\tab\b ?/g, '\t')
    .replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '').replace(/\\([\\{}])/g, '$1');
}
async function read(file) {
  if (!file || !file.size) throw Error('Choose a non-empty document.');
  if (file.size > LIMIT) throw Error('Please choose a document under 25 MB.');
  const ext = file.name.split('.').pop().toLowerCase();
  let text = '';
  if (ext === 'pdf') {
    const task = pdfjs.getDocument({data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false});
    let pdf;
    try {
      pdf = await task.promise;
      if (pdf.numPages > 500) throw Error('Please split PDFs longer than 500 pages before importing.');
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i), content = await page.getTextContent();
        pages.push(content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join(''));
        page.cleanup();
      }
      text = pages.join('\n\n');
      if (!text.trim()) throw Error('This PDF has no selectable text. Run OCR on the scanned pages, then import it again.');
    } finally { await task.destroy(); }
  } else if (ext === 'docx') {
    text = (await mammoth.extractRawText({arrayBuffer: await file.arrayBuffer()})).value;
  } else if (ext === 'epub' || ext === 'odt') {
    const zip = unzipSync(new Uint8Array(await file.arrayBuffer()), {filter: entry => {
      if (entry.originalSize > 20 * 1024 * 1024) throw Error('A document section is too large to extract safely.');
      return ext === 'odt' ? entry.name === 'content.xml' : /\.(xhtml|html|htm|opf|xml)$/i.test(entry.name);
    }});
    if (ext === 'odt') {
      if (!zip['content.xml']) throw Error('This ODT document is missing its content.');
      text = markupText(strFromU8(zip['content.xml']), true);
    } else {
      const container = zip['META-INF/container.xml'];
      const containerDoc = new DOMParser().parseFromString(container ? strFromU8(container) : '', 'application/xml');
      const opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
      if (!opfPath || !zip[opfPath]) throw Error('This EPUB has no readable book manifest.');
      const opf = new DOMParser().parseFromString(strFromU8(zip[opfPath]), 'application/xml');
      const base = opfPath.slice(0, opfPath.lastIndexOf('/') + 1);
      const sections = Array.from(opf.querySelectorAll('spine itemref')).map(ref => {
        const item = Array.from(opf.querySelectorAll('manifest item')).find(item => item.getAttribute('id') === ref.getAttribute('idref'));
        const href = item?.getAttribute('href');
        if (!href) return '';
        const path = decodeURIComponent(new URL(href, 'https://book.invalid/' + base).pathname.slice(1));
        return zip[path] ? markupText(strFromU8(zip[path])) : '';
      });
      text = sections.join('\n\n');
    }
  } else {
    if (!ACCEPT.split(',').includes('.' + ext) && !file.type.startsWith('text/')) {
      throw Error('This format cannot be read as a document. Use TXT, PDF, DOCX, EPUB, ODT, RTF, JSON, Markdown, HTML or CSV. Legacy DOC and encrypted files need conversion first.');
    }
    text = await file.text();
    if (text.includes('\u0000')) throw Error('This file contains binary data, not readable text.');
    if (ext === 'html' || ext === 'htm') text = markupText(text);
    if (ext === 'rtf') text = rtfText(text);
  }
  text = text.replace(/\r\n?/g, '\n').trim();
  if (!text) throw Error('No readable text was found in this document.');
  if (text.length > 500000) throw Error('This document contains over 500,000 characters. Split it into smaller sections to preserve all its text.');
  return text;
}
window.DocumentImport = {read, accept: ACCEPT};
