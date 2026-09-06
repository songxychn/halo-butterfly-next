import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const escape = text => String(text ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
export const statusLabels = {
  gap: '待实现',
  'mapping-required': '待平台映射',
  'implemented-unverified': '有相关实现，待对照验收',
  'in-progress': '开发中',
  'verification-failed': '验收失败',
  'review-required': '待独立审查',
  'ci-required': '待 CI',
  verified: '已验收',
  blocked: '阻塞（范围保留）',
};

export function renderMatrix(matrix) {
  const lines = ['# Butterfly 5.7.0 功能矩阵', '',
    '> 此文件由 `node scripts/parity-render.mjs` 生成。只编辑 `matrix.json`；覆盖检查不代表功能验收。', '',
    `固定上游：${matrix.upstream.version} / \`${matrix.upstream.commit}\`。首次 Halo 源码盘点：\`${matrix.haloBaseline}\`。`, '',
    '每项必须经过其验收场景、独立审查和对应提交的 CI 才能置为 `verified`。平台差异保留原需求，未经维护者确认不能删除或标为不适用。', '',
    '| 状态 | 项数 |', '| --- | ---: |'];
  for (const [key, label] of Object.entries(statusLabels)) lines.push(`| ${label} | ${matrix.items.filter(item => item.status === key).length} |`);
  lines.push('', '详细适配方案、依赖和每项验收案例见 [matrix.json](matrix.json)。共用条件及证据格式见 [维护说明](README.md)。', '');
  for (const kind of [...new Set(matrix.items.map(item => item.kind))]) {
    lines.push(`## ${matrix.kindLabels[kind] ?? kind}`, '', '| ID / 功能 | 上游来源 | Halo 现状 / 适配 | 验收 | 状态 / 证据 |', '| --- | --- | --- | --- | --- |');
    for (const item of matrix.items.filter(item => item.kind === kind)) {
      const source = item.sources[0];
      const link = `${matrix.upstream.repository}/blob/${matrix.upstream.commit}/${source.file}#L${source.line}`;
      const current = item.halo.settings.length ? `设置：${item.halo.settings.join(', ')}` : item.halo.finding;
      const evidence = item.evidence.length ? item.evidence.map(e => e.path).join(', ') : '无验收证据';
      lines.push(`| <a id="${escape(item.id.replace(/[^\w-]/g, '-'))}"></a>\`${escape(item.id)}\`<br>${escape(item.title)} | [${escape(source.file)}:${source.line}](${link})${source.key || source.symbol ? `<br>\`${escape(source.key || source.symbol)}\`` : ''} | ${escape(current)}<br>${escape(item.halo.strategy)} | ${escape(item.acceptance.contractScenarios.join(', '))}<br>${escape(item.acceptance.cases.join('；'))} | ${statusLabels[item.status]}<br>${escape(evidence)} |`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const matrix = JSON.parse(await readFile(path.join(ROOT, 'docs/parity/matrix.json'), 'utf8'));
  await writeFile(path.join(ROOT, 'docs/parity/MATRIX.md'), renderMatrix(matrix));
  console.log(`已生成 ${matrix.items.length} 项功能矩阵`);
}
