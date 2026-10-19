// The /api/blitz serverless function (Vercel). The rules are in server/handler.js and the storage
// in server/stores.js.
import { handle } from '../server/handler.js';
import { storesFrom } from '../server/stores.js';

async function run(req) {
  let stores;
  try {
    stores = await storesFrom();
  } catch (err) {
    console.error('bug-blitz', err);
    return Response.json({ error: 'Shared blitzes aren’t available right now.' }, { status: 503 });
  }
  return handle(req, stores);
}

export const GET = run;
export const POST = run;
export const DELETE = run;
