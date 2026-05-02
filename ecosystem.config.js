module.exports = {
  apps: [{
    name: 'security-analyzer',
    script: 'node_modules/.bin/next',
    args: 'start -p 3000',
    node_args: '--max-old-space-size=1024',
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }],
};
