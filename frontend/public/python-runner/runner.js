// Spec 017 : exécuteur de l'atelier Python, dans une iframe
// sandbox="allow-scripts" d'origine opaque (ni cookie, ni stockage, ni accès
// à la page). Le code Python tourne dans un worker créé ici depuis une URL
// blob: : une boucle infinie n'occupe jamais le fil de la page, et « Arrêter »
// est un terminate(). La CSP de ce document (connect-src 'none') s'applique
// aussi au worker : aucune requête ne peut partir, le moteur arrive de la page
// par postMessage. Protocole : specs/017-python-runtime/contracts/runner-protocol.md.
// Fichier écrit à la main, sans dépendance, à relire en entier à chaque
// modification : c'est la frontière de sécurité de l'atelier.
'use strict';

(function () {
  const ENGINE_FILES = [
    'pyodide.js',
    'pyodide.asm.mjs',
    'pyodide.asm.wasm',
    'python_stdlib.zip',
    'pyodide-lock.json',
  ];
  const FILE_NAME = /^[A-Za-z_][A-Za-z0-9_]*\.py$/;
  const MAX_FILES = 20;
  const MAX_FILE_LENGTH = 20000;
  const MAX_STDIN_LENGTH = 10000;

  let parentOrigin = null;
  let engine = null; // { module: WebAssembly.Module, files: { nom: ArrayBuffer } }
  let warm = null; // worker démarré, rien exécuté
  let current = null; // { worker, runId }

  function send(message) {
    if (parentOrigin !== null) window.parent.postMessage(message, parentOrigin);
  }

  function isPlainObject(value) {
    return (
      typeof value === 'object' &&
      value !== null &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }

  // Seuls les fichiers .py à nom simple sont écrits (pas de dossier, pas de
  // « .. ») ; les autres sont ignorés, l'aperçu les signale au rédacteur.
  function readRunFiles(files) {
    if (!isPlainObject(files)) return null;
    const entries = Object.entries(files);
    if (entries.length > MAX_FILES) return null;
    const kept = {};
    for (const [name, code] of entries) {
      if (typeof code !== 'string' || code.length > MAX_FILE_LENGTH) return null;
      if (FILE_NAME.test(name)) kept[name] = code;
    }
    return kept;
  }

  // Un worker neuf par exécution : rien d'une exécution ne survit à la
  // suivante. Celui-ci démarre le moteur à l'avance pour que le clic suivant
  // réponde en moins de deux secondes.
  function prepareWorker() {
    const url = URL.createObjectURL(
      new Blob(['(' + workerMain.toString() + ')()'], {
        type: 'text/javascript',
      }),
    );
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onmessage = (event) => {
      const message = event.data;
      if (!isPlainObject(message)) return;
      // Le worker qui exécute du code n'est plus jamais pris pour un worker
      // qui démarre, quoi qu'il envoie.
      if (current?.worker === worker) {
        relay(message);
        return;
      }
      // Un seul worker démarre à la fois : le suivant n'est créé qu'à la fin
      // de l'exécution qui a consommé celui-ci.
      if (message.type === 'booted' && warm === null) {
        warm = worker;
        send({ type: 'ready' });
      } else if (message.type === 'boot-failed') {
        worker.terminate();
        send({ type: 'engine-failed', reason: 'unknown' });
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      if (current?.worker === worker) {
        finish({
          status: 'error',
          error: { type: 'InternalError', message: '' },
        });
      } else {
        worker.terminate();
        send({ type: 'engine-failed', reason: 'unknown' });
      }
    };
    // Copies : chaque worker reçoit les siennes, l'iframe garde les originaux.
    worker.postMessage({
      type: 'boot',
      module: engine.module,
      files: {
        loader: engine.files['pyodide.js'],
        glue: engine.files['pyodide.asm.mjs'],
        stdlib: engine.files['python_stdlib.zip'],
        lock: engine.files['pyodide-lock.json'],
      },
    });
  }

  function relay(message) {
    if (message.type === 'output' && Array.isArray(message.chunks)) {
      send({ type: 'output', runId: current.runId, chunks: message.chunks });
    } else if (message.type === 'finished') {
      finish({ status: message.status, error: message.error });
    }
  }

  function finish({ status, error }) {
    const { worker, runId } = current;
    current = null;
    worker.terminate();
    send({
      type: 'finished',
      runId,
      status,
      ...(error ? { error } : {}),
    });
    prepareWorker();
  }

  async function receiveEngine(message) {
    if (engine !== null || !isPlainObject(message.assets)) return;
    const files = {};
    for (const name of ENGINE_FILES) {
      if (!(message.assets[name] instanceof ArrayBuffer)) return;
      files[name] = message.assets[name];
    }
    if (typeof WebAssembly !== 'object' || typeof Worker !== 'function') {
      send({ type: 'engine-failed', reason: 'unsupported' });
      return;
    }
    try {
      // Compilé une fois ; chaque worker reçoit le module déjà compilé.
      const module = await WebAssembly.compile(files['pyodide.asm.wasm']);
      delete files['pyodide.asm.wasm'];
      engine = { module, files };
    } catch {
      send({ type: 'engine-failed', reason: 'unknown' });
      return;
    }
    prepareWorker();
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!isPlainObject(message)) return;
    switch (message.type) {
      case 'init':
        if (parentOrigin === null && typeof message.parentOrigin === 'string') {
          parentOrigin = message.parentOrigin;
        }
        break;
      case 'engine':
        void receiveEngine(message);
        break;
      case 'run': {
        if (warm === null || current !== null) return;
        if (typeof message.runId !== 'string') return;
        const files = readRunFiles(message.files);
        if (
          files === null ||
          typeof message.stdin !== 'string' ||
          message.stdin.length > MAX_STDIN_LENGTH
        ) {
          return;
        }
        current = { worker: warm, runId: message.runId };
        warm = null;
        current.worker.postMessage({ type: 'run', files, stdin: message.stdin });
        break;
      }
      case 'stop':
        if (current !== null && current.runId === message.runId) {
          finish({ status: 'stopped' });
        }
        break;
    }
  });

  // ---------------------------------------------------------------------
  // Code du worker. Transformé en texte puis en URL blob: par prepareWorker :
  // il ne voit aucune variable de ce fichier.
  // ---------------------------------------------------------------------
  function workerMain() {
    const MAX_OUTPUT_CHARS = 200000;
    const MAX_OUTPUT_LINES = 10000;
    const FLUSH_EVERY_MS = 50;
    // Gardé avant le retrait des globales : le code Python ne pourra pas
    // fabriquer de faux messages (une sortie ou un verdict inventés).
    const post = self.postMessage.bind(self);

    // Après le démarrage, plus rien de réseau ni de stockage : la CSP coupe
    // déjà tout, ce retrait évite qu'une seule erreur de configuration suffise.
    function removeGlobals() {
      const names = [
        'fetch',
        'XMLHttpRequest',
        'WebSocket',
        'WebTransport',
        'EventSource',
        'importScripts',
        'BroadcastChannel',
        'indexedDB',
        'caches',
        'postMessage',
        'Worker',
        'SharedWorker',
      ];
      for (const name of names) {
        try {
          delete self[name];
        } catch {
          // propriété non configurable : masquée ci-dessous
        }
        if (name in self) {
          try {
            Object.defineProperty(self, name, { value: undefined });
          } catch {
            // dernière ligne : la CSP reste la garantie
          }
        }
      }
    }

    // Prélude Python : ni paquet, ni requête depuis Python.
    const PRELUDE = [
      'import sys',
      "for _name in ('micropip', 'pyodide.http'):",
      '    sys.modules[_name] = None',
      'del _name',
    ].join('\n');

    // Exécute main.py comme `python main.py` dans un dossier, et rend la trace
    // sans les cadres internes de runpy.
    const RUN_MAIN = [
      'def _atelier_run():',
      '    import runpy, sys, traceback',
      "    sys.path.insert(0, '/home/pyodide')",
      '    try:',
      "        runpy.run_path('main.py', run_name='__main__')",
      '    except SystemExit as error:',
      '        if error.code in (None, 0):',
      '            return None',
      "        return ('SystemExit', f'SystemExit: {error.code}')",
      '    except BaseException as error:',
      '        report = traceback.TracebackException.from_exception(error)',
      '        report.stack = traceback.StackSummary.from_list(',
      "            [frame for frame in report.stack if not frame.filename.startswith('<')]",
      '        )',
      "        return (type(error).__name__, ''.join(report.format()))",
      '    return None',
      '_atelier_run()',
    ].join('\n');

    let pyodide = null;

    async function boot({ module, files }) {
      const blobUrl = (buffer) =>
        URL.createObjectURL(new Blob([buffer], { type: 'text/javascript' }));
      const stdlib = files.stdlib;
      const nativeFetch = self.fetch;
      const nativeInstantiateStreaming = WebAssembly.instantiateStreaming;
      // Le chargeur de Pyodide demande le .wasm et la bibliothèque standard
      // par fetch : ce fetch-ci ne répond qu'à ces deux noms, depuis la
      // mémoire, et il est retiré avant toute exécution.
      self.fetch = async (url) => {
        const name = String(url).split('/').pop();
        if (name === 'python_stdlib.zip') return new Response(stdlib);
        if (name === 'pyodide.asm.wasm') {
          return new Response(new Uint8Array(0), {
            headers: { 'Content-Type': 'application/wasm' },
          });
        }
        throw new TypeError('Aucune requête depuis l’atelier.');
      };
      // Instancie le module déjà compilé par l'iframe au lieu de compiler la
      // réponse vide ci-dessus.
      WebAssembly.instantiateStreaming = async (_response, imports) => ({
        module,
        instance: await WebAssembly.instantiate(module, imports),
      });
      try {
        importScripts(blobUrl(files.loader));
        const glue = await import(blobUrl(files.glue));
        pyodide = await self.loadPyodide({
          // Adresse fictive, jamais contactée : tout est servi par le fetch
          // ci-dessus (et la CSP bloquerait toute requête).
          indexURL: 'https://pyodide.invalid/',
          lockFileContents: new TextDecoder().decode(files.lock),
          createPyodideModule: glue.default,
          // Sorties déclarées « terminal » plus bas : sans couleurs ANSI.
          env: { NO_COLOR: '1', PYTHON_COLORS: '0' },
          stdout: () => {},
          stderr: () => {},
        });
      } finally {
        self.fetch = nativeFetch;
        WebAssembly.instantiateStreaming = nativeInstantiateStreaming;
      }
      const refuse = () => {
        throw new Error('Seule la bibliothèque standard est disponible.');
      };
      pyodide.loadPackage = refuse;
      pyodide.loadPackagesFromImports = refuse;
      pyodide.runPython(PRELUDE);
      removeGlobals();
    }

    function run({ files, stdin }) {
      const lines = stdin === '' ? [] : stdin.replace(/\r\n?/g, '\n').split('\n');
      let nextLine = 0;
      pyodide.setStdin({
        stdin: () => (nextLine < lines.length ? lines[nextLine++] : undefined),
      });

      let chunks = [];
      let lastFlush = Date.now();
      let chars = 0;
      let lineCount = 0;
      let truncated = false;
      const flush = () => {
        if (chunks.length > 0) post({ type: 'output', chunks });
        chunks = [];
        lastFlush = Date.now();
      };
      // Pendant l'exécution, le worker est occupé : aucun minuteur ne se
      // déclenche. Les paquets partent donc depuis l'écriture elle-même.
      const writer = (stream) => {
        const decoder = new TextDecoder();
        return {
          // Comme un terminal : Python vide sa sortie à chaque ligne, l'ordre
          // entre sortie et erreurs est celui de la production.
          isatty: true,
          write(buffer) {
            if (truncated) return buffer.length;
            let text = decoder.decode(buffer, { stream: true });
            const room = MAX_OUTPUT_CHARS - chars;
            if (text.length > room) {
              text = text.slice(0, room);
              truncated = true;
            }
            const newLines = text.split('\n').length - 1;
            if (lineCount + newLines > MAX_OUTPUT_LINES) {
              const keep = text.split('\n').slice(0, MAX_OUTPUT_LINES - lineCount);
              text = keep.join('\n');
              truncated = true;
            }
            chars += text.length;
            lineCount += text.split('\n').length - 1;
            const last = chunks[chunks.length - 1];
            if (last && last.stream === stream) last.text += text;
            else if (text !== '') chunks.push({ stream, text });
            if (truncated) {
              flush();
              // L'iframe termine ce worker dès ce message.
              post({ type: 'finished', status: 'truncated' });
            } else if (Date.now() - lastFlush >= FLUSH_EVERY_MS) {
              flush();
            }
            return buffer.length;
          },
        };
      };
      pyodide.setStdout(writer('stdout'));
      pyodide.setStderr(writer('stderr'));

      const home = '/home/pyodide';
      for (const [name, code] of Object.entries(files)) {
        pyodide.FS.writeFile(`${home}/${name}`, code, { encoding: 'utf8' });
      }
      if (!('main.py' in files)) {
        flush();
        post({
          type: 'finished',
          status: 'error',
          error: { type: 'MissingMain', message: '' },
        });
        return;
      }

      let error;
      try {
        const result = pyodide.runPython(RUN_MAIN);
        if (result) {
          const [type, message] = result.toJs();
          result.destroy();
          error = { type, message };
        }
      } catch (fatal) {
        // Erreur du moteur lui-même : le plus souvent la mémoire épuisée.
        error = {
          type:
            fatal instanceof RangeError || /memory/i.test(String(fatal))
              ? 'MemoryError'
              : 'InternalError',
          message: '',
        };
      }
      if (truncated) return;
      flush();
      post({
        type: 'finished',
        status: error ? 'error' : 'ok',
        ...(error ? { error } : {}),
      });
    }

    self.onmessage = async (event) => {
      const message = event.data;
      if (message.type === 'boot' && pyodide === null) {
        try {
          await boot(message);
          post({ type: 'booted' });
        } catch {
          post({ type: 'boot-failed' });
        }
      } else if (message.type === 'run' && pyodide !== null) {
        self.onmessage = null; // une seule exécution par worker
        run(message);
      }
    };
  }
})();
