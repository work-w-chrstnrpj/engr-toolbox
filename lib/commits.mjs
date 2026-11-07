import { git } from './git.mjs';
import { loadTickets } from './tickets.mjs';

const LOCAL_REF = /\b([a-z0-9][a-z0-9-]*)\/(\d{2,3})\b/g;
const REMOTE_REF = /(?:^|[\s(])#\d+\b/;
const ESCAPE = /\[no-ticket\]/i;

export function checkMessage(message, knownIds) {
  if (ESCAPE.test(message)) return { ok: true, refs: [], reason: 'no-ticket escape' };
  if (REMOTE_REF.test(message)) return { ok: true, refs: [message.match(REMOTE_REF)[0].trim()] };
  const refs = [...message.matchAll(LOCAL_REF)].map(m => `${m[1]}/${m[2]}`);
  const known = refs.filter(r => knownIds.has(r));
  if (known.length) return { ok: true, refs: known };
  if (refs.length) return { ok: false, refs, reason: `unknown ticket ${refs.join(', ')}` };
  return { ok: false, refs: [], reason: 'no ticket reference (use feature/NN, #123, or [no-ticket])' };
}

export function checkCommits(root, range) {
  if (!range) throw new Error('--range <base>..<head> is required');
  const knownIds = new Set(loadTickets(root).map(t => t.id));
  const raw = git(root, ['log', '--no-merges', '--format=%h%x1f%s%x1f%b%x1e', range]);
  const results = raw
    .split('\x1e')
    .map(s => s.trim())
    .filter(Boolean)
    .map(rec => {
      const [sha, subject, body = ''] = rec.split('\x1f');
      return { sha, subject, ...checkMessage(`${subject}\n${body}`, knownIds) };
    });
  return { range, results, ok: results.every(r => r.ok) };
}
