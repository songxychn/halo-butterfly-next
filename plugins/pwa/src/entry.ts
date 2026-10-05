import { installWorker } from './worker.ts';
installWorker(self as unknown as ServiceWorkerGlobalScope);
