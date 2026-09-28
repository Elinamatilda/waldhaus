import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);

// Exercise the actual TS modules with isolated I/O. No database, cookies, or
// application secrets are accessed. React request caching is outside this test.
export function loadModule(relativePath, mocks = {}, loaded = new Map()) {
  const filename = resolve(relativePath);
  if (loaded.has(filename)) return loaded.get(filename).exports;
  const loadedModule = { exports: {} };
  loaded.set(filename, loadedModule);
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === 'server-only') return {};
    if (name === 'react') return { cache: (fn) => fn };
    if (name.startsWith('@/') || name.startsWith('.')) {
      const file = name.startsWith('@/')
        ? resolve('src', name.slice(2))
        : resolve(dirname(filename), name);
      const source = [file + '.ts', file + '.tsx', resolve(file, 'index.ts'), resolve(file, 'index.tsx')].find(existsSync);
      if (!source) throw new Error(`Cannot resolve test module: ${name}`);
      return loadModule(source, mocks, loaded);
    }
    return require(name);
  };
  vm.runInThisContext(`(function(require,module,exports){${outputText}\n})`, { filename })(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
