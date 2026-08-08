import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resolveId = (importee) => importee[0] === '/' ? resolve(__dirname, '.' + importee) : null;

export default {
  input: 'core/content.mjs',
  output: {
    file: 'core/bundle/content.bundle.js',
    format: 'cjs'
  },
  plugins: [
    { resolveId }
  ]
};
