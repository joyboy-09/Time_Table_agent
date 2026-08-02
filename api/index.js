import app from '../server/index.cjs';

export default function handler(req, res) {
  app(req, res);
}
