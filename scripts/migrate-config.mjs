import { open, readFile, rm } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { parse } from 'yaml';
import { asConfigMap, defaultsFromSettings, migrateConfig, readConfig } from './config-migration.mjs';

const { values } = parseArgs({ options: {
  input: { type: 'string' }, output: { type: 'string' }, from: { type: 'string' }, format: { type: 'string', default: 'json-config' }, help: { type: 'boolean' },
} });
if (values.help) {
  console.log('bun run migrate --input old.json --from 2.0.5 --output next.json [--format json-config|configmap]');
} else {
  if (!values.input || !values.output) throw new Error('请指定 --input 和 --output；脚本只写新文件，不会连接 Halo');
  if (!['json-config', 'configmap'].includes(values.format)) throw new Error('format 必须是 json-config 或 configmap');
  if (path.resolve(values.input) === path.resolve(values.output)) throw new Error('输出不能覆盖原配置');
  const settings = parse(await readFile(new URL('../settings.yaml', import.meta.url), 'utf8'));
  const { config, report } = migrateConfig(readConfig(await readFile(values.input, 'utf8')), values.from, defaultsFromSettings(settings));
  const created = [];
  try {
    for (const [file, content] of [[values.output, values.format === 'configmap' ? asConfigMap(config) : config], [`${values.output}.report.json`, report]]) {
      const handle = await open(file, 'wx', 0o600);
      created.push(file);
      try { await handle.writeFile(JSON.stringify(content, null, 2) + '\n'); } finally { await handle.close(); }
    }
  } catch (error) {
    await Promise.all(created.map(file => rm(file)));
    throw error;
  }
  console.log(`已生成新配置及字段级报告。${report.needsReview ? '存在需要人工处理的字段，请先阅读 .report.json。' : '请核对站点预览后再应用。'}`);
}
