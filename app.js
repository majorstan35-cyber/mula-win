import('./.output/server/index.mjs').catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
