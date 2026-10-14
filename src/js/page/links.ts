import App from '../core/App.ts';
import { initializeLinks } from '../core/site-content.ts';
class Links { constructor() { initializeLinks(); } }
App([])(Links);
