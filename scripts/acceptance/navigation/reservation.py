"""Share existing performance/combination reservations through plugin restoration."""
import json

COORDINATOR = 'navigation-coordinator.lock'
SHARED = ('acceptance-combinations.lock', 'perf03-followup.lock')
KIND = 'navigation-coordination'


def acquire(runtime, run, guard, cpu_lock=None):
    guard.require(not list(runtime.glob('*.lock')), 'Another acceptance writer or restoration is active')
    cpu_lock = cpu_lock or guard.CPU_LOCK
    locks = guard.acquire_run_locks(runtime, run, cpu_lock, kind=KIND)
    try:
        coordinator = runtime / COORDINATOR
        with coordinator.open('x') as stream:
            stream.write(run)
        coordinator.chmod(0o600)
        locks.append((coordinator, run))
        return locks
    except BaseException:
        guard.release_run_locks(locks)
        raise


def validate_delegation(runtime, run, guard, cpu_lock=None):
    expected = {runtime / name for name in (*SHARED, COORDINATOR)}
    guard.require(set(runtime.glob('*.lock')) == expected and all(p.read_text() == run for p in expected), 'Coordinator reservation differs')
    owner = json.loads(((cpu_lock or guard.CPU_LOCK) / 'owner.json').read_text())
    guard.require(owner.get('runId') == run and owner.get('runtime') == str(runtime) and owner.get('kind') == KIND, 'Coordinator CPU reservation differs')
