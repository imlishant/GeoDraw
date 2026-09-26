// Share-by-link without a server: the whole construction is compressed into the
// URL fragment (#share=…). Fragments are never sent to the web server.

import type { Doc } from '../../engine/types';
import { base64UrlToBytes, bytesToBase64Url, docToJSON, parseDoc } from '../../engine/serialize';

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeShare(doc: Doc): Promise<string> {
  // strip ids that tie the link to the author's local library
  const json = new TextEncoder().encode(docToJSON({ ...doc, id: 'shared' }));
  if (typeof CompressionStream !== 'undefined') {
    const z = await pipe(json, new CompressionStream('deflate-raw'));
    return `z${bytesToBase64Url(z)}`;
  }
  return `j${bytesToBase64Url(json)}`;
}

export async function decodeShare(token: string): Promise<Doc> {
  const kind = token[0];
  const bytes = base64UrlToBytes(token.slice(1));
  let json: Uint8Array;
  if (kind === 'z') {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed links');
    json = await pipe(bytes, new DecompressionStream('deflate-raw'));
  } else if (kind === 'j') json = bytes;
  else throw new Error('Unknown link format');
  return parseDoc(new TextDecoder().decode(json));
}

export async function shareUrl(doc: Doc): Promise<string> {
  const token = await encodeShare(doc);
  return `${location.origin}${location.pathname}#share=${token}`;
}

export function readShareToken(): string | null {
  const m = location.hash.match(/^#share=([A-Za-z0-9_-]+)$/);
  return m ? m[1] : null;
}
