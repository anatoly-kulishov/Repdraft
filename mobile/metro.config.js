const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const domainRoot = path.join(workspaceRoot, 'src/lib/domain');
const shimRoot = path.join(projectRoot, 'src/shims');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [domainRoot];
config.resolver.extraNodeModules = {
	'@repdraft/domain': domainRoot,
	$lib: shimRoot
};
config.resolver.nodeModulesPaths = [
	path.resolve(projectRoot, 'node_modules'),
	path.resolve(workspaceRoot, 'node_modules')
];

module.exports = config;
