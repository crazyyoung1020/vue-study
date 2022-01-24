/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */

// __ob__
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    // 2.此处dep目的？
    // 我们使用Vue.set去给对象新增响应式属性的时候，底层实际是调用了defineReactive方法去新增的
    // 在defineReactive内部是用defineProperty方法去处理的，那新增的同时才定义的数据拦截
    // 可以这个新增操作其实已经修改了该对象了，我们应该要去发通知让组件更新的

    // 所以这里的dep就是用来给Vue.set/delete添加或删除属性的时候，去发通知用的
    // 包括数组push或者pop操作，都是通过这里的dep来通知的
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    // 注意，这一步里在ob的value下定义了一个响应式数据__ob__
    def(value, '__ob__', this)

    // 1.分辨传入对象类型
    if (Array.isArray(value)) {
      // 现代浏览器，覆盖原型
      if (hasProto) {
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      this.observeArray(value)
    } else {
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  // 覆盖当前数组实例的原型
  // 他只会影响当前数组实例本身
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  // Observer作用？
  // 1.将传入value做响应式处理
  let ob: Observer | void
  // 如果已经做过响应式处理，则直接返回ob
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    // 初始化传入需要响应式的对象
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 创建和key一一对应的dep
  // 这个dep只有在key被访问时才会收集
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  // 递归遍历子属性，得到一个子Observer实例
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      // 如果存在，说明此次调用触发者是一个Watcher实例
      // dep n：n watcher
      if (Dep.target) {
        // 假设数据结构为obj={
        //   obj1:{
        //     a:1
        //   }
        // }
        // 那么这个dep就是在obj.obj1,或者obj.val读取操作的时候，通知对应的watcher去更新
        // 而如果Vue.set(obj,obj2,{})这种操作，这里就控制不到了，就需要下面的childOb的dep
        // 建立dep和Dep.target之间依赖关系
        // 这个dep是这个变量对应的dep，是在当前这个defineReactive方法里创建的dep实例
        dep.depend()

        if (childOb) {
          // 建立ob内部dep和Dep.target之间依赖关系
          // 由于每一个childOb都是一个Observer实例，在创建的时候都同时创建了dep实例
          // 触发Vue.set的时候也需要去通知更新，通知谁呢，就也通知这个obj对应的watcher
          // 也就是Vue.set(obj,obj1)操作会执行defineReactive里的defineProperty，新增属性
          // 其实读或者新增都是obj在变，就是要通知obj的watcher去更新，所以这里childObj的dep也把当前的obj对应的wacther给收集起来

          // 这里其实换一种说法更好理解
          // obj修改属性，可以由obj在defineReactive的时候创建的dep去收集依赖，因为修改的时候会读以下触发get
          // 而调用Vue.set新增的时候，由于触发不了get，所以没办法去直接收集依赖
          // 那就想了个办法，在每一个对象对应的Observer被创建的时候，我们都去新建一个dep收集器
          // 然后让这个收集器也去收集对象的父对象的依赖
          // 因为假设obj = {a:1},那么obj.a和obj新增一个不存的key，本质都是要obj的watcher去更新对吧
          childOb.dep.depend()
          // 如果是数组，数组内部所有项都要做相同处理
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      // 变更通知
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  // ob是traget目标的响应式属性，该响应式属性的value对应的是创建这个响应式属性时候的对象
  // 其实这里target === obj.value,这么绕是要保证Vue.set第一个参数是响应式的
  defineReactive(ob.value, key, val)
  // 这里，就是为什么要花那么多段文字描述Vue.set收集依赖和watcher读取不一样的原因
  // 因为set完之后，没办法去要取发通知，那发给谁的，我在谁下面新增属性，代表是谁改变了，我就通知谁，这里的ob是target的ob，所以我们通知的就是target的watcher
  // 我们要通知的是target，那就得知道target依赖的watcher有哪些，所以每个Observer实例创建的时候要同时创建一个dep用来保存它变更对应的watcher,存在实例的响应式属性__ob__下
  // 那么个obj的属性被访问的时候，obj变更了，我们就会收集watcher；那么obj的属性被创建的时候,obj也变了，也应该是刚才那些watcher
  // 所以当obj被get的时候，拿到的watcher要存一份到obj的子属性里的dep里才行

  // data:{
  //   obj:{
  //     a:1
  //   }
  // }

  // data.obj => 触发get依赖收集，存一份在闭包，存一份在obj.__ob__.dep里
  // data.obj的值发生变更会去通知视图更新，这个watcher对应的是读取data的obj属性
  // 那么当我们Vue.set(obj,b,1)时，就可以去obj.__ob__.dep里面取出刚才读取data.obj的watcher，去通知更新
  // 因为这个时候等于是obj发生了变化
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
