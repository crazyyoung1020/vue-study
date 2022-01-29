import Vue from "vue";
import App from "./App.vue";
import Notice from "./components/Notice.vue";
import "./plugins/element.js";

// import router from './router'
import router from "./krouter";

// import store from './store'
import store from "./kstore";
import create from "./utils/create";

// 把我们编写的svg图片加载组件引入进来，初始化全局组件，并自动import对应文件
import '@/icon'

Vue.config.productionTip = false;

Vue.prototype.$notice = function(opts) {
  const comp = create(Notice, opts);
  comp.show();
  return comp;
};

// 事件总线
Vue.prototype.$bus = new Vue();

new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount("#app");
