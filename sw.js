// sw.js - 象棋專案離線快取版本
const CACHE_NAME = 'xiangqi-cache-v1';
const RUNTIME_CACHE = 'xiangqi-runtime-v1';

// 預先快取的核心資源（按類別組織）
const PRECACHE_URLS = [
    // 主要文件
    '/',
    '/index.html',
    '/main.js',
    '/manifest.json',

    // Pikafish 引擎文件
    '/pikafish.js',
    '/pikafish.wasm',
    '/pikafish.data',
    // 注意：pikafish.nnue 太大，不預快取，改用按需快取

    // ONNX 模型文件
    '/Entity_chess_recognition_model.onnx',
    '/online_xiangqi_classifier.onnx',
    '/online_xiangqi_piece_detector.onnx',

    // JSON 資料文件
    '/advanced-checkmates.json',
    '/basic-checkmates.json',
    '/endgames_all.json',
    '/extremely-challenging-endgames.json',
    '/jianghu-endgames.json',
    '/meng-ru-shen-ji.json',
    '/opening-repertoire.json',
    '/shi-qing-ya-qu.json',
    '/patterns_index.json',

    // 資源資料夾（使用萬用字元概念，但需要具體列出）
    // 注意：Service Worker 不支援萬用字元，需要在安裝時動態添加
];

// 需要運行時快取的資源模式
const CACHE_PATTERNS = {
    chessPieces: /\/chess-pieces\//,
    chessboard: /\/chessboard\//,
    icons: /\/icons\//,
    signature: /\/signature\//,
    voice: /\/voice\//,
    patterns: /\/Chess-Patterns\//,
};

// 安裝階段：預快取核心資源
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching core files');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => self.skipWaiting())
            .catch((err) => console.error('[SW] Cache failed:', err))
    );
});

// 啟動階段：清理舊快取
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch 階段：快取策略
self.addEventListener('fetch', (event) => {
    // 跳過特殊請求
    if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
        return;
    }

    const url = new URL(event.request.url);

    // 🔥 CDN 資源：網路優先，快取備用
    if (url.hostname.includes('cdn.jsdelivr.net') ||
        url.hostname.includes('unpkg.com') ||
        url.hostname.includes('cdnjs.cloudflare.com')) {
        event.respondWith(networkFirstStrategy(event.request));
        return;
    }

    // 🎯 核心資源（ONNX、WASM、JSON、NNUE）：快取優先
    if (url.pathname.endsWith('.onnx') ||
        url.pathname.endsWith('.wasm') ||
        url.pathname.endsWith('.data') ||
        url.pathname.endsWith('.nnue') ||  // NNUE 也快取
        url.pathname.endsWith('.json')) {
        event.respondWith(cacheFirstStrategy(event.request));
        return;
    }

    // 🖼️ 圖片/音訊資源：快取優先
    if (Object.values(CACHE_PATTERNS).some(pattern => pattern.test(url.pathname))) {
        event.respondWith(cacheFirstStrategy(event.request));
        return;
    }

    // 📄 HTML 文件：網路優先
    if (event.request.mode === 'navigate') {
        event.respondWith(networkFirstStrategy(event.request));
        return;
    }

    // 🌐 其他同源資源：網路優先
    if (url.origin === self.location.origin) {
        event.respondWith(networkFirstStrategy(event.request));
        return;
    }

    // 預設：直接 fetch
    event.respondWith(fetch(event.request));
});

// 快取優先策略（適合不常變動的資源）
async function cacheFirstStrategy(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);

    if (cached) {
        console.log('[SW] Cache hit:', request.url);
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response && response.status === 200) {
            cache.put(request, response.clone());
            console.log('[SW] Cached new resource:', request.url);
        }
        return response;
    } catch (error) {
        console.error('[SW] Fetch failed:', request.url, error);
        throw error;
    }
}

// 網路優先策略（適合需要最新版本的資源）
async function networkFirstStrategy(request) {
    const cache = await caches.open(RUNTIME_CACHE);

    try {
        const response = await fetch(request);
        if (response && response.status === 200) {
            cache.put(request, response.clone());
            console.log('[SW] Updated cache:', request.url);
        }
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) {
            console.log('[SW] Using cached version:', request.url);
            return cached;
        }
        console.error('[SW] Network and cache failed:', request.url, error);
        throw error;
    }
}