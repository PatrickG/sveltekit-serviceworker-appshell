/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;

// relative to `${base}/service-worker.js`
const APP_SHELL = './appshell';

const ASSETS = [
	...build, // the app itself
	...files  // everything in `static`
];

self.addEventListener('install', (event) => {
	// Create a new cache and add all files to it
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll([...ASSETS, APP_SHELL]); // Cache the appshell
		// You could also add it to the `ASSETS` array directly (line 15)
	}

	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	// Remove previous cached data from disk
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', (event) => {
	// ignore POST requests etc
	if (event.request.method !== 'GET') return;

	async function respond() {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE);

		// `build`/`files` can always be served from the cache
		if (ASSETS.includes(url.pathname)) {
			const response = await cache.match(url.pathname);

			if (response) {
				return response;
			}
		}

		// for everything else, try the network first, but
		// fall back to the cache if we're offline
		try {
			const response = await fetch(event.request);

			// if we're offline, fetch can return a value that is not a Response
			// instead of throwing - and we can't pass this non-Response to respondWith
			if (!(response instanceof Response)) {
				throw new Error('invalid response from fetch');
			}

			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}

			return response;
		} catch (err) {
			const response = await cache.match(event.request);

			if (response) {
				return response;
			}

			// if this is a full page load, try to respond with the appshell
			if (event.request.mode === 'navigate') {
				const response = await cache.match(APP_SHELL);

				if (response) {
					/**
					 * if you can not use `kit.paths.relative: false`, uncomment this section
					 * @see https://github.com/PatrickG/sveltekit-serviceworker-appshell/issues/1
					 * @thanks https://github.com/tizu69
					 */
					// const depth = url.pathname.split('/').length - location.pathname.split('/').length;
					// if (depth > 0) {
					// 	const path_prefix = '../'.repeat(depth);

					// 	const headers = new Headers();
					// 	response.headers.forEach((value, name) => {
					// 		headers.append(
					// 			name,
					// 			name.toLocaleLowerCase() === 'link'
					// 				? value.replace(/<\.\//g, '<' + path_prefix)
					// 				: value
					// 		);
					// 	});

					// 	return new Response(
					// 		(await response.text()).replace(/(['"])\.\/?/g, '$1' + path_prefix),
					// 		{
					// 			headers,
					// 			status: response.status,
					// 			statusText: response.statusText
					// 		}
					// 	);
					// }

					return response;
				}
			}

			// if there's no cache, then just error out
			// as there is nothing we can do to respond to this request
			throw err;
		}
	}

	event.respondWith(respond());
});
