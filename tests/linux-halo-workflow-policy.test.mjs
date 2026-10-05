import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import YAML from 'yaml';

const workflow = YAML.parse(readFileSync('.github/workflows/linux-halo-browser.yml', 'utf8'));

test('Linux diagnostics accept manual runs and same-repository PRs regardless of visibility', () => {
  // This condition uses only string equality, property access and boolean operators,
  // which share their semantics with Actions expressions for these event fixtures.
  for (const isPrivate of [false, true]) {
    for (const [eventName, headRepository, expected] of [
      ['workflow_dispatch', undefined, true],
      ['pull_request', 'owner/theme', true],
      ['pull_request', 'contributor/theme', false],
      ['push', undefined, false],
      ['pull_request_target', 'owner/theme', false],
    ]) {
      const github = {
        event_name: eventName,
        repository: 'owner/theme',
        event: {
          repository: {private: isPrivate},
          ...(headRepository ? {pull_request: {head: {repo: {full_name: headRepository}}}} : {}),
        },
      };
      assert.equal(runInNewContext(workflow.jobs.core.if, {github}, {timeout: 1000}), expected,
        `${isPrivate ? 'private' : 'public'} ${eventName} ${headRepository ?? ''}`);
    }
  }
});

test('Linux diagnostics retain unprivileged triggers and ephemeral checkout credentials', () => {
  assert.deepEqual(Object.keys(workflow.on).sort(), ['pull_request', 'workflow_dispatch']);
  assert.deepEqual(workflow.permissions, {contents: 'read'});
  assert.equal(workflow.jobs.core.permissions, undefined);
  const checkouts = workflow.jobs.core.steps.filter(step => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkouts.length, 2);
  for (const checkout of checkouts) assert.equal(checkout.with['persist-credentials'], false);
});
