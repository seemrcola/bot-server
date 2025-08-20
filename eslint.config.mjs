// eslint.config.mjs
import antfu from '@antfu/eslint-config'

export default antfu({
    stylistic: {
        indent: 4,
    },
    rules: {
        'dot-notation': 'off',
        'new-cap': 'off',
        'no-console': 'off',
    },
})
