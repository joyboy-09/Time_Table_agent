import expressApp from '../server/index.cjs';

const app = expressApp.default || expressApp;

export default function handler(req, res) {
  app(req, res);
}
