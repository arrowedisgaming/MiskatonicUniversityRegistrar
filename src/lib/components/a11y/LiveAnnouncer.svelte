<script lang="ts">
	import { announcerState } from '$lib/stores/announcer';
</script>

<div class="sr-only" aria-live="polite" aria-atomic="true">{$announcerState.polite}</div>
<div class="sr-only" role="alert" aria-live="assertive" aria-atomic="true">{$announcerState.assertive}</div>
