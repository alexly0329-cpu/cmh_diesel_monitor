const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../site/theme.js'), 'utf8');
function run(saved, systemDark, blocked = false) {
  const root = {dataset: {}}; const attrs = {}; const handlers = {}; const writes = [];
  const button = {setAttribute: (k,v) => attrs[k] = String(v), addEventListener: (k,f) => handlers[k] = f};
  const context = {document: {documentElement: root, addEventListener: (_,fn) => handlers.ready = fn, getElementById: () => button},
    matchMedia: () => ({matches: systemDark}), localStorage: {getItem: () => {if (blocked) throw Error('blocked'); return saved;}, setItem: (k,v) => {if (blocked) throw Error('blocked'); writes.push([k,v]);}}};
  vm.runInNewContext(source, context); handlers.ready(); return {root,attrs,handlers,writes};
}
let t = run(null, true); assert.equal(t.root.dataset.colorScheme, 'dark'); assert.equal(t.attrs['aria-checked'], 'true');
t.handlers.click(); assert.equal(t.root.dataset.colorScheme, 'light'); assert.equal(t.attrs['aria-checked'], 'false'); assert.deepEqual(t.writes, [['cmh-color-scheme','light']]);
t = run('light', true); assert.equal(t.root.dataset.colorScheme, 'light');
t = run('invalid', false); assert.equal(t.root.dataset.colorScheme, 'light');
t = run(null, false, true); t.handlers.click(); assert.equal(t.root.dataset.colorScheme, 'dark');
console.log('PASS: system default, saved preference, persistence, accessible state, invalid value, unavailable storage.');
