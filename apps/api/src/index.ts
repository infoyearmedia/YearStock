// YearMedia API — local runner.
// `npm run dev` (tsx watch) and `npm run start` (node dist/index.js) use
// this file. The Express app itself lives in ./app.ts so the same app can
// also run as a Vercel serverless function (see api/index.ts at repo root)
// without ever calling listen() there.

import app from './app';

const PORT = Number(process.env.PORT || 4000);

app.listen(PORT, () => {
  console.log(`[yearmedia-api] listening on http://localhost:${PORT}`);
});

export default app;
