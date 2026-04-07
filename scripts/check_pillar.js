const m = require('mysql2/promise');
m.createConnection({host:'localhost',user:'root',database:'mubs_super_admin'})
  .then(c => c.query("SHOW COLUMNS FROM strategic_activities LIKE 'pillar'")
  .then(([r]) => console.log(r))
  .catch(console.error)
  .finally(() => c.end()));
