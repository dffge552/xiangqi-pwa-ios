// sw.js - 修正版
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
        return;
    }

    const url = new URL(event.request.url);

    // 🔥 放行所有 CDN 資源，不要攔截
    if (url.hostname.includes('cdn.jsdelivr.net') ||
        url.hostname.includes('unpkg.com') ||
        url.hostname.includes('cdnjs.cloudflare.com')) {
        return; // 讓瀏覽器直接處理
    }

    // 只處理同源資源
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (!response || response.status !== 200) {
                    return response;
                }

                const newHeaders = new Headers(response.headers);
                newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
                newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders
                });
            })
            .catch((error) => {
                console.error('Fetch error:', error);
                return fetch(event.request); // 失敗時直接用原始請求
            })
    );
});