import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export function readThemeArtifact(root) {
  const { name, version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const artifactFile = `dist/${name}-${version}.zip`;
  let bytes;
  try { bytes = readFileSync(resolve(root, artifactFile)); }
  catch (error) { throw new Error(`Build the current theme package before browser validation: ${artifactFile}`, { cause: error }); }
  return { artifactFile, artifactVersion: version, artifactSha256: createHash('sha256').update(bytes).digest('hex') };
}
