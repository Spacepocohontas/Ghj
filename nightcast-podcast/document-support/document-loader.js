(() => {
  const base = document.currentScript.src;
  const accept = '.txt,.md,.markdown,.json,.csv,.tsv,.html,.htm,.xml,.yaml,.yml,.log,.srt,.vtt,.pdf,.docx,.epub,.odt,.rtf';
  let loading;
  const loader = {
    accept,
    async read(file) {
      if (!loading) loading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL('document-import.js', base).href;
        script.onload = () => window.DocumentImport !== loader ? resolve(window.DocumentImport) : reject(Error('Document reader failed to initialize.'));
        script.onerror = () => { loading = undefined; script.remove(); reject(Error('Could not load the document reader. Please try again.')); };
        document.head.append(script);
      });
      return (await loading).read(file);
    },
  };
  window.DocumentImport = loader;
})();
