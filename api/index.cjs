const app = require('../server/index.cjs');

module.exports = (req, res) => {
  app(req, res);
};
