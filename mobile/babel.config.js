module.exports = function (api) {
	api.cache(true);
	return {
		presets: ['babel-preset-expo'],
		// Reanimated 4 worklets: must stay the last Babel plugin.
		plugins: ['react-native-worklets/plugin']
	};
};
