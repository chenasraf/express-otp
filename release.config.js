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
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        parserOpts: {
          noteKeywords: ['breaking'],
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
        },
      },
    ],
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
        changelogTitle: '# Change Log',
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
