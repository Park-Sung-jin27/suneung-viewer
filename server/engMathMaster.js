/* global process */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Server only. Never trust browser email, user_metadata, role flags, or decoded JWTs.
export function isEngMathMaster(user) {
  return Boolean(user?.id && user.email_confirmed_at && !user.is_anonymous &&
    typeof user.email === 'string' && user.email.toLowerCase() === 'downfall121@gmail.com');
}
async function authenticate(token) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Master authentication not configured');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error) return null;
  return data.user;
}
export function createMasterHandler({ getUser = authenticate, directory = path.join(process.cwd(), 'data-eng-math-master') } = {}) {
  const read = (file) => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('Vary', 'Authorization');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    const header = req.headers?.authorization;
    const token = typeof header === 'string' ? header.match(/^Bearer ([^\s]+)$/i)?.[1] : null;
    if (!token) return res.status(401).json({ error: 'LOGIN_REQUIRED' });
    try {
      const user = await getUser(token);
      if (!user) return res.status(401).json({ error: 'LOGIN_REQUIRED' });
      if (!isEngMathMaster(user)) return res.status(403).json({ error: 'MASTER_REQUIRED' });
      const { question, asset, status } = req.query ?? {};
      if (status === '1' && question === undefined && asset === undefined) return res.status(200).json({ access: 'master' });
      if (question !== undefined && asset !== undefined) return res.status(400).json({ error: 'INVALID_REQUEST' });
      if (asset !== undefined) {
        if (typeof asset !== 'string' || !/^[a-f0-9]{64}$/.test(asset)) return res.status(400).json({ error: 'INVALID_ASSET' });
        const filename = read('assets.json')[asset];
        if (filename !== `assets/${asset}.png`) return res.status(404).json({ error: 'NOT_FOUND' });
        res.setHeader('Content-Type', 'image/png');
        return res.status(200).send(fs.readFileSync(path.join(directory, filename)));
      }
      const catalog = read('catalog.json');
      if (question === undefined) return res.status(200).json(catalog);
      if (typeof question !== 'string' || !catalog.questions.some(q => q.id === question)) return res.status(404).json({ error: 'NOT_FOUND' });
      return res.status(200).json(read(`${question}.json`));
    } catch {
      return res.status(503).json({ error: 'MASTER_UNAVAILABLE' });
    }
  };
}
