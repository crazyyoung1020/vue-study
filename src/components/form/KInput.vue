<template>
  <div>
    <!-- 输入：:value
    输出：@input -->
    <input type="text" :value="value" @input="onInput" v-bind="$attrs">
  </div>
</template>

<script>
  export default {
    // 在组件上直接绑定非props属性，在子组件可以直接通过v-bind="$attrs"展开使用，
    // 但是vue有一个默认行为，会把这属性在组件根节点上也绑上一份,它的本意是当用户绑定的是class或style的时候，在子组件根节点直接绑上
    // 那如果是其他属性也会绑上，就不是很好，不需要的话可以用inheritAttrs:false,不去继承父组件的这些属性
    inheritAttrs: false,
    props: {
      value: {
        type: String,
        default: ''
      },
    },
    methods: {
      onInput(e) {
        this.$emit('input', e.target.value)

        // 通知校验
        // this.dispatch('el-form-item', 'validate')
        this.$parent.$emit('validate')
      }
    },
  }
</script>

<style lang="scss" scoped>

</style>