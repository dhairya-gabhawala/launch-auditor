const express = require('express');
const path = require('path');
const { APP_ROOT, RUNS_ROOT } = require('./lib/paths');

const indexRoutes = require('./routes/index');
const configRoutes = require('./routes/config');
const validateRoutes = require('./routes/validate');
const auditRoutes = require('./routes/audit');
const runsRoutes = require('./routes/runs');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(APP_ROOT, 'public')));
app.use('/runs', express.static(RUNS_ROOT));

app.use(indexRoutes);
app.use(configRoutes);
app.use(validateRoutes);
app.use(auditRoutes);
app.use(runsRoutes);

function startServer(port = process.env.PORT || 4545) {
  return new Promise(resolve => {
    const server = app.listen(port, () => {
      console.log(`Launch Auditor running at http://localhost:${port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer
};
