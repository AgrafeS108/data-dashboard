// Alias route. If /api/snapshot-channel fails in a browser/cache, /api/snapshot works too.
module.exports = require('./snapshot-channel');
