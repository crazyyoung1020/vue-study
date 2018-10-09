import { VNodeFlags } from './flags'
import { EMPTY_OBJ } from './utils'
import { h } from './h'
import { VNode, MountedVNode, createFragment } from './vdom'
import { Component, ComponentInstance, ComponentClass } from './component'
import { createTextVNode, cloneVNode } from './vdom'
import { initializeState } from './componentState'
import { initializeProps } from './componentProps'
import {
  initializeComputed,
  getComputedOptions,
  teardownComputed
} from './componentComputed'
import { initializeWatch, teardownWatch } from './componentWatch'
import { ComponentOptions } from './componentOptions'
import { createRenderProxy } from './componentProxy'
import { handleError, ErrorTypes } from './errorHandling'

export function createComponentInstance(
  vnode: VNode,
  Component: ComponentClass,
  parentComponent: ComponentInstance | null
): ComponentInstance {
  const instance = (vnode.children = new Component()) as ComponentInstance
  instance.$parentVNode = vnode as MountedVNode

  // renderProxy
  const proxy = (instance.$proxy = createRenderProxy(instance))

  // pointer management
  if (parentComponent) {
    instance.$parent = parentComponent.$proxy
    instance.$root = parentComponent.$root
    parentComponent.$children.push(proxy)
  } else {
    instance.$root = proxy
  }

  // lifecycle
  if (instance.beforeCreate) {
    instance.beforeCreate.call(proxy)
  }
  // TODO provide/inject
  initializeProps(instance, vnode.data)
  initializeState(instance)
  initializeComputed(instance, getComputedOptions(Component))
  initializeWatch(instance, instance.$options.watch)
  instance.$slots = vnode.slots || EMPTY_OBJ
  if (instance.created) {
    instance.created.call(proxy)
  }

  return instance as ComponentInstance
}

export function renderInstanceRoot(instance: ComponentInstance): VNode {
  let vnode
  try {
    vnode = instance.render.call(instance.$proxy, h, {
      props: instance.$props,
      slots: instance.$slots,
      attrs: instance.$attrs
    })
  } catch (e1) {
    handleError(e1, instance, ErrorTypes.RENDER)
    if (__DEV__ && instance.renderError) {
      try {
        vnode = instance.renderError.call(instance.$proxy, e1)
      } catch (e2) {
        handleError(e2, instance, ErrorTypes.RENDER_ERROR)
      }
    }
  }
  return normalizeComponentRoot(
    vnode,
    instance.$parentVNode,
    instance.$attrs,
    instance.$options.inheritAttrs
  )
}

export function teardownComponentInstance(instance: ComponentInstance) {
  if (instance._unmounted) {
    return
  }
  const parentComponent = instance.$parent && instance.$parent._self
  if (parentComponent && !parentComponent._unmounted) {
    parentComponent.$children.splice(
      parentComponent.$children.indexOf(instance.$proxy),
      1
    )
  }
  teardownComputed(instance)
  teardownWatch(instance)
}

export function normalizeComponentRoot(
  vnode: any,
  componentVNode: VNode | null,
  attrs: Record<string, any> | void,
  inheritAttrs: boolean | void
): VNode {
  if (vnode == null) {
    vnode = createTextVNode('')
  } else if (typeof vnode !== 'object') {
    vnode = createTextVNode(vnode + '')
  } else if (Array.isArray(vnode)) {
    if (vnode.length === 1) {
      vnode = normalizeComponentRoot(
        vnode[0],
        componentVNode,
        attrs,
        inheritAttrs
      )
    } else {
      vnode = createFragment(vnode)
    }
  } else {
    const { el, flags } = vnode
    if (
      componentVNode &&
      (flags & VNodeFlags.COMPONENT || flags & VNodeFlags.ELEMENT)
    ) {
      if (
        inheritAttrs !== false &&
        attrs !== void 0 &&
        Object.keys(attrs).length > 0
      ) {
        vnode = cloneVNode(vnode, attrs)
      } else if (el) {
        vnode = cloneVNode(vnode)
      }
      if (flags & VNodeFlags.COMPONENT) {
        vnode.parentVNode = componentVNode
      }
    } else if (el) {
      vnode = cloneVNode(vnode)
    }
  }
  return vnode
}

export function shouldUpdateFunctionalComponent(
  prevProps: Record<string, any> | null,
  nextProps: Record<string, any> | null
): boolean {
  if (prevProps === nextProps) {
    return false
  }
  if (prevProps === null) {
    return nextProps !== null
  }
  if (nextProps === null) {
    return prevProps !== null
  }
  let shouldUpdate = true
  const nextKeys = Object.keys(nextProps)
  if (nextKeys.length === Object.keys(prevProps).length) {
    shouldUpdate = false
    for (let i = 0; i < nextKeys.length; i++) {
      const key = nextKeys[i]
      if (nextProps[key] !== prevProps[key]) {
        shouldUpdate = true
      }
    }
  }
  return shouldUpdate
}

export function createComponentClassFromOptions(
  options: ComponentOptions
): ComponentClass {
  class AnonymousComponent extends Component {
    constructor() {
      super()
      this.$options = options
    }
  }
  const proto = AnonymousComponent.prototype as any
  for (const key in options) {
    const value = options[key]
    // name -> displayName
    if (__COMPAT__ && key === 'name') {
      options.displayName = options.name
    }
    if (typeof value === 'function') {
      if (__COMPAT__ && key === 'render') {
        proto[key] = function() {
          return value.call(this, h)
        }
      } else {
        proto[key] = value
      }
    }
    if (key === 'computed') {
      const isGet = typeof value === 'function'
      Object.defineProperty(proto, key, {
        configurable: true,
        get: isGet ? value : value.get,
        set: isGet ? undefined : value.set
      })
    }
    if (key === 'methods') {
      for (const method in value) {
        if (__DEV__ && proto.hasOwnProperty(method)) {
          console.warn(
            `Object syntax contains method name that conflicts with ` +
              `lifecycle hook: "${method}"`
          )
        }
        proto[method] = value[method]
      }
    }
  }
  return AnonymousComponent as ComponentClass
}