const path = require('path')


// 用于通过相对地址返回一个绝对地址
// 用当前文件的绝对地址__dirname和想要生成的地址的相对地址dir，生成一个目标地址的绝对地址
const resolve = (dir) => path.join(__dirname, dir)

console.log(process.env.foo);

module.exports = {
  publicPath: '/best-practice',
  devServer: {
    port: 7070
  },
  // configureWebpack如果是对象，那么会和默认的webpack的配置合并，如果冲突，以用户传入的为主
  // configureWebpack: {
  //   resolve: {
  //     alias: {
  //       comps: path.join(__dirname, 'src/components')
  //     }
  //   }
  // }
  // 如果configureWebpack是函数，则可以在函数中去取出webpack的配置做修改
  configureWebpack(config) {
    config.resolve.alias.comps = path.join(__dirname, 'src/components')
    
    if (process.env.NODE_ENV === 'development') {
      // 这里在config下设置的变量，可以在打包过程中，通过<%= webpackConfig.name %>去被动态的替换掉
      // 这个可能是使用了webpack的defineplugin，不太确定
      config.name = 'vue best practice'
    } else {
      config.name = 'vue项目最佳实践'
    }
  },
  // 那configureWebpack是函数，对于我们要处理rules里面的某一项就很不方便，我们还需要去遍历去判断

  chainWebpack(config) {
    // 1.添加一个loader，负责去icon目录中加载图标，方便直接使用
    config.module.rule('icon')
      // 这里由于include是个set，那么调用完add方法后，当前上下文就是一个set对象了，
      // 我们需要执行end()让上下文回归到之前的上下文，否则后面就会报错
      .include.add(resolve('src/icon')).end()
      .test(/\.svg$/)
      .use('svg-sprite-loader')
      .loader('svg-sprite-loader')
      .options({symbolId: 'icon-[name]'})
    
    // 2.当前项目下有一个加载svg的loader，svg规则排除icon目录
    config.module.rule('svg').exclude.add(resolve('src/icon'))
  }
}