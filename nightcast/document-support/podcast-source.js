(() => {
  const topic = document.getElementById('topic');
  if (!topic || !window.DocumentImport) return;
  const section = document.createElement('section');
  section.className = 'importBox';
  const label = document.createElement('label');
  label.textContent = 'Upload episode source document';
  const input = document.createElement('input');
  input.type = 'file'; input.accept = window.DocumentImport.accept;
  label.append(input);
  const status = document.createElement('p'); status.className = 'hint'; status.setAttribute('role', 'status');
  status.textContent = 'TXT, PDF, DOCX, EPUB, ODT, RTF, Markdown, HTML, JSON and CSV. Files stay in your browser; scanned PDFs need OCR.';
  section.append(label, status); topic.closest('label').after(section);
  input.addEventListener('change', async () => {
    const file = input.files[0]; if (!file) return;
    input.disabled = true; status.textContent = 'Reading ' + file.name + '…';
    try {
      const text = await window.DocumentImport.read(file);
      topic.value = text;
      topic.dispatchEvent(new Event('input', {bubbles: true}));
      status.textContent = `Loaded ${file.name}: ${text.length.toLocaleString()} characters. Review the source before generating.`;
    } catch (error) { status.textContent = error.message; }
    finally { input.disabled = false; input.value = ''; }
  });
})();
