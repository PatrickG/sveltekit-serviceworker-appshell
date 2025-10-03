<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	// redirect to `/` if someone tries to access `/appshell`
	// otherwise redirect to the current url so sveltekit renders the page
	onMount(() =>
		goto(
			location.pathname.startsWith(base + '/appshell') ? '/' : location.pathname + location.search,
			{ replaceState: true }
		)
	);
</script>
