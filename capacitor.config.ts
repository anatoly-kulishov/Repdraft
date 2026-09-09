import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Mode A: set CAP_SERVER_URL (e.g. https://repdraft.app) so the WebView loads the live site.
 * Mode B: omit CAP_SERVER_URL; WebView serves the static `build/` SPA from the app bundle.
 */
const serverUrl = (process.env.CAP_SERVER_URL ?? '').trim();

const config: CapacitorConfig = {
	appId: 'com.repdraft.app',
	appName: 'Repdraft',
	webDir: 'build',
	plugins: {
		SplashScreen: {
			launchAutoHide: true,
			backgroundColor: '#0B0B0C',
			showSpinner: false
		},
		StatusBar: {
			style: 'DARK',
			backgroundColor: '#0B0B0C'
		}
	},
	ios: {
		contentInset: 'automatic',
		scheme: 'Repdraft',
		limitsNavigationsToAppBoundDomains: true
	},
	android: {
		allowMixedContent: false
	}
};

if (serverUrl) {
	config.server = {
		url: serverUrl,
		cleartext: serverUrl.startsWith('http://')
	};
}

export default config;
