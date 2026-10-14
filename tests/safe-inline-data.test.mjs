import assert from 'node:assert/strict';
import {test} from 'bun:test';
import {safeInlineData} from '../scripts/safe-inline-data.mjs';
test('script data use platform JSON serialization before HTML boundary escaping',()=>{
 const s=safeInlineData('<script th:inline="javascript">const data=/*[[${model}]]*/ {};</script>');
 assert.match(s,/th:with="scriptJsonMapper=\$\{T\(run.halo.app.infra.utils.JsonUtils\).mapper\(\)\}"/);
 assert.match(s,/scriptJsonMapper.writeValueAsString\(\(model\)\)/);for(const code of ['\\u003C','\\u003E','\\u2028','\\u2029'])assert(s.includes("'"+code.slice(1)+"'"));assert(!s.includes('/*[['));
 assert(s.includes("#strings.substring(scriptJsonMapper.writeValueAsString('"+'"'+"'), 1, 2)"));assert(!s.includes("'\\u003C'"));assert.equal(s.indexOf('eval('),-1);assert(s.includes("'JSON.parse(' +"));assert(s.includes('writeValueAsString(scriptJsonMapper.writeValueAsString('));
});
test('binding retains preexisting script scope and quoted greater-than attributes; messages use same protection',()=>{
 const s=safeInlineData('<script data-test="a > b" th:inline="javascript" th:with="local=${value}">const label=/*[[#{ui.label}]]*/ "label";const x=/*[[${local ?: {}}]]*/ {};</script>');
 assert.match(s,/th:with="local=\$\{value\}, scriptJsonMapper=/);assert(s.includes("#messages.msg('ui.label')"));assert(s.includes('((local ?: {}))'));
 assert.throws(()=>safeInlineData('<script th:inline="javascript">const x=/*[(${raw})]*/ {};</script>'));
});
test('JSON-LD and intentional injection/non-inline scripts are left to their own declared boundary',()=>{
 for(const s of ['<script type="application/ld+json" th:utext="${encoded}"></script>','<script th:inline="none">const x="{{value}}";</script>','<div th:utext="${trusted}"></div>'])assert.equal(safeInlineData(s),s);
});

test('unsupported bare data expressions and reserved binding fail closed',()=>{
 for(const token of ['[[${value}]]','[(${raw})]','[[#{ui.label}]]'])assert.throws(()=>safeInlineData('<script th:inline="javascript">'+token+'</script>'));
 assert.throws(()=>safeInlineData('<script th:inline="javascript" th:with="scriptJsonMapper=${other}">const data=/*[[${x}]]*/ {};</script>'));
 const quoted=safeInlineData("<script th:inline='javascript' th:with='x=${data}'>const x=/*[[${x}]]*/ {};</script>");assert(quoted.includes('scriptJsonMapper.writeValueAsString'));assert(quoted.includes('x=${data}, scriptJsonMapper='));
});
