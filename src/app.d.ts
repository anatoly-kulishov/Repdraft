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
		readonly PUBLIC_WEB_ORIGIN?: string;
		readonly PUBLIC_APP_NATIVE?: string;
		readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
		readonly PUBLIC_PRIVACY_CONTACT_EMAIL?: string;
		readonly PUBLIC_PRIVACY_OPERATOR_NAME?: string;
		readonly PUBLIC_PRIVACY_OPERATOR_INN?: string;
		readonly PUBLIC_PRIVACY_OPERATOR_ADDRESS?: string;
	}
}

export {};
