(function initBetterNamesChatRewrite() {
    'use strict';

    if (window.__BN_CHAT_REWRITE_INSTALLED__) return;
    window.__BN_CHAT_REWRITE_INSTALLED__ = true;

    const CHAT_CACHE_KEY_PREFIX = 'bn.chat.rewrite.cache.v2';
    const CHAT_DRAFT_KEY_PREFIX = 'bn.chat.rewrite.drafts.v2';
    const CHAT_LEGACY_CACHE_KEY = 'bn.chat.rewrite.cache.v1';
    const CHAT_LEGACY_DRAFT_KEY = 'bn.chat.rewrite.drafts.v1';
    const CHAT_OLD_PANEL_CACHE_KEY = 'bn.chat.messageCache.v1';
    const CHAT_CACHE_VERSION = 1;
    const CHAT_MAX_CACHE_MESSAGES = 500;
    const CHAT_DEFAULT_INTERVAL_MS = 5000;
    const CHAT_MONITOR_INTERVAL_MS = 9000;
    const CHAT_LOAD_OLDER_EDGE_PX = 80;
    const CHAT_FILE_INSERT_LIMIT_BYTES = 8 * 1024 * 1024;
    const CHAT_LONG_TEXT_LIMIT = 1200;
    const CHAT_LONG_HEIGHT_LIMIT = 220;
    const CHAT_RENDER_MAX_CHARS = 200000;
    const CHAT_RENDER_DATA_URL_MAX_CHARS = 240000;
    const CHAT_MESSAGE_STORE_MAX_CHARS = 120000;
    const CHAT_CLIPBOARD_BLOB_MAX_BYTES = 12 * 1024 * 1024;
    const CHAT_IMAGE_TARGET_MAX_SIDE = 1280;
    const CHAT_IMAGE_MIN_SIDE = 72;
    const CHAT_IMAGE_QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.42, 0.34, 0.28];
    const CHAT_WINDOW_EDGE_MARGIN = 8;
    const CHAT_WINDOW_MIN_WIDTH = 720;
    const CHAT_WINDOW_MIN_HEIGHT = 500;

    const state = {
        groupRefreshTimer: null,
        initialized: false,
        visible: false,
        loadingInfo: false,
        loadingMessages: false,
        loadingOlder: false,
        runningGroupOp: false,
        activeKey: '',
        scope: 'all',
        query: '',
        info: {},
        selfId: NaN,
        selfName: '我',
        countLimit: 20,
        messageLengthLimit: Infinity,
        maxTokenCount: null,
        tokenUsed: null,
        tokenRemain: null,
        recoverTime: null,
        conversations: [],
        conversationByKey: new Map(),
        userNameById: new Map(),
        betterNameById: new Map(),
        groupById: new Map(),
        messagesByKey: new Map(),
        pendingByKey: new Map(),
        unreadByKey: new Map(),
        oldestSecByKey: new Map(),
        noOlderKeys: new Set(),
        lastActivitySecByKey: new Map(),
        trackedKeys: new Set(),
        drafts: {},
        storageAccountKey: '',
        quotedMessage: null,
        autoRefreshTimer: null,
        monitorTimer: null,
        monitorCursor: 0,
        requestSeq: 0,
        windowInteraction: null,
        windowRestoreRect: null,
        notificationAtByKey: new Map(),
        mention: {
            active: false,
            start: 0,
            end: 0,
            index: 0,
            candidates: [],
        },
    };

    const els = {};

    function $(id) {
        return document.getElementById(id);
    }

    function createElement(tagName, attrs = {}, children = []) {
        const node = document.createElement(tagName);
        Object.entries(attrs || {}).forEach(([key, value]) => {
            if (value == null || value === false) return;
            if (key === 'className') {
                node.className = String(value);
                return;
            }
            if (key === 'text') {
                node.textContent = String(value);
                return;
            }
            if (key === 'dataset' && value && typeof value === 'object') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    if (dataValue != null) node.dataset[dataKey] = String(dataValue);
                });
                return;
            }
            if (key === 'disabled' || key === 'hidden' || key === 'checked') {
                node[key] = !!value;
                return;
            }
            node.setAttribute(key, String(value));
        });
        const list = Array.isArray(children) ? children : [children];
        list.forEach((child) => {
            if (child == null) return;
            node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
        });
        return node;
    }

    function button(className, text, title) {
        const btn = createElement('button', {type: 'button', className, text});
        if (title) btn.title = title;
        return btn;
    }

    function clearNode(node) {
        if (!node) return;
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function setText(node, text) {
        if (node) node.textContent = String(text || '');
    }

    function toInteger(value) {
        if (value == null || value === '') return NaN;
        const parsed = Number.parseInt(String(value), 10);
        return Number.isFinite(parsed) ? parsed : NaN;
    }

    function normalizeTimestampToSec(value) {
        if (value == null || value === '') return NaN;
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) return NaN;
            return Math.floor(value > 1e12 ? value / 1000 : value);
        }
        const raw = String(value).trim();
        if (!raw) return NaN;
        if (/^-?\d+(\.\d+)?$/.test(raw)) return normalizeTimestampToSec(Number(raw));
        const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
        const parsed = Date.parse(normalized);
        return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : NaN;
    }

    function formatTime(sec) {
        const normalized = normalizeTimestampToSec(sec);
        if (!Number.isFinite(normalized) || normalized <= 0) return '--:--';
        const date = new Date(normalized * 1000);
        const now = new Date();
        const sameDay = date.getFullYear() === now.getFullYear()
            && date.getMonth() === now.getMonth()
            && date.getDate() === now.getDate();
        const pad = (value) => String(value).padStart(2, '0');
        const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
        if (sameDay) return time;
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}`;
    }

    function formatUnread(value) {
        const count = toInteger(value);
        if (!Number.isFinite(count) || count <= 0) return '';
        return count > 99 ? '99+' : String(count);
    }

    function storageGetJson(key, fallback) {
        try {
            const raw = typeof GM_getValue === 'function' ? GM_getValue(key, '') : localStorage.getItem(key);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (_) {
            return fallback;
        }
    }

    function storageSetJson(key, value) {
        try {
            const raw = JSON.stringify(value);
            if (typeof GM_setValue === 'function') {
                GM_setValue(key, raw);
            } else {
                localStorage.setItem(key, raw);
            }
        } catch (_) {
            // Local cache is best-effort.
        }
    }

    function storageRemoveJson(key) {
        try {
            if (typeof GM_deleteValue === 'function') {
                GM_deleteValue(key);
            } else {
                localStorage.removeItem(key);
            }
        } catch (_) {
            // Local cache is best-effort.
        }
    }

    function accountKeyForSelf() {
        return Number.isFinite(state.selfId) && state.selfId > 0 ? `u${state.selfId}` : 'anonymous';
    }

    function accountStorageKey(prefix) {
        const accountKey = state.storageAccountKey || accountKeyForSelf();
        return `${prefix}.${accountKey}`;
    }

    function cacheStorageKey() {
        return accountStorageKey(CHAT_CACHE_KEY_PREFIX);
    }

    function draftStorageKey() {
        return accountStorageKey(CHAT_DRAFT_KEY_PREFIX);
    }

    function loadDrafts() {
        const drafts = storageGetJson(draftStorageKey(), {});
        state.drafts = drafts && typeof drafts === 'object' && !Array.isArray(drafts) ? drafts : {};
    }

    function saveDraft(key, value) {
        if (!key) return;
        const text = String(value || '');
        if (text) state.drafts[key] = text; else delete state.drafts[key];
        storageSetJson(draftStorageKey(), state.drafts);
    }

    function persistCache() {
        const messages = {};
        Array.from(state.messagesByKey.entries()).forEach(([key, items]) => {
            if (state.conversationByKey.size && !state.conversationByKey.has(key)) return;
            messages[key] = (Array.isArray(items) ? items : []).slice(-CHAT_MAX_CACHE_MESSAGES);
        });
        storageSetJson(cacheStorageKey(), {
            version: CHAT_CACHE_VERSION,
            selfId: Number.isFinite(state.selfId) ? state.selfId : null,
            savedAt: Date.now(),
            activeKey: state.activeKey,
            messages,
            unread: Object.fromEntries(state.unreadByKey.entries()),
            oldest: Object.fromEntries(state.oldestSecByKey.entries()),
            activity: Object.fromEntries(state.lastActivitySecByKey.entries()),
        });
    }

    function restoreCache() {
        const cache = storageGetJson(cacheStorageKey(), null);
        if (!cache || cache.version !== CHAT_CACHE_VERSION) return;
        const cachedSelfId = toInteger(cache.selfId);
        if (Number.isFinite(cachedSelfId) && Number.isFinite(state.selfId) && cachedSelfId !== state.selfId) return;
        if (cache.messages && typeof cache.messages === 'object') {
            Object.entries(cache.messages).forEach(([key, items]) => {
                if (state.conversationByKey.size && !state.conversationByKey.has(key)) return;
                if (Array.isArray(items)) state.messagesByKey.set(key, sortMessages(items));
            });
        }
        if (cache.unread && typeof cache.unread === 'object') {
            Object.entries(cache.unread).forEach(([key, value]) => {
                if (state.conversationByKey.size && !state.conversationByKey.has(key)) return;
                const parsed = toInteger(value);
                if (Number.isFinite(parsed) && parsed > 0) state.unreadByKey.set(key, parsed);
            });
        }
        if (cache.oldest && typeof cache.oldest === 'object') {
            Object.entries(cache.oldest).forEach(([key, value]) => {
                if (state.conversationByKey.size && !state.conversationByKey.has(key)) return;
                const parsed = normalizeTimestampToSec(value);
                if (Number.isFinite(parsed)) state.oldestSecByKey.set(key, parsed);
            });
        }
        if (cache.activity && typeof cache.activity === 'object') {
            Object.entries(cache.activity).forEach(([key, value]) => {
                if (state.conversationByKey.size && !state.conversationByKey.has(key)) return;
                const parsed = normalizeTimestampToSec(value);
                if (Number.isFinite(parsed)) state.lastActivitySecByKey.set(key, parsed);
            });
        }
        if (typeof cache.activeKey === 'string' && state.conversationByKey.has(cache.activeKey)) state.activeKey = cache.activeKey;
    }

    function clearRuntimeMessageCache({keepActivity = true} = {}) {
        state.messagesByKey.clear();
        state.pendingByKey.clear();
        state.unreadByKey.clear();
        state.oldestSecByKey.clear();
        state.noOlderKeys.clear();
        state.trackedKeys.clear();
        state.drafts = {};
        state.quotedMessage = null;
        if (!keepActivity) state.lastActivitySecByKey.clear();
    }

    function loadAccountStorage() {
        const accountKey = accountKeyForSelf();
        if (state.storageAccountKey === accountKey) return;
        clearRuntimeMessageCache({keepActivity: true});
        state.storageAccountKey = accountKey;
        loadDrafts();
        restoreCache();
    }

    function clearLocalCache() {
        if (els.input && state.activeKey) saveDraft(state.activeKey, els.input.value);
        storageRemoveJson(cacheStorageKey());
        storageRemoveJson(draftStorageKey());
        storageRemoveJson(CHAT_LEGACY_CACHE_KEY);
        storageRemoveJson(CHAT_LEGACY_DRAFT_KEY);
        storageRemoveJson(CHAT_OLD_PANEL_CACHE_KEY);
        clearRuntimeMessageCache({keepActivity: true});
        if (state.activeKey && !state.conversationByKey.has(state.activeKey)) {
            state.activeKey = state.conversations[0] ? state.conversations[0].key : '';
        }
        renderAll();
        setStatus('当前账号本地缓存已清除', 'success');
        if (state.activeKey) refreshActive({silent: true, scrollToBottom: true});
    }

    function buildUrl(path, params = null) {
        const url = new URL(path, location.origin);
        if (params && typeof params === 'object') {
            Object.entries(params).forEach(([key, value]) => {
                if (value == null || value === '') return;
                url.searchParams.set(key, String(value));
            });
        }
        return url.toString();
    }

    function formBody(data) {
        const body = new URLSearchParams();
        Object.entries(data || {}).forEach(([key, value]) => {
            if (value != null) body.append(key, String(value));
        });
        return body.toString();
    }

    function payloadRoot(payload) {
        if (!payload || typeof payload !== 'object') return {};
        const data = payload.data ?? payload.result;
        return data && typeof data === 'object' && !Array.isArray(data) ? data : payload;
    }

    async function apiRequest(method, path, options = {}) {
        const upperMethod = String(method || 'GET').toUpperCase();
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timeoutMs = Math.max(1000, Number(options.timeoutMs || 12000));
        const timer = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
        try {
            const response = await fetch(buildUrl(path, options.params), {
                method: upperMethod,
                cache: 'no-store',
                credentials: 'include',
                signal: controller ? controller.signal : undefined,
                headers: upperMethod === 'POST'
                    ? {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}
                    : undefined,
                body: upperMethod === 'POST' ? formBody(options.data) : undefined,
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            let payload;
            try {
                payload = JSON.parse(text || '{}');
            } catch (_) {
                throw new Error('接口返回不是合法 JSON');
            }
            if (!payload || typeof payload !== 'object') throw new Error('接口返回格式错误');
            if (payload.success === false) {
                const message = payload.err && payload.err.message ? payload.err.message : '未知错误';
                throw new Error(message);
            }
            return payload;
        } catch (error) {
            if (error && error.name === 'AbortError') throw new Error('请求超时');
            throw error;
        } finally {
            if (timer) window.clearTimeout(timer);
        }
    }

    function pickArray(source, keys) {
        if (Array.isArray(source)) return source;
        if (!source || typeof source !== 'object') return [];
        for (const key of keys) {
            if (Array.isArray(source[key])) return source[key];
        }
        return [];
    }

    function pickChatItems(source, keys) {
        if (Array.isArray(source)) return source;
        if (!source || typeof source !== 'object') return [];
        for (const key of keys) {
            const value = source[key];
            if (Array.isArray(value)) return value;
            if (value && typeof value === 'object') return [value];
        }
        return [];
    }

    function pickText(source, keys, fallback = '') {
        if (!source || typeof source !== 'object') return fallback;
        for (const key of keys) {
            const value = source[key];
            if (typeof value === 'string' && value.trim()) return value.trim();
            if (typeof value === 'number' && Number.isFinite(value)) return String(value);
        }
        return fallback;
    }

    function pickInteger(source, keys) {
        if (!source || typeof source !== 'object') return NaN;
        for (const key of keys) {
            const parsed = toInteger(source[key]);
            if (Number.isFinite(parsed)) return parsed;
        }
        return NaN;
    }

    async function loadBetterNameUsers() {
        try {
            if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') return;
            const response = await fetch(chrome.runtime.getURL('data/users.json'), {cache: 'no-store'});
            if (!response.ok) return;
            const data = await response.json();
            const users = data && typeof data === 'object' && data.users && typeof data.users === 'object'
                ? data.users
                : data;
            if (!users || typeof users !== 'object' || Array.isArray(users)) return;
            state.betterNameById.clear();
            Object.entries(users).forEach(([id, info]) => {
                if (!info || typeof info !== 'object') return;
                const name = typeof info.name === 'string' ? info.name.trim() : '';
                if (name) state.betterNameById.set(Number(id), name);
            });
        } catch (_) {
            // Nickname data is a bonus; the official API remains authoritative.
        }
    }

    function displayNameForUser(userId, source = null) {
        const id = toInteger(userId);
        if (Number.isFinite(id) && state.betterNameById.has(id)) return state.betterNameById.get(id);
        if (source && typeof source === 'object') {
            const nested = source.user && typeof source.user === 'object' ? source.user : null;
            const fromSource = pickText(source, ['real_name', 'realName', 'nickname', 'name', 'username', 'title']);
            if (fromSource) return fromSource;
            if (nested) {
                const fromNested = pickText(nested, ['real_name', 'realName', 'nickname', 'name', 'username', 'title']);
                if (fromNested) return fromNested;
            }
        }
        if (Number.isFinite(id) && state.userNameById.has(id)) return state.userNameById.get(id);
        return Number.isFinite(id) ? `用户 ${id}` : '未知用户';
    }

    function extractSelfId(userInfo) {
        return pickInteger(userInfo || {}, ['id', 'user_id', 'uid']);
    }

    function extractFriendId(friend) {
        if (!friend || typeof friend !== 'object') return NaN;
        const selfId = Number.isFinite(state.selfId) ? state.selfId : NaN;
        const nested = friend.user && typeof friend.user === 'object' ? friend.user : {};
        const source = pickInteger(friend, ['source_id', 'sourceId', 'from_id', 'fromId', 'sender_id', 'senderId']);
        const target = pickInteger(friend, ['target_id', 'targetId', 'to_id', 'toId', 'receiver_id', 'receiverId']);
        if (Number.isFinite(selfId)) {
            if (source === selfId && Number.isFinite(target)) return target;
            if (target === selfId && Number.isFinite(source)) return source;
        }
        const candidates = [
            target,
            source,
            friend.friend_id,
            friend.friendId,
            friend.other_id,
            friend.otherId,
            friend.user_id,
            friend.userId,
            friend.uid,
            nested.id,
            nested.user_id,
            nested.uid,
            friend.id,
        ];
        for (const value of candidates) {
            const id = toInteger(value);
            if (Number.isFinite(id) && id > 0) return id;
        }
        return NaN;
    }

    function conversationKey(type, id) {
        const normalized = type === 'group' ? 'group' : 'user';
        const parsed = toInteger(id);
        return Number.isFinite(parsed) && parsed > 0 ? `${normalized}:${parsed}` : '';
    }

    function conversationActivitySec(source) {
        if (!source || typeof source !== 'object') return NaN;
        const candidates = [
            source.last_message_time,
            source.lastMessageTime,
            source.last_message_at,
            source.lastMessageAt,
            source.last_chat_time,
            source.lastChatTime,
            source.latest_message_time,
            source.latestMessageTime,
            source.updated_at,
            source.updatedAt,
            source.timestamp,
            source.send_time,
            source.time,
            source.created_at,
            source.createdAt,
        ];
        for (const value of candidates) {
            const sec = normalizeTimestampToSec(value);
            if (Number.isFinite(sec) && sec > 0) return sec;
        }
        return NaN;
    }

    function rebuildConversations(payload) {
        const root = payloadRoot(payload);
        const info = root && typeof root === 'object' ? root : {};
        const limit = info.limit && typeof info.limit === 'object' ? info.limit : {};
        const userInfo = [info.user, info.self, info.me, info.profile]
            .find((item) => item && typeof item === 'object' && !Array.isArray(item)) || {};

        state.info = info;
        const nextSelfId = extractSelfId(userInfo);
        if (state.storageAccountKey && state.storageAccountKey !== (Number.isFinite(nextSelfId) && nextSelfId > 0 ? `u${nextSelfId}` : 'anonymous')) {
            clearRuntimeMessageCache({keepActivity: false});
        }
        state.selfId = nextSelfId;
        state.selfName = displayNameForUser(state.selfId, userInfo);
        state.userNameById.clear();
        if (Number.isFinite(state.selfId)) state.userNameById.set(state.selfId, state.selfName);

        const countLimit = toInteger(limit.count_limit ?? limit.countLimit ?? limit.message_count_limit);
        const lengthLimit = toInteger(limit.message_length_limit ?? limit.length_limit ?? limit.lengthLimit);
        const maxToken = toInteger(limit.max_token_count ?? limit.maxTokenCount ?? limit.token_count);
        const recoverTime = toInteger(limit.recover_time ?? limit.recoverTime);
        state.countLimit = Number.isFinite(countLimit) && countLimit > 0 ? countLimit : 20;
        state.messageLengthLimit = Number.isFinite(lengthLimit) && lengthLimit > 0 ? lengthLimit : Infinity;
        state.maxTokenCount = Number.isFinite(maxToken) && maxToken >= 0 ? maxToken : state.maxTokenCount;
        state.recoverTime = Number.isFinite(recoverTime) && recoverTime >= 0 ? recoverTime : null;

        const conversations = [];
        pickArray(info, ['friends', 'friend', 'users', 'contacts']).forEach((friend) => {
            const id = extractFriendId(friend);
            if (!Number.isFinite(id) || id <= 0) return;
            if (Number.isFinite(state.selfId) && id === state.selfId) return;
            const realName = friend.real_name || (friend.user && friend.user.real_name);
            if (!realName) return; // 没有 real_name 视为单项好友，跳过
            const key = conversationKey('user', id);
            const name = displayNameForUser(id, friend);
            const activitySec = conversationActivitySec(friend);
            state.userNameById.set(id, name);
            if (Number.isFinite(activitySec)) state.lastActivitySecByKey.set(key, activitySec);
            conversations.push({
                key,
                type: 'user',
                id,
                name,
                subtitle: `私聊 · ID ${id}`,
                raw: friend,
            });
        });

        state.groupById.clear();
        pickArray(info, ['groups', 'group']).forEach((group) => {
            if (!group || typeof group !== 'object') return;
            const id = pickInteger(group, ['id', 'group_id', 'groupId']);
            if (!Number.isFinite(id) || id <= 0) return;
            const key = conversationKey('group', id);
            const name = pickText(group, ['title', 'name', 'group_name', 'groupName'], `群组 ${id}`);
            const members = pickArray(group, ['users', 'members', 'member']);
            members.forEach((member) => {
                const uid = pickInteger(member || {}, ['id', 'user_id', 'uid']);
                if (!Number.isFinite(uid) || uid <= 0) return;
                state.userNameById.set(uid, displayNameForUser(uid, member));
            });
            const activitySec = conversationActivitySec(group);
            if (Number.isFinite(activitySec)) state.lastActivitySecByKey.set(key, activitySec);
            state.groupById.set(id, group);
            conversations.push({
                key,
                type: 'group',
                id,
                name,
                subtitle: `群聊 · ${members.length || 0} 人 · ID ${id}`,
                raw: group,
                members,
            });
        });

        const validKeys = new Set(conversations.map((item) => item.key));
        [state.messagesByKey, state.pendingByKey, state.unreadByKey, state.oldestSecByKey, state.lastActivitySecByKey]
            .forEach((map) => {
                Array.from(map.keys()).forEach((key) => {
                    if (!validKeys.has(key)) map.delete(key);
                });
            });
        Array.from(state.noOlderKeys).forEach((key) => {
            if (!validKeys.has(key)) state.noOlderKeys.delete(key);
        });

        state.conversations = sortConversations(conversations);
        state.conversationByKey = new Map(state.conversations.map((item) => [item.key, item]));
        loadAccountStorage();
        if (!state.activeKey || !state.conversationByKey.has(state.activeKey)) {
            state.activeKey = state.conversations[0] ? state.conversations[0].key : '';
        }
    }

    function sortConversations(conversations) {
        return [...conversations].sort((a, b) => {
            const timeA = state.lastActivitySecByKey.get(a.key) || 0;
            const timeB = state.lastActivitySecByKey.get(b.key) || 0;
            if (timeA !== timeB) return timeB - timeA;
            if (a.type !== b.type) return a.type === 'group' ? -1 : 1;
            return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN');
        });
    }

    function getConversation(key = state.activeKey) {
        return key && state.conversationByKey.has(key) ? state.conversationByKey.get(key) : null;
    }

    function isSelfUserConversation(conversation) {
        return !!conversation
            && conversation.type === 'user'
            && Number.isFinite(state.selfId)
            && toInteger(conversation.id) === state.selfId;
    }

    function getChats(payload) {
        const roots = [payload, payloadRoot(payload)];
        for (const root of roots) {
            const chats = pickChatItems(root, ['chat', 'chats', 'messages', 'message', 'records', 'list', 'items']);
            if (chats.length) return chats;
        }
        return [];
    }

    function sanitizeStoredMessageContent(value) {
        let content = String(value == null ? '' : value);
        let blockedData = 0;
        content = content.replace(/data:([a-z0-9.+/-]+);base64,[a-z0-9+/=]+/gi, (match, mime) => {
            if (match.length <= CHAT_RENDER_DATA_URL_MAX_CHARS) return match;
            blockedData += 1;
            return `#bn-blocked-large-${String(mime || 'data').replace(/[^a-z0-9-]+/gi, '-')}`;
        });
        if (content.length > CHAT_MESSAGE_STORE_MAX_CHARS) {
            content = `${content.slice(0, CHAT_MESSAGE_STORE_MAX_CHARS)}\n\n> Better Names: 内容过大，已截断以保护页面性能。`;
        }
        if (blockedData > 0) {
            content += `\n\n> Better Names: 已阻止 ${blockedData} 个过大的内联数据。`;
        }
        return content;
    }

    function normalizeMessage(rawMessage, directionHint = '') {
        const raw = rawMessage && typeof rawMessage === 'object' ? rawMessage : {};
        const explicitSenderId = pickInteger(raw, ['sender_id', 'senderId', 'from_id', 'fromId', 'source_id', 'sourceId']);
        const explicitTargetId = pickInteger(raw, ['target_id', 'targetId', 'group_id', 'groupId', 'to_id', 'toId', 'receiver_id', 'receiverId', 'dest_id', 'destId']);
        const peerId = pickInteger(raw, ['user_id', 'userId', 'uid', 'friend_id', 'friendId', 'other_id', 'otherId']);
        let senderId = explicitSenderId;
        let targetId = explicitTargetId;
        if (directionHint === 'out') {
            if (!Number.isFinite(senderId) && Number.isFinite(state.selfId)) senderId = state.selfId;
            if (!Number.isFinite(targetId) && Number.isFinite(peerId)) targetId = peerId;
        } else if (directionHint === 'in') {
            if (!Number.isFinite(senderId) && Number.isFinite(peerId)) senderId = peerId;
            if (!Number.isFinite(targetId) && Number.isFinite(state.selfId)) targetId = state.selfId;
        } else if (!Number.isFinite(senderId) && Number.isFinite(peerId)) {
            senderId = peerId;
        }
        const contentValue = raw.content ?? raw.message ?? raw.text ?? raw.body_md ?? raw.body ?? '';
        const content = sanitizeStoredMessageContent(contentValue);
        const sec = normalizeTimestampToSec(raw.timestamp ?? raw.send_time ?? raw.sendTime ?? raw.time ?? raw.created_at ?? raw.createdAt);
        const rawSelf = Number.isFinite(state.selfId) && Number.isFinite(senderId) && senderId === state.selfId;
        const direction = directionHint || (rawSelf ? 'out' : 'in');
        const isSelf = direction === 'out' || rawSelf;
        const idValue = raw.id ?? raw.chat_id ?? raw.chatId ?? raw.message_id ?? raw.messageId ?? raw.mid ?? '';
        const synthetic = `${direction}|${idValue || ''}|${senderId || ''}|${targetId || ''}|${Number.isFinite(sec) ? sec : ''}|${content}`;
        return {
            id: idValue ? `${direction}:${idValue}` : synthetic,
            senderId,
            targetId,
            content,
            sec,
            direction,
            isSelf,
            raw,
        };
    }

    function messageBelongsToConversation(message, conversation, directionHint = '') {
        if (!message || !conversation) return false;
        const convId = toInteger(conversation.id);
        const sender = toInteger(message.senderId);
        const target = toInteger(message.targetId);
        const raw = message.raw && typeof message.raw === 'object' ? message.raw : {};
        const selfId = Number.isFinite(state.selfId) ? state.selfId : NaN;
        if (conversation.type === 'group') {
            const rawGroup = pickInteger(raw, ['group_id', 'groupId', 'target_id', 'targetId']);
            return rawGroup === convId || target === convId;
        }
        const selfKnown = Number.isFinite(selfId);
        if (directionHint === 'out' || message.direction === 'out') {
            const rawTarget = pickInteger(raw, ['target_id', 'targetId', 'to_id', 'toId', 'receiver_id', 'receiverId']);
            const actualTarget = Number.isFinite(rawTarget) ? rawTarget : target;
            if (actualTarget !== convId) return false;
            return !selfKnown || !Number.isFinite(sender) || sender === selfId;
        }
        if (directionHint === 'in' || message.direction === 'in') {
            const rawSender = pickInteger(raw, ['sender_id', 'senderId', 'from_id', 'fromId', 'source_id', 'sourceId', 'user_id', 'userId', 'uid']);
            const actualSender = Number.isFinite(rawSender) ? rawSender : sender;
            if (actualSender !== convId) return false;
            return !selfKnown || !Number.isFinite(target) || target === selfId;
        }
        if (Number.isFinite(selfId) && sender === selfId && target === convId) return true;
        if (Number.isFinite(selfId) && target === selfId && sender === convId) return true;
        return false;
    }

    function sortMessages(messages) {
        return [...(Array.isArray(messages) ? messages : [])].sort((a, b) => {
            const secA = normalizeTimestampToSec(a && a.sec);
            const secB = normalizeTimestampToSec(b && b.sec);
            if (Number.isFinite(secA) && Number.isFinite(secB) && secA !== secB) return secA - secB;
            if (Number.isFinite(secA) !== Number.isFinite(secB)) return Number.isFinite(secA) ? -1 : 1;
            return String(a && a.id || '').localeCompare(String(b && b.id || ''));
        });
    }

    function mergeMessages(existing, incoming) {
        const messages = [...(existing || [])];
        (incoming || []).forEach((message) => {
            if (!message || !message.id) return;
            const matchedIndex = messages.findIndex((item) => shouldReplaceLocalEcho(item, message));
            if (matchedIndex >= 0) {
                messages[matchedIndex] = Object.assign({}, messages[matchedIndex], message, {localOnly: false});
                return;
            }
            messages.push(message);
        });
        const byId = new Map();
        messages.forEach((message) => {
            if (!message || !message.id) return;
            byId.set(message.id, Object.assign({}, byId.get(message.id) || {}, message));
        });
        return sortMessages(Array.from(byId.values())).slice(-CHAT_MAX_CACHE_MESSAGES);
    }

    function shouldReplaceLocalEcho(existing, incoming) {
        if (!existing || !incoming) return false;
        if (!existing.localOnly) return false;
        if (String(existing.content || '') !== String(incoming.content || '')) return false;
        if (!!existing.isSelf !== !!incoming.isSelf) return false;
        if (toInteger(existing.senderId) !== toInteger(incoming.senderId)) return false;
        if (toInteger(existing.targetId) !== toInteger(incoming.targetId)) return false;
        const secA = normalizeTimestampToSec(existing.sec);
        const secB = normalizeTimestampToSec(incoming.sec);
        if (!Number.isFinite(secA) || !Number.isFinite(secB)) return true;
        return Math.abs(secA - secB) <= 15;
    }

    function rememberMessages(conversation, incoming, options = {}) {
        if (!conversation) return {changed: false, newIncoming: []};
        const key = conversation.key;
        const existing = state.messagesByKey.get(key) || [];
        const existingIds = new Set(existing.map((item) => item && item.id));
        const existingTimes = existing.map((item) => normalizeTimestampToSec(item && item.sec)).filter(Number.isFinite);
        const fallbackActivity = state.lastActivitySecByKey.get(key) || 0;
        const hadBaseline = state.trackedKeys.has(key) || existing.length > 0 || fallbackActivity > 0;
        const previousLatest = existingTimes.length ? Math.max(...existingTimes) : fallbackActivity;
        const beforeSignature = messageSignature(existing);
        const beforeDisplaySignature = messageDisplaySignature(existing);
        const merged = mergeMessages(existing, incoming);
        state.messagesByKey.set(key, merged);
        state.trackedKeys.add(key);

        const times = merged.map((item) => normalizeTimestampToSec(item && item.sec)).filter(Number.isFinite);
        if (times.length) {
            state.lastActivitySecByKey.set(key, Math.max(...times));
            state.oldestSecByKey.set(key, Math.min(...times));
        }

        let newIncoming = [];
        if (options.trackUnread && hadBaseline) {
            newIncoming = incoming.filter((message) => {
                if (!message || message.isSelf) return false;
                if (existingIds.has(message.id)) return false;
                const sec = normalizeTimestampToSec(message.sec);
                return !Number.isFinite(previousLatest) || !Number.isFinite(sec) || sec >= previousLatest;
            });
            if (newIncoming.length && !(state.visible && state.activeKey === key)) {
                state.unreadByKey.set(key, (state.unreadByKey.get(key) || 0) + newIncoming.length);
                notifyIncomingMessages(conversation, newIncoming);
            }
        }
        if (state.visible && state.activeKey === key) state.unreadByKey.delete(key);
        const changed = beforeSignature !== messageSignature(merged);
        const displayChanged = beforeDisplaySignature !== messageDisplaySignature(merged);
        if (changed || newIncoming.length) persistCache();
        return {changed, displayChanged, newIncoming};
    }

    function messageSignature(messages) {
        return (messages || []).map((item) => [
            item && item.id || '',
            item && item.sec || '',
            item && item.content || '',
            item && item.direction || '',
        ].join('\x1f')).join('\x1e');
    }

    function messageDisplaySignature(messages) {
        return (messages || []).map((item) => [
            item && item.senderId || '',
            item && item.targetId || '',
            normalizeTimestampToSec(item && item.sec) || '',
            item && item.content || '',
            item && item.direction || '',
            item && item.isSelf ? 'self' : 'other',
            item && item.sendState || '',
        ].join('\x1f')).join('\x1e');
    }

    async function fetchConversationMessages(conversation, endTimeSec = null, takeOverride = null) {
        if (!conversation) return [];
        const take = Math.max(1, Math.min(Number(takeOverride || state.countLimit || 20), 100));
        const common = {target_id: conversation.id, take};
        if (endTimeSec != null) common.end_time = endTimeSec;
        if (conversation.type === 'group') {
            const payload = await apiRequest('GET', '/chat/chat', {
                params: Object.assign({}, common, {type: 'group'}),
            });
            return sortMessages(getChats(payload)
                .map((raw) => normalizeMessage(raw, ''))
                .filter((message) => messageBelongsToConversation(message, conversation, 'group')));
        }
        const [received, sent] = await Promise.all([
            apiRequest('GET', '/chat/chat', {params: Object.assign({}, common, {type: 'user'})}),
            apiRequest('GET', '/chat/chat', {params: Object.assign({}, common, {type: 'send'})}),
        ]);
        return sortMessages([
            ...getChats(received)
                .map((raw) => normalizeMessage(raw, 'in'))
                .filter((message) => messageBelongsToConversation(message, conversation, 'in')),
            ...getChats(sent)
                .map((raw) => normalizeMessage(raw, 'out'))
                .filter((message) => messageBelongsToConversation(message, conversation, 'out')),
        ]);
    }

    function updateTokenCounts(payload) {
        const root = payloadRoot(payload);
        const used = pickInteger(root, ['used_token_count', 'usedTokenCount', 'used_token', 'usedToken', 'used']);
        const remain = pickInteger(root, ['remain_token_count', 'remainTokenCount', 'remaining_token_count', 'remainingTokenCount', 'remain_token', 'remainToken', 'remaining']);
        if (Number.isFinite(used)) state.tokenUsed = used;
        if (Number.isFinite(remain)) state.tokenRemain = remain;
        if (Number.isFinite(used) && Number.isFinite(remain)) state.maxTokenCount = used + remain;
        renderToken();
    }

    function renderToken() {
        const remain = Number.isFinite(state.tokenRemain) ? state.tokenRemain : '--';
        const max = Number.isFinite(state.maxTokenCount) ? state.maxTokenCount : '--';
        setText(els.token, `Token: ${remain} / ${max}`);
    }

    function setStatus(text, level = 'info') {
        if (!els.status) return;
        els.status.classList.remove('is-error', 'is-success');
        if (level === 'error') els.status.classList.add('is-error');
        if (level === 'success') els.status.classList.add('is-success');
        els.status.textContent = String(text || '');
    }

    async function loadInfo(options = {}) {
        if (state.loadingInfo) return;
        state.loadingInfo = true;
        if (!options.silent) setStatus('正在同步会话...');
        try {
            const payload = await apiRequest('GET', '/chat/info');
            rebuildConversations(payload);
            renderAll();
            if (!options.silent) setStatus(`已同步 ${state.conversations.length} 个会话`, 'success');
            if (options.refreshActive !== false && state.activeKey) {
                await refreshActive({silent: true, scrollToBottom: false});
            }
        } catch (error) {
            setStatus(`同步失败: ${error.message || error}`, 'error');
        } finally {
            state.loadingInfo = false;
        }
    }

    async function refreshActive(options = {}) {
        const conversation = getConversation();
        if (!conversation) {
            renderMessages();
            return;
        }
        if (state.loadingMessages) return;
        state.loadingMessages = true;
        const seq = ++state.requestSeq;
        if (!options.silent) setStatus('正在刷新消息...');
        try {
            const unreadBefore = state.unreadByKey.get(conversation.key) || 0;
            const messages = await fetchConversationMessages(conversation);
            if (seq !== state.requestSeq) return;
            const result = rememberMessages(conversation, messages, {trackUnread: true});
            const unreadChanged = unreadBefore !== (state.unreadByKey.get(conversation.key) || 0);
            const messageChanged = result.displayChanged || result.newIncoming.length || options.forceRender;
            if (messageChanged || unreadChanged) {
                state.conversations = sortConversations(state.conversations);
                renderConversationList();
                updateBadge();
            }
            if (messageChanged) {
                renderHeader();
                renderMessages({preserveScroll: !!options.preserveScroll, forceScrollBottom: options.scrollToBottom !== false});
            }
            if (!options.silent) {
                setStatus(result.changed ? `消息已更新: ${messages.length} 条` : `消息无变化: ${messages.length} 条`, 'success');
            }
        } catch (error) {
            if (seq === state.requestSeq) setStatus(`刷新失败: ${error.message || error}`, 'error');
        } finally {
            state.loadingMessages = false;
        }
    }

    async function loadOlderMessages() {
        const conversation = getConversation();
        if (!conversation || state.loadingOlder || state.loadingMessages) return;
        if (state.noOlderKeys.has(conversation.key)) return;
        const oldest = state.oldestSecByKey.get(conversation.key);
        if (!Number.isFinite(oldest)) return;
        const before = Math.max(0, Math.floor(oldest) - 1);
        state.loadingOlder = true;
        setStatus('正在加载更早消息...');
        const oldBottom = els.messages ? (els.messages.scrollHeight - els.messages.scrollTop) : 0;
        try {
            const messages = await fetchConversationMessages(conversation, before);
            if (!messages.length) {
                state.noOlderKeys.add(conversation.key);
                setStatus('没有更早消息了');
                return;
            }
            const previousOldest = state.oldestSecByKey.get(conversation.key);
            rememberMessages(conversation, messages, {trackUnread: false});
            const nextOldest = state.oldestSecByKey.get(conversation.key);
            if (!Number.isFinite(nextOldest) || nextOldest >= previousOldest) {
                state.noOlderKeys.add(conversation.key);
            }
            renderMessages({preserveScroll: true});
            if (els.messages) els.messages.scrollTop = Math.max(0, els.messages.scrollHeight - oldBottom);
            setStatus(`已加载更早消息 ${messages.length} 条`, 'success');
        } catch (error) {
            setStatus(`加载失败: ${error.message || error}`, 'error');
        } finally {
            state.loadingOlder = false;
        }
    }

    function filteredConversations() {
        const query = String(state.query || '').trim().toLowerCase();
        return state.conversations.filter((item) => {
            if (state.scope !== 'all' && item.type !== state.scope) return false;
            if (!query) return true;
            return [item.name, item.subtitle, item.id, item.key]
                .some((value) => String(value || '').toLowerCase().includes(query));
        });
    }

    function renderAll() {
        renderToken();
        renderConversationList();
        renderHeader();
        renderMessages();
        renderComposerState();
        updateBadge();
    }

    function renderConversationList() {
        if (!els.conversations) return;
        clearNode(els.conversations);
        const list = filteredConversations();
        list.forEach((item) => {
            const row = createElement('button', {
                type: 'button',
                className: 'bn-chat2-conversation',
                dataset: {key: item.key},
            });
            if (item.key === state.activeKey) row.classList.add('is-active');
            const unread = state.unreadByKey.get(item.key) || 0;
            if (unread > 0) row.classList.add('has-unread');

            const avatar = createElement('span', {
                className: `bn-chat2-avatar ${item.type === 'group' ? 'is-group' : 'is-user'}`,
                text: item.type === 'group' ? '群' : (String(item.name || '?').trim().charAt(0) || '?'),
            });
            const body = createElement('span', {className: 'bn-chat2-conversation-body'});
            const top = createElement('span', {className: 'bn-chat2-conversation-top'});
            top.appendChild(createElement('strong', {text: item.name || `会话 ${item.id}`}));
            top.appendChild(createElement('span', {text: item.type === 'group' ? '群聊' : '私聊'}));
            const preview = createElement('span', {
                className: 'bn-chat2-conversation-preview',
                text: conversationPreview(item),
            });
            body.appendChild(top);
            body.appendChild(preview);
            row.appendChild(avatar);
            row.appendChild(body);
            if (unread > 0) row.appendChild(createElement('span', {className: 'bn-chat2-unread', text: formatUnread(unread)}));
            row.addEventListener('click', () => selectConversation(item.key, {refresh: true}));
            els.conversations.appendChild(row);
        });
        if (els.conversationEmpty) els.conversationEmpty.hidden = list.length > 0;
        if (state.activeKey && els.conversations) {
            const activeItem = els.conversations.querySelector(`.bn-chat2-conversation[data-key="${state.activeKey}"]`);
            if (activeItem) {
                // 使用 scrollIntoView 在容器内滚动到该元素，不影响页面滚动
                activeItem.scrollIntoView({behavior: 'instant' });
                // 或者使用更精确的 scrollTop 计算：
                // const container = els.conversations;
                // const itemRect = activeItem.getBoundingClientRect();
                // const containerRect = container.getBoundingClientRect();
                // container.scrollTop += itemRect.top - containerRect.top;
            }
        }
    }

    function conversationPreview(conversation) {
        const messages = state.messagesByKey.get(conversation.key) || [];
        const last = messages[messages.length - 1];
        if (last && last.content) {
            const prefix = last.isSelf ? '我: ' : '';
            return `${prefix}${String(last.content).replace(/\s+/g, ' ').slice(0, 80)}`;
        }
        return conversation.subtitle || (conversation.type === 'group' ? '群聊' : '私聊');
    }

    function renderHeader() {
        const conversation = getConversation();
        if (!conversation) {
            setText(els.currentTitle, '请选择会话');
            setText(els.currentMeta, '同步列表后可开始聊天');
            return;
        }
        setText(els.currentTitle, conversation.name || `会话 ${conversation.id}`);
        const recover = Number.isFinite(state.recoverTime) ? ` · Token ${state.recoverTime}s 恢复` : '';
        const type = conversation.type === 'group' ? '群聊' : '私聊';
        setText(els.currentMeta, `${type} · ID ${conversation.id}${recover}`);
        if (els.groupIdInput && conversation.type === 'group') els.groupIdInput.value = String(conversation.id);
        if (els.groupTargetInput && conversation.type === 'user') els.groupTargetInput.value = String(conversation.id);
    }

    function renderMessages(options = {}) {
        if (!els.messages) return;
        const oldHeight = els.messages.scrollHeight;
        const oldTop = els.messages.scrollTop;
        const oldBottom = oldHeight - oldTop - els.messages.clientHeight;
        const nearBottom = oldBottom < 64;
        clearNode(els.messages);
        const conversation = getConversation();
        if (!conversation) {
            els.messages.appendChild(createElement('div', {className: 'bn-chat2-empty-thread', text: '选择一个会话，或者刷新列表。'}));
            return;
        }
        const serverMessages = state.messagesByKey.get(conversation.key) || [];
        const pendingMessages = state.pendingByKey.get(conversation.key) || [];
        const messages = sortMessages([...serverMessages, ...pendingMessages]);
        if (!messages.length) {
            els.messages.appendChild(createElement('div', {className: 'bn-chat2-empty-thread', text: '还没有消息，发送第一条试试。'}));
        } else {
            renderLoadMoreButton(conversation);
            messages.forEach((message) => renderMessageRow(message, conversation));
        }
        if (typeof window.__BN_highlightCodeTheme === 'function') window.__BN_highlightCodeTheme(els.messages);
        window.requestAnimationFrame(() => applyMessageCollapse());
        if (options.forceScrollBottom || (!options.preserveScroll && (nearBottom || options.forceScrollBottom !== false))) {
            scrollMessagesToBottom();
            return;
        }
        if (options.preserveScroll) {
            const delta = els.messages.scrollHeight - oldHeight;
            els.messages.scrollTop = Math.max(0, oldTop + delta);
        }
    }

    function renderLoadMoreButton(conversation) {
        const wrap = createElement('div', {className: 'bn-chat2-load-more-wrap'});
        const noOlder = state.noOlderKeys.has(conversation.key);
        const btn = button('bn-chat2-load-more', noOlder ? '没有更早消息' : '加载更早消息');
        btn.disabled = noOlder || state.loadingOlder;
        btn.addEventListener('click', () => loadOlderMessages());
        wrap.appendChild(btn);
        els.messages.appendChild(wrap);
    }

    function limitMarkdownForRender(content) {
        let text = String(content == null ? '' : content);
        const notices = [];
        if (text.length > CHAT_RENDER_MAX_CHARS) {
            text = text.slice(0, CHAT_RENDER_MAX_CHARS);
            notices.push(`内容超过 ${CHAT_RENDER_MAX_CHARS} 字符，已截断以保护页面性能。`);
        }
        text = text.replace(/data:([a-z0-9.+/-]+);base64,[a-z0-9+/=]+/gi, (match, mime) => {
            if (match.length <= CHAT_RENDER_DATA_URL_MAX_CHARS) return match;
            notices.push(`已阻止渲染过大的 ${mime || 'data'} 数据。`);
            return '#bn-blocked-large-data-url';
        });
        return {text, notices};
    }

    function renderMarkdownInto(node, content) {
        if (!node) return;
        clearNode(node);
        const limited = limitMarkdownForRender(content || '[空消息]');
        if (typeof WriteCleanHTML === 'function') {
            WriteCleanHTML(node, limited.text || '[空消息]');
        } else {
            node.textContent = limited.text || '[空消息]';
        }
        limited.notices.forEach((notice) => {
            node.appendChild(createElement('div', {className: 'bn-chat2-render-notice', text: notice}));
        });
        enhanceRenderedMarkdown(node);
    }

    function isSafeMediaUrl(url) {
        const raw = String(url || '').trim();
        if (!raw) return false;
        if (/^data:image\/(?:png|gif|jpe?g|webp|bmp);/i.test(raw)) return  raw.length <= CHAT_RENDER_DATA_URL_MAX_CHARS;
        if (/^blob:/i.test(raw)) return true;
        try {
            const parsed = new URL(raw, location.href);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    function isSafeDownloadUrl(url) {
        const raw = String(url || '').trim();
        if (!raw) return false;
        if (/^data:(?:image\/(?:png|gif|jpe?g|webp|bmp)|text\/plain|application\/json|application\/octet-stream);/i.test(raw)) {
            return raw.length <= CHAT_RENDER_DATA_URL_MAX_CHARS;
        }
        if (/^blob:/i.test(raw)) return true;
        try {
            const parsed = new URL(raw, location.href);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    function enhanceRenderedMarkdown(root) {
        root.querySelectorAll('img').forEach((img) => {
            const src = img.getAttribute('src') || img.dataset.src || '';
            if (!isSafeMediaUrl(src)) {
                const replacement = createElement('span', {className: 'bn-chat2-render-notice', text: '图片过大或地址不安全，已阻止渲染。'});
                img.replaceWith(replacement);
                return;
            }
            img.loading = 'lazy';
            img.decoding = 'async';
            img.draggable = false;
            img.classList.add('bn-chat2-clickable-image');
            img.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                showImagePreview(src, img.alt || '图片');
            });
        });
    }

    function messageSenderName(message, conversation) {
        if (!message || message.isSelf) return '我';
        if (conversation && conversation.type === 'group') return displayNameForUser(message.senderId, message.raw);
        return conversation && conversation.name ? conversation.name : displayNameForUser(message.senderId, message.raw);
    }

    function messageExcerpt(content, maxLength = 120) {
        const text = String(content || '').replace(/\s+/g, ' ').trim();
        if (text.length <= maxLength) return text;
        return `${text.slice(0, maxLength)}...`;
    }

    function quoteMessage(message, conversation) {
        const sender = messageSenderName(message, conversation);
        const lines = String(message.content || '').split(/\r?\n/).slice(0, 8);
        const quote = lines.map((line) => `> ${line || ' '}`).join('\n');
        insertTextAtCursor(`> ${sender} · ${formatTime(message.sec)}\n${quote}\n\n`);
        state.quotedMessage = {
            sender,
            content: messageExcerpt(message.content, 180),
            sec: message.sec,
        };
        setStatus('已插入引用');
    }

    function mentionDisplayName(id, raw) {
        const name = displayNameForUser(id, raw).replace(/\s+/g, '');
        return name || `用户${id}`;
    }

    function activeMentionCandidates(query = '') {
        const conversation = getConversation();
        if (!conversation || conversation.type !== 'group') return [];
        const rawGroup = state.groupById.get(conversation.id) || conversation.raw || {};
        const members = Array.isArray(conversation.members) && conversation.members.length
            ? conversation.members
            : pickArray(rawGroup, ['users', 'members', 'member']);
        const normalizedQuery = String(query || '').trim().toLowerCase();
        const byId = new Map();
        members.forEach((member) => {
            const id = typeof member === 'number'
                ? member
                : pickInteger(member || {}, ['id', 'user_id', 'uid']);
            if (!Number.isFinite(id) || id <= 0) return;
            if (Number.isFinite(state.selfId) && id === state.selfId) return;
            const name = mentionDisplayName(id, member);
            const haystack = `${name} ${id}`.toLowerCase();
            if (normalizedQuery && !haystack.includes(normalizedQuery)) return;
            if (!byId.has(id)) byId.set(id, {id, name, raw: member});
        });
        return Array.from(byId.values()).slice(0, 8);
    }

    function findMentionTrigger() {
        if (!els.input) return null;
        const start = els.input.selectionStart ?? 0;
        const end = els.input.selectionEnd ?? start;
        if (start !== end) return null;
        const before = els.input.value.slice(0, start);
        const match = before.match(/(^|[\s([{，。！？、；;：:])@([^\s@]*)$/u);
        if (!match) return null;
        const query = match[2] || '';
        if (query.length > 32) return null;
        return {
            start: before.length - query.length - 1,
            end: start,
            query,
        };
    }

    function hideMentionList() {
        state.mention.active = false;
        state.mention.candidates = [];
        state.mention.index = 0;
        if (els.mentionPanel) {
            els.mentionPanel.hidden = true;
            clearNode(els.mentionPanel);
        }
    }

    function textareaCaretCoordinates(textarea, index) {
        const style = window.getComputedStyle(textarea);
        const mirror = document.createElement('div');
        const props = [
            'box-sizing', 'width', 'font-family', 'font-size', 'font-weight', 'font-style',
            'letter-spacing', 'text-transform', 'word-spacing', 'text-indent', 'line-height',
            'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
            'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
            'white-space', 'word-break', 'overflow-wrap', 'tab-size',
        ];
        props.forEach((prop) => mirror.style.setProperty(prop, style.getPropertyValue(prop)));
        mirror.style.position = 'fixed';
        mirror.style.left = '-9999px';
        mirror.style.top = '-9999px';
        mirror.style.height = 'auto';
        mirror.style.minHeight = '0';
        mirror.style.maxHeight = 'none';
        mirror.style.overflow = 'hidden';
        mirror.style.visibility = 'hidden';
        mirror.style.whiteSpace = 'pre-wrap';
        mirror.style.wordWrap = 'break-word';
        mirror.textContent = textarea.value.slice(0, index);
        const marker = document.createElement('span');
        marker.textContent = '\u200b';
        mirror.appendChild(marker);
        document.body.appendChild(mirror);
        const lineHeight = Number.parseFloat(style.lineHeight) || 18;
        const coords = {
            left: marker.offsetLeft - textarea.scrollLeft,
            top: marker.offsetTop - textarea.scrollTop + lineHeight,
        };
        mirror.remove();
        return coords;
    }

    function positionMentionList() {
        if (!els.mentionPanel || !els.input) return;
        const inputRect = els.input.getBoundingClientRect();
        const caret = textareaCaretCoordinates(els.input, state.mention.end);
        const panelWidth = els.mentionPanel.offsetWidth || 260;
        const panelHeight = els.mentionPanel.offsetHeight || 160;
        const maxLeft = Math.max(8, window.innerWidth - panelWidth - 8);
        const maxTop = Math.max(8, window.innerHeight - panelHeight - 8);
        const rawLeft = inputRect.left + caret.left;
        const rawTop = inputRect.top + caret.top + 6;
        els.mentionPanel.style.left = `${Math.max(8, Math.min(maxLeft, rawLeft))}px`;
        els.mentionPanel.style.top = `${Math.max(8, Math.min(maxTop, rawTop))}px`;
    }

    function renderMentionList() {
        if (!els.mentionPanel) return;
        clearNode(els.mentionPanel);
        if (!state.mention.active || !state.mention.candidates.length) {
            els.mentionPanel.hidden = true;
            return;
        }
        state.mention.candidates.forEach((candidate, index) => {
            const row = button(`bn-chat2-mention-option ${index === state.mention.index ? 'is-active' : ''}`, '');
            row.dataset.index = String(index);
            row.appendChild(createElement('span', {
                className: 'bn-chat2-mention-avatar',
                text: candidate.name.charAt(0) || '?',
            }));
            const text = createElement('span', {className: 'bn-chat2-mention-name'});
            text.appendChild(createElement('strong', {text: candidate.name}));
            text.appendChild(createElement('small', {text: `ID ${candidate.id}`}));
            row.appendChild(text);
            row.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                selectMentionCandidate(index);
            });
            els.mentionPanel.appendChild(row);
        });
        els.mentionPanel.hidden = false;
        positionMentionList();
    }

    function updateMentionList() {
        const trigger = findMentionTrigger();
        const candidates = trigger ? activeMentionCandidates(trigger.query) : [];
        if (!trigger || !candidates.length) {
            hideMentionList();
            return;
        }
        state.mention.active = true;
        state.mention.start = trigger.start;
        state.mention.end = trigger.end;
        state.mention.candidates = candidates;
        state.mention.index = 0;
        renderMentionList();
    }

    function moveMentionSelection(delta) {
        if (!state.mention.active || !state.mention.candidates.length) return;
        const length = state.mention.candidates.length;
        state.mention.index = (state.mention.index + delta + length) % length;
        renderMentionList();
    }

    function selectMentionCandidate(index = state.mention.index) {
        if (!els.input || !state.mention.active) return false;
        const candidate = state.mention.candidates[index];
        if (!candidate) return false;
        const value = els.input.value || '';
        const mentionText = `@${candidate.name} `;
        els.input.value = `${value.slice(0, state.mention.start)}${mentionText}${value.slice(state.mention.end)}`;
        const cursor = state.mention.start + mentionText.length;
        els.input.focus({preventScroll: true});
        els.input.setSelectionRange(cursor, cursor);
        saveDraft(state.activeKey, els.input.value);
        hideMentionList();
        renderComposerState();
        return true;
    }

    function extractMessageRefs(message) {
        const content = String(message && message.content || '');
        const refs = {images: [], links: []};
        const imageRe = /!\[([^\]]*)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
        let match;
        while ((match = imageRe.exec(content))) {
            refs.images.push({label: match[1] || 'image', url: match[2]});
        }
        const linkRe = /(?<!!)\[([^\]]+)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
        while ((match = linkRe.exec(content))) {
            refs.links.push({label: match[1] || 'file', url: match[2]});
        }
        const rawUrlRe = /(https?:\/\/[^\s<>"')]+|data:image\/(?:png|gif|jpe?g|webp|bmp);base64,[a-z0-9+/=]+)/gi;
        while ((match = rawUrlRe.exec(content))) {
            const url = match[1];
            if (/^data:image|\/(?:png|gif|jpe?g|webp|bmp)(?:[?#]|$)/i.test(url)) {
                refs.images.push({label: 'image', url});
            } else {
                refs.links.push({label: url, url});
            }
        }
        const seen = new Set();
        refs.images = refs.images.filter((item) => {
            if (!isSafeMediaUrl(item.url) || seen.has(`i:${item.url}`)) return false;
            seen.add(`i:${item.url}`);
            return true;
        });
        refs.links = refs.links.filter((item) => {
            if (!isSafeDownloadUrl(item.url) || seen.has(`l:${item.url}`)) return false;
            seen.add(`l:${item.url}`);
            return true;
        });
        return refs;
    }

    async function copyText(text, successText = '已复制') {
        const value = String(text || '');
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(value);
            } else if (typeof GM_setClipboard === 'function') {
                GM_setClipboard(value);
            } else {
                throw new Error('当前浏览器不支持剪贴板写入');
            }
            setStatus(successText, 'success');
        } catch (error) {
            setStatus(`复制失败: ${error.message || error}`, 'error');
        }
    }

    async function blobFromUrl(url) {
        if (/^data:/i.test(url)) {
            const response = await fetch(url);
            const blob = await response.blob();
            if (blob.size > CHAT_CLIPBOARD_BLOB_MAX_BYTES) throw new Error('文件过大，已阻止复制');
            return blob;
        }
        const response = await fetch(url, {cache: 'force-cache', credentials: 'include'});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const length = toInteger(response.headers && response.headers.get ? response.headers.get('content-length') : '');
        if (Number.isFinite(length) && length > CHAT_CLIPBOARD_BLOB_MAX_BYTES) throw new Error('文件过大，已阻止复制');
        const blob = await response.blob();
        if (blob.size > CHAT_CLIPBOARD_BLOB_MAX_BYTES) throw new Error('文件过大，已阻止复制');
        return blob;
    }

    async function copyImage(ref) {
        try {
            if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function' || typeof ClipboardItem === 'undefined') {
                await copyText(ref.url, '已复制图片地址');
                return;
            }
            const blob = await blobFromUrl(ref.url);
            if (!/^image\//i.test(blob.type || '')) throw new Error('不是可复制图片');
            await navigator.clipboard.write([new ClipboardItem({[blob.type]: blob})]);
            setStatus('图片已写入剪贴板', 'success');
        } catch (error) {
            await copyText(ref.url, `图片复制失败，已复制地址`);
        }
    }

    async function copyFile(ref) {
        try {
            if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function' || typeof ClipboardItem === 'undefined') {
                await copyText(ref.url, '已复制文件地址');
                return;
            }
            const blob = await blobFromUrl(ref.url);
            const type = blob.type || 'application/octet-stream';
            await navigator.clipboard.write([new ClipboardItem({[type]: blob})]);
            setStatus('文件已写入剪贴板', 'success');
        } catch (error) {
            await copyText(ref.url, `文件复制失败，已复制地址`);
        }
    }

    function safeFileName(name, fallback = 'download') {
        const cleaned = String(name || '').replace(/[\\/:*?"<>|\r\n]+/g, '_').trim();
        return cleaned || fallback;
    }

    function downloadRef(ref, fallbackName = 'download') {
        try {
            const link = document.createElement('a');
            link.href = ref.url;
            link.download = safeFileName(ref.label, fallbackName);
            link.rel = 'noopener';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setStatus('已开始下载', 'success');
        } catch (error) {
            setStatus(`下载失败: ${error.message || error}`, 'error');
        }
    }

    function closeContextMenu() {
        if (els.contextMenu) {
            els.contextMenu.remove();
            els.contextMenu = null;
        }
    }

    function contextMenuItem(label, handler) {
        const item = button('bn-chat2-context-item', label);
        item.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            closeContextMenu();
            handler();
        });
        return item;
    }

    function showContextMenu(event, message, conversation) {
        closeContextMenu();
        const refs = extractMessageRefs(message);
        const image = refs.images[0] || null;
        const link = refs.links[0] || null;
        const menu = createElement('div', {className: 'bn-chat2-context-menu', role: 'menu'});
        const appendMenuItem = (condition, label, handler) => {
            if (condition) menu.appendChild(contextMenuItem(label, handler));
        };
        appendMenuItem(!!message.content, '复制文字', () => copyText(message.content || '', '已复制消息文字'));
        appendMenuItem(!!image, '复制图片', () => copyImage(image));
        appendMenuItem(!!link, '复制文件', () => copyFile(link));
        appendMenuItem(!!(link || image), '复制链接', () => copyText((link || image).url, '已复制链接'));
        appendMenuItem(!!image, '下载图片', () => downloadRef(image, 'image'));
        appendMenuItem(!!link, '下载文件', () => downloadRef(link, 'file'));
        menu.appendChild(contextMenuItem('引用', () => quoteMessage(message, conversation)));
        menu.appendChild(contextMenuItem('转发...', () => showForwardPicker(message)));
        document.body.appendChild(menu);
        const rect = menu.getBoundingClientRect();
        const left = Math.min(event.clientX, window.innerWidth - rect.width - 8);
        const top = Math.min(event.clientY, window.innerHeight - rect.height - 8);
        menu.style.left = `${Math.max(8, left)}px`;
        menu.style.top = `${Math.max(8, top)}px`;
        els.contextMenu = menu;
        window.setTimeout(() => {
            document.addEventListener('click', closeContextMenu, {once: true});
        }, 0);
    }

    function closeModal(name) {
        if (els[name]) {
            els[name].remove();
            els[name] = null;
        }
    }

    function showImagePreview(src, title = '图片') {
        if (!isSafeMediaUrl(src)) {
            setStatus('图片过大或地址不安全，无法预览', 'error');
            return;
        }
        closeModal('lightbox');
        const backdrop = createElement('div', {className: 'bn-chat2-lightbox', role: 'dialog', 'aria-modal': 'true'});
        const toolbar = createElement('div', {className: 'bn-chat2-lightbox-toolbar'});
        toolbar.appendChild(createElement('strong', {text: title || '图片'}));
        const actions = createElement('div', {className: 'bn-chat2-lightbox-actions'});
        const copyBtn = button('bn-chat2-inline-btn', '复制');
        copyBtn.addEventListener('click', () => copyImage({url: src, label: title || 'image'}));
        const downloadBtn = button('bn-chat2-inline-btn', '下载');
        downloadBtn.addEventListener('click', () => downloadRef({url: src, label: title || 'image'}, 'image'));
        const closeBtn = button('bn-chat2-inline-btn', '关闭');
        closeBtn.addEventListener('click', () => closeModal('lightbox'));
        actions.appendChild(copyBtn);
        actions.appendChild(downloadBtn);
        actions.appendChild(closeBtn);
        toolbar.appendChild(actions);
        const img = createElement('img', {src, alt: title || '图片'});
        backdrop.appendChild(toolbar);
        backdrop.appendChild(img);
        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) closeModal('lightbox');
        });
        document.body.appendChild(backdrop);
        els.lightbox = backdrop;
    }

    function showForwardPicker(message) {
        closeModal('forwardPicker');
        const backdrop = createElement('div', {className: 'bn-chat2-modal-backdrop', role: 'dialog', 'aria-modal': 'true'});
        const panel = createElement('div', {className: 'bn-chat2-forward-picker'});
        const header = createElement('div', {className: 'bn-chat2-forward-header'});
        header.appendChild(createElement('strong', {text: '转发到'}));
        const closeBtn = button('bn-chat2-inline-btn', '关闭');
        closeBtn.addEventListener('click', () => closeModal('forwardPicker'));
        header.appendChild(closeBtn);
        const search = createElement('input', {type: 'search', className: 'bn-chat2-forward-search', placeholder: '搜索联系人或群聊'});
        const list = createElement('div', {className: 'bn-chat2-forward-list'});
        const renderList = () => {
            clearNode(list);
            const query = String(search.value || '').trim().toLowerCase();
            state.conversations
                .filter((item) => !query || [item.name, item.subtitle, item.id].some((value) => String(value || '').toLowerCase().includes(query)))
                .forEach((item) => {
                    const row = button('bn-chat2-forward-row', '');
                    row.appendChild(createElement('span', {
                        className: `bn-chat2-avatar ${item.type === 'group' ? 'is-group' : 'is-user'}`,
                        text: item.type === 'group' ? '群' : (String(item.name || '?').trim().charAt(0) || '?'),
                    }));
                    const text = createElement('span', {className: 'bn-chat2-forward-name'});
                    text.appendChild(createElement('strong', {text: item.name || `会话 ${item.id}`}));
                    text.appendChild(createElement('small', {text: item.subtitle || item.key}));
                    row.appendChild(text);
                    row.addEventListener('click', () => {
                        closeModal('forwardPicker');
                        forwardMessageToConversation(message, item);
                    });
                    list.appendChild(row);
                });
            if (!list.childNodes.length) list.appendChild(createElement('div', {className: 'bn-chat2-empty-list', text: '没有匹配会话'}));
        };
        search.addEventListener('input', renderList);
        panel.appendChild(header);
        panel.appendChild(search);
        panel.appendChild(list);
        backdrop.appendChild(panel);
        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) closeModal('forwardPicker');
        });
        document.body.appendChild(backdrop);
        els.forwardPicker = backdrop;
        renderList();
        search.focus({preventScroll: true});
    }

    async function forwardMessageToConversation(message, conversation) {
        if (!conversation) return;
        if (isSelfUserConversation(conversation)) {
            setStatus('不能转发给自己', 'error');
            return;
        }
        const content = String(message.content || '');
        if (!content.trim()) {
            setStatus('空消息不能转发', 'error');
            return;
        }
        setStatus(`正在转发到 ${conversation.name || conversation.id}...`);
        try {
            const payload = await apiRequest('POST', '/chat/chat', {
                data: {
                    type: conversation.type,
                    target_id: conversation.id,
                    content,
                },
            });
            updateTokenCounts(payload);
            const returnedMessages = getChats(payload)
                .map((raw) => normalizeMessage(raw, conversation.type === 'group' ? '' : 'out'))
                .filter((item) => messageBelongsToConversation(item, conversation, conversation.type === 'group' ? 'group' : 'out'));
            const sentAt = Math.floor(Date.now() / 1000);
            const confirmedMessages = returnedMessages.length
                ? returnedMessages
                : [{
                    id: `forward:${conversation.key}:${sentAt}:${Math.random().toString(36).slice(2, 8)}`,
                    localOnly: true,
                    sendState: 'sent',
                    conversationKey: conversation.key,
                    senderId: state.selfId,
                    targetId: conversation.id,
                    content,
                    sec: sentAt,
                    direction: 'out',
                    isSelf: true,
                    raw: {},
                }];
            rememberMessages(conversation, confirmedMessages, {trackUnread: false});
            state.lastActivitySecByKey.set(conversation.key, sentAt);
            state.conversations = sortConversations(state.conversations);
            renderConversationList();
            if (conversation.key === state.activeKey) {
                renderMessages({forceScrollBottom: true});
                window.setTimeout(() => refreshActive({silent: true, preserveScroll: true, scrollToBottom: false}), 350);
            }
            persistCache();
            setStatus('转发成功', 'success');
        } catch (error) {
            setStatus(`转发失败: ${error.message || error}`, 'error');
        }
    }

    function renderMessageRow(message, conversation) {
        const row = createElement('div', {
            className: `bn-chat2-message ${message.isSelf ? 'is-self' : ''} ${message.sendState === 'failed' ? 'is-failed' : ''} ${message.sendState === 'pending' ? 'is-pending' : ''}`,
        });
        const avatarText = message.isSelf
            ? '我'
            : (conversation.type === 'group'
                ? (displayNameForUser(message.senderId, message.raw).charAt(0) || '?')
                : (conversation.name.charAt(0) || '?'));
        row.appendChild(createElement('div', {
            className: `bn-chat2-message-avatar ${message.isSelf ? 'is-self' : (conversation.type === 'group' ? 'is-group' : 'is-user')}`,
            text: avatarText,
        }));

        const contentWrap = createElement('div', {className: 'bn-chat2-message-main'});
        const meta = createElement('div', {className: 'bn-chat2-message-meta'});
        const senderName = message.isSelf
            ? '我'
            : (conversation.type === 'group' ? displayNameForUser(message.senderId, message.raw) : conversation.name);
        meta.appendChild(createElement('span', {text: senderName}));
        meta.appendChild(createElement('span', {text: formatTime(message.sec)}));
        if (message.sendState === 'pending') meta.appendChild(createElement('span', {text: '发送中'}));
        if (message.sendState === 'failed') meta.appendChild(createElement('span', {text: '发送失败'}));

        const bubble = createElement('div', {className: 'bn-chat2-bubble'});
        const markdown = createElement('div', {className: 'bn-chat2-md'});
        renderMarkdownInto(markdown, message.content || '[空消息]');
        bubble.appendChild(markdown);
        if (message.sendState === 'failed') {
            const actions = createElement('div', {className: 'bn-chat2-message-actions'});
            const retry = button('bn-chat2-inline-btn', '重发');
            retry.addEventListener('click', () => retryPendingMessage(conversation.key, message.localId));
            const remove = button('bn-chat2-inline-btn', '移除');
            remove.addEventListener('click', () => removePendingMessage(conversation.key, message.localId));
            actions.appendChild(retry);
            actions.appendChild(remove);
            bubble.appendChild(actions);
        }
        contentWrap.appendChild(meta);
        contentWrap.appendChild(bubble);
        row.appendChild(contentWrap);
        row.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            showContextMenu(event, message, conversation);
        });
        els.messages.appendChild(row);
    }

    function applyMessageCollapse() {
        if (!els.messages) return;
        Array.from(els.messages.querySelectorAll('.bn-chat2-bubble')).forEach((bubble) => {
            if (bubble.dataset.collapseChecked === '1') return;
            bubble.dataset.collapseChecked = '1';
            const textLength = (bubble.textContent || '').length;
            if (textLength <= CHAT_LONG_TEXT_LIMIT && bubble.scrollHeight <= CHAT_LONG_HEIGHT_LIMIT) return;
            bubble.classList.add('is-collapsed');
            const toggle = button('bn-chat2-collapse-btn', '展开');
            toggle.addEventListener('click', () => {
                const collapsed = bubble.classList.toggle('is-collapsed');
                toggle.textContent = collapsed ? '展开' : '收起';
            });
            bubble.appendChild(toggle);
        });
    }

    function scrollMessagesToBottom() {
        if (els.messages) els.messages.scrollTop = els.messages.scrollHeight;
    }

    function selectConversation(key, options = {}) {
        if (!key || !state.conversationByKey.has(key)) return;
        if (els.groupPanel && !els.groupPanel.hidden) {
            toggleGroupPanel(false);
        }
        const oldKey = state.activeKey;
        if (els.input && oldKey) saveDraft(oldKey, els.input.value);
        hideMentionList();
        state.activeKey = key;
        state.unreadByKey.delete(key);
        state.conversations = sortConversations(state.conversations);
        renderAll();
        restoreDraftForActive();
        if (options.refresh) refreshActive({silent: false, scrollToBottom: true});
        persistCache();
    }

    function renderComposerState() {
        if (!els.input || !els.counter || !els.send) return;
        const conversation = getConversation();
        els.input.disabled = !conversation;
        els.send.disabled = !conversation;
        const limit = Number.isFinite(state.messageLengthLimit) ? state.messageLengthLimit : '--';
        const current = els.input.value.length;
        els.counter.textContent = `${current} / ${limit}`;
        els.counter.classList.toggle('is-overflow', Number.isFinite(state.messageLengthLimit) && current > state.messageLengthLimit);
        renderPreview();
    }

    function restoreDraftForActive() {
        if (!els.input) return;
        els.input.value = state.drafts[state.activeKey] || '';
        renderComposerState();
    }

    function renderPreview() {
        if (!els.preview || !els.previewToggle || !els.input) return;
        const enabled = !!els.previewToggle.checked;
        els.preview.hidden = !enabled;
        if (els.previewDivider) els.previewDivider.hidden = !enabled;
        if (els.editor) els.editor.classList.toggle('is-preview-off', !enabled);
        clearNode(els.preview);
        if (!enabled) {
            hideMentionList();
            return;
        }
        const value = els.input.value || '';
        if (!value.trim()) {
            els.preview.appendChild(createElement('span', {className: 'bn-chat2-preview-placeholder', text: '预览'}));
            return;
        }
        renderMarkdownInto(els.preview, value);
    }

    function beginComposerSplitResize(event) {
        if (!els.editor || !els.preview || !els.previewToggle || !els.previewToggle.checked) return;
        if (event.button != null && event.button !== 0) return;
        event.preventDefault();
        const editorRect = els.editor.getBoundingClientRect();
        const previewRect = els.preview.getBoundingClientRect();
        const startX = event.clientX;
        const startPreviewWidth = previewRect.width || 260;
        const minInputWidth = 260;
        const minPreviewWidth = 220;
        const maxPreviewWidth = Math.max(minPreviewWidth, editorRect.width - minInputWidth - 8);
        const onMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const nextWidth = Math.max(minPreviewWidth, Math.min(maxPreviewWidth, startPreviewWidth - deltaX));
            els.editor.style.setProperty('--bn-chat2-preview-width', `${Math.round(nextWidth)}px`);
            if (state.mention.active) positionMentionList();
        };
        const cleanup = () => {
            els.editor.classList.remove('is-resizing');
            window.removeEventListener('pointermove', onMove, true);
            window.removeEventListener('pointerup', cleanup, true);
            window.removeEventListener('pointercancel', cleanup, true);
        };
        els.editor.classList.add('is-resizing');
        window.addEventListener('pointermove', onMove, true);
        window.addEventListener('pointerup', cleanup, true);
        window.addEventListener('pointercancel', cleanup, true);
    }

    async function sendCurrentMessage() {
        const conversation = getConversation();
        if (!conversation || !els.input) {
            setStatus('请先选择会话', 'error');
            return;
        }
        if (isSelfUserConversation(conversation)) {
            setStatus('不能向自己发送私聊消息', 'error');
            return;
        }
        const content = els.input.value;
        if (!content.trim()) {
            setStatus('消息不能为空', 'error');
            return;
        }
        if (Number.isFinite(state.messageLengthLimit) && content.length > state.messageLengthLimit) {
            setStatus(`消息长度超过限制: ${content.length} / ${state.messageLengthLimit}`, 'error');
            return;
        }
        els.input.value = '';
        saveDraft(conversation.key, '');
        renderComposerState();
        const pending = createPendingMessage(conversation, content);
        addPendingMessage(conversation.key, pending);
        performSend(pending);
    }

    function createPendingMessage(conversation, content) {
        const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return {
            id: localId,
            localId,
            localOnly: true,
            sendState: 'pending',
            conversationKey: conversation.key,
            senderId: state.selfId,
            targetId: conversation.id,
            content,
            sec: Math.floor(Date.now() / 1000),
            direction: 'out',
            isSelf: true,
            raw: {},
        };
    }

    function addPendingMessage(key, message) {
        const list = state.pendingByKey.get(key) || [];
        state.pendingByKey.set(key, [...list, message]);
        state.lastActivitySecByKey.set(key, message.sec);
        renderConversationList();
        renderMessages({forceScrollBottom: true});
        setStatus('正在发送...');
    }

    function updatePendingMessage(key, localId, patch) {
        const list = state.pendingByKey.get(key) || [];
        state.pendingByKey.set(key, list.map((item) => item.localId === localId ? Object.assign({}, item, patch) : item));
        renderMessages({forceScrollBottom: true});
        renderConversationList();
    }

    function removePendingMessage(key, localId, options = {}) {
        const list = state.pendingByKey.get(key) || [];
        const next = list.filter((item) => item.localId !== localId);
        if (next.length) state.pendingByKey.set(key, next); else state.pendingByKey.delete(key);
        if (options.render !== false) renderMessages();
    }

    async function performSend(message) {
        const conversation = getConversation(message.conversationKey);
        if (!conversation) return;
        if (isSelfUserConversation(conversation)) {
            updatePendingMessage(conversation.key, message.localId, {
                sendState: 'failed',
                sendError: '不能向自己发送私聊消息',
            });
            setStatus('不能向自己发送私聊消息', 'error');
            return;
        }
        try {
            const payload = await apiRequest('POST', '/chat/chat', {
                data: {
                    type: conversation.type,
                    target_id: conversation.id,
                    content: message.content,
                },
            });
            updateTokenCounts(payload);
            const returnedMessages = getChats(payload)
                .map((raw) => normalizeMessage(raw, conversation.type === 'group' ? '' : 'out'))
                .filter((item) => messageBelongsToConversation(item, conversation, conversation.type === 'group' ? 'group' : 'out'));
            const confirmedMessages = returnedMessages.length
                ? returnedMessages
                : [Object.assign({}, message, {
                    id: `sent:${message.localId}`,
                    localOnly: true,
                    sendState: 'sent',
                })];
            rememberMessages(conversation, confirmedMessages, {trackUnread: false});
            removePendingMessage(conversation.key, message.localId, {render: false});
            state.lastActivitySecByKey.set(conversation.key, Math.max(
                state.lastActivitySecByKey.get(conversation.key) || 0,
                normalizeTimestampToSec(message.sec) || Math.floor(Date.now() / 1000)
            ));
            state.conversations = sortConversations(state.conversations);
            renderConversationList();
            renderMessages({forceScrollBottom: true});
            persistCache();
            setStatus('发送成功', 'success');
            window.setTimeout(() => {
                refreshActive({silent: true, preserveScroll: true, scrollToBottom: false});
            }, 350);
        } catch (error) {
            updatePendingMessage(conversation.key, message.localId, {
                sendState: 'failed',
                sendError: error.message || String(error),
            });
            setStatus(`发送失败: ${error.message || error}`, 'error');
        }
    }

    function retryPendingMessage(key, localId) {
        const item = (state.pendingByKey.get(key) || []).find((message) => message.localId === localId);
        if (!item) return;
        updatePendingMessage(key, localId, {sendState: 'pending', sendError: ''});
        performSend(Object.assign({}, item, {sendState: 'pending'}));
    }

    async function queryToken() {
        setStatus('正在查询 Token...');
        try {
            const payload = await apiRequest('POST', '/chat/chat', {data: {type: 'none'}});
            updateTokenCounts(payload);
            const used = Number.isFinite(state.tokenUsed) ? state.tokenUsed : '--';
            const remain = Number.isFinite(state.tokenRemain) ? state.tokenRemain : '--';
            setStatus(`Token 已更新: 已用 ${used}, 剩余 ${remain}`, 'success');
        } catch (error) {
            setStatus(`查询 Token 失败: ${error.message || error}`, 'error');
        }
    }

    async function monitorTick() {
        if (!state.initialized || !state.conversations.length || state.loadingMessages || state.loadingOlder) return;
        const conversation = state.conversations[state.monitorCursor % state.conversations.length];
        state.monitorCursor += 1;
        if (!conversation) return;
        try {
            const messages = await fetchConversationMessages(conversation, null, 3);
            const result = rememberMessages(conversation, messages, {trackUnread: true});
            if (result.changed || result.newIncoming.length) {
                state.conversations = sortConversations(state.conversations);
                renderConversationList();
                if (conversation.key === state.activeKey && (result.displayChanged || result.newIncoming.length)) {
                    renderMessages({preserveScroll: true, forceScrollBottom: false});
                }
                updateBadge();
            }
        } catch (_) {
            // Background probing is quiet; manual refresh surfaces errors.
        }
    }

    function startTimers() {
        stopTimers();
        state.autoRefreshTimer = window.setInterval(() => {
            if (!state.visible || !els.autoRefresh || !els.autoRefresh.checked) return;
            refreshActive({silent: true, preserveScroll: true, scrollToBottom: false});
        }, selectedIntervalMs());
        state.monitorTimer = window.setInterval(monitorTick, CHAT_MONITOR_INTERVAL_MS);
    }

    function stopTimers() {
        if (state.autoRefreshTimer) window.clearInterval(state.autoRefreshTimer);
        if (state.monitorTimer) window.clearInterval(state.monitorTimer);
        state.autoRefreshTimer = null;
        state.monitorTimer = null;
    }

    function selectedIntervalMs() {
        const value = els.interval ? toInteger(els.interval.value) : NaN;
        return Number.isFinite(value) ? Math.max(3000, Math.min(30000, value)) : CHAT_DEFAULT_INTERVAL_MS;
    }

    function updateBadge() {
        const total = Array.from(state.unreadByKey.values()).reduce((sum, value) => sum + (Number(value) || 0), 0);
        if (els.trigger) els.trigger.classList.toggle('has-unread', total > 0);
        if (els.badge) {
            els.badge.hidden = total <= 0;
            els.badge.textContent = formatUnread(total);
        }
    }

    function notifyIncomingMessages(conversation, messages) {
        if (!conversation || !messages || !messages.length) return;
        if (document.visibilityState === 'visible' && document.hasFocus() && state.visible && state.activeKey === conversation.key) return;
        if (typeof GM_notification !== 'function') return;
        const now = Date.now();
        const lastAt = state.notificationAtByKey.get(conversation.key) || 0;
        if (now - lastAt < 8000) return;
        state.notificationAtByKey.set(conversation.key, now);
        const first = messages[0];
        const sender = messageSenderName(first, conversation);
        const title = conversation.type === 'group' ? `${conversation.name} · ${sender}` : sender;
        const text = messageExcerpt(first.content, 100) || '收到一条新消息';
        try {
            GM_notification({
                title: `7FA4 聊天室`,
                text: `${title}: ${text}`,
                timeout: 5000,
            });
        } catch (_) {
            // Notifications are optional.
        }
    }

    function setWindowVisible(visible) {
        state.visible = !!visible;
        if (!els.window) return;
        if (!state.visible) {
            closeContextMenu();
            hideMentionList();
            stopWindowInteraction();
            toggleGroupPanel(false);
        }
        els.window.classList.toggle('bn-show', state.visible);
        els.window.setAttribute('aria-hidden', state.visible ? 'false' : 'true');
        if (els.trigger) {
            els.trigger.classList.toggle('bn-active', state.visible);
            els.trigger.setAttribute('aria-expanded', state.visible ? 'true' : 'false');
        }
        if (state.visible) {
            if (!state.initialized) {
                initializeChatData();
            } else {
                renderAll();
                restoreDraftForActive();
                refreshActive({silent: true, scrollToBottom: false});
            }
            if (els.input) setTimeout(() => els.input.focus({preventScroll: true}), 80);
        }
    }

    function clampNumber(value, min, max) {
        const normalized = Number(value);
        if (Number.isFinite(min) && Number.isFinite(max) && max < min) return min;
        if (!Number.isFinite(normalized)) return min;
        return Math.min(max, Math.max(min, normalized));
    }

    function viewportSize() {
        return {
            width: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0),
            height: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0),
        };
    }

    function isFullscreen() {
        return !!(els.window && els.window.classList.contains('bn-fullscreen'));
    }

    function clampWindowRect(rect) {
        const viewport = viewportSize();
        const maxWidth = Math.max(CHAT_WINDOW_MIN_WIDTH, viewport.width - CHAT_WINDOW_EDGE_MARGIN * 2);
        const maxHeight = Math.max(CHAT_WINDOW_MIN_HEIGHT, viewport.height - CHAT_WINDOW_EDGE_MARGIN * 2);
        const width = clampNumber(rect.width, Math.min(CHAT_WINDOW_MIN_WIDTH, maxWidth), maxWidth);
        const height = clampNumber(rect.height, Math.min(CHAT_WINDOW_MIN_HEIGHT, maxHeight), maxHeight);
        const left = clampNumber(rect.left, CHAT_WINDOW_EDGE_MARGIN, viewport.width - width - CHAT_WINDOW_EDGE_MARGIN);
        const top = clampNumber(rect.top, CHAT_WINDOW_EDGE_MARGIN, viewport.height - height - CHAT_WINDOW_EDGE_MARGIN);
        return {left, top, width, height};
    }

    function captureWindowRect() {
        if (!els.window) return null;
        const rect = els.window.getBoundingClientRect();
        return {left: rect.left, top: rect.top, width: rect.width, height: rect.height};
    }

    function applyWindowRect(rect, options = {}) {
        if (!els.window || !rect) return null;
        const next = options.clamp === false ? rect : clampWindowRect(rect);
        els.window.style.left = `${Math.round(next.left)}px`;
        els.window.style.top = `${Math.round(next.top)}px`;
        els.window.style.width = `${Math.round(next.width)}px`;
        els.window.style.height = `${Math.round(next.height)}px`;
        els.window.style.right = 'auto';
        els.window.style.bottom = 'auto';
        return next;
    }

    function prepareFloatingRect() {
        if (!els.window || isFullscreen()) return null;
        return applyWindowRect(captureWindowRect(), {clamp: true});
    }

    function resolveResizeRect(startRect, deltaX, deltaY, direction) {
        let {left, top, width, height} = startRect;
        if (direction.includes('e')) width += deltaX;
        if (direction.includes('s')) height += deltaY;
        if (direction.includes('w')) {
            width -= deltaX;
            left += deltaX;
        }
        if (direction.includes('n')) {
            height -= deltaY;
            top += deltaY;
        }
        const clamped = clampWindowRect({left, top, width, height});
        if (direction.includes('w')) clamped.left = Math.min(startRect.left + startRect.width - CHAT_WINDOW_MIN_WIDTH, clamped.left);
        if (direction.includes('n')) clamped.top = Math.min(startRect.top + startRect.height - CHAT_WINDOW_MIN_HEIGHT, clamped.top);
        return clampWindowRect(clamped);
    }

    function stopWindowInteraction() {
        const current = state.windowInteraction;
        if (!current) return;
        if (typeof current.cleanup === 'function') current.cleanup();
        state.windowInteraction = null;
        if (els.window) els.window.classList.remove('bn-chat2-moving', 'bn-chat2-resizing');
    }

    function beginWindowInteraction(event, mode, direction = '') {
        if (!els.window || !state.visible || isFullscreen()) return;
        if (event.button != null && event.button !== 0) return;
        if (mode === 'move' && event.target && event.target.closest && event.target.closest('button, input, select, textarea, a')) return;
        event.preventDefault();
        const startRect = prepareFloatingRect();
        if (!startRect) return;
        const startX = event.clientX;
        const startY = event.clientY;
        const stateRef = {mode, direction, startRect};
        const onMove = (moveEvent) => {
            if (state.windowInteraction !== stateRef) return;
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;
            if (mode === 'resize') {
                applyWindowRect(resolveResizeRect(startRect, deltaX, deltaY, direction), {clamp: true});
            } else {
                applyWindowRect({
                    left: startRect.left + deltaX,
                    top: startRect.top + deltaY,
                    width: startRect.width,
                    height: startRect.height,
                }, {clamp: true});
            }
        };
        const onUp = () => stopWindowInteraction();
        stateRef.cleanup = () => {
            window.removeEventListener('pointermove', onMove, true);
            window.removeEventListener('pointerup', onUp, true);
            window.removeEventListener('pointercancel', onUp, true);
        };
        state.windowInteraction = stateRef;
        els.window.classList.toggle('bn-chat2-moving', mode === 'move');
        els.window.classList.toggle('bn-chat2-resizing', mode === 'resize');
        window.addEventListener('pointermove', onMove, true);
        window.addEventListener('pointerup', onUp, true);
        window.addEventListener('pointercancel', onUp, true);
    }

    async function initializeChatData() {
        if (state.initialized) return;
        state.initialized = true;
        renderAll();
        await loadBetterNameUsers();
        await loadInfo({silent: false});
        restoreDraftForActive();
        startTimers();
    }

    function toggleFullscreen() {
        if (!els.window || !els.fullscreen) return;
        stopWindowInteraction();
        const next = !isFullscreen();
        if (next) state.windowRestoreRect = prepareFloatingRect() || captureWindowRect();
        els.window.classList.toggle('bn-fullscreen', next);
        if (!next && state.windowRestoreRect) applyWindowRect(state.windowRestoreRect, {clamp: true});
        els.fullscreen.setAttribute('aria-pressed', next ? 'true' : 'false');
        els.fullscreen.title = next ? '退出全屏' : '全屏';
        els.fullscreen.textContent = next ? '还原' : '全屏';
    }

    function toggleGroupPanel(visible = null) {
        if (!els.groupPanel || !els.groupToggle) return;
        const next = visible == null ? els.groupPanel.hidden : !!visible;

        // 控制面板显示
        els.groupPanel.hidden = !next;
        if (next) {
            els.groupPanel.style.display = 'flex';
            els.window.style.setProperty('--bn-chat2-panel-width', '280px');
        } else {
            els.groupPanel.style.display = 'none';
            els.window.style.setProperty('--bn-chat2-panel-width', '0px');
            closeMemberMenu();
            if (state.groupRefreshTimer) {
                clearInterval(state.groupRefreshTimer);
                state.groupRefreshTimer = null;
            }
        }
        els.groupToggle.setAttribute('aria-expanded', next ? 'true' : 'false');
        els.window.classList.toggle('bn-chat2-group-open', next);

        if (next) {
            const conversation = getConversation();
            if (conversation && conversation.type === 'group') {
                renderGroupMembers(conversation);
                // 启动定时刷新
                if (state.groupRefreshTimer) clearInterval(state.groupRefreshTimer);
                state.groupRefreshTimer = setInterval(() => {
                    if (!els.groupPanel || els.groupPanel.hidden) {
                        clearInterval(state.groupRefreshTimer);
                        state.groupRefreshTimer = null;
                        return;
                    }
                    loadInfo({ silent: true, refreshActive: false }).then(() => {
                        const updated = getConversation();
                        if (updated && updated.type === 'group') {
                            renderGroupMembers(updated);
                        }
                    });
                }, 30000);
            } else {
                setStatus('请先选择一个群聊', 'error');
                els.groupPanel.hidden = true;
                els.groupPanel.style.display = 'none';
                els.window.style.setProperty('--bn-chat2-panel-width', '0px');
                els.window.classList.remove('bn-chat2-group-open');
            }
        } else {
            closeMemberMenu();
            if (state.groupRefreshTimer) {
                clearInterval(state.groupRefreshTimer);
                state.groupRefreshTimer = null;
            }
        }
    }

    // runGroupAction 增加 setup 支持
    async function runGroupAction(type, extra = {}, options = {}) {
        const silent = options.silent || false;
        const conversation = getConversation();

        // 处理新建群聊
        if (type === 'setup') {
            const title = extra.title ? String(extra.title).trim() : '';
            if (!title) {
                setStatus('请输入群名称', 'error');
                return;
            }
            try {
                setStatus('正在创建群聊...');
                await apiRequest('POST', '/chat/group', { data: { type: 'setup', title } });
                setStatus('群聊创建成功', 'success');
                await loadInfo({ silent: true, refreshActive: false });
                // 自动选择新群
                const newGroup = state.conversations.find(c => c.type === 'group' && c.name === title);
                if (newGroup) {
                    selectConversation(newGroup.key, { refresh: true });
                    toggleGroupPanel(true);
                }
                return;
            } catch (error) {
                setStatus(`创建失败: ${error.message || error}`, 'error');
                return;
            }
        }

        // 原有群操作逻辑（需 group_id）
        if (!conversation || conversation.type !== 'group') {
            setStatus('请先选择一个群聊', 'error');
            return;
        }

        const payload = { type };
        payload.group_id = conversation.id;
        Object.assign(payload, extra);

        if (extra.mute !== undefined) {
            payload.mute = Math.floor(Date.now() / 1000) + extra.mute;
        }


        try {
            if (!silent) setStatus(`正在执行...`);
            await apiRequest('POST', '/chat/group', { data: payload });
            if (!silent) {
                setStatus(`${type} 操作成功`, 'success');
                await loadInfo({ silent: true, refreshActive: false });
                const updated = getConversation();
                if (updated) renderGroupMembers(updated);
            }
        } catch (error) {
            if (!silent) setStatus(`操作失败: ${error.message || error}`, 'error');
            else console.warn('群操作失败:', error);
        }
    }

    function insertTextAtCursor(text) {
        if (!els.input) return;
        const value = els.input.value || '';
        const start = els.input.selectionStart ?? value.length;
        const end = els.input.selectionEnd ?? value.length;
        const next = `${value.slice(0, start)}${text}${value.slice(end)}`;
        if (Number.isFinite(state.messageLengthLimit) && next.length > state.messageLengthLimit) {
            setStatus('插入后会超过消息长度限制', 'error');
            return;
        }
        els.input.value = next;
        const cursor = start + text.length;
        els.input.focus({preventScroll: true});
        els.input.setSelectionRange(cursor, cursor);
        saveDraft(state.activeKey, els.input.value);
        renderComposerState();
    }

    function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
            reader.readAsDataURL(file);
        });
    }

    function loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => {
                URL.revokeObjectURL(url);
                resolve(image);
            };
            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('图片解码失败'));
            };
            image.src = url;
        });
    }

    function sanitizedImageAlt(name) {
        return String(name || 'image').replace(/[\[\]\n\r]/g, '').slice(0, 80) || 'image';
    }

    function dataUrlTargetLength(fileName = '') {
        const current = els.input ? els.input.value.length : 0;
        if (!Number.isFinite(state.messageLengthLimit)) return CHAT_RENDER_DATA_URL_MAX_CHARS;
        const markdownOverhead = sanitizedImageAlt(fileName).length + 40;
        const available = state.messageLengthLimit - current - markdownOverhead;
        return Math.max(0, Math.min(CHAT_RENDER_DATA_URL_MAX_CHARS, available));
    }

    function canvasToDataUrl(canvas, mime, quality) {
        try {
            return canvas.toDataURL(mime, quality);
        } catch (_) {
            return '';
        }
    }

    async function compressImageFile(file) {
        const targetLength = dataUrlTargetLength(file.name);
        if (targetLength < 1200) throw new Error('当前消息剩余长度不足以插入图片');
        if (/^image\/gif$/i.test(file.type || '')) {
            const dataUrl = await fileToDataUrl(file);
            if (dataUrl.length <= targetLength) return dataUrl;
            throw new Error('GIF 图片过大，当前官方 API 不支持作为附件上传');
        }
        const image = await loadImageFromFile(file);
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        if (!width || !height) throw new Error('图片尺寸异常');
        if (width * height > 36000000) throw new Error('图片像素过大，已阻止以避免页面卡死');

        let side = Math.min(CHAT_IMAGE_TARGET_MAX_SIDE, Math.max(width, height));
        let best = '';
        while (side >= CHAT_IMAGE_MIN_SIDE) {
            const scale = Math.min(1, side / Math.max(width, height));
            const nextWidth = Math.max(1, Math.round(width * scale));
            const nextHeight = Math.max(1, Math.round(height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = nextWidth;
            canvas.height = nextHeight;
            const ctx = canvas.getContext('2d', {alpha: false});
            if (!ctx) throw new Error('无法创建图片压缩画布');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, nextWidth, nextHeight);
            ctx.drawImage(image, 0, 0, nextWidth, nextHeight);
            for (const quality of CHAT_IMAGE_QUALITY_STEPS) {
                const dataUrl = canvasToDataUrl(canvas, 'image/jpeg', quality);
                if (!dataUrl) continue;
                if (!best || dataUrl.length < best.length) best = dataUrl;
                if (dataUrl.length <= targetLength) return dataUrl;
            }
            side = Math.floor(side * 0.72);
        }
        if (best && best.length <= targetLength) return best;
        throw new Error('图片压缩后仍超过当前消息长度限制');
    }

    async function insertFiles(files) {
        const normalized = Array.from(files || []).filter(Boolean);
        if (!normalized.length) return;
        for (const file of normalized) {
            if (file.size > CHAT_FILE_INSERT_LIMIT_BYTES) {
                setStatus(`文件 ${file.name || ''} 超过 ${Math.round(CHAT_FILE_INSERT_LIMIT_BYTES / 1024 / 1024)} MB，已跳过`, 'error');
                continue;
            }
            if (!/^image\/(?:png|gif|jpe?g|webp|bmp)$/i.test(file.type || '')) {
                setStatus('当前官方 API 不支持真实附件，只能插入小图片 data URL', 'error');
                continue;
            }
            try {
                setStatus(`正在处理图片 ${file.name || ''}...`);
                const dataUrl = await compressImageFile(file);
                insertTextAtCursor(`\n![${sanitizedImageAlt(file.name)}](${dataUrl})\n`);
                setStatus(`已插入图片，约 ${Math.round(dataUrl.length / 1024)} KB`, 'success');
            } catch (error) {
                setStatus(`图片插入失败: ${error.message || error}`, 'error');
            }
        }
    }

    function buildChatWindow() {
        els.window = $('bn-chat-window');
        els.trigger = $('bn-chat-trigger');
        els.badge = $('bn-chat-trigger-badge');
        if (!els.window || !els.trigger) return false;

        els.window.classList.add('bn-chat2-window');
        clearNode(els.window);

        const header = createElement('div', {className: 'bn-chat-window-header bn-chat2-header'});
        els.header = header;
        const titleWrap = createElement('div', {className: 'bn-chat2-title-wrap'});
        titleWrap.appendChild(createElement('div', {className: 'bn-chat-window-title', text: '7FA4 聊天室'}));
        titleWrap.appendChild(createElement('div', {className: 'bn-chat2-subtitle', text: 'Better Names Chat · 官方 API'}));
        const actions = createElement('div', {className: 'bn-chat-window-actions'});
        els.refresh = button('bn-chat-window-action', '刷新', '刷新当前会话');
        els.tokenButton = button('bn-chat-window-action', 'Token', '查询 Token');
        els.groupToggle = button('bn-chat-window-action', '群成员', '查看群成员');
        els.setupGroup = button("bn-chat-window-action", "新建群", "新建一个空群");
        els.fullscreen = button('bn-chat-window-action', '全屏', '全屏');
        els.close = button('bn-chat-window-close', '×', '关闭聊天室');
        [els.refresh, els.tokenButton, els.groupToggle, els.setupGroup, els.fullscreen, els.close].forEach((item) => actions.appendChild(item));
        header.appendChild(titleWrap);
        header.appendChild(actions);

        const body = createElement('div', {className: 'bn-chat-window-body bn-chat2-body'});
        const shell = createElement('div', {className: 'bn-chat2-shell'});
        shell.appendChild(buildSidebar());
        shell.appendChild(buildMain());
        body.appendChild(shell);

        els.window.appendChild(header);
        els.window.appendChild(body);
        els.groupPanel = buildGroupPanel();
        els.setupGroup.addEventListener("click", () => {
            const title = prompt("请输入群名", "[Empty Group Name]");
            runGroupAction("setup", {title});
        })
        body.appendChild(els.groupPanel);
        els.resizeHandles = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].map((dir) => {
            const handle = createElement('div', {
                className: `bn-chat2-resize-handle is-${dir}`,
                dataset: {dir},
                'aria-hidden': 'true',
            });
            els.window.appendChild(handle);
            return handle;
        });
        return true;
    }

    function buildSidebar() {
        const sidebar = createElement('aside', {className: 'bn-chat2-sidebar'});
        const searchRow = createElement('div', {className: 'bn-chat2-search-row'});
        els.search = createElement('input', {
            type: 'search',
            className: 'bn-chat2-search',
            placeholder: '搜索会话 / ID',
            'aria-label': '搜索会话',
        });
        els.reloadInfo = button('bn-chat2-small-btn', '同步');
        els.clearCache = button('bn-chat2-small-btn', '清缓存', '清除当前账号本地缓存');
        searchRow.appendChild(els.search);
        searchRow.appendChild(els.reloadInfo);
        searchRow.appendChild(els.clearCache);
        const tabs = createElement('div', {className: 'bn-chat2-tabs', role: 'tablist'});
        [['all', '全部'], ['group', '群聊'], ['user', '私聊']].forEach(([scope, label]) => {
            const tab = button('bn-chat2-tab', label);
            tab.dataset.scope = scope;
            tab.setAttribute('role', 'tab');
            tab.addEventListener('click', () => {
                state.scope = scope;
                Array.from(tabs.children).forEach((node) => {
                    node.classList.toggle('is-active', node.dataset.scope === scope);
                    node.setAttribute('aria-selected', node.dataset.scope === scope ? 'true' : 'false');
                });
                renderConversationList();
            });
            if (scope === state.scope) {
                tab.classList.add('is-active');
                tab.setAttribute('aria-selected', 'true');
            }
            tabs.appendChild(tab);
        });
        els.conversations = createElement('div', {className: 'bn-chat2-conversations', 'aria-live': 'polite'});
        els.conversationEmpty = createElement('div', {className: 'bn-chat2-empty-list', text: '暂无会话，请同步列表。', hidden: true});
        sidebar.appendChild(searchRow);
        sidebar.appendChild(tabs);
        sidebar.appendChild(els.conversations);
        sidebar.appendChild(els.conversationEmpty);
        return sidebar;
    }

    function buildMain() {
        const main = createElement('section', {className: 'bn-chat2-main'});
        const current = createElement('div', {className: 'bn-chat2-current'});
        const identity = createElement('div', {className: 'bn-chat2-current-identity'});
        els.currentTitle = createElement('div', {className: 'bn-chat2-current-title', text: '请选择会话'});
        els.currentMeta = createElement('div', {className: 'bn-chat2-current-meta', text: '同步列表后可开始聊天'});
        identity.appendChild(els.currentTitle);
        identity.appendChild(els.currentMeta);
        els.status = createElement('div', {className: 'bn-chat2-status', role: 'status', 'aria-live': 'polite', text: '准备就绪'});
        current.appendChild(identity);
        current.appendChild(els.status);
        els.messages = createElement('div', {className: 'bn-chat2-messages', 'aria-live': 'polite'});
        const composer = createElement('div', {className: 'bn-chat2-composer'});
        const composerTools = createElement('div', {className: 'bn-chat2-composer-tools'});
        const previewLabel = createElement('label', {className: 'bn-chat2-preview-toggle'});
        els.previewToggle = createElement('input', {type: 'checkbox', checked: true});
        previewLabel.appendChild(els.previewToggle);
        previewLabel.appendChild(document.createTextNode('预览'));
        els.token = createElement('span', {className: 'bn-chat2-token', text: 'Token: -- / --'});
        composerTools.appendChild(previewLabel);
        composerTools.appendChild(els.token);
        const editor = createElement('div', {className: 'bn-chat2-editor'});
        els.editor = editor;
        els.input = createElement('textarea', {
            className: 'bn-chat2-input',
            rows: '4',
            placeholder: '输入消息，Enter 发送，Shift+Enter 换行',
        });
        els.preview = createElement('div', {className: 'bn-chat2-preview'});
        els.previewDivider = createElement('div', {
            className: 'bn-chat2-preview-divider',
            role: 'separator',
            'aria-orientation': 'vertical',
            title: '拖动调整输入和预览宽度',
        });
        els.mentionPanel = createElement('div', {
            className: 'bn-chat2-mention-panel',
            role: 'listbox',
            hidden: true,
        });
        editor.appendChild(els.input);
        editor.appendChild(els.previewDivider);
        editor.appendChild(els.preview);
        document.body.appendChild(els.mentionPanel);
        const footer = createElement('div', {className: 'bn-chat2-composer-footer'});
        els.counter = createElement('div', {className: 'bn-chat2-counter', text: '0 / --'});
        els.send = button('bn-chat2-send', '发送');
        footer.appendChild(els.counter);
        footer.appendChild(els.send);
        composer.appendChild(composerTools);
        composer.appendChild(editor);
        composer.appendChild(footer);
        main.appendChild(current);
        main.appendChild(els.messages);
        main.appendChild(composer);
        return main;
    }

    async function destroyGroup(conversation) {
        const members = conversation.members || [];
        const selfId = state.selfId;
        const others = members.filter(m => m.user_id !== selfId);
        if (!others.length) {
            // 如果只有自己，直接离开
            await runGroupAction('leave');
            return;
        }
        setStatus(`正在解散群，移除 ${others.length} 名成员...`);
        // 分批移除（每次 3 个并发）
        const batchSize = 3;
        for (let i = 0; i < others.length; i += batchSize) {
            const batch = others.slice(i, i + batchSize);
            await Promise.all(batch.map(member =>
                runGroupAction('del_member', { target_id: member.user_id })
            ));
            setStatus(`已移除 ${Math.min(i + batchSize, others.length)}/${others.length} 名成员`);
        }
        // 最后离开群
        await runGroupAction('leave');
        setStatus('群已解散', 'success');
        // 刷新会话列表（已经由 runGroupAction 触发 loadInfo，但可能需要额外刷新）
        await loadInfo({ silent: true, refreshActive: false });
        // 如果当前选中的是该群，切换到第一个会话
        if (state.activeKey === conversation.key) {
            const first = state.conversations[0];
            if (first) selectConversation(first.key, { refresh: true });
            else {
                state.activeKey = '';
                renderAll();
            }
        }
    }

    function buildGroupPanel() {
        const panel = createElement('div', { className: 'bn-chat2-group-panel', hidden: true });

        // ---------- 头部 ----------
        const header = createElement('div', { className: 'bn-chat2-group-header' });
        const titleWrap = createElement('div', { className: 'bn-chat2-group-header-title' });
        const nameEl = createElement('strong', { text: '群聊' });
        const idEl = createElement('span', { className: 'bn-chat2-group-id-text', text: '' });
        titleWrap.appendChild(nameEl);
        titleWrap.appendChild(idEl);
        header.appendChild(titleWrap);
        const closeBtn = button('bn-chat-window-close', '×', '关闭群管理');
        closeBtn.addEventListener('click', () => toggleGroupPanel(false));
        header.appendChild(closeBtn);
        panel.appendChild(header);
        // 保存引用到 els，以便其他地方使用
        els.groupClose = closeBtn;

        // ---------- 成员列表 ----------
        const memberList = createElement('div', { className: 'bn-chat2-member-list' });
        panel.appendChild(memberList);
        panel._memberList = memberList;

        // ---------- 底部操作栏 ----------
        const actions = createElement('div', { className: 'bn-chat2-group-actions' });
        const addBtn = button('bn-chat2-action-btn', '添加成员');
        const renameBtn = button('bn-chat2-action-btn', '修改群名');
        const muteAllBtn = button('bn-chat2-action-btn', '全体禁言');
        const leaveBtn = button('bn-chat2-action-btn', '退出群聊');
        actions.appendChild(addBtn);
        actions.appendChild(renameBtn);
        actions.appendChild(muteAllBtn);
        actions.appendChild(leaveBtn);
        const destroyBtn = button('bn-chat2-action-btn', '解散群');
        destroyBtn.style.color = '#c24141';
        destroyBtn.addEventListener('click', () => {
            const conversation = getConversation();
            if (!conversation || conversation.type !== 'group') return;
            // 检查当前用户是否为群主
            const selfId = state.selfId;
            const currentUser = (conversation.members || []).find(u => u.user_id === selfId);
            if (!currentUser || currentUser.type !== 'Owner') {
                setStatus('只有群主可以解散群', 'error');
                return;
            }
            if (!confirm(`确定要解散群 "${conversation.name}" 吗？\n此操作不可撤销，所有成员将被移除。`)) return;
            destroyGroup(conversation);
        });
        actions.appendChild(destroyBtn);
        panel.appendChild(actions);

        // ---------- 保存引用 ----------
        panel._headerName = nameEl;
        panel._headerId = idEl;
        panel._memberList = memberList;

        // ---------- 绑定事件 ----------
        addBtn.addEventListener('click', () => {
            const target = prompt('输入要添加的用户 ID:');
            if (target && /^\d+$/.test(target)) {
                runGroupAction('add_member', { target_id: Number(target) });
            }
        });
        renameBtn.addEventListener('click', () => {
            const title = prompt('输入新的群名称:');
            if (title && title.trim()) {
                runGroupAction('set_title', { title: title.trim() });
            }
        });
        muteAllBtn.addEventListener('click', () => {
            const seconds = prompt('输入禁言秒数（0 解除全体禁言）:');
            if (seconds !== null && /^\d+$/.test(seconds)) {
                runGroupAction('mute_group', { mute: Number(seconds) });
            }
        });
        leaveBtn.addEventListener('click', () => {
            if (confirm('确定要退出该群聊吗？')) {
                runGroupAction('leave');
            }
        });

        return panel;
    }

    function renderGroupMembers(conversation) {
        if (!conversation || conversation.type !== 'group') return;
        const panel = els.groupPanel;
        if (!panel) return;
        const memberList = panel._memberList;
        if (!memberList) return;

        clearNode(memberList);

        const members = conversation.members || [];
        if (!members.length) {
            memberList.appendChild(createElement('div', { className: 'bn-chat2-empty-list', text: '暂无成员' }));
            return;
        }

        // 更新头部信息
        panel._headerName.textContent = conversation.name + `· ${members.length}人`;
        panel._headerId.textContent = `  ID: ${conversation.id}`;

        // 排序：Owner > Administrator > Member
        const roleOrder = { Owner: 0, Administrator: 1, Member: 2 };
        const sorted = [...members].sort((a, b) => {
            const aRole = a.type || 'Member';
            const bRole = b.type || 'Member';
            return (roleOrder[aRole] || 3) - (roleOrder[bRole] || 3);
        });

        sorted.forEach(member => {
            const uid = member.user_id || member.id || member.uid;
            if (!uid) return;

            // 获取显示名（如果 userNameById 有缓存，否则 fallback）
            const name = state.userNameById.get(uid) || `用户 ${uid}`;
            const role = member.type || 'Member';

            const row = createElement('div', { className: 'bn-chat2-member-row', dataset: { uid } });
            // 头像（首字母）
            const avatar = createElement('span', { className: 'bn-chat2-member-avatar', text: name.charAt(0) || '?' });
            // 昵称 + 角色标签
            const info = createElement('span', { className: 'bn-chat2-member-info' });
            info.appendChild(createElement('span', { className: 'bn-chat2-member-name', text: name }));
            if (role === 'Owner') {
                info.appendChild(createElement('span', { className: 'bn-chat2-member-role owner', text: '群主' }));
            } else if (role === 'Administrator') {
                info.appendChild(createElement('span', { className: 'bn-chat2-member-role admin', text: '管理员' }));
            }
            row.appendChild(avatar);
            row.appendChild(info);

            // 如果不是自己，点击弹出操作菜单
            row.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showMemberMenu(e, uid, name, role, conversation);
            });
            memberList.appendChild(row);
        });
    }

    function showMemberMenu(event, uid, name, role, conversation) {
        // 关闭已有菜单
        closeMemberMenu();

        const menu = createElement('div', { className: 'bn-chat2-member-menu', role: 'menu' });

        // 构建菜单项（根据权限）
        const items = [];
        // 判断当前用户是否有管理权限（群主或管理员）
        const selfId = state.selfId;
        // 获取当前群信息，判断登录用户的身份（需要从 conversation 中获取）
        // 由于 conversation.raw.users 包含所有成员，我们可以查找自己的身份
        const currentUser = (conversation.members || []).find(u => u.user_id === selfId);
        const currentRole = currentUser ? currentUser.type : null;

        // 如果当前用户是群主或管理员，显示管理操作
        if (currentRole === "Owner") {
            items.push({
                label: '禁言',
                action: () => {
                    const seconds = prompt('输入禁言秒数（0 解除禁言）:');
                    if (seconds !== null && /^\d+$/.test(seconds)) {
                        runGroupAction('mute_member', {target_id: uid, mute: Number(seconds)})
                    }
                }
            });
            // 如果已经是管理员，显示取消管理员；否则显示设为管理员
            if (role === 'Administrator') {
                items.push({
                    label: '取消管理员',
                    action: () => runGroupAction('del_administrator', { target_id: uid })
                });
            } else {
                items.push({
                    label: '设为管理员',
                    action: () => runGroupAction('add_administrator', { target_id: uid })
                });
            }
            items.push({
                label: '移除成员',
                action: () => {
                    if (confirm(`确定移除 ${name} 吗？`)) {
                        runGroupAction('del_member', { target_id: uid });
                    }
                }
            });
            items.push({
                label: '转让群主',
                action: () => {
                    if (confirm(`确定转让群主给 ${name} 吗？`)) {
                        runGroupAction('give_owner', { target_id: uid });
                    }
                }
            });
        }
        if (currentRole === "Administrator"){
            if (role === "Member"){
                items.push({
                    label: '禁言',
                    action: () => {
                        const seconds = prompt('输入禁言秒数（0 解除禁言）:');
                        if (seconds !== null && /^\d+$/.test(seconds)) {
                            runGroupAction('mute_member', {target_id: uid, mute: Number(seconds)})
                        }
                    }
                });
                items.push({
                    label: '移除成员',
                    action: () => {
                        if (confirm(`确定移除 ${name} 吗？`)) {
                            runGroupAction('del_member', { target_id: uid });
                        }
                    }
                });
            }
        }

        items.push({
            label: '打开私聊',
            action: () => {
                const key = conversationKey('user', uid);
                selectConversation(key, { refresh: true });
                toggleGroupPanel(false);
            }
        });

        if (items.length === 0) {
            // 如果没有任何操作项（比如自己看自己），不显示菜单
            return;
        }

        items.forEach(item => {
            const btn = button('bn-chat2-menu-item', item.label);
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeMemberMenu();
                item.action();
            });
            menu.appendChild(btn);
        });

        menu.addEventListener('click', (e) => e.stopPropagation());

        // 定位菜单
        const x = event.clientX || 0;
        const y = event.clientY || 0;
        // 先附加到 body 以获取尺寸
        document.body.appendChild(menu);
        menu.style.zIndex = '2147483647';
        // 获取菜单尺寸
        const rect = menu.getBoundingClientRect();
        const menuWidth = rect.width || 150;
        const menuHeight = rect.height || 100;
        // 计算位置，不超出视口
        let left = Math.min(x, window.innerWidth - menuWidth - 10);
        let top = Math.min(y, window.innerHeight - menuHeight - 10);
        left = Math.max(10, left);
        top = Math.max(10, top);
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
        // 全局点击监听：点击菜单外关闭
        const closeHandler = (e) => {
            if (!menu.contains(e.target)) {
                closeMemberMenu();
                document.removeEventListener('click', closeHandler);
            }
        };
        // 延迟注册，避免当前点击事件触发关闭
        setTimeout(() => {
            document.addEventListener('click', closeHandler);
        }, 0);
        // 确保显示
        menu.style.display = 'block';
        els._memberMenu = menu;
        menu._closeHandler = closeHandler;
    }

    function closeMemberMenu() {
        if (els._memberMenu) {
            if (els._memberMenu._closeHandler) {
                document.removeEventListener('click', els._memberMenu._closeHandler);
            }
            els._memberMenu.remove();
            els._memberMenu = null;
        }
    }

    function bindEvents() {
        els.trigger.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            setWindowVisible(!state.visible);
        });
        els.trigger.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            setWindowVisible(!state.visible);
        });
        els.close.addEventListener('click', () => setWindowVisible(false));
        els.fullscreen.addEventListener('click', toggleFullscreen);
        els.groupToggle.addEventListener('click', () => toggleGroupPanel());
        els.groupClose.addEventListener('click', () => toggleGroupPanel(false));
        if (els.header) {
            els.header.addEventListener('pointerdown', (event) => beginWindowInteraction(event, 'move'));
            els.header.addEventListener('dblclick', (event) => {
                if (event.target && event.target.closest && event.target.closest('button')) return;
                toggleFullscreen();
            });
        }
        (els.resizeHandles || []).forEach((handle) => {
            handle.addEventListener('pointerdown', (event) => {
                beginWindowInteraction(event, 'resize', handle.dataset.dir || '');
            });
        });
        els.refresh.addEventListener('click', () => refreshActive({silent: false, scrollToBottom: false}));
        els.reloadInfo.addEventListener('click', () => loadInfo({silent: false}));
        els.clearCache.addEventListener('click', () => {
            if (!window.confirm('清除当前账号的聊天室本地缓存和草稿？')) return;
            clearLocalCache();
        });
        els.tokenButton.addEventListener('click', queryToken);
        els.interval = null;
        els.autoRefresh = {checked: true};
        els.search.addEventListener('input', () => {
            state.query = els.search.value || '';
            renderConversationList();
        });
        els.input.addEventListener('input', () => {
            saveDraft(state.activeKey, els.input.value);
            renderComposerState();
            updateMentionList();
        });
        els.input.addEventListener('keydown', (event) => {
            if (state.mention.active) {
                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    moveMentionSelection(1);
                    return;
                }
                if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    moveMentionSelection(-1);
                    return;
                }
                if (event.key === 'Enter' || event.key === 'Tab') {
                    event.preventDefault();
                    selectMentionCandidate();
                    return;
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    hideMentionList();
                    return;
                }
            }
            if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
            event.preventDefault();
            sendCurrentMessage();
        });
        els.input.addEventListener('keyup', (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return;
            updateMentionList();
        });
        els.input.addEventListener('mouseup', updateMentionList);
        els.input.addEventListener('scroll', () => {
            if (state.mention.active) positionMentionList();
        });
        els.input.addEventListener('blur', () => {
            window.setTimeout(hideMentionList, 120);
        });
        if (els.previewDivider) {
            els.previewDivider.addEventListener('pointerdown', beginComposerSplitResize);
        }
        if (els.mentionPanel) {
            els.mentionPanel.addEventListener('wheel', (event) => {
                event.preventDefault();
                event.stopPropagation();
                els.mentionPanel.scrollTop += event.deltaY;
            }, {passive: false});
        }
        els.input.addEventListener('paste', (event) => {
            const files = Array.from(event.clipboardData ? event.clipboardData.files : []);
            if (!files.length) return;
            event.preventDefault();
            insertFiles(files);
        });
        els.input.addEventListener('dragover', (event) => {
            event.preventDefault();
            els.input.classList.add('is-drag-over');
        });
        els.input.addEventListener('dragleave', () => els.input.classList.remove('is-drag-over'));
        els.input.addEventListener('drop', (event) => {
            event.preventDefault();
            els.input.classList.remove('is-drag-over');
            insertFiles(event.dataTransfer ? event.dataTransfer.files : []);
        });
        els.previewToggle.addEventListener('change', renderPreview);
        els.send.addEventListener('click', sendCurrentMessage);
        els.messages.addEventListener('scroll', () => {
            if (els.messages.scrollTop <= CHAT_LOAD_OLDER_EDGE_PX) loadOlderMessages();
        }, {passive: true});
        window.addEventListener('resize', () => {
            if (state.visible && !isFullscreen() && els.window && els.window.style.left) {
                applyWindowRect(captureWindowRect(), {clamp: true});
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (els.contextMenu) {
                closeContextMenu();
                return;
            }
            if (els.lightbox) {
                closeModal('lightbox');
                return;
            }
            if (els.forwardPicker) {
                closeModal('forwardPicker');
                return;
            }
            if (els.groupPanel && !els.groupPanel.hidden) {
                toggleGroupPanel(false);
                return;
            }
            if (state.visible) setWindowVisible(false);
        });
        window.addEventListener('beforeunload', () => {
            if (els.input && state.activeKey) saveDraft(state.activeKey, els.input.value);
            persistCache();
        });
    }

    function waitForPanel() {
        return new Promise((resolve) => {
            const existing = $('bn-container');
            if (existing) {
                resolve(existing);
                return;
            }
            const onReady = () => {
                const container = $('bn-container');
                if (container) resolve(container);
            };
            window.addEventListener('bn-panel-ready', onReady, {once: true});
            const observer = new MutationObserver(() => {
                const container = $('bn-container');
                if (!container) return;
                observer.disconnect();
                resolve(container);
            });
            observer.observe(document.documentElement || document, {childList: true, subtree: true});
        });
    }

    async function init() {
        await waitForPanel();
        let enabled = true;
        try {
            enabled = typeof GM_getValue !== 'function' || GM_getValue('enableChatroom', true) !== false;
        } catch (_) {
            enabled = true;
        }
        if (!enabled) {
            const trigger = $('bn-chat-trigger');
            const chatWindow = $('bn-chat-window');
            if (trigger) {
                trigger.hidden = true;
                trigger.setAttribute('aria-hidden', 'true');
                trigger.setAttribute('aria-expanded', 'false');
            }
            if (chatWindow) {
                chatWindow.classList.remove('bn-show');
                chatWindow.setAttribute('aria-hidden', 'true');
            }
            return;
        }
        if (!buildChatWindow()) return;
        bindEvents();
        renderAll();
    }

    init();
})();
