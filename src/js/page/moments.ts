import App from '../core/App.ts';
import AmplifyImg from '../modules/AmplifyImg.ts';
import { initializeMoments } from '../core/moments.ts';
class Moments { constructor() { initializeMoments(); } }
App([AmplifyImg])(Moments);
