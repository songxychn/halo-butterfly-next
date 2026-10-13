import App from '../core/App.ts';
import Pagination from '../modules/Pagination.ts';
import {loadPageChart} from '../core/chart-loader.ts';
class Archives { run_chart() { void loadPageChart('archives'); } }
App([Pagination])(Archives);
