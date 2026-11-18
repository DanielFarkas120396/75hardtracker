const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// The challenge rules are shared with the web app and live outside this folder (../src/logic,
// and the data types in ../src/db/types.ts). Metro has to watch them, and their npm imports
// (date-fns) must resolve from this folder's node_modules: on EAS only mobile/ is installed.
config.watchFolders = [path.resolve(__dirname, '../src')]
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')]

module.exports = config
