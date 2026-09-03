<script lang="ts">
	import { onMount } from 'svelte';
	import { isTurnstileConfigured, turnstileSiteKey } from '$lib/auth/publicAuthConfig';
	import { appTheme } from '$lib/stores/theme';

	let {
		token = $bindable(''),
		resetSignal = 0
	}: {
		token?: string;
		/** Bump to force widget reset after submit. */
		resetSignal?: number;
	} = $props();

	let host = $state<HTMLDivElement | null>(null);
	let widgetId = $state<string | null>(null);
	let configured = $derived(isTurnstileConfigured());
	let theme = $derived($appTheme === 'light' ? 'light' : 'dark');

	type TurnstileApi = {
		render: (
			el: HTMLElement,
			opts: {
				sitekey: string;
				theme?: string;
				callback?: (t: string) => void;
				'expired-callback'?: () => void;
				'error-callback'?: () => void;
			}
		) => string;
		reset: (id: string) => void;
		remove: (id: string) => void;
	};

	function api(): TurnstileApi | null {
		const w = window as Window & { turnstile?: TurnstileApi };
		return w.turnstile ?? null;
	}

	function clearToken() {
		token = '';
	}

	function mountWidget() {
		const el = host;
		const sitekey = turnstileSiteKey();
		const turnstile = api();
		if (!el || !sitekey || !turnstile) return;
		if (widgetId != null) {
			try {
				turnstile.remove(widgetId);
			} catch {
				/* ignore */
			}
			widgetId = null;
		}
		el.replaceChildren();
		widgetId = turnstile.render(el, {
			sitekey,
			theme,
			callback: (t) => {
				token = t;
			},
			'expired-callback': clearToken,
			'error-callback': clearToken
		});
	}

	function loadScript(): Promise<void> {
		if (api()) return Promise.resolve();
		const existing = document.querySelector<HTMLScriptElement>('script[data-repdraft-turnstile]');
		if (existing) {
			return new Promise((resolve, reject) => {
				existing.addEventListener('load', () => resolve(), { once: true });
				existing.addEventListener('error', () => reject(new Error('turnstile load')), {
					once: true
				});
			});
		}
		return new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
			script.async = true;
			script.dataset.repdraftTurnstile = '1';
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('turnstile load'));
			document.head.appendChild(script);
		});
	}

	onMount(() => {
		if (!configured) return;
		let cancelled = false;
		void loadScript()
			.then(() => {
				if (!cancelled) mountWidget();
			})
			.catch(() => {
				clearToken();
			});
		return () => {
			cancelled = true;
			const turnstile = api();
			if (widgetId != null && turnstile) {
				try {
					turnstile.remove(widgetId);
				} catch {
					/* ignore */
				}
			}
			widgetId = null;
		};
	});

	$effect(() => {
		const signal = resetSignal;
		if (!configured || widgetId == null) return;
		if (signal === 0) return;
		const turnstile = api();
		if (!turnstile) return;
		clearToken();
		try {
			turnstile.reset(widgetId);
		} catch {
			mountWidget();
		}
	});
</script>

{#if configured}
	<div class="turnstile-widget" bind:this={host}></div>
{/if}
