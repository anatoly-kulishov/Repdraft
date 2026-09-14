<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY } from '$lib/components/icons/sizes';
	import type { LocalMergeChoice } from '$lib/domain/localMergeConflict';
	import { translate } from '$lib/i18n/messages';
	import { localMergeConflict } from '$lib/stores/localMergeConflict';
	import { resolvedLocale } from '$lib/stores/locale';
	import { CloudUpload, Trash2 } from '@lucide/svelte';

	let lang = $derived($resolvedLocale);
	let open = $derived($localMergeConflict.status === 'pending');

	function choose(choice: LocalMergeChoice) {
		localMergeConflict.resolve(choice);
	}
</script>

<BottomSheet {open} titleId="local-merge-conflict-title" dismissible={false}>
	<p id="local-merge-conflict-title" class="bottom-sheet__title">
		{translate(lang, 'auth.mergeConflictTitle')}
	</p>
	<p class="bottom-sheet__hint">{translate(lang, 'auth.mergeConflictLead')}</p>
	<div class="local-merge-conflict__choices" role="group" aria-labelledby="local-merge-conflict-title">
		<button
			type="button"
			class="local-merge-conflict__card local-merge-conflict__card--keep"
			onclick={() => choose('merge')}
		>
			<span class="local-merge-conflict__icon" aria-hidden="true">
				<LucideIcon icon={CloudUpload} size={ICON_PRIMARY} />
			</span>
			<span class="local-merge-conflict__card-text">
				<span class="local-merge-conflict__card-title">
					{translate(lang, 'auth.mergeConflictKeepTitle')}
				</span>
				<span class="local-merge-conflict__card-hint">
					{translate(lang, 'auth.mergeConflictKeepHint')}
				</span>
			</span>
		</button>
		<button
			type="button"
			class="local-merge-conflict__card local-merge-conflict__card--discard"
			onclick={() => choose('discard')}
		>
			<span class="local-merge-conflict__icon" aria-hidden="true">
				<LucideIcon icon={Trash2} size={ICON_PRIMARY} />
			</span>
			<span class="local-merge-conflict__card-text">
				<span class="local-merge-conflict__card-title">
					{translate(lang, 'auth.mergeConflictDiscardTitle')}
				</span>
				<span class="local-merge-conflict__card-hint">
					{translate(lang, 'auth.mergeConflictDiscardHint')}
				</span>
			</span>
		</button>
	</div>
</BottomSheet>
