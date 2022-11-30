/** @type {import('semantic-release').Options} */
module.exports = {
  branches: ['master', { name: 'develop', prerelease: true }, { name: 'alpha', prerelease: true }, 'feat/*', 'fix/*'],
  analyzeCommits: {
    path: 'semantic-release-conventional-commits',
    majorTypes: ['major', 'breaking'],
    minorTypes: ['minor', 'feat', 'feature'],
    patchTypes: [
      'patch',
      'fix',
      'bugfix',
      'chore',
      'docs',
      'style',
      'refactor',
      'perf',
      'test',
      'build',
      'ci',
      'revert',
    ],
  },
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { type: 'docs', hidden: true },
          { type: 'feat', section: 'Features' },
          { type: 'fix', section: 'Bug Fixes' },
          { type: 'chore', hidden: true },
          { type: 'style', hidden: true },
          { type: 'refactor', hidden: true },
          { type: 'perf', hidden: true },
          { type: 'test', hidden: true },
        ],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        parserOpts: {
          noteKeywords: ['breaking'],
        },
      },
    ],
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
      },
    ],
    [
      '@semantic-release/npm',
      {
        packageRoot: 'build',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: ['package.tgz'],
      },
    ],
  ],
}
