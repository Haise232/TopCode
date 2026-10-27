const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Monorepo: incluir packages/shared en el watcher
config.watchFolders = [workspaceRoot]

// Resolver @topcode/shared al source TypeScript de shared
config.resolver.extraNodeModules = {
  '@topcode/shared': path.resolve(workspaceRoot, 'packages/shared/src'),
}

module.exports = config
