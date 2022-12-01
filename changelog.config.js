/* eslint-disable @typescript-eslint/no-var-requires */

const config = require('conventional-changelog-conventionalcommits')
const release = require('./release.config')

module.exports = config({
  types: [
    { type: 'feat', section: 'Features', release: 'minor' },
    { type: 'docs', section: 'Misc', release: 'patch' },
    { type: 'fix', section: 'Bug Fixes', release: 'patch' },
    { type: 'refactor', section: 'Misc', release: 'patch' },
    { type: 'docs', section: 'Misc', release: 'patch' },
    { type: 'perf', section: 'Misc', release: 'patch' },
    { type: 'build', section: 'Misc', release: 'patch' },
    { type: 'chore', section: 'Misc', release: 'patch' },
    { type: 'test', section: 'Misc', release: 'patch' },
  ],
})
