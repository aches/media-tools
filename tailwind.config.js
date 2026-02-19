/** Tailwind v4 使用 PostCSS 插件进行配置，此文件可留空以兼容工具链 */
const {heroui} = require("@heroui/theme");

module.exports = {
    content: [
    // single component styles
    "./node_modules/@heroui/theme/dist/components/button.js",
    // or you can use a glob pattern (multiple component styles)
    './node_modules/@heroui/theme/dist/components/(button|snippet|tabs|input).js'
  ],
  theme: {},
  plugins: [heroui()]
}
