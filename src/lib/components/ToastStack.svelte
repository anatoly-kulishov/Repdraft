<script lang="ts">
	import { toasts, type Toast } from '$lib/stores/toasts';

	let { items }: { items: Toast[] } = $props();
</script>

{#if items.length}
	<div class="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+var(--sticky-actions-h)+0.5rem)] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
		{#each items as toast (toast.id)}
			<div
				class="pointer-events-auto max-w-sm rounded-[var(--radius-panel)] px-4 py-2.5 text-sm text-white shadow-lg animate-[fadeIn_200ms_ease]"
				class:bg-[var(--color-accent)]={toast.kind === 'success' || toast.kind === 'info'}
				class:bg-[var(--color-danger)]={toast.kind === 'error'}
				role="status"
			>
				{toast.message}
				<button
					type="button"
					class="ml-2 opacity-80 hover:opacity-100"
					onclick={() => toasts.dismiss(toast.id)}
				>
					×
				</button>
			</div>
		{/each}
	</div>
{/if}
