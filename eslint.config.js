import { globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
//import pluginOxlint from 'eslint-plugin-oxlint'
import globals from 'globals'

export default [
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,js,mjs,cjs}'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'no-alert': 'off',
    },
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],

  {
    name: 'app/schedule-main-view',
    files: ['src/views/Schedule.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },

  //...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),
]