<svelte:head>
	<title>Privacy Policy — Miskatonic University Registrar</title>
	<meta
		name="description"
		content="Privacy policy for the Miskatonic University Registrar, covering Google and Discord sign-in data handling, storage, and deletion."
	/>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8 space-y-8">
	<header class="space-y-2">
		<h1 class="text-3xl font-bold" data-heading>Privacy Policy</h1>
		<p class="text-xs text-[var(--color-muted-foreground)]">Last updated: 12 May 2026</p>
	</header>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold" data-heading>Summary</h2>
		<p class="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
			The Miskatonic University Registrar is a free, open-source character-creation tool for the
			Call of Cthulhu 7th Edition tabletop role-playing game. The only personal data the app
			handles is what you provide when you sign in (with Google or Discord), plus the character
			sheets you create while signed in. We don't share your data with anyone.
		</p>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold" data-heading>1. Data we access from your sign-in provider</h2>
		<p class="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
			The app offers sign-in with either Google or Discord. Whichever you choose, the same
			minimal set of fields is read so we can recognise you across sessions:
		</p>
		<ul class="list-disc space-y-1 pl-5 text-sm text-[var(--color-muted-foreground)]">
			<li>
				Your provider account identifier (Google's <code>sub</code> claim, or Discord's user
				<code>id</code>)
			</li>
			<li>Your email address and its verification status</li>
			<li>Your display name</li>
			<li>Your avatar / profile picture URL</li>
		</ul>
		<p class="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
			<strong>Google:</strong> the app requests only the standard OpenID Connect scopes
			<code>openid email profile</code>. It does not call Gmail, Drive, Calendar, Classroom,
			Sheets, Contacts, or any other Google API.
		</p>
		<p class="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
			<strong>Discord:</strong> the app requests only the default scopes
			<code>identify email</code>. It does not read your servers, friends list, direct messages,
			voice state, presence, or any other Discord data, and it does not send messages or take any
			action on your behalf.
		</p>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold" data-heading>2. How we use this data</h2>
		<ul class="list-disc space-y-1 pl-5 text-sm text-[var(--color-muted-foreground)]">
			<li>To authenticate you when you sign in.</li>
			<li>
				To link your Google identity to a local user record so the same person sees the same
				saved character sheets across sessions and devices.
			</li>
			<li>To display your name and avatar in the application's header.</li>
		</ul>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold" data-heading>3. Sharing with third parties</h2>
		<p class="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
			We do not sell, share, or transfer your account data to any third party for their own use.
			Two infrastructure sub-processors are involved in delivering the site:
		</p>
		<ul class="list-disc space-y-2 pl-5 text-sm text-[var(--color-muted-foreground)]">
			<li>
				<strong>Hosting provider.</strong> Serves the canonical instance at
				<code>mur.arrowed.games</code> and stores its database. Operates under its standard
				data-processing agreement.
			</li>
			<li>
				<strong>Google Fonts.</strong> The site's typography is loaded from
				<code>fonts.googleapis.com</code> and <code>fonts.gstatic.com</code>. As a side-effect of
				how browsers fetch external stylesheets, Google receives your IP address, User-Agent,
				and referring page each time a page on the site loads. No interactive data &mdash;
				nothing you type, no character-sheet content, no Google or Discord profile fields
				&mdash; is sent in those requests. Google's logging of font requests is described in
				their
				<a
					href="https://developers.google.com/fonts/faq/privacy"
					target="_blank"
					rel="noopener noreferrer"
					class="underline hover:text-[var(--color-foreground)]">Fonts privacy FAQ</a>.
			</li>
		</ul>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold" data-heading>4. Storage and protection</h2>
		<ul class="list-disc space-y-1 pl-5 text-sm text-[var(--color-muted-foreground)]">
			<li>Account data is stored in a managed SQL database that is encrypted at rest.</li>
			<li>All traffic between your browser and the app is served over HTTPS.</li>
			<li>
				Authentication sessions use signed tokens whose signing key is held only on the server
				and is never sent to the browser.
			</li>
			<li>
				Industry-standard response headers are set to mitigate clickjacking, MIME-sniffing, and
				referrer information leakage, and to restrict camera, microphone, and geolocation access.
			</li>
			<li>Endpoints that write data are rate-limited.</li>
		</ul>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold" data-heading>5. Retention and deletion</h2>
		<p class="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
			Your account data is retained for as long as your account remains in use. From within the
			app you can <strong>archive</strong> individual character sheets at any time, which removes
			them from your active sheet list. Archived sheets stay in the database so that
			account-level deletion (below) is the authoritative path for permanent removal.
		</p>
		<p class="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
			To <strong>permanently delete</strong> your entire account and all associated data
			&mdash; including the linked Google or Discord identity, your profile, and every character
			sheet you have saved (archived ones included) &mdash; email
			<a href="mailto:privacy@arrowed.games" class="underline hover:text-[var(--color-foreground)]"
				><strong>privacy@arrowed.games</strong></a>
			from the email address on your account. Deletion requests are honoured within 30 days.
		</p>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold" data-heading>No AI, no analytics, no ads</h2>
		<p class="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
			Nothing you enter into the app &mdash; your Google or Discord profile fields, your
			character sheets, or your backstory text &mdash; is sent to any third party. The app uses
			no analytics services, no advertising networks, and <strong>no AI, LLM, or
			machine-learning providers of any kind</strong>. None of your data is shared with, sent to,
			or used to train any AI or machine-learning system. (The font-CDN request described in
			Section 3 carries only the standard browser-issued connection metadata; nothing you input
			is sent in it.)
		</p>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold" data-heading>Self-hosted instances</h2>
		<p class="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
			The Miskatonic University Registrar is open-source (GPL-3.0) and can be self-hosted. If you
			are signed in to a self-hosted deployment rather than the canonical
			<code>mur.arrowed.games</code> instance, the operator of that deployment is the data
			controller for your data on that instance. This policy applies only to the canonical
			instance.
		</p>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold" data-heading>Changes to this policy</h2>
		<p class="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
			Material changes will be reflected by updating the &ldquo;Last updated&rdquo; date at the
			top of this page. The history of changes is publicly visible in the project's
			<a
				href="https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar"
				target="_blank"
				rel="noopener noreferrer"
				class="underline hover:text-[var(--color-foreground)]">Git repository</a>.
		</p>
	</section>

	<section class="space-y-3">
		<h2 class="text-xl font-semibold" data-heading>Contact</h2>
		<p class="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
			Questions about this policy or about your data:
			<a href="mailto:privacy@arrowed.games" class="underline hover:text-[var(--color-foreground)]"
				>privacy@arrowed.games</a>.
		</p>
		<p class="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
			See also our <a href="/licensing" class="underline hover:text-[var(--color-foreground)]">Licensing &amp; Legal</a> page.
		</p>
	</section>
</div>

<style>
	/* Slack-style inline code: tinted chip, accent color, breathing room. */
	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
			'Courier New', monospace;
		font-size: 0.875em;
		padding: 0.125rem 0.4rem;
		border-radius: 0.3rem;
		background-color: color-mix(in oklch, var(--color-muted) 80%, transparent);
		border: 1px solid var(--color-border);
		color: var(--color-gold, var(--color-foreground));
		white-space: nowrap;
	}
</style>
