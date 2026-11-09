<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import {
		HOME_KIT_OPTIONAL_GROUPS,
		type HomeKitOptionalId
	} from '$lib/domain/homeKit';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { homeKitSelection } from '$lib/stores/prefs';

	let {
		open = $bindable(false),
		onDismiss
	}: {
		open?: boolean;
		onDismiss?: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let draft = $state<HomeKitOptionalId[]>([]);
	let wasOpen = $state(false);

	$effect(() => {
		if (open && !wasOpen) draft = [...$homeKitSelection];
		wasOpen = open;
	});

	function groupLabel(id: HomeKitOptionalId): string {
		return translate(lang, `homeKit.group.${id}`);
	}

	function toggle(id: HomeKitOptionalId) {
		draft = draft.includes(id) ? draft.filter((g) => g !== id) : [...draft, id];
	}

	function save() {
		homeKitSelection.set(draft);
		open = false;
		onDismiss?.();
	}

	function dismiss() {
		open = false;
		onDismiss?.();
	}
</script>

<BottomSheet bind:open titleId="home-kit-sheet-title" onDismiss={dismiss}>
	<div class="bottom-sheet__head">
		<p id="home-kit-sheet-title" class="bottom-sheet__title">
			{translate(lang, 'homeKit.title')}
		</p>
		<p class="bottom-sheet__hint">{translate(lang, 'homeKit.hint')}</p>
	</div>
	<div class="home-kit-sheet" role="group" aria-label={translate(lang, 'homeKit.title')}>
		<div
			class="home-kit-sheet__row home-kit-sheet__row--locked"
			aria-disabled="true"
			title={translate(lang, 'homeKit.bodyweightAlways')}
		>
			<span class="home-kit-sheet__label home-kit-sheet__label--muted">
				{translate(lang, 'homeKit.group.bodyweight')}
			</span>
			<input
				type="checkbox"
				class="auth-pref-toggle__input"
				checked
				disabled
				tabindex="-1"
				aria-label={translate(lang, 'homeKit.bodyweightAlways')}
			/>
		</div>
		{#each HOME_KIT_OPTIONAL_GROUPS as id (id)}
			<label class="home-kit-sheet__row">
				<span class="home-kit-sheet__label">{groupLabel(id)}</span>
				<input
					type="checkbox"
					class="auth-pref-toggle__input"
					checked={draft.includes(id)}
					onchange={() => toggle(id)}
				/>
			</label>
		{/each}
	</div>
	{#snippet actions()}
		<AppButton type="button" block onclick={save}>{translate(lang, 'homeKit.save')}</AppButton>
	{/snippet}
</BottomSheet>

<style>
	/* Card already pads; keep CTA tight under the list. */
	:global(.bottom-sheet__card:has(.home-kit-sheet)) {
		padding-bottom: 0.75rem;
	}
	:global(.bottom-sheet__card:has(.home-kit-sheet) .bottom-sheet__actions) {
		margin-top: 0.65rem;
	}
	.home-kit-sheet {
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 0;
	}
	.home-kit-sheet__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 48px;
		min-width: 48px;
		padding: 0;
		cursor: pointer;
	}
	.home-kit-sheet__row--locked {
		cursor: default;
		opacity: 0.72;
		margin-bottom: 4px;
		padding-bottom: 4px;
		border-bottom: 1px solid var(--color-border);
	}
	.home-kit-sheet__label {
		font-size: 0.95rem;
		line-height: 1.35;
		color: var(--color-text);
	}
	.home-kit-sheet__label--muted {
		color: var(--color-muted);
	}
</style>
