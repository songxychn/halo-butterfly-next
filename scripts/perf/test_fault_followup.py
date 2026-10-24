"""Offline fault-runner regressions: owned locks, real process groups, API failures."""
import importlib.util
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import types
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location('fault_followup', Path(__file__).with_name('fault-followup.py'))
fault = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fault)


class LocksTests(unittest.TestCase):
    def test_reservation_blocks_both_existing_runners_and_releases_only_its_own_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve(); runtime = root / 'lab'; runtime.mkdir(); cpu = root / 'cpu'
            locks = fault.acquire_run_locks(runtime, 'one', cpu)
            # The actual atomic operations used by collect.mjs / combinations/run.py.
            with self.assertRaises(FileExistsError): cpu.mkdir()
            with self.assertRaises(FileExistsError): (runtime / 'acceptance-combinations.lock').open('x')
            with self.assertRaises(FileExistsError): fault.acquire_run_locks(runtime, 'two', cpu)
            fault.release_run_locks(locks)
            self.assertFalse(cpu.exists()); self.assertEqual(list(runtime.iterdir()), [])

    def test_conflicts_roll_back_partial_reservation_without_deleting_other_owner(self):
        for name in ['acceptance-combinations.lock', 'perf03-followup.lock']:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temp:
                root = Path(temp).resolve(); runtime = root / 'lab'; runtime.mkdir(); cpu = root / 'cpu'
                existing = runtime / name; existing.write_text('other')
                with self.assertRaises(FileExistsError): fault.acquire_run_locks(runtime, 'one', cpu)
                self.assertEqual(existing.read_text(), 'other'); self.assertFalse(cpu.exists())
                self.assertEqual(list(runtime.iterdir()), [existing])

    def test_owner_drift_does_not_partially_unlock(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve(); runtime = root / 'lab'; runtime.mkdir(); cpu = root / 'cpu'
            locks = fault.acquire_run_locks(runtime, 'one', cpu)
            changed = runtime / 'perf03-followup.lock'; changed.write_text('other')
            with self.assertRaisesRegex(RuntimeError, 'ownership changed'): fault.release_run_locks(locks)
            self.assertTrue(all(p.exists() for p, _ in locks))
            changed.write_text('one'); fault.release_run_locks(locks)


class BrowserGroupTests(unittest.TestCase):
    def group_case(self, mode):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve(); pulse = root / 'pulse'; ready = root / 'ready'; children = []
            descendant = "import signal,time,pathlib,os;signal.signal(signal.SIGTERM,signal.SIG_IGN);p=pathlib.Path(%r);pathlib.Path(%r).write_text(str(os.getpid()))\nwhile True:\n p.write_text(str(time.monotonic_ns()));time.sleep(.02)" % (str(pulse), str(ready))
            parent = "import subprocess,sys,time,pathlib;subprocess.Popen([sys.executable,'-c',%r])\nwhile not pathlib.Path(%r).exists(): time.sleep(.01)\n" % (descendant, str(ready))
            if mode != 'normal': parent += 'while True: time.sleep(1)\n'
            real_popen = subprocess.Popen
            def launch(*args, **kwargs):
                child = real_popen(*args, **kwargs); children.append(child)
                if mode == 'interrupt':
                    real_wait = child.wait; first = True
                    def wait(*a, **kw):
                        nonlocal first
                        if first:
                            first = False; deadline = time.monotonic() + 3
                            while not ready.exists():
                                if time.monotonic() > deadline: raise RuntimeError('Child fixture did not start')
                                time.sleep(.01)
                            raise KeyboardInterrupt()
                        return real_wait(*a, **kw)
                    child.wait = wait
                return child
            try:
                with patch.object(fault.subprocess, 'Popen', side_effect=launch):
                    command = [sys.executable, '-c', parent]
                    if mode == 'normal': self.assertEqual(fault.run_browser(command, root / 'log', 'http://127.0.0.1:1', timeout=3, grace=.2), 0)
                    else:
                        error = KeyboardInterrupt if mode == 'interrupt' else RuntimeError
                        with self.assertRaises(error): fault.run_browser(command, root / 'log', 'http://127.0.0.1:1', timeout=.8, grace=.2)
                self.assertTrue(ready.exists(), 'Real TERM-ignoring descendant must have started')
                time.sleep(.1); stopped = pulse.read_text(); time.sleep(.2)
                self.assertEqual(pulse.read_text(), stopped, 'Browser descendant survived coordinator cleanup')
                self.assertIsNotNone(children[0].poll())
            finally:
                for child in children:
                    try: os.killpg(child.pid, signal.SIGKILL)
                    except ProcessLookupError: pass
                    child.wait(timeout=3)

    def test_parent_exit_does_not_leave_descendants(self): self.group_case('normal')
    def test_timeout_kills_descendants_even_when_parent_exits_on_term(self): self.group_case('timeout')
    def test_keyboard_interrupt_cleans_group_before_propagating(self): self.group_case('interrupt')


class PreflightTests(unittest.TestCase):
    def test_client_config_and_snapshot_failures_are_recorded_without_mutating_or_leaking_locks(self):
        for failure in ['client', 'config', 'plugins', 'content']:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as temp:
                root = Path(temp).resolve(); runtime = root / '.runtime/lab'; runtime.mkdir(parents=True)
                jar = runtime / 'halo/halo-test.jar'; jar.parent.mkdir(); jar.write_bytes(b'official')
                package = root / 'theme.zip'
                with zipfile.ZipFile(package, 'w') as archive: archive.writestr('theme.yaml', 'name: fixture')
                theme = runtime / 'halo/data/themes/halo-butterfly-next'; theme.mkdir(parents=True); (theme / 'theme.yaml').write_text('name: fixture')
                digest = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
                (runtime / 'lab.json').write_text(json.dumps({'schema': 1, 'owner': 'halo-butterfly-next-comparison', 'ports': {'halo': 18845, 'hexo': 14845}}))
                (runtime / 'halo-process.json').write_text(json.dumps({'identity': str(jar), 'pid': 123}))
                (runtime / 'installed-package.json').write_text(json.dumps({'sourceCommit': 'a' * 40, 'sha256': digest(package)}))
                calls = []
                class Client:
                    def __init__(self):
                        if failure == 'client': raise RuntimeError('failed client')
                    def api(self, url, method='GET', data=None):
                        calls.append((url, method)); self.auth = {'username': 'fixture'}
                        if url == fault.CONFIG:
                            if failure == 'config': raise RuntimeError('failed config')
                            return {}
                        if url.startswith(fault.PLUGINS):
                            if failure == 'plugins': raise RuntimeError('failed plugins')
                            return {'items': []}
                        raise RuntimeError('failed content')
                def write_json(path, value, private=False):
                    Path(path).write_text(json.dumps(value)); Path(path).chmod(0o600 if private else 0o644)
                fake_lab = types.SimpleNamespace(owned_process=lambda name: 123, HALO_JAR_NAME=jar.name, VERSIONS={'halo': {'sha256': digest(jar)}}, digest=digest, Client=Client, write_json=write_json, BASE={'halo': 'http://127.0.0.1:18845'})
                fake_spec = types.SimpleNamespace(loader=types.SimpleNamespace(exec_module=lambda module: None))
                args = ['fault-followup.py', '--lab-runtime', str(runtime), '--package', str(package), '--source-sha', 'a' * 40, '--allow-synthetic-writes', 'yes']
                with patch.object(fault, 'ROOT', root), patch.object(fault, 'CPU_LOCK', root / 'cpu'), patch.object(sys, 'argv', args), patch.dict(os.environ), patch.object(fault.importlib.util, 'spec_from_file_location', return_value=fake_spec), patch.object(fault.importlib.util, 'module_from_spec', return_value=fake_lab):
                    with self.assertRaises(SystemExit) as result: fault.main()
                self.assertEqual(result.exception.code, 1)
                reports = list((runtime / 'fault-followup').glob('*/report.json')); self.assertEqual(len(reports), 1)
                report = json.loads(reports[0].read_text())
                self.assertTrue(report['preflightOnly']); self.assertTrue(report['locksReleased']); self.assertFalse(report['passed'])
                self.assertIn('failed ' + failure, report['errors'])
                self.assertTrue(all(method == 'GET' for _, method in calls))
                self.assertFalse((root / 'cpu').exists()); self.assertFalse(list(runtime.glob('*.lock')))


if __name__ == '__main__': unittest.main()
