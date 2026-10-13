import App from '../core/App.ts';
import {loadPageChart} from '../core/chart-loader.ts';
class Categories {
  run_chart() { void loadPageChart('categories'); }
}
App([])(Categories);
