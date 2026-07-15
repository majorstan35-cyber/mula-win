import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverEntry = join(__dirname, '.output', 'server', 'index.mjs');

import(serverEntry).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
