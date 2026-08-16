'use strict';

/**
 * Metro WorkerFarm / jest-worker fork transform workers with FORCE_COLOR=1.
 * Node 24 then warns when the parent also inherited NO_COLOR (Cursor agent,
 * CI): "The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set."
 */
function stripNodeColorConflict(env = process.env) {
  delete env.NO_COLOR;
  delete env.NODE_DISABLE_COLORS;
  return env;
}

module.exports = { stripNodeColorConflict };
