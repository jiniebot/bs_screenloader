module.exports = {
  apps: [
    {
      name: "bs-api",
      script: "src/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
      time: true,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "bs-worker",
      script: "src/workers/uploadWorker.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
      time: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
