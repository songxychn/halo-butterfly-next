import {test} from 'bun:test';
import {execFileSync} from 'node:child_process';

test('comment inventory collects every page and rejects drift, duplicates and incomplete lists',()=>{
 execFileSync('python3',['-B','-c',String.raw`
import sys
sys.path.insert(0,'scripts/acceptance/comments')
from inventory import read_inventory
def item(name):return {'metadata':{'name':name}}
def read(pages):
 calls=[]
 def api(url):
  calls.append(url)
  return pages[len(calls)-1]
 result=read_inventory(api,'/items',page_size=2,max_items=4)
 assert calls==['/items?page=1&size=2','/items?page=2&size=2']
 return result
a={'page':1,'total':3,'hasNext':True,'items':[item('a'),item('b')]}
b={'page':2,'total':3,'hasNext':False,'items':[item('c')]}
assert len(read([a,b]))==3
for changed in [dict(b,total=4),dict(b,items=[item('a')]),dict(b,items=[]),dict(b,page=1),dict(b,hasNext=True)]:
 try:read([a,changed])
 except RuntimeError:pass
 else:raise AssertionError('Unsafe inventory accepted')
try:read_inventory(lambda _:dict(a,total=5),'/items',page_size=2,max_items=4)
except RuntimeError:pass
else:raise AssertionError('Unbounded inventory accepted')
`],{stdio:'pipe'});
});

test('only an existing exact synthetic global reply subscription may rotate',()=>{
 execFileSync('python3',['-B','-c',String.raw`
import sys,copy
sys.path.insert(0,'scripts/acceptance/comments')
from subscriptions import rotating_subscription
obj={'spec':{'disabled':False,'subscriber':{'name':'fixture-maintainer'},'unsubscribeToken':'synthetic','reason':{'reasonType':'someone-replied-to-you','expression':"props.repliedOwner == 'fixture-maintainer'",'subject':{'apiVersion':'notification.halo.run/v1alpha1','kind':'NonexistentKind'}}}}
assert rotating_subscription(obj,'Post',True)
assert not rotating_subscription(obj,'Post',False)
for change in [lambda x:x['spec'].update(extra=True),lambda x:x['spec'].update(disabled=True),lambda x:x['spec']['subscriber'].update(name='other'),lambda x:x['spec']['reason'].update(expression='true'),lambda x:x['spec']['reason']['subject'].update(name='any'),lambda x:x['spec'].update(unsubscribeToken='')]:
 changed=copy.deepcopy(obj);change(changed);assert not rotating_subscription(changed,'Post',True)
`],{stdio:'pipe'});
});
