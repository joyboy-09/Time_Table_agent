import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const expressApp = require('../server/index.cjs');

export default function handler(req, res) {
  const fn = typeof expressApp === 'function' ? expressApp : (expressApp.default || expressApp);
  fn(req, res);
}
