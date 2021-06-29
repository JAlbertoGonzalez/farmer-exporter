const { exec } = require('child_process');

module.exports = function (port) {
  if (isNaN(port)) {
    return;
  }

  return new Promise((resolve) => {
    exec(`lsof -i:${port} -i:${port} | grep ESTABLISHED | wc -l`, (err, stdout, stderr) => {
      if (err || stderr) {
        return resolve(-1);
      }

      return resolve(stdout);
    })
  });
}