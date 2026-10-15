import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
// Framing regressions would falsely blame a server; exercise real Reader against fragmented bytes.
test('queued HTTP reader preserves adjacent responses and chunk trailers', () => {
  const output = execFileSync('python3', ['-c', `
import importlib.util, hashlib
s=importlib.util.spec_from_file_location('probe','scripts/browser/queued-http-diagnostic.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Stream:
 def __init__(self,data,size):self.data=data;self.size=size
 def recv(self,n):value,self.data=self.data[:self.size],self.data[self.size:];return value
fixed=b'HTTP/1.1 200 OK\\r\\nContent-Length: 3\\r\\n\\r\\nabc'
chunked=b'HTTP/1.1 200 OK\\r\\nTransfer-Encoding: chunked\\r\\n\\r\\n2;ext=v\\r\\nde\\r\\n1\\r\\nf\\r\\n0\\r\\nX-Trailer: yes\\r\\n\\r\\n'
for size in [1,7,65536]:
 reader=m.Reader(Stream(fixed+chunked+fixed,size))
 assert [reader.response()['sha256'] for _ in range(3)]==[hashlib.sha256(b).hexdigest() for b in [b'abc',b'def',b'abc']]
 assert reader.buffer==b''
print('3 fragment boundaries passed')
`], { encoding: 'utf8' });
  assert.match(output, /3 fragment boundaries passed/);
});
test('queued HTTP reader rejects EOF and ambiguous or closing responses', () => {
  const output = execFileSync('python3', ['-c', `
import importlib.util
s=importlib.util.spec_from_file_location('probe','scripts/browser/queued-http-diagnostic.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Stream:
 def __init__(self,data):self.data=data
 def recv(self,n):value,self.data=self.data,b'';return value
bad=[b'HTTP/1.1 200 OK\\r\\nContent-Length: 4\\r\\n\\r\\nabc',b'HTTP/1.1 200 OK\\r\\nConnection: close\\r\\nContent-Length: 0\\r\\n\\r\\n',b'HTTP/1.1 200 OK\\r\\nTransfer-Encoding: chunked\\r\\nContent-Length: 0\\r\\n\\r\\n',b'HTTP/1.1 200 OK\\r\\n\\r\\n',b'HTTP/1.1 200 OK\\r\\nContent-Length: 0\\r\\nContent-Length: 1\\r\\n\\r\\n']
for raw in bad:
 try:m.Reader(Stream(raw)).response()
 except (EOFError,ValueError):pass
 else:raise AssertionError('Invalid framing accepted')
print('5 invalid response cases rejected')
`], { encoding: 'utf8' });
  assert.match(output, /5 invalid response cases rejected/);
});
