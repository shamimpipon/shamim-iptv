// Simple bounded-concurrency worker pool for high-speed parallel checking.
async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  let active = 0;
  const safeLimit = Math.max(1, limit);

  return new Promise((resolve, reject) => {
    function launchNext() {
      if (index >= items.length && active === 0) {
        resolve(results);
        return;
      }
      while (active < safeLimit && index < items.length) {
        const current = index++;
        active++;
        Promise.resolve(worker(items[current], current))
          .then((res) => {
            results[current] = res;
            active--;
            launchNext();
          })
          .catch(reject);
      }
    }
    launchNext();
  });
}

module.exports = { runWithConcurrency };
