const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const libRoot = path.join(workspaceRoot, 'src/lib');
const domainRoot = path.join(libRoot, 'domain');
const i18nRoot = path.join(libRoot, 'i18n');
const designRoot = path.join(libRoot, 'design');
/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [libRoot];
config.resolver.extraNodeModules = {
	'@repdraft/domain': domainRoot,
	'@repdraft/i18n': i18nRoot,
	'@repdraft/design': designRoot
};
config.resolver.nodeModulesPaths = [
	path.resolve(projectRoot, 'node_modules'),
	path.resolve(workspaceRoot, 'node_modules')
];

const sharedPrefixes = [
	['$lib/domain/', domainRoot],
	['$lib/i18n/', i18nRoot],
	['$lib/design/', designRoot]
];

function resolveSharedFile(absoluteDir, subPath) {
	const base = path.join(absoluteDir, subPath);
	const candidates = [
		base,
		`${base}.ts`,
		`${base}.tsx`,
		`${base}.js`,
		path.join(base, 'index.ts'),
		path.join(base, 'index.js')
	];
	for (const candidate of candidates) {
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
			return { type: 'sourceFile', filePath: candidate };
		}
	}
	return null;
}

const upstreamResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
	for (const [prefix, root] of sharedPrefixes) {
		if (moduleName.startsWith(prefix)) {
			const resolved = resolveSharedFile(root, moduleName.slice(prefix.length));
			if (resolved) return resolved;
		}
	}

	if (typeof upstreamResolveRequest === 'function') {
		return upstreamResolveRequest(context, moduleName, platform);
	}
	return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
