/**
 * AWS Signature Version 4 for JSON-RPC style AWS APIs (for example KMS).
 * Built on node:crypto only. Verified against an independent reference in
 * the test suite; not yet exercised against live AWS in this repository.
 */
import { createHash, createHmac } from 'node:crypto';

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface SignInput {
  service: string;
  region: string;
  credentials: AwsCredentials;
  method: 'GET' | 'POST';
  host: string;
  path: string;
  headers: Record<string, string>;
  body: Buffer;
  now: Date;
}

const sha256Hex = (d: Buffer | string) => createHash('sha256').update(d).digest('hex');
const hmac = (k: Buffer | string, d: string) => createHmac('sha256', k).update(d).digest();

/** Returns the complete header set to send, including Authorization. */
export function signAwsRequest(input: SignInput): Record<string, string> {
  const amzDate = input.now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(input.body);

  const headers: Record<string, string> = {
    ...input.headers,
    host: input.host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };
  const names = Object.keys(headers).map((n) => n.toLowerCase()).sort();
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = String(v).trim();

  const canonicalHeaders = names.map((n) => `${n}:${lower[n]}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = [input.method, input.path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const kDate = hmac('AWS4' + input.credentials.secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, input.service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const out: Record<string, string> = { ...input.headers };
  out['x-amz-date'] = amzDate;
  out['x-amz-content-sha256'] = payloadHash;
  out.Authorization =
    `AWS4-HMAC-SHA256 Credential=${input.credentials.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return out;
}
