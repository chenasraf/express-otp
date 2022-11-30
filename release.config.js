/** @type {import('semantic-release').Options} */
module.exports = {
  branches: ['master', { name: 'develop', prerelease: true }, { name: 'alpha', prerelease: true }, 'feat/*', 'fix/*'],
  analyzeCommits: {
    path: 'semantic-release-conventional-commits',
    majorTypes: ['major', 'breaking'],
    minorTypes: ['minor', 'feat', 'feature'],
    patchTypes: ['patch', 'fix', 'bugfix', 'refactor', 'perf', 'revert'],
  },
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        parserOpts: {
          noteKeywords: ['breaking:', 'breaking-fix:', 'breaking-feat:'],
        },
        releaseRules: [
          { type: 'docs', hidden: true },
          { type: 'feat', section: 'Features' },
          { type: 'fix', section: 'Bug Fixes' },
          { type: 'chore', hidden: true },
          { type: 'style', hidden: true },
          { type: 'refactor', section: 'Misc' },
          { type: 'perf', section: 'Misc' },
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
        changelogTitle: '# Changelog',
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
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
      },
    ],
  ],
}
