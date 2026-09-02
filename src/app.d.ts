// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		interface PageData {
			seoLocale?: import('$lib/i18n/locale').AppLocale;
		}
		// interface PageState {}
		// interface Platform {}
	}

	interface ImportMetaEnv {
		readonly PUBLIC_APP_VERSION: string;
		readonly PUBLIC_SITE_URL: string;
	}
}

export {};
