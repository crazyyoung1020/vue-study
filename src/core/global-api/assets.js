/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  // ASSET_TYPES = ['component', 'directive', 'filter']
  ASSET_TYPES.forEach(type => {
    // Vue.component = function(id, def)
    // Vue.component('comp', {...})
    // 这里就是在给Vue全局注册['component', 'directive', 'filter']这三个静态方法
    Vue[type] = function (
      id: string,
      definition: Function | Object // 组件配置对象
    ): Function | Object | void {
      if (!definition) {
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)
        }
        // 组件注册函数
        // 如果是对象，说明传入是组件配置，此时需要做转换：对象 =》组件构造函数
        // 这是为后续组件实例化做准备：new Ctor()
        if (type === 'component' && isPlainObject(definition)) {
          // Vue.component('comp', {render(h){}})或者Vue.component('comp', {template:''})这样
          definition.name = definition.name || id
          // 构造函数获取：Vue.extend(obj) => VueComponent，根据传入的definition配置，返回一个组件构造函数
          // 因为用户调用Vue.component()其实是在创造一个组件的构造函数类
          // 要等用户去实例化的时候才会是一个真正的组件
          // const Ctor = Vue.extend()
          // new Ctor()
          // this.options._base这个其实就是Vue构造函数
          // 此时 Vue.options = {
          //   components:{ KeepAlive },
          //   directive:{},
          //   filter:{},
          //   _base: Vue
          // }
          // 查看后面的源码Vue.extend会把传入的对象和Vue构造函数的options合并，并继承，然后返回一个新的构造函数，即组件构造函数
          definition = this.options._base.extend(definition)
        }
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
        // 2.注册到全局配置项中
        // options.components['comp'] = Ctor
        // 全局注册就是添加到系统选项中，以后所有组件初始化的时候，会有一个选项合并
        // 那时所有这些全局组件就放入了当前组件实例的components选项中，所以我们在任意组件里都能使用这些全局组件
        // 如果是component的话，这里的definition已经是处理好的组件构造函数了
        // 直接给他挂载到全局的options.components里面{'copm':definition}
        // 这里又把definition这个新的组件构造函数挂到了Vue构造函数下的options里，什么意思呢？
        // 这一步就让这个新的组件等同于keep-alive一样，去全局注册了，
        // 后面任何新的组件实例化的时候都会把这个options.component里面的所有组件合并到自己的选项里

        // 这里能够看到options.component里注册的组件，要么值为对象，也就是那些props，created，data等钩子组成的对象
        // 要么就是通过这个钩子对象处理好的构造函数，本质上最终都要处理成构造函数
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
