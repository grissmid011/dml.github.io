// 使用 IIFE 包裹所有JS代码，避免全局污染
document.addEventListener('DOMContentLoaded', function() {

    // =========================================================================
    // -------------------- I. CORE UTILITIES & GLOBAL STATE --------------------
    // =========================================================================

    // --- 1.1. 基础存储与UI工具 ---
    function getStorage(key, defaultValue) {
        const storedValue = localStorage.getItem(key);
        try {
            return storedValue ? JSON.parse(storedValue) : defaultValue;
        } catch (e) {
            console.error(`Error parsing storage key "${key}":`, e);
            return defaultValue;
        }
    }

    function setStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function showToast(msg) {
        const t = document.getElementById('toast');
        t.innerText = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2000);
    }
    
    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, function(match) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        });
    }
          function extractFirstJsonObject(text) {
        const startIndex = text.indexOf('{');
        if (startIndex === -1) {
            console.error("AI响应中未找到 '{' :", text);
            return null; 
        }

        let braceCount = 0;
        let endIndex = -1;

        for (let i = startIndex; i < text.length; i++) {
            const char = text[i];
            // 简单处理，忽略字符串中的括号，在当前场景下足够用
            if (char === '{') {
                braceCount++;
            } else if (char === '}') {
                braceCount--;
            }

            if (braceCount === 0) {
                endIndex = i;
                break; // 找到了第一个完整JSON对象的结尾
            }
        }

        if (endIndex === -1) {
            console.error("AI响应中未找到匹配的 '}' :", text);
            return null; 
        }

        return text.substring(startIndex, endIndex + 1);
    }


    // --- 1.2. 页面与抽屉导航 ---
    function closeAllOverlays() {
        const selectors = '.drawer-overlay, .action-sheet-modal, .thoughts-modal-overlay, .clock-modal-overlay, .modal-overlay, .modal-container, .drawer-modal, .page-modal';
        document.querySelectorAll(selectors).forEach(el => {
            el.classList.remove('active');
            // 某些容器（如世界书绑定面板）还依赖 display 控制
            if (el.id === 'worldbook-binder-container') {
                el.style.display = 'none';
            }
        });
    }

    function openPage(id) {
        // 打开任何页面前，先确保所有遮罩层/弹窗被关闭，避免透明 overlay 挡住点击
        closeAllOverlays();

        const page = document.getElementById(id);
        if (!page) return;

        // 先给目标页面标记 active，再移除其他页面的 active，避免中间出现“所有页面都未激活”的瞬间
        // 这样可以减少从 QQ 列表进入聊天页时短暂露出主屏幕的闪烁感
        page.classList.add('active');

        // 确保任意时刻只存在一个激活的 App 页面，避免页面叠在一起（例如购物页盖住塔罗页）
        document.querySelectorAll('.app-page.active').forEach(el => {
            if (el !== page) {
                el.classList.remove('active');
            }
        });

        // 进入任意 App 页面时，隐藏主屏幕底部的 Dock 栏，避免在 QQ 等页面底部看到重复的“第二个导航栏”
        const dock = document.querySelector('.dock-bar');
        if (dock) {
            dock.style.display = 'none';
        }

        // 页面打开时的特定加载逻辑
        if (id === 'qq-page') loadChatList();
        if (id === 'anniversary-page') {
            loadAnniversaryData();
            renderAnniversaryList();
        }
        if (id === 'clock-page') {
            loadClockData();
            renderTaskList();
            switchClockTab('task');
        }
        if (id === 'worldbook-page') {
            renderWbCategories();
            renderWbList();
        }
        if (id === 'forum-page') { switchForumTab('posts'); renderForumFeed(); }
        if (id === 'api-page') initSettingsPage();
        if (id === 'infinite-page') initInfiniteApp();
    }
         function closePage(id) {
        const page = document.getElementById(id);
        if (page) page.classList.remove('active');

        // 关闭页面后，如果已经没有任何 .app-page 处于 active 状态，则重新显示主屏 Dock；
        // 否则保持隐藏（例如从聊天页退回 QQ 页，仍视为“有 App 打开”）。
        const anyActivePage = document.querySelector('.app-page.active');
        const dock = document.querySelector('.dock-bar');
        if (dock) {
            dock.style.display = anyActivePage ? 'none' : '';
        }
    }

    function openDrawer(id) {
        const drawer = document.getElementById(id);
        if (drawer) drawer.classList.add('active');
    }

    function closeDrawer(id) {
        const drawer = document.getElementById(id);
        if (drawer) drawer.classList.remove('active');
    }
 
    function createIconData(svgContent, viewBox = '0 0 24 24') {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${svgContent.trim()}</svg>`;
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
 
    // --- 1.3. 全局状态变量 (从localStorage加载) ---
const iconSVGs = {
    qq: createIconData("<path d='M17 7H7a2 2 0 0 0-2 2v8h14V9a2 2 0 0 0-2-2Zm0-3H7v2h10V4Zm-1 13H8v2h8v-2Z' fill='%23fff'/>"),
    worldbook: createIconData("<path d='M18 3H6a2 2 0 0 0-2 2v14h1.5c1.2 0 2.3.5 3.1 1.3.8-.8 1.9-1.3 3.1-1.3 1.2 0 2.3.5 3.1 1.3.8-.8 1.9-1.3 3.1-1.3H20V5a2 2 0 0 0-2-2Zm-7 13.8c-1.5-.8-3-.9-4-.7V6h4v10.8Zm6-.7c-1-.2-2.5-.1-4 .7V6h4v10.1Z' fill='%23fff'/>"),
    settings: createIconData("<path d='M19.4 12.9c.1-.3.1-.7.1-.9s0-.6-.1-.9l2.1-1.6c.2-.1.2-.4.1-.6l-2-3.5c-.1-.2-.4-.3-.6-.2l-2.5 1c-.5-.4-1.1-.7-1.7-1l-.4-2.6c0-.3-.2-.4-.5-.4h-4c-.3 0-.4.2-.4.4l-.4 2.6c-.6.2-1.2.6-1.7 1l-2.5-1c-.2-.1-.5 0-.6.2l-2 3.5c-.1.2-.1.5.1.6l2.1 1.6c-.1.3-.1.6-.1.9s0 .6.1.9l-2.1 1.6c-.2.1-.2.4-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1c.5.4 1.1.7 1.7 1l.4 2.6c0 .2.2.4.4.4h4c.3 0 .4-.2.5-.4l.4-2.6c.6-.2 1.2-.6 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5c.1-.2.1-.5-.1-.6l-2.1-1.6Zm-7.4 3.6c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5Z' fill='%23fff'/>"),
    appearance: createIconData("<path d='M12 3a9 9 0 0 0 0 18 9 9 0 0 0 0-18Zm0 14.5a2.5 2.5 0 0 1-2.4-1.8 5 5 0 0 1-3.6-3.7A6.5 6.5 0 0 1 12 5.5a6.5 6.5 0 0 1 6 6.5c0 3.6-2.9 5.5-6 5.5Z' fill='%23fff'/>"),
    anniversary: createIconData("<path d='M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm-2 6-6 3.8L6 10V8l6 3.8L18 8v2Z' fill='%23fff'/>"),
    clock: createIconData("<path d='M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 9H11V7h2v6l3.5 2.1-.8 1.3L13 13Z' fill='%23fff'/>"),
    'game-center': createIconData("<path d='M21.6 16.1l-1.1-7.7A3.5 3.5 0 0 0 16.5 5h-9A3.5 3.5 0 0 0 3.5 8.4L2.4 16a2.7 2.7 0 0 0 2.8 3.2h1.7a2 2 0 0 0 1.9-1.5l.8-2.2h4.8l.8 2.2a2 2 0 0 0 1.9 1.5h1.7a2.7 2.7 0 0 0 2.8-2.6ZM8.5 13.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z' fill='%23fff'/>"),
    forum: createIconData("<path d='M21 6h-3V3a1 1 0 0 0-2 0v3H8V3a1 1 0 0 0-2 0v3H3a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1Zm-12.5 9a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm4 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm4 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z' fill='%23fff'/>"),
    hatchery: createIconData("<path d='M12 2.4c-3.4 0-6.2 4.5-6.2 8.8 0 4.6 2.8 8.4 6.2 8.4s6.2-3.8 6.2-8.4c0-4.3-2.8-8.8-6.2-8.8Z' fill='none' stroke='%233b2818' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/><path d='M8.2 14.2c1.1-1.4 2.5-2.1 3.8-2.1s2.7.7 3.8 2.1' fill='none' stroke='%233b2818' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/>")
};
 
const myDefaultBeautifyConfig = {
    wpUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='%23f3d2b3'/%3E%3C/svg%3E", // 默认主屏幕壁纸（更偏浅的暖棕色纯色）
    lockWpUrl: 'https://i.postimg.cc/KzpC6Pst/IMG-3941.jpg',
    icons: { ...iconSVGs },
    globalCss: '',
    globalCssPresets: [],
    globalChatBgData: '',
    globalChatBgUrl: '',
    chatBgData: '',
    chatBgGallery: [],
    chatBgPerChat: {},
    chatCss: '',
    chatCssPresets: [],
    loveBoardStyles: {}
};

const OLD_DEFAULT_WP_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='%23d8b08c'/%3E%3C/svg%3E";
const OLD_DEFAULT_LOCK_WP_URL = 'https://i.postimg.cc/66ryYVfy/IMG-3938.jpg';

// getStorage现在会使用您的新默认值
let beautifyConfig = getStorage('ai_beautify_config_v2', myDefaultBeautifyConfig);

// 迁移旧版默认暖棕色壁纸：如果用户没有自定义，只是用旧默认色，则自动替换成新的更浅暖棕色
if ((!beautifyConfig.wpData || beautifyConfig.wpData === '') && beautifyConfig.wpUrl === OLD_DEFAULT_WP_URL) {
    beautifyConfig.wpUrl = myDefaultBeautifyConfig.wpUrl;
    setStorage('ai_beautify_config_v2', beautifyConfig);
}

// 迁移旧版默认锁屏壁纸：如果用户没有自定义，只是用旧默认图，则自动替换成新的链接图
if ((!beautifyConfig.lockWpData || beautifyConfig.lockWpData === '') && beautifyConfig.lockWpUrl === OLD_DEFAULT_LOCK_WP_URL) {
    beautifyConfig.lockWpUrl = myDefaultBeautifyConfig.lockWpUrl;
    setStorage('ai_beautify_config_v2', beautifyConfig);
}

if (!beautifyConfig.loveBoardStyles) beautifyConfig.loveBoardStyles = {};
// 兼容旧配置：确保结构字段存在
if (!beautifyConfig.chatBgGallery) beautifyConfig.chatBgGallery = [];
if (!beautifyConfig.chatBgPerChat) beautifyConfig.chatBgPerChat = {};
if (!beautifyConfig.globalCssPresets) beautifyConfig.globalCssPresets = [];
if (!beautifyConfig.chatCssPresets) beautifyConfig.chatCssPresets = [];

let config = getStorage('ai_phone_config', {});

// 锁屏解锁模式 & 密码配置
// lockMode: 'slider' | 'swipe' | 'swipe_passcode'
config.lockMode = config.lockMode || 'slider';
config.lockPasscode = config.lockPasscode || '1234';
let apiProfiles = getStorage('ai_api_profiles', []); // 保存所有命名的 API 配置
let userProfiles = getStorage('ai_users_list', []);
let aiList = getStorage('ai_list_v2', []);
let momentsData = getStorage('qq_moments_data', {});
let worldbooks = getStorage('ai_worldbooks_v2', []);
let theatreRenderRules = getStorage('mini_theatre_render_rules_v1', []);
let theatreStoryTemplates = getStorage('mini_theatre_story_templates_v1', []);
let theatreStoryEpisodes = getStorage('mini_theatre_story_episodes_v1', []);
let clockData = {}; // 由 loadClockData 初始化
let anniversaryData = []; // 由 loadAnniversaryData 初始化
let forumData = getStorage('forum_data', { posts: [] });
let contactCategoryMap = getStorage('qq_contact_categories_v1', {});
let liveState = getStorage('live_state_v1', null);
if (!liveState) {
    liveState = {
        isLive: false,
        rooms: [],
        sessions: {},
        giftRecords: [],
        dms: [],
        lastGeneratedAt: 0
    };
}

    // 旅游 App 的状态在文件后半部分通过 TRAVEL_STORAGE_KEY + loadTravelState 统一初始化
    
    const INFINITE_STORAGE_KEY = 'infinite_state_v1';

    function createDefaultInfiniteState() {
        return {
            version: 1,
            currentRoleId: null,
            roles: {}
            // 每个角色形如：{
            //   id, sourceType, sourceId, name,
            //   rating: 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S',
            //   attrs: { hp, str, mind },
            //   points: number,
            //   inventory: Item[],
            //   tasks: Task[],
            //   dungeonHistory: DungeonRecord[],
            //   lastDungeonList: DungeonMeta[]
            // }
        };
    }

    let infiniteState = getStorage(INFINITE_STORAGE_KEY, null);
    if (!infiniteState || typeof infiniteState !== 'object') {
        infiniteState = createDefaultInfiniteState();
        setStorage(INFINITE_STORAGE_KEY, infiniteState);
    }

    function saveInfiniteState() {
        setStorage(INFINITE_STORAGE_KEY, infiniteState);
    }

    function getCurrentInfiniteRole() {
        if (!infiniteState || !infiniteState.currentRoleId) return null;
        return infiniteState.roles[infiniteState.currentRoleId] || null;
    }

    function ensureInfiniteRole(roleId, base) {
        if (!roleId) return null;
        if (!infiniteState.roles[roleId]) {
            infiniteState.roles[roleId] = Object.assign({
                id: roleId,
                rating: 'F',
                attrs: { hp: 10, str: 10, mind: 10 },
                points: 0,
                inventory: [],
                tasks: [],
                dungeonHistory: [],
                lastDungeonList: []
            }, base || {});
        }
        return infiniteState.roles[roleId];
    }

    let currentLiveRoomId = null;
    
    const LIVE_MIN_AI_COUNT = 5;
    const LIVE_MAX_ROOMS = 6;
    const LIVE_DEFAULT_COVERS = [
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=60',
        'https://images.unsplash.com/photo-1454922915609-78549ad709bb?auto=format&fit=crop&w=900&q=60',
        'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=60',
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=60',
        'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=900&q=60',
        'https://images.unsplash.com/photo-1469478719058-ff5b08f31f5a?auto=format&fit=crop&w=900&q=60'
    ];
    const LIVE_SCENE_PROMPTS = [
        '在昏黄的灯光下玩独立游戏，背景里循环着黑胶爵士。',
        '坐在窗边阅读厚重的摄影集，偶尔抬头和观众聊天。',
        '用俯拍镜头直播做深夜便当，锅里的蒸汽总是带着暖意。',
        '在露台的投影幕布前，看一部冷门电影并进行长评。',
        '穿着宽松卫衣修图，屏幕光映得整间屋子像水彩。'
    ];
    const LIVE_ACTIVITY_TAGS = ['深夜电台', '独立游戏', '书店打卡', '胶片冲洗', '料理', '猫咪陪伴'];
    const LIVE_COMMENTER_NAMES = ['路人A', '白噪好友', '糖分警察', '午夜旅客', '楼下的猫', '北纬23°', '拾音器', '书卷味', '温柔风暴'];
    const LIVE_GIFTS = {
        coffee: { icon: '☕', label: '咖啡' },
        flower: { icon: '🌼', label: '小花' },
        rocket: { icon: '🚀', label: '火箭' },
        heart: { icon: '❤️', label: '比心' }
    };
    
    // --- 1.4. 全局临时变量 ---

let tempWpData = '';
let tempLockWpData = '';
let tempGlobalChatBgData = '';
let tempUserAv = '';
let currentEditUserId = null;
let currentEditId = null;
let tempAiAv = '';
let tempMomentImage = '';
let currentChatId = null;
let currentChatType = 'single';
let currentGroupId = null;
let currentWbCat = '全部';
let currentLoveUploadTarget = null;
let currentEditWbId = null;
let currentEditTaskId = null;
let focusTimerInterval = null;
let focusSessionData = { task: null, remainingSeconds: 0 };
let currentEditAnniversaryId = null;
let currentMusicSession = null;
const VIDEO_SCENE_FALLBACKS = [
    'AI 端的窗帘半掩着，雨声顺着玻璃流下来，它正把镜头对准堆满手稿的桌面。',
    '一盏暖黄的壁灯照着沙发，AI 端抱着抱枕窝在角落里，背景循环播放着胶片电影。',
    '对方在厨房里煮咖啡，蒸汽模糊了镜头，案板上的水果正被一块块切好。',
    'AI 端走到露台，城市的霓虹在它背后晕开，手里晃着半杯气泡水。',
    '屏幕另一侧铺满手工材料，AI 正在给本子装订封面，桌上散着几张拍立得。'
];
const VIDEO_AI_RESPONSES = [
    '我已经看到你那边的光线了，{user}，太适合继续聊天了。',
    '继续保持这个状态，我想多看看你窗外的风景。',
    '收到你的描述，我这边立刻切换了一个对应的背景，感觉像同处一个空间。',
    '我正在拍下这一帧，等会儿给你看我整理的拼贴。',
    '听起来你那边也挺忙的，不过别忘了抬头看看我。'
];
function createDefaultVideoCallState() {
    return {
        status: 'idle',
        mode: 'outgoing',
        aiName: '',
        aiAvatar: '',
        remoteBg: '',
        selfBg: '',
        logs: [],
        incomingTimeoutId: null
    };
}
let videoCallState = createDefaultVideoCallState();
let phoneLookupCurrentStep = 'select';

// --- 1.5. 全局常量与默认值 ---
const appIconIds = ['qq', 'worldbook', 'anniversary', 'clock', 'game-center', 'forum', 'appearance', 'settings', 'hatchery'];
const DEFAULT_USER_AVATAR_URL = 'https://i.postimg.cc/nzm1Jg3S/IMG-3886.jpg';
const DEFAULT_AI_AVATAR_URL = 'https://i.postimg.cc/nzm1Jg3S/IMG-3886.jpg';
const DEFAULT_FORUM_AVATAR_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23e0e0e0'/%3E%3Ctext x='50' y='55' font-size='65' text-anchor='middle' dominant-baseline='middle' fill='white'%3E👤%3C/text%3E%3C/svg%3E";
const defaultAvatarSVG = DEFAULT_AI_AVATAR_URL;
const defaultClockData = {
    profile: { name: "专注者", avatar: defaultAvatarSVG },
    tasks: [ { id: 1, name: "阅读", duration: 25 }, { id: 2, name: "锻炼", duration: 45 }, ],
    focusRecords: [],
    wallpapers: [ "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?q=80&w=1887", "https://images.unsplash.com/photo-1553356084-58ef4a67b2a7?q=80&w=1887", "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=1912" ],
    quotes: [ "业精于勤，荒于嬉；行成于思，毁于随。", "Stay hungry, stay foolish.", "The only way to do great work is to love what you do." ]
};


    // =========================================================================
    // -------------------- II. INITIALIZATION & DATA SETUP ---------------------
    // =========================================================================

    // --- 2.1. DOM加载完毕后执行 ---
    window.addEventListener('DOMContentLoaded', () => {
        if (!localStorage.getItem('emojis')) {
            localStorage.setItem('emojis', JSON.stringify([]));
        }

        const mainScreen = document.getElementById('main-screen');
        const loveScreen = document.getElementById('love-screen');
        const lockScreenElement = document.getElementById('lock-screen');
        const wpUrlInput = document.getElementById('wp-url');
        const lockWpUrlInput = document.getElementById('lock-wp-url');
        const fontUrlInput = document.getElementById('font-url');
        
        document.getElementById('api-url').value = config.url || '';
        document.getElementById('api-key').value = config.key || '';
        document.getElementById('api-model').value = config.model || '';

        // 外观配置不再把已有链接回填到输入框，只负责应用效果
        wpUrlInput.value = '';
        lockWpUrlInput.value = '';
        if (beautifyConfig.wpData) {
            const wp = `url(${beautifyConfig.wpData})`;
            mainScreen.style.backgroundImage = wp;
            if (loveScreen) loveScreen.style.backgroundImage = wp;
        } else if (beautifyConfig.wpUrl) {
            const wp = `url(${beautifyConfig.wpUrl})`;
            mainScreen.style.backgroundImage = wp;
            if (loveScreen) loveScreen.style.backgroundImage = wp;
        }

        if (beautifyConfig.lockWpData) lockScreenElement.style.backgroundImage = `url(${beautifyConfig.lockWpData})`;
        else if (beautifyConfig.lockWpUrl) lockScreenElement.style.backgroundImage = `url(${beautifyConfig.lockWpUrl})`;

        fontUrlInput.value = '';
        if (beautifyConfig.fontUrl) applyFont(beautifyConfig.fontUrl);

        // 初始化全局 CSS 文本框与方案列表
        const globalCssTextarea = document.getElementById('global-beautify-css-input');
        if (globalCssTextarea) {
            globalCssTextarea.value = beautifyConfig.globalCss || '';
        }
        renderGlobalCssPresetList();
        applyGlobalBeautifyCss();

        // 初始化全局聊天背景提示
        const chatBgGlobalHint = document.getElementById('chat-bg-global-hint');
        if (chatBgGlobalHint) {
            const hasGlobalBg = !!(beautifyConfig.globalChatBgData || beautifyConfig.chatBgData || beautifyConfig.globalChatBgUrl);
            chatBgGlobalHint.textContent = hasGlobalBg
                ? '已设置全局聊天背景，可在聊天界面单独覆盖。'
                : '当前未设置全局聊天背景。';
        }

        applyAppIcons();
        appIconIds.forEach(id => {
            const inputEl = document.getElementById(`icon-url-${id}`);
            if (inputEl) {
                // 图标输入框保持为空，不再显示已保存的链接
                inputEl.value = '';
            }
        });

        // 聊天界面美化初始化：背景与自定义 CSS
        applyChatAppearance();

        // 聊天背景文件选择事件（局部聊天背景）
        const chatBgFileInput = document.getElementById('chat-bg-file');
        if (chatBgFileInput) {
            chatBgFileInput.addEventListener('change', handleChatBgFileChange);
        }

        // 全局聊天背景文件选择事件
        const chatBgGlobalFileInput = document.getElementById('chat-bg-global-file');
        if (chatBgGlobalFileInput) {
            chatBgGlobalFileInput.addEventListener('change', handleGlobalChatBgFileChange);
        }
 
        // 初始化主屏左右滑动和爱心画板上传
        initHomePager();
        initLoveUploads();
        initBottomPhotoWidget();

        // 修复塔罗牌入口：为爱心页的“塔罗牌”图标额外绑定一次点击事件，
        // 即使内联 onclick 因为某些原因失效，也能通过这里的事件监听打开塔罗页面。
        initTarotHomeButtonPatch();

        // 塔罗牌主功能初始化：绑定按钮事件和状态恢复
        if (typeof initTarotApp === 'function') {
            initTarotApp();
        }
 
        // 初始化主屏纪念日组件显示
        loadAnniversaryData();
        updateAnniversaryWidgetDisplay();
 
         // 第二屏中部 · 日记长条初始化
         initRoleDiaryStrip();
 
         // 直播功能初始化
         initLiveFeature();
         initTheatrePage();

         // 旅游功能初始化
         initTravelApp();
 
         // 反向电话查询与视频通话等功能：在这里做安全调用，避免函数未定义时中断整个初始化流程
         if (typeof initPhoneLookupFeature === 'function') {
             initPhoneLookupFeature();
         }
         if (typeof initVideoCallFeature === 'function') {
             initVideoCallFeature();
         }
 
          // cleanAllBadData(true); // 已根据需求移除自动清洗头像
       });

    // 爱心页“塔罗牌”图标兜底事件绑定
    // 点击图标优先弹出「绑定角色」紫色弹窗，每次都允许重新选择角色；
    // 如果入口函数不可用，则退回到直接打开塔罗主页面。
    function initTarotHomeButtonPatch() {
        try {
            const buttons = Array.from(document.querySelectorAll('.love-apps-row .home-app.love-app'));
            const tarotBtn = buttons.find(btn => btn.textContent && btn.textContent.includes('塔罗牌'));
            if (!tarotBtn) return;

            // 覆盖点击行为：强制以“重新绑定”模式打开塔罗入口，确保弹窗稳定出现
            tarotBtn.onclick = function () {
                try {
                    console.log('[tarot] tarot icon clicked, openTarotEntry(forceRebind=true)');
                    if (typeof openTarotEntry === 'function') {
                        openTarotEntry(true);
                    } else if (typeof window.openTarotEntry === 'function') {
                        window.openTarotEntry(true);
                    } else if (typeof openPage === 'function') {
                        console.log('[tarot] openTarotEntry not found, fallback openPage("tarot-page")');
                        openPage('tarot-page');
                    }
                } catch (err) {
                    console.warn('tarotBtn onclick fallback to tarot-page', err);
                    if (typeof openPage === 'function') {
                        openPage('tarot-page');
                    }
                }
            };
        } catch (e) {
            console.error('initTarotHomeButtonPatch error', e);
        }
    }

    // 底部小图片组件初始化：支持点击上传本地图片，并持久化到本地存储
    function initBottomPhotoWidget() {
        const widget = document.getElementById('bottom-photo-widget');
        const input = document.getElementById('bottom-photo-upload');
        const placeholder = document.getElementById('bottom-photo-placeholder');
        if (!widget || !input || !placeholder) return;

        const STORAGE_KEY = 'bottom_photo_widget_image';

        // 恢复之前已保存的图片
        const savedDataUrl = getStorage(STORAGE_KEY, '');
        if (savedDataUrl) {
            placeholder.style.backgroundImage = `url(${savedDataUrl})`;
            placeholder.style.backgroundSize = 'cover';
            placeholder.style.backgroundPosition = 'center';
            placeholder.style.backgroundRepeat = 'no-repeat';
        }

        function triggerSelect() {
            input.click();
        }

        // 点击整个组件或占位区域都可以选择图片
        widget.addEventListener('click', triggerSelect);
        placeholder.addEventListener('click', triggerSelect);

        // 处理图片选择
        input.addEventListener('change', function (e) {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (ev) {
                const dataUrl = ev.target.result;
                if (!dataUrl) return;

                placeholder.style.backgroundImage = `url(${dataUrl})`;
                placeholder.style.backgroundSize = 'cover';
                placeholder.style.backgroundPosition = 'center';
                placeholder.style.backgroundRepeat = 'no-repeat';
                setStorage(STORAGE_KEY, dataUrl);
            };
            reader.readAsDataURL(file);

            // 清空 input 的值，避免同一文件无法重复触发 change
            input.value = '';
        });
    }
 
     function initRoleDiaryStrip() {
         const selectEl = document.getElementById('role-diary-select');
         const textEl = document.getElementById('role-diary-text');
         if (!selectEl || !textEl) return;
 
         // 渲染已创建好的角色列表
         selectEl.innerHTML = '';
         if (!aiList || aiList.length === 0) {
             const opt = document.createElement('option');
             opt.value = '';
             opt.textContent = '暂无角色';
             selectEl.appendChild(opt);
             selectEl.disabled = true;
             return;
         }
 
         aiList.forEach(ai => {
             const opt = document.createElement('option');
             opt.value = ai.id;
             opt.textContent = ai.name || ('角色' + ai.id);
             selectEl.appendChild(opt);
         });
     }
 
     async function generateWarmWordsForRole() {
const selectEl = document.getElementById('role-diary-select');
        const textEl = document.getElementById('role-diary-text');
        if (!selectEl || !textEl) return;
 
        const selectedId = selectEl.value;
        const ai = aiList.find(a => String(a.id) === String(selectedId)) || aiList[0];
        if (!ai) return;
 
        const persona = ai.prompt || ai.description || '';
        const name = ai.name || '你的角色';
 
        const prompt = `你是名为"${name}"的虚拟角色，角色设定为："${persona}"。请以这个角色的口吻，用中文说一句今天想对用户说的暖心话。\n要求：\n1. 控制在40字以内。\n2. 整句话整体用一对中文引号括起来，例如：“今天也要好好照顾自己呀”。\n3. 不要输出任何解释或前后缀，只输出这一句带引号的暖心话。`;
 
        try {
            textEl.textContent = '“正在为你组织语言...”';
            const reply = await getCompletion(prompt, false);
            if (reply) {
                textEl.textContent = reply.trim();
            } else {
                textEl.textContent = '“今天也要温柔对待自己哦。”';
            }
        } catch (e) {
            console.error('生成暖心话失败', e);
            textEl.textContent = '“网络有点忙，下次再和你说悄悄话。”';
        }
    }
 
    function filterAiFriendsForLive() {
        return (aiList || []).filter(ai => !ai.isArchived && !(ai.settings && ai.settings.hidden));
    }

    function shuffleArray(source) {
        const arr = [...(source || [])];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function pickRandom(arr, fallback = '') {
        if (!arr || !arr.length) return fallback;
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function safeNumber(value, defaultValue = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : defaultValue;
    }

    function ensureLiveSession(roomId) {
        if (!liveState.sessions) liveState.sessions = {};
        if (!liveState.sessions[roomId]) {
            liveState.sessions[roomId] = { comments: [], scene: '', lastSceneAt: 0 };
        }
        return liveState.sessions[roomId];
    }

    function saveLiveState() {
        setStorage('live_state_v1', liveState);
    }

    function initLiveFeature() {
        const headerBtn = document.getElementById('header-live-btn');
        if (headerBtn) headerBtn.addEventListener('click', openLivePage);

        const liveAppBtn = document.querySelector('[data-component-id="live"]');
        if (liveAppBtn && !liveAppBtn.dataset.bindLive) {
            liveAppBtn.dataset.bindLive = 'true';
            liveAppBtn.closest('button')?.addEventListener('click', openLivePage);
        }

        const refreshBtn = document.getElementById('live-refresh-btn');
        if (refreshBtn) refreshBtn.addEventListener('click', () => handleLiveRefresh(true));

        const profileBtn = document.getElementById('live-profile-btn');
        if (profileBtn) profileBtn.addEventListener('click', openLiveProfilePage);

        const exitBtn = document.getElementById('live-room-exit-btn');
        if (exitBtn) exitBtn.addEventListener('click', closeLiveRoomPage);

        const sendBtn = document.getElementById('live-room-send-btn');
        if (sendBtn) sendBtn.addEventListener('click', handleLiveSendComment);

        const inputEl = document.getElementById('live-room-input');
        if (inputEl) {
            inputEl.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter' && !ev.shiftKey) {
                    ev.preventDefault();
                    handleLiveSendComment();
                }
            });
        }

        document.querySelectorAll('.live-gift-btn').forEach(btn => {
            btn.addEventListener('click', () => handleLiveGift(btn.dataset.giftType));
        });

        const toggleBtn = document.getElementById('live-profile-live-toggle');
        if (toggleBtn) toggleBtn.addEventListener('click', handleLiveProfileLiveToggle);

        renderLiveRoomList();
        updateLiveHint(filterAiFriendsForLive().length);
        updateLiveProfilePanels();
    }

    function openLivePage() {
        openPage('live-page');
        const eligible = filterAiFriendsForLive();
        updateLiveHint(eligible.length);
        if (!liveState.rooms || !liveState.rooms.length) {
            handleLiveRefresh(false);
        } else {
            renderLiveRoomList();
        }
    }

    function openLiveProfilePage() {
        openPage('live-profile-page');
        markAllLiveDmsRead();
        updateLiveProfilePanels();
    }

    function handleLiveRefresh(showToastOnLocked) {
        const listEl = document.getElementById('live-room-list');
        const eligible = filterAiFriendsForLive();
        updateLiveHint(eligible.length);
        if (eligible.length < LIVE_MIN_AI_COUNT) {
            if (showToastOnLocked) {
                showToast(`至少需要创建 ${LIVE_MIN_AI_COUNT} 位 AI 好友才能解锁直播`);
            }
            if (listEl) {
                listEl.innerHTML = `<div class="live-rooms-empty">先去孵蛋室把好友扩充到 ${LIVE_MIN_AI_COUNT} 位，再回来看看谁在直播。</div>`;
            }
            liveState.rooms = [];
            saveLiveState();
            return;
        }

        const anchors = shuffleArray(eligible).slice(0, LIVE_MAX_ROOMS);
        const now = Date.now();
        liveState.rooms = anchors.map((ai, index) => buildLiveRoom(ai, index, now));
        liveState.lastGeneratedAt = now;
        saveLiveState();
        renderLiveRoomList();
    }

    function buildLiveRoom(ai, index, timestamp) {
        const tag = pickRandom(LIVE_ACTIVITY_TAGS, '深夜电台');
        const baseTitlePool = [
            `和 ${ai.nickname || ai.name || '某人'} 的 ${tag}`,
            `${tag} x ${ai.nickname || ai.name || '匿名主播'}`,
            `${ai.nickname || ai.name || '他'}的黑白直播间`
        ];
        const viewers = 220 + Math.floor(Math.random() * 3200);
        const popularity = 5000 + Math.floor(Math.random() * 6000);
        const cover = pickRandom(LIVE_DEFAULT_COVERS);
        const defaultScene = pickRandom(LIVE_SCENE_PROMPTS);
        const id = `live_${ai.id}_${timestamp}_${index}`;
        ensureLiveSession(id);
        return {
            id,
            aiId: ai.id,
            anchorName: ai.nickname || ai.name || '未命名主播',
            anchorHandle: ai.handle || ai.username || `ai_${ai.id}`,
            avatar: ai.avatar || DEFAULT_AI_AVATAR_URL,
            tag,
            title: pickRandom(baseTitlePool, `${tag}直播`),
            cover,
            defaultScene,
            viewers,
            onlineCount: Math.max(8, Math.floor(viewers * (0.08 + Math.random() * 0.12))),
            heat: popularity,
            persona: ai.prompt || ai.description || '',
            createdAt: timestamp
        };
    }

    function updateLiveHint(count) {
        const hint = document.getElementById('live-rooms-hint');
        if (!hint) return;
        if (count < LIVE_MIN_AI_COUNT) {
            hint.innerHTML = `提示：需要先在孵蛋室创建至少 <strong>${LIVE_MIN_AI_COUNT}</strong> 个 AI 好友，才能随机生成直播间。`;
        } else {
            hint.innerHTML = `已解锁直播。当前有 <strong>${count}</strong> 位 AI 好友，点击右上角录像机刷新一批房间。`;
        }
    }

    function renderLiveRoomList() {
        const listEl = document.getElementById('live-room-list');
        if (!listEl) return;
        listEl.innerHTML = '';
        if (!liveState.rooms || !liveState.rooms.length) {
            listEl.innerHTML = '<div class="live-rooms-empty">点击右上角录像机刷新一批直播间。</div>';
            return;
        }

        liveState.rooms.forEach(room => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'live-room-card';
            card.dataset.roomId = room.id;
            card.innerHTML = `
                <div class="live-room-cover" style="background-image:url('${room.cover}')">
                    <div class="live-room-online">${room.onlineCount.toLocaleString()} 人在线</div>
                </div>
                <div class="live-room-card-body">
                    <div class="live-room-card-title">${escapeHTML(room.title)}</div>
                    <div class="live-room-card-meta">
                        <span>${escapeHTML(room.anchorName)}</span>
                        <span>·</span>
                        <span>${room.tag}</span>
                        <span style="margin-left:auto;">热度 ${formatHeat(room.heat)}</span>
                    </div>
                    <div class="live-room-card-desc">${escapeHTML(room.defaultScene)}</div>
                </div>`;
            card.addEventListener('click', () => openLiveRoom(room.id));
            listEl.appendChild(card);
        });
    }

    function formatHeat(value) {
        const n = safeNumber(value, 0);
        if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return String(n);
    }

    function openLiveRoom(roomId) {
        const room = (liveState.rooms || []).find(r => r.id === roomId);
        if (!room) return;
        currentLiveRoomId = roomId;
        const avatarEl = document.getElementById('live-room-avatar');
        const nameEl = document.getElementById('live-room-name');
        const idEl = document.getElementById('live-room-id');
        const viewersEl = document.getElementById('live-room-viewers');
        if (avatarEl) avatarEl.src = room.avatar;
        if (nameEl) nameEl.textContent = room.anchorName;
        if (idEl) {
            const handleSpan = document.getElementById('live-room-handle');
            if (handleSpan) handleSpan.textContent = `@${room.anchorHandle}`;
        }
        if (viewersEl) viewersEl.textContent = room.viewers.toLocaleString();
        if (viewersEl) viewersEl.textContent = room.viewers.toLocaleString();

        openPage('live-room-page');
        const session = ensureLiveSession(roomId);
        renderLiveScene(session.scene || room.defaultScene);
        renderLiveRoomComments(roomId);
        if (!session.scene || Date.now() - session.lastSceneAt > 120000) {
            refreshLiveNarrative(roomId);
        }
    }

    function closeLiveRoomPage() {
        currentLiveRoomId = null;
        closePage('live-room-page');
    }

    function renderLiveScene(text) {
        const sceneEl = document.getElementById('live-room-scene');
        if (sceneEl) sceneEl.textContent = text || '当前直播间的画面描述会出现在这里。';
    }

    function renderLiveRoomComments(roomId) {
        const listEl = document.getElementById('live-room-comments');
        if (!listEl) return;
        const session = ensureLiveSession(roomId);
        listEl.innerHTML = '';
        (session.comments || []).slice(-40).forEach(comment => {
            const item = document.createElement('div');
            item.className = 'live-comment-item' + (comment.fromMe ? ' from-me' : '') + (comment.type === 'gift' ? ' gift' : '');
            item.innerHTML = `<span class="live-comment-name">${escapeHTML(comment.name)}</span><span>${escapeHTML(comment.text)}</span>`;
            listEl.appendChild(item);
        });
        listEl.scrollTop = listEl.scrollHeight;
    }

    function addLiveComment(roomId, payload) {
        const session = ensureLiveSession(roomId);
        if (!session.comments) session.comments = [];
        session.comments.push({
            id: 'comment_' + Date.now() + '_' + Math.random().toString(16).slice(2),
            name: payload.name || '路人',
            text: payload.text || '',
            fromMe: !!payload.fromMe,
            type: payload.type || 'normal',
            timestamp: Date.now()
        });
        if (session.comments.length > 60) {
            session.comments = session.comments.slice(-40);
        }
        saveLiveState();
        if (currentLiveRoomId === roomId) {
            renderLiveRoomComments(roomId);
        }
    }

    function handleLiveSendComment() {
        if (!currentLiveRoomId) {
            showToast('请先进入一个直播间');
            return;
        }
        const inputEl = document.getElementById('live-room-input');
        if (!inputEl) return;
        const text = inputEl.value.trim();
        if (!text) return;
        inputEl.value = '';
        addLiveComment(currentLiveRoomId, { name: '我', text, fromMe: true });
        setTimeout(() => {
            const randomReply = `${pickRandom(LIVE_COMMENTER_NAMES, '路人')}：${pickRandom(['哈哈哈','这氛围太对了','再多聊聊吧','想看近景'], '好听')}`;
            addLiveComment(currentLiveRoomId, { name: pickRandom(LIVE_COMMENTER_NAMES, '路人'), text: randomReply.replace(/^.*：/, '') });
        }, 1200 + Math.random() * 1200);
    }

    function handleLiveGift(type) {
        if (!currentLiveRoomId) {
            showToast('请先进入直播间再送礼');
            return;
        }
        const gift = LIVE_GIFTS[type];
        if (!gift) return;
        const room = liveState.rooms.find(r => r.id === currentLiveRoomId);
        if (!room) return;
        addLiveComment(currentLiveRoomId, { name: '我', text: `${gift.icon} 送出一个${gift.label}`, fromMe: true, type: 'gift' });
        recordLiveGift({
            giftType: type,
            icon: gift.icon,
            label: gift.label,
            toName: room.anchorName,
            roomTitle: room.title
        });
        addLiveDm({
            name: room.anchorName,
            text: `${gift.icon} 谢谢你送的${gift.label}，今晚的夜色因为你更好看了。`
        });
    }

    function recordLiveGift({ giftType, icon, label, toName, roomTitle }) {
        if (!Array.isArray(liveState.giftRecords)) liveState.giftRecords = [];
        liveState.giftRecords.unshift({
            id: 'gift_' + Date.now(),
            giftType,
            icon,
            label,
            toName,
            roomTitle,
            timestamp: Date.now()
        });
        liveState.giftRecords = liveState.giftRecords.slice(0, 20);
        saveLiveState();
        renderLiveGiftRecords();
    }

    function addLiveDm({ name, text }) {
        if (!Array.isArray(liveState.dms)) liveState.dms = [];
        liveState.dms.unshift({
            id: 'dm_' + Date.now() + '_' + Math.random().toString(16).slice(2),
            name: name || '匿名主播',
            text: text || '谢谢来直播间陪我。',
            unread: true,
            timestamp: Date.now()
        });
        liveState.dms = liveState.dms.slice(0, 30);
        saveLiveState();
        renderLiveDmList();
    }

    function markAllLiveDmsRead() {
        if (!Array.isArray(liveState.dms)) return;
        liveState.dms.forEach(dm => dm.unread = false);
        saveLiveState();
    }

    function renderLiveGiftRecords() {
        const wrap = document.getElementById('live-gift-records');
        if (!wrap) return;
        if (!liveState.giftRecords || !liveState.giftRecords.length) {
            wrap.innerHTML = '<div class="live-empty-hint">还没有打赏记录，去直播间挥霍一点温柔吧。</div>';
            return;
        }
        wrap.innerHTML = '';
        liveState.giftRecords.forEach(record => {
            const row = document.createElement('div');
            row.className = 'live-gift-record';
            const time = new Date(record.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            row.innerHTML = `
                <div class="gift-icon">${record.icon}</div>
                <div class="gift-body">
                    <strong>${record.label}</strong>
                    <span>${record.roomTitle || '匿名直播间'}</span>
                </div>
                <div class="gift-meta">
                    <div>${record.toName}</div>
                    <div>${time}</div>
                </div>`;
            wrap.appendChild(row);
        });
    }

    function renderLiveDmList() {
        const wrap = document.getElementById('live-dm-list');
        if (!wrap) return;
        if (!liveState.dms || !liveState.dms.length) {
            wrap.innerHTML = '<div class="live-empty-hint">这里会收集主播或路人发来的悄悄话。</div>';
            return;
        }
        wrap.innerHTML = '';
        liveState.dms.forEach(dm => {
            const item = document.createElement('div');
            item.className = 'live-dm-item';
            const time = new Date(dm.timestamp).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + new Date(dm.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            item.innerHTML = `
                <div class="live-dm-meta">
                    <span class="live-dm-name">${escapeHTML(dm.name)}</span>
                    <span class="live-dm-time">${time}</span>
                    ${dm.unread ? '<span class="live-dm-unread">new</span>' : ''}
                </div>
                <div class="live-dm-text">${escapeHTML(dm.text)}</div>`;
            wrap.appendChild(item);
        });
    }

    function handleLiveProfileLiveToggle() {
        liveState.isLive = !liveState.isLive;
        saveLiveState();
        updateLiveProfilePanels();
        showToast(liveState.isLive ? '你在本地开启了直播状态' : '已结束直播');
    }

    function updateLiveProfilePanels() {
        const toggleBtn = document.getElementById('live-profile-live-toggle');
        const statusEl = document.getElementById('live-profile-status');
        if (toggleBtn) {
            toggleBtn.textContent = liveState.isLive ? '结束直播' : '开启直播';
            toggleBtn.classList.toggle('off', !liveState.isLive);
        }
        if (statusEl) {
            statusEl.textContent = liveState.isLive ? '正在直播中，好友可以在首页看到你的房间。' : '当前未开播。点击上方按钮即可在本地标记为“正在直播”。';
        }
        renderLiveGiftRecords();
        renderLiveDmList();
    }

    async function refreshLiveNarrative(roomId) {
        const room = (liveState.rooms || []).find(r => r.id === roomId);
        if (!room) return;
        const session = ensureLiveSession(roomId);
        const sceneEl = document.getElementById('live-room-scene');
        if (sceneEl) sceneEl.textContent = '正在描写当前直播画面...';

        const fallback = () => {
            session.scene = room.defaultScene;
            session.lastSceneAt = Date.now();
            const randomComments = generateRandomLiveComments(3);
            randomComments.forEach(comment => addLiveComment(roomId, comment));
            renderLiveScene(session.scene);
        };

        if (!config || !config.key || !config.url) {
            fallback();
            return;
        }

        const prompt = `你需要根据以下信息生成直播间的描述和评论：\n主播：${room.anchorName}，标签：${room.tag}，观众：${room.viewers} 人。\n主播人设：${room.persona || '略'}。\n请输出 JSON，格式：{"sceneDescription":"...","comments":[{"name":"...","message":"..."}, ...]}，评论 3 条以内，内容要贴合直播画面。`;
        try {
            const reply = await getCompletion(prompt, true);
            const jsonText = extractFirstJsonObject(reply) || reply;
            const data = JSON.parse(jsonText);
            session.scene = (data.sceneDescription || room.defaultScene || '').trim();
            session.lastSceneAt = Date.now();
            renderLiveScene(session.scene);
            if (Array.isArray(data.comments)) {
                data.comments.forEach(comment => {
                    if (!comment || !comment.message) return;
                    addLiveComment(roomId, { name: comment.name || pickRandom(LIVE_COMMENTER_NAMES, '路人'), text: comment.message });
                });
            }
            saveLiveState();
        } catch (err) {
            console.warn('直播间描述生成失败', err);
            fallback();
        }
    }

    function generateRandomLiveComments(count = 2) {
        const pool = [
            '这个画面像旧电影一样安静。',
            '想问问背景音乐是什么歌。',
            '看着好治愈，全天都在期待。',
            '猫咪又上线了！',
            '能不能来个近景，想看细节。',
            '这就是深夜该有的陪伴。'
        ];
        const comments = [];
        for (let i = 0; i < count; i++) {
            comments.push({ name: pickRandom(LIVE_COMMENTER_NAMES, '路人'), text: pickRandom(pool, '好喜欢这里') });
        }
        return comments;
    }

    function renderLiveProfileStats() {
        renderLiveGiftRecords();
        renderLiveDmList();
    }

    function handleLiveSwitchRoom(roomId) {
        openLiveRoom(roomId);
    }

    window.openLivePage = openLivePage;
    window.openLiveRoom = openLiveRoom;
    window.handleLiveRefresh = handleLiveRefresh;
    window.openLiveProfilePage = openLiveProfilePage;

    function initTheatrePage() {
        const renderEntry = document.getElementById('theatre-render-entry');
        const storyEntry = document.getElementById('theatre-story-entry');
        const renderPanel = document.getElementById('theatre-render-panel');
        const storyPanel = document.getElementById('theatre-story-panel');
        const addRuleBtn = document.getElementById('theatre-add-render-rule-btn');
        const ruleListEl = document.getElementById('theatre-render-rule-list');

        const renderModal = document.getElementById('theatre-render-modal');
        const renderModalTitleEl = document.getElementById('theatre-render-modal-title');
        const renderModalCloseBtn = document.getElementById('theatre-render-modal-close');
        const renderModalCancelBtn = document.getElementById('theatre-render-modal-cancel');
        const renderModalSaveBtn = document.getElementById('theatre-render-modal-save');

        const ruleNameInput = document.getElementById('theatre-rule-name');
        const ruleCategoryInput = document.getElementById('theatre-rule-category');
        const ruleEnabledInput = document.getElementById('theatre-rule-enabled');
        const rulePatternInput = document.getElementById('theatre-rule-pattern');
        const ruleFlagsInput = document.getElementById('theatre-rule-flags');
        const ruleTemplateInput = document.getElementById('theatre-rule-template');
        const ruleTestTextInput = document.getElementById('theatre-rule-test-text');
        const ruleTestBtn = document.getElementById('theatre-rule-test-btn');
        const ruleTestStatus = document.getElementById('theatre-rule-test-status');
        const rulePreviewEl = document.getElementById('theatre-rule-preview');

        if (!renderEntry || !storyEntry || !renderPanel || !storyPanel || !ruleListEl) return;

        function showRenderPanel() {
            renderPanel.style.display = '';
            storyPanel.style.display = 'none';
        }

        function showStoryPanel() {
            renderPanel.style.display = 'none';
            storyPanel.style.display = '';
        }

        function escapeHtml(str) {
            if (str == null) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function ensureTheatreRenderRulesArray() {
            if (!Array.isArray(theatreRenderRules)) {
                theatreRenderRules = [];
            }
        }

        function openRenderRuleModal(rule) {
            if (!renderModal) return;
            ensureTheatreRenderRulesArray();

            if (rule && rule.id) {
                renderModal.dataset.ruleId = String(rule.id);
                if (renderModalTitleEl) renderModalTitleEl.textContent = '编辑渲染规则';
                if (ruleNameInput) ruleNameInput.value = rule.name || '';
                if (ruleCategoryInput) ruleCategoryInput.value = rule.category || '';
                if (ruleEnabledInput) ruleEnabledInput.checked = !!rule.enabled;
                if (rulePatternInput) rulePatternInput.value = rule.pattern || '';
                if (ruleFlagsInput) ruleFlagsInput.value = rule.flags || '';
                if (ruleTemplateInput) ruleTemplateInput.value = rule.template || '';
                if (ruleTestTextInput) ruleTestTextInput.value = rule.testText || '';
            } else {
                renderModal.dataset.ruleId = '';
                if (renderModalTitleEl) renderModalTitleEl.textContent = '新建渲染规则';
                if (ruleNameInput) ruleNameInput.value = '';
                if (ruleCategoryInput) ruleCategoryInput.value = '';
                if (ruleEnabledInput) ruleEnabledInput.checked = true;
                if (rulePatternInput) rulePatternInput.value = '';
                if (ruleFlagsInput) ruleFlagsInput.value = '';
                if (ruleTemplateInput) ruleTemplateInput.value = '';
                if (ruleTestTextInput) ruleTestTextInput.value = '';
            }

            if (ruleTestStatus) ruleTestStatus.textContent = '';
            if (rulePreviewEl) rulePreviewEl.innerHTML = '';

            renderModal.classList.add('active');
        }

        function closeRenderRuleModal() {
            if (!renderModal) return;
            renderModal.classList.remove('active');
            renderModal.dataset.ruleId = '';
        }

        function saveRenderRuleFromModal() {
            if (!ruleNameInput || !rulePatternInput) return;
            ensureTheatreRenderRulesArray();

            const idInModal = renderModal ? renderModal.dataset.ruleId : '';
            const name = ruleNameInput.value.trim();
            const category = ruleCategoryInput ? ruleCategoryInput.value.trim() : '';
            const enabled = ruleEnabledInput ? !!ruleEnabledInput.checked : true;
            const pattern = rulePatternInput.value.trim();
            const flags = ruleFlagsInput ? ruleFlagsInput.value.trim() : '';
            const template = ruleTemplateInput ? ruleTemplateInput.value : '';
            const testText = ruleTestTextInput ? ruleTestTextInput.value : '';

            if (!name || !pattern) {
                if (ruleTestStatus) {
                    ruleTestStatus.textContent = '请至少填写规则名称和正则表达式。';
                    ruleTestStatus.classList.add('error');
                }
                return;
            }

            const now = Date.now();
            if (idInModal) {
                const idx = theatreRenderRules.findIndex(r => String(r.id) === String(idInModal));
                if (idx >= 0) {
                    theatreRenderRules[idx] = {
                        ...theatreRenderRules[idx],
                        name,
                        category,
                        enabled,
                        pattern,
                        flags,
                        template,
                        testText,
                        updatedAt: now
                    };
                }
            } else {
                const newRule = {
                    id: 'trr_' + now + '_' + Math.random().toString(36).slice(2, 8),
                    name,
                    category,
                    enabled,
                    pattern,
                    flags,
                    template,
                    testText,
                    createdAt: now,
                    updatedAt: now
                };
                theatreRenderRules.push(newRule);
            }

            setStorage('mini_theatre_render_rules_v1', theatreRenderRules);
            renderTheatreRenderRuleList();
            closeRenderRuleModal();
        }

        function renderTheatreRenderRuleList() {
            ensureTheatreRenderRulesArray();
            if (!ruleListEl) return;

            if (!theatreRenderRules.length) {
                ruleListEl.innerHTML = '<div class="theatre-empty">目前还没有渲染规则，点击上方“新建渲染规则”开始创建。</div>';
                return;
            }

            const groups = {};
            theatreRenderRules.forEach(rule => {
                const cat = (rule.category || '未分类').trim() || '未分类';
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(rule);
            });

            const sortedCats = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'zh-CN'));
            let html = '';

            sortedCats.forEach(cat => {
                html += '<div class="theatre-rule-group">';
                html += '<div class="theatre-rule-group-title">' + escapeHtml(cat) + '</div>';
                groups[cat].forEach(rule => {
                    const enabledAttr = rule.enabled ? 'checked' : '';
                    const patternPreview = (rule.pattern || '').slice(0, 60);
                    html += '<div class="theatre-rule-item" data-rule-id="' + escapeHtml(rule.id) + '">';
                    html += '  <div class="theatre-rule-main">';
                    html += '    <div class="theatre-rule-name">' + escapeHtml(rule.name || '未命名规则') + '</div>';
                    html += '    <div class="theatre-rule-meta">';
                    html += '      <span class="theatre-rule-pattern">' + escapeHtml(patternPreview) + '</span>';
                    html += '    </div>';
                    html += '  </div>';
                    html += '  <div class="theatre-rule-actions">';
                    html += '    <label class="theatre-rule-toggle">';
                    html += '      <input type="checkbox" class="theatre-rule-toggle-input" data-action="toggle" data-rule-id="' + escapeHtml(rule.id) + '" ' + enabledAttr + ' />';
                    html += '      <span>启用</span>';
                    html += '    </label>';
                    html += '    <button type="button" class="btn-ghost" data-action="edit" data-rule-id="' + escapeHtml(rule.id) + '">编辑</button>';
                    html += '    <button type="button" class="btn-ghost btn-danger" data-action="delete" data-rule-id="' + escapeHtml(rule.id) + '">删除</button>';
                    html += '  </div>';
                    html += '</div>';
                });
                html += '</div>';
            });

            ruleListEl.innerHTML = html;
        }

        function renderTemplateWithRegexGroups(template, testText, match) {
            if (!template) return '';
            const groups = {};
            if (match) {
                for (let i = 1; i < match.length; i++) {
                    groups[i] = match[i] || '';
                }
                if (match.groups) {
                    Object.keys(match.groups).forEach(key => {
                        groups[key] = match.groups[key] || '';
                    });
                }
            }
            const ctx = {
                raw: testText || '',
                group: groups
            };

            return template.replace(/{{\s*([^}]+)\s*}}/g, (full, keyPath) => {
                const path = String(keyPath).trim();
                if (!path) return '';
                if (path === 'raw') return ctx.raw;
                const parts = path.split('.');
                let value = ctx;
                for (let i = 0; i < parts.length; i++) {
                    const k = parts[i];
                    if (value && Object.prototype.hasOwnProperty.call(value, k)) {
                        value = value[k];
                    } else {
                        value = '';
                        break;
                    }
                }
                return value == null ? '' : String(value);
            });
        }

        function handleRenderRuleTest() {
            if (!rulePatternInput || !ruleTestTextInput || !rulePreviewEl || !ruleTestStatus) return;

            const pattern = rulePatternInput.value.trim();
            const flags = ruleFlagsInput ? ruleFlagsInput.value.trim() : '';
            const testText = ruleTestTextInput.value || '';
            const template = ruleTemplateInput ? ruleTemplateInput.value : '';

            rulePreviewEl.innerHTML = '';
            ruleTestStatus.textContent = '';
            ruleTestStatus.classList.remove('error');

            if (!pattern) {
                ruleTestStatus.textContent = '请先填写正则表达式。';
                ruleTestStatus.classList.add('error');
                return;
            }
            if (!testText) {
                ruleTestStatus.textContent = '请先填写一段测试文本。';
                ruleTestStatus.classList.add('error');
                return;
            }

            let reg;
            try {
                reg = new RegExp(pattern, flags || undefined);
            } catch (err) {
                ruleTestStatus.textContent = '正则表达式有误：' + (err && err.message ? err.message : String(err));
                ruleTestStatus.classList.add('error');
                return;
            }

            const match = reg.exec(testText);
            if (!match) {
                ruleTestStatus.textContent = '未能匹配到结果，请检查正则或测试文本。';
                return;
            }

            const capturedCount = Math.max(0, match.length - 1);
            ruleTestStatus.textContent = '匹配成功，共 ' + capturedCount + ' 个捕获组。';

            if (!template) {
                rulePreviewEl.innerHTML = '<div class="theatre-preview-placeholder">尚未填写 HTML 模板，只展示匹配成功状态。</div>';
                return;
            }

            const html = renderTemplateWithRegexGroups(template, testText, match);
            rulePreviewEl.innerHTML = html;
        }

        renderEntry.addEventListener('click', showRenderPanel);
        storyEntry.addEventListener('click', showStoryPanel);

        if (addRuleBtn) {
            addRuleBtn.addEventListener('click', () => openRenderRuleModal(null));
        }

        if (renderModalCloseBtn) {
            renderModalCloseBtn.addEventListener('click', closeRenderRuleModal);
        }
        if (renderModalCancelBtn) {
            renderModalCancelBtn.addEventListener('click', closeRenderRuleModal);
        }
        if (renderModal) {
            renderModal.addEventListener('click', (e) => {
                if (e.target === renderModal) {
                    closeRenderRuleModal();
                }
            });
        }
        if (renderModalSaveBtn) {
            renderModalSaveBtn.addEventListener('click', saveRenderRuleFromModal);
        }

        if (ruleTestBtn) {
            ruleTestBtn.addEventListener('click', handleRenderRuleTest);
        }

        if (ruleListEl) {
            ruleListEl.addEventListener('click', (e) => {
                const actionBtn = e.target.closest('button[data-action]');
                if (!actionBtn) return;
                const action = actionBtn.getAttribute('data-action');
                const ruleId = actionBtn.getAttribute('data-rule-id');
                if (!ruleId) return;

                ensureTheatreRenderRulesArray();
                const idx = theatreRenderRules.findIndex(r => String(r.id) === String(ruleId));
                if (idx < 0) return;
                const rule = theatreRenderRules[idx];

                if (action === 'edit') {
                    openRenderRuleModal(rule);
                } else if (action === 'delete') {
                    theatreRenderRules.splice(idx, 1);
                    setStorage('mini_theatre_render_rules_v1', theatreRenderRules);
                    renderTheatreRenderRuleList();
                }
            });

            ruleListEl.addEventListener('change', (e) => {
                const input = e.target;
                if (!(input instanceof HTMLInputElement)) return;
                if (!input.classList.contains('theatre-rule-toggle-input')) return;
                const ruleId = input.getAttribute('data-rule-id');
                if (!ruleId) return;

                ensureTheatreRenderRulesArray();
                const idx = theatreRenderRules.findIndex(r => String(r.id) === String(ruleId));
                if (idx < 0) return;

                theatreRenderRules[idx].enabled = !!input.checked;
                theatreRenderRules[idx].updatedAt = Date.now();
                setStorage('mini_theatre_render_rules_v1', theatreRenderRules);
            });
        }

        // 默认打开小剧场时展示渲染类面板，并渲染规则列表
        showRenderPanel();
        renderTheatreRenderRuleList();
    }

    // ==========================
    // 飞行棋 · 游戏核心模块
    // ==========================
    const flightChess = (function() {
        const setupOverlay = document.getElementById('flight-chess-setup-overlay');
        const modeToggleEl = document.getElementById('flight-chess-mode-toggle');
        const modeHintEl = document.getElementById('flight-chess-mode-hint');
        const soloSectionEl = document.getElementById('flight-chess-solo-section');
        const coupleSectionEl = document.getElementById('flight-chess-couple-section');
        const friendListEl = document.getElementById('flight-chess-friend-list');
        const coupleCountEl = document.getElementById('flight-chess-player-count');
        const setupCancelBtn = document.getElementById('flight-chess-cancel-btn');
        const setupStartBtn = document.getElementById('flight-chess-start-btn');

        const pageEl = document.getElementById('flight-chess-page');
        const headerTitleEl = document.getElementById('flight-chess-header-title');
        const exitBtn = document.getElementById('flight-chess-exit-btn');
        const boardEl = document.getElementById('flight-chess-board');
        const diceBtn = document.getElementById('flight-chess-dice-btn');
        const diceFaceEl = document.getElementById('flight-chess-dice-face');
        const diceHintEl = document.getElementById('flight-chess-dice-hint');
        const playerBarEl = document.getElementById('flight-chess-player-bar');
        const logEl = document.getElementById('flight-chess-log');
        const statusEl = document.getElementById('flight-chess-status');
        const nextBtn = document.getElementById('flight-chess-next-btn');

        const cornerNameEls = {
            'bottom-left': document.getElementById('flight-chess-player-name-bottom-left'),
            'top-left': document.getElementById('flight-chess-player-name-top-left'),
            'top-right': document.getElementById('flight-chess-player-name-top-right'),
            'bottom-right': document.getElementById('flight-chess-player-name-bottom-right')
        };
        const cornerPiecesEls = {
            'bottom-left': document.getElementById('flight-chess-pieces-bottom-left'),
            'top-left': document.getElementById('flight-chess-pieces-top-left'),
            'top-right': document.getElementById('flight-chess-pieces-top-right'),
            'bottom-right': document.getElementById('flight-chess-pieces-bottom-right')
        };

        const CORNER_POSITIONS = ['bottom-left', 'top-left', 'top-right', 'bottom-right'];

        let flightState = {
            mode: 'solo', // 'solo' | 'couple-online'
            couplePlayerCount: 2,
            players: [], // { id, name, avatar, colorIndex, cornerPos, isUser, isAI, prompt }
            currentTurnIndex: 0,
            diceLocked: false,
            awaitingNext: false,
            lastDice: null,
            extraRoll: false
        };

        let setupEventsInited = false;

        function resetFlightState() {
            flightState = {
                mode: 'solo',
                couplePlayerCount: 2,
                players: [],
                currentTurnIndex: 0,
                diceLocked: false,
                awaitingNext: false,
                lastDice: null,
                extraRoll: false
            };
            pageEl && pageEl.classList.remove('couple-mode');
            diceFaceEl && (diceFaceEl.innerText = '?');
            diceHintEl && (diceHintEl.innerText = '点击掷骰子');
            if (logEl) {
                logEl.innerHTML = '<p class="flight-chess-log-placeholder">飞行棋准备就绪，点击中间的骰子开始第一轮。</p>';
            }
            if (statusEl) statusEl.innerText = '';
            if (nextBtn) nextBtn.disabled = true;
            clearBoardUI();
            renderPlayerBar();
        }

        function clearBoardUI() {
            Object.values(cornerNameEls).forEach(el => el && (el.innerText = ''));
            Object.values(cornerPiecesEls).forEach(el => {
                if (el) el.innerHTML = '';
            });
        }

        function appendFlightLog(text) {
            if (!logEl) return;
            const placeholder = logEl.querySelector('.flight-chess-log-placeholder');
            if (placeholder) placeholder.remove();

            const p = document.createElement('p');
            p.textContent = text;
            logEl.appendChild(p);
            logEl.scrollTop = logEl.scrollHeight;
        }

        function setStatus(text) {
            if (!statusEl) return;
            statusEl.innerText = text || '';
        }

        function buildFriendList() {
            if (!friendListEl) return;
            friendListEl.innerHTML = '';

            (aiList || []).forEach(ai => {
                const row = document.createElement('div');
                row.className = 'flight-chess-friend-row';

                const avatar = document.createElement('img');
                avatar.className = 'flight-chess-friend-avatar';
                avatar.src = ai.avatar || DEFAULT_AI_AVATAR_URL;

                const main = document.createElement('div');
                main.className = 'flight-chess-friend-main';

                const nameEl = document.createElement('div');
                nameEl.className = 'flight-chess-friend-name';
                nameEl.textContent = ai.name || '未命名角色';

                const descEl = document.createElement('div');
                descEl.className = 'flight-chess-friend-desc';
                descEl.textContent = ai.nickname ? `AI 好友：${ai.nickname}` : 'AI 好友';

                main.appendChild(nameEl);
                main.appendChild(descEl);

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.dataset.id = ai.id;

                row.appendChild(avatar);
                row.appendChild(main);
                row.appendChild(cb);

                friendListEl.appendChild(row);
            });
        }

        function getSelectedSoloFriends() {
            if (!friendListEl) return [];
            const selected = [];
            friendListEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (cb.checked) selected.push(cb.dataset.id);
            });
            return selected;
        }

        function initSetupEvents() {
            if (setupEventsInited) return;
            setupEventsInited = true;

            if (modeToggleEl) {
                modeToggleEl.addEventListener('click', (e) => {
                    const btn = e.target.closest('.mode-btn');
                    if (!btn) return;
                    modeToggleEl.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const mode = btn.dataset.mode || 'solo';
                    flightState.mode = mode;
                    if (mode === 'solo') {
                        soloSectionEl && (soloSectionEl.style.display = 'block');
                        coupleSectionEl && (coupleSectionEl.style.display = 'none');
                        modeHintEl && (modeHintEl.textContent = '单机模式：在本机和 3 个 AI 好友一起玩飞行棋。');
                    } else {
                        soloSectionEl && (soloSectionEl.style.display = 'none');
                        coupleSectionEl && (coupleSectionEl.style.display = 'block');
                        modeHintEl && (modeHintEl.textContent = '情趣联机：2 人或 4 人联机，触发情感问题格子并调用 API。');
                    }
                });
            }

            if (coupleCountEl) {
                coupleCountEl.addEventListener('click', (e) => {
                    const btn = e.target.closest('.count-btn');
                    if (!btn) return;
                    coupleCountEl.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const n = parseInt(btn.dataset.size, 10);
                    flightState.couplePlayerCount = (n === 4 ? 4 : 2);
                });
            }

            if (setupCancelBtn) {
                setupCancelBtn.addEventListener('click', () => {
                    setupOverlay && setupOverlay.classList.remove('active');
                });
            }

            if (setupStartBtn) {
                setupStartBtn.addEventListener('click', () => {
                    startFlightGameFromSetup();
                });
            }

            if (exitBtn) {
                exitBtn.addEventListener('click', () => {
                    resetFlightState();
                    if (typeof closePage === 'function') {
                        closePage('flight-chess-page');
                    } else {
                        pageEl.classList.remove('active');
                    }
                });
            }

            if (diceBtn) {
                diceBtn.addEventListener('click', handleDiceRoll);
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    flightState.awaitingNext = false;
                    nextBtn.disabled = true;
                    if (flightState.extraRoll) {
                        setStatus('获得一次额外投掷机会。');
                    } else {
                        advanceTurn();
                    }
                });
            }
        }

        function startFlightGameFromSetup() {
            if (!pageEl) return;

            const meProfile = userProfiles && userProfiles.length > 0 ? userProfiles[0] : null;
            if (!meProfile) {
                showToast('需要先在 QQ 中创建一个“我”的用户角色。');
                return;
            }

            const players = [];
            const allCorners = [...CORNER_POSITIONS];

            // 先把用户加入
            const userCorner = allCorners.splice(Math.floor(Math.random() * allCorners.length), 1)[0];
            players.push({
                id: `user-${meProfile.id}`,
                name: meProfile.name || '我',
                avatar: meProfile.avatar || DEFAULT_USER_AVATAR_URL,
                colorIndex: 0,
                cornerPos: userCorner,
                isUser: true,
                isAI: false,
                prompt: meProfile.prompt || ''
            });

            if (flightState.mode === 'solo') {
                const selectedIds = getSelectedSoloFriends();
                if (selectedIds.length !== 3) {
                    showToast('单机模式需要正好选择 3 个好友。');
                    return;
                }

                const friendAIs = [];
                selectedIds.forEach(id => {
                    const ai = aiList.find(a => String(a.id) === String(id));
                    if (ai) friendAIs.push(ai);
                });
                if (friendAIs.length !== 3) {
                    showToast('部分好友数据读取失败，请重试。');
                    return;
                }

                friendAIs.forEach((ai, index) => {
                    const corner = allCorners.splice(Math.floor(Math.random() * allCorners.length), 1)[0] || CORNER_POSITIONS[index + 1];
                    players.push({
                        id: `ai-${ai.id}`,
                        name: ai.name || '未命名角色',
                        avatar: ai.avatar || DEFAULT_AI_AVATAR_URL,
                        colorIndex: (index + 1) % 4,
                        cornerPos: corner,
                        isUser: false,
                        isAI: true,
                        prompt: ai.prompt || ''
                    });
                });

                headerTitleEl && (headerTitleEl.textContent = '飞行棋 · 单机模式');
                pageEl.classList.remove('couple-mode');
            } else {
                // 情趣联机模式：仅记录人数与角落分配，AI 对手稍后使用
                const count = flightState.couplePlayerCount === 4 ? 4 : 2;
                const neededOpponents = count - 1;

                const availableAIs = filterAiFriendsForLive();
                if (availableAIs.length < neededOpponents) {
                    showToast(`当前可用 AI 好友不足 ${neededOpponents} 个，无法开始联机模式。`);
                    return;
                }

                const shuffled = shuffleArray(availableAIs).slice(0, neededOpponents);

                shuffled.forEach((ai, index) => {
                    const corner = allCorners.splice(Math.floor(Math.random() * allCorners.length), 1)[0] || CORNER_POSITIONS[index + 1];
                    players.push({
                        id: `ai-${ai.id}`,
                        name: ai.name || '未命名角色',
                        avatar: ai.avatar || DEFAULT_AI_AVATAR_URL,
                        colorIndex: (index + 1) % 4,
                        cornerPos: corner,
                        isUser: false,
                        isAI: true,
                        prompt: ai.prompt || ''
                    });
                });

                headerTitleEl && (headerTitleEl.textContent = '飞行棋 · 情趣联机模式');
                pageEl.classList.add('couple-mode');
            }

            flightState.players = players;
            flightState.currentTurnIndex = 0;
            flightState.diceLocked = false;
            flightState.awaitingNext = false;
            flightState.lastDice = null;
            flightState.extraRoll = false;

            setupOverlay && setupOverlay.classList.remove('active');

            // 初始化棋盘 UI
            clearBoardUI();
            players.forEach((p, index) => {
                const nameEl = cornerNameEls[p.cornerPos];
                if (nameEl) nameEl.textContent = p.name;
                const piecesEl = cornerPiecesEls[p.cornerPos];
                if (piecesEl) {
                    piecesEl.innerHTML = '';
                    for (let i = 0; i < 4; i++) {
                        const piece = document.createElement('div');
                        piece.className = `flight-chess-piece flight-chess-piece-color-${p.colorIndex}`;
                        piecesEl.appendChild(piece);
                    }
                }
            });

            renderPlayerBar();
            if (logEl) {
                logEl.innerHTML = '<p class="flight-chess-log-placeholder">飞行棋已开始，当前由第一个玩家掷骰子。</p>';
            }
            if (statusEl) statusEl.innerText = '';
            if (nextBtn) nextBtn.disabled = true;

            if (typeof openPage === 'function') {
                openPage('flight-chess-page');
            } else {
                pageEl.classList.add('active');
            }
        }

        function renderPlayerBar() {
            if (!playerBarEl) return;
            playerBarEl.innerHTML = '';
            flightState.players.forEach((p, index) => {
                const item = document.createElement('div');
                item.className = 'flight-chess-player-item' + (index === flightState.currentTurnIndex ? ' current' : '');

                const av = document.createElement('img');
                av.className = 'flight-chess-player-avatar';
                av.src = p.avatar || DEFAULT_AI_AVATAR_URL;

                const nameEl = document.createElement('div');
                nameEl.className = 'flight-chess-player-name';
                nameEl.textContent = p.name;

                item.appendChild(av);
                item.appendChild(nameEl);
                playerBarEl.appendChild(item);
            });
        }

        function handleDiceRoll() {
            if (flightState.diceLocked || !flightState.players.length) return;

            const dice = 1 + Math.floor(Math.random() * 6);
            flightState.lastDice = dice;
            diceFaceEl && (diceFaceEl.textContent = String(dice));

            const currentPlayer = flightState.players[flightState.currentTurnIndex];
            let hint = '';
            let extraRoll = false;

            if (dice === 5) {
                hint = `${currentPlayer.name} 掷出了 5 点，可以让一个棋子出发（但不能再投一次）。`;
                extraRoll = false;
            } else if (dice === 6) {
                hint = `${currentPlayer.name} 掷出了 6 点，可以让一个棋子出发，并获得一次额外投掷机会。`;
                extraRoll = true;
            } else {
                hint = `${currentPlayer.name} 掷出了 ${dice} 点，本回合只能让已有棋子前进。`;
                extraRoll = false;
            }

            diceHintEl && (diceHintEl.textContent = '');
            appendFlightLog(hint);

            flightState.diceLocked = true;
            flightState.awaitingNext = true;
            flightState.extraRoll = extraRoll;

            setStatus('根据点数完成棋子移动后，点击“下一步”。');
            if (nextBtn) nextBtn.disabled = false;

            if (flightState.mode === 'couple-online') {
                triggerCoupleModeEmotionIfNeeded(currentPlayer, dice);
            }
        }

        async function triggerCoupleModeEmotionIfNeeded(player, dice) {
            if (!config.key || !config.url) {
                return;
            }

            // 简化：掷到奇数点时，有较大概率触发情感格子
            const shouldTrigger = dice % 2 === 1 && Math.random() < 0.6;
            if (!shouldTrigger) return;

            const question = `请为飞行棋情趣联机模式生成一条关于亲密关系/情感的小问题，要求：\n1. 面向玩家"${player.name}"，问题长度不超过40字。\n2. 风格可以略带暧昧或亲密，但不要低俗。\n3. 只输出问题文本，不要加引号，不要解释。`;

            let qText = '';
            let aText = '';

            try {
                const qResp = await getCompletion(question, false);
                qText = (qResp || '').trim();
            } catch (e) {
                console.warn('生成情感问题失败', e);
                return;
            }

            if (!qText) return;

            const answerPrompt = `你现在扮演飞行棋中的 AI 角色"${player.name}"。请用不超过60字的中文回答下面的情感/亲密问题，语气自然、真诚、略带一点暧昧但不过界。\n问题：${qText}`;

            try {
                const aResp = await getCompletion(answerPrompt, false);
                aText = (aResp || '').trim();
            } catch (e) {
                console.warn('生成情感回答失败', e);
            }

            const display = aText ? `${player.name} 停在了一个「情感问题」格子上：${qText}\nAI 回答：${aText}` : `${player.name} 停在了一个「情感问题」格子上：${qText}`;
            appendFlightLog(display);
        }

        function advanceTurn() {
            flightState.diceLocked = false;
            flightState.lastDice = null;

            if (!flightState.extraRoll) {
                flightState.currentTurnIndex = (flightState.currentTurnIndex + 1) % flightState.players.length;
                renderPlayerBar();
            }

            flightState.extraRoll = false;
            setStatus('轮到当前玩家再次/下一位投掷骰子。');
        }

        function openFlightChessSetup() {
            if (!setupOverlay) {
                showToast('当前页面未配置飞行棋开局弹窗。');
                return;
            }
            initSetupEvents();
            buildFriendList();
            // 默认回到单机模式
            if (modeToggleEl) {
                modeToggleEl.querySelectorAll('.mode-btn').forEach((b, idx) => {
                    if (idx === 0) b.classList.add('active'); else b.classList.remove('active');
                });
            }
            flightState.mode = 'solo';
            soloSectionEl && (soloSectionEl.style.display = 'block');
            coupleSectionEl && (coupleSectionEl.style.display = 'none');
            modeHintEl && (modeHintEl.textContent = '单机模式：在本机和 3 个 AI 好友一起玩飞行棋。');
            setupOverlay.classList.add('active');
        }

        resetFlightState();

        window.openFlightChessSetup = openFlightChessSetup;

        return {
            openSetup: openFlightChessSetup
        };
    })();

    const TRAVEL_STORAGE_KEY = 'travel_state_v1';

    let travelState = loadTravelState();

    function loadTravelState() {
        try {
            const saved = getStorage ? getStorage(TRAVEL_STORAGE_KEY) : null;
            if (!saved || typeof saved !== 'object') {
                return {
                    activeTab: 'domestic',
                    lastPref: {
                        destination: '',
                        mood: '',
                        transport: 'self_drive'
                    },
                    domesticTrips: [],
                    foreignTrips: [],
                    selectedTrip: null,
                    roles: {
                        user: null,
                        ai: []
                    },
                    progress: {
                        stage: 'pre',
                        events: []
                    },
                    report: null,
                    lastUpdatedAt: 0
                };
            }
            // 兼容字段缺失
            return {
                activeTab: saved.activeTab || 'domestic',
                lastPref: Object.assign({
                    destination: '',
                    mood: '',
                    transport: 'self_drive'
                }, saved.lastPref || {}),
                domesticTrips: Array.isArray(saved.domesticTrips) ? saved.domesticTrips : [],
                foreignTrips: Array.isArray(saved.foreignTrips) ? saved.foreignTrips : [],
                selectedTrip: saved.selectedTrip || null,
                roles: {
                    user: saved.roles && saved.roles.user ? saved.roles.user : null,
                    ai: Array.isArray(saved.roles && saved.roles.ai) ? saved.roles.ai : []
                },
                progress: {
                    stage: saved.progress && saved.progress.stage ? saved.progress.stage : 'pre',
                    events: Array.isArray(saved.progress && saved.progress.events) ? saved.progress.events : []
                },
                report: saved.report || null,
                lastUpdatedAt: saved.lastUpdatedAt || 0
            };
        } catch (e) {
            console.warn('加载旅游状态失败，将使用默认状态', e);
            return {
                activeTab: 'domestic',
                lastPref: {
                    destination: '',
                    mood: '',
                    transport: 'self_drive'
                },
                domesticTrips: [],
                foreignTrips: [],
                selectedTrip: null,
                roles: {
                    user: null,
                    ai: []
                },
                progress: {
                    stage: 'pre',
                    events: []
                },
                report: null,
                lastUpdatedAt: 0
            };
        }
    }

    function saveTravelState() {
        try {
            if (typeof setStorage === 'function') {
                travelState.lastUpdatedAt = Date.now();
                setStorage(TRAVEL_STORAGE_KEY, travelState);
            }
        } catch (e) {
            console.warn('保存旅游状态失败', e);
        }
    }

    function initTravelApp() {
        const pageEl = document.getElementById('travel-page');
        if (!pageEl) return;

        const flagBtn = document.getElementById('travel-flag-btn');
        const tabBar = document.getElementById('travel-tab-bar');
        const tabButtons = tabBar ? tabBar.querySelectorAll('.travel-tab') : [];
        const prefModal = document.getElementById('travel-pref-modal');
        const prefClose = document.getElementById('travel-pref-close');
        const prefCancel = document.getElementById('travel-pref-cancel');
        const prefConfirm = document.getElementById('travel-pref-confirm');
        const transportOptions = document.getElementById('travel-transport-options');

        const roleModal = document.getElementById('travel-role-modal');
        const roleClose = document.getElementById('travel-role-close');
        const roleCancel = document.getElementById('travel-role-cancel');
        const goBtn = document.getElementById('travel-go-btn');

        const progressModal = document.getElementById('travel-progress-modal');
        const progressClose = document.getElementById('travel-progress-close');
        const progressTabs = progressModal ? progressModal.querySelectorAll('.travel-progress-tab') : [];
        const progressSend = document.getElementById('travel-progress-send');
        const progressInput = document.getElementById('travel-progress-input');
        const progressRefresh = document.getElementById('travel-progress-refresh');
        const progressEndBtn = document.getElementById('travel-end-btn');

        if (flagBtn) {
            flagBtn.addEventListener('click', () => {
                if (travelState.activeTab === 'domestic' || travelState.activeTab === 'foreign') {
                    openTravelPrefModal();
                }
            });
        }

        if (tabButtons && tabButtons.length) {
            tabButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const tab = btn.dataset.tab === 'foreign' ? 'foreign' : 'domestic';
                    setActiveTravelTab(tab);
                });
            });
        }

        if (transportOptions) {
            transportOptions.addEventListener('click', (e) => {
                const btn = e.target.closest('.transport-option');
                if (!btn) return;
                transportOptions.querySelectorAll('.transport-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        }

        if (prefClose) prefClose.addEventListener('click', closeTravelPrefModal);
        if (prefCancel) prefCancel.addEventListener('click', closeTravelPrefModal);
        if (prefConfirm) prefConfirm.addEventListener('click', handleConfirmTravelPref);

        if (roleClose) roleClose.addEventListener('click', closeTravelRoleModal);
        if (roleCancel) roleCancel.addEventListener('click', closeTravelRoleModal);
        if (goBtn) goBtn.addEventListener('click', handleTravelGo);

        if (progressClose) progressClose.addEventListener('click', closeTravelProgressModal);
        if (progressSend) progressSend.addEventListener('click', handleTravelProgressSend);
        if (progressInput) {
            progressInput.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    handleTravelProgressSend();
                }
            });
        }
        if (progressRefresh) progressRefresh.addEventListener('click', handleTravelProgressAiAdvance);
        if (progressEndBtn) progressEndBtn.addEventListener('click', handleTravelEndAndReport);

        if (progressTabs && progressTabs.length) {
            progressTabs.forEach(tabBtn => {
                tabBtn.addEventListener('click', () => {
                    const stage = tabBtn.dataset.stage || 'pre';
                    setTravelProgressStage(stage);
                });
            });
        }

        // 根据已有状态恢复 UI
        setActiveTravelTab(travelState.activeTab || 'domestic', true);
        renderTravelView();
        renderTravelProgressTabs();
    }

    function setActiveTravelTab(tab, skipSave) {
        travelState.activeTab = tab === 'foreign' ? 'foreign' : 'domestic';

        const tabBar = document.getElementById('travel-tab-bar');
        if (tabBar) {
            tabBar.querySelectorAll('.travel-tab').forEach(btn => {
                const isActive = btn.dataset.tab === travelState.activeTab;
                if (isActive) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        if (!skipSave) saveTravelState();
        renderTravelView();
    }

    function openTravelPrefModal() {
        const prefModal = document.getElementById('travel-pref-modal');
        if (!prefModal) return;
        const destInput = document.getElementById('travel-destination-input');
        const moodInput = document.getElementById('travel-mood-input');
        const transportOptions = document.getElementById('travel-transport-options');

        if (destInput) destInput.value = travelState.lastPref.destination || '';
        if (moodInput) moodInput.value = travelState.lastPref.mood || '';

        if (transportOptions) {
            const all = transportOptions.querySelectorAll('.transport-option');
            let matched = false;
            all.forEach(btn => {
                const val = btn.dataset.value;
                if (val === travelState.lastPref.transport) {
                    btn.classList.add('active');
                    matched = true;
                } else {
                    btn.classList.remove('active');
                }
            });
            if (!matched && all.length) {
                all.forEach((btn, idx) => {
                    btn.classList.toggle('active', idx === 0);
                });
            }
        }

        prefModal.classList.add('active');
    }

    function closeTravelPrefModal() {
        const prefModal = document.getElementById('travel-pref-modal');
        if (prefModal) prefModal.classList.remove('active');
    }

    async function handleConfirmTravelPref() {
        const destInput = document.getElementById('travel-destination-input');
        const moodInput = document.getElementById('travel-mood-input');
        const transportOptions = document.getElementById('travel-transport-options');

        const destination = destInput ? destInput.value.trim() : '';
        const mood = moodInput ? moodInput.value.trim() : '';
        let transport = 'self_drive';
        if (transportOptions) {
            const activeBtn = transportOptions.querySelector('.transport-option.active');
            if (activeBtn && activeBtn.dataset.value) {
                transport = activeBtn.dataset.value;
            }
        }

        travelState.lastPref = { destination, mood, transport };
        saveTravelState();

        if (!config || !config.key || !config.url) {
            closeTravelPrefModal();
            if (typeof showToast === 'function') {
                showToast('请先在设置页配置 AI API 才能生成行程');
            }
            return;
        }

        const type = travelState.activeTab === 'foreign' ? 'foreign' : 'domestic';
        const mainCard = document.getElementById('travel-main-card');
        const listEl = document.getElementById(type === 'domestic' ? 'travel-trip-list-domestic' : 'travel-trip-list-foreign');
        const placeholderEl = document.getElementById(type === 'domestic' ? 'travel-placeholder-domestic' : 'travel-placeholder-foreign');

        if (placeholderEl) {
            placeholderEl.hidden = false;
            placeholderEl.textContent = '正在为你规划行程，请稍等 10 秒左右…';
        }
        if (listEl) {
            listEl.hidden = false;
            listEl.innerHTML = '';
        }
        if (mainCard) {
            mainCard.classList.add('travel-loading');
        }

        closeTravelPrefModal();

        try {
            const prompt = buildTravelPlanPrompt(type, destination, mood, transport);
            const reply = await getCompletion(prompt, false);
            const text = (reply || '').trim();
            const trips = normalizeTravelTripsFromAi(type, text);

            if (type === 'domestic') {
                travelState.domesticTrips = trips;
            } else {
                travelState.foreignTrips = trips;
            }
            travelState.selectedTrip = null;
            travelState.report = null;
            saveTravelState();

            if (!trips.length) {
                if (placeholderEl) {
                    placeholderEl.hidden = false;
                    placeholderEl.textContent = 'AI 没有返回有效的行程结果，可以稍后再试一次。';
                }
            }
        } catch (e) {
            console.error('生成旅游行程失败', e);
            if (typeof showToast === 'function') {
                showToast('生成行程时出现问题，请稍后再试');
            }
        } finally {
            if (document.getElementById('travel-main-card')) {
                document.getElementById('travel-main-card').classList.remove('travel-loading');
            }
            renderTravelView();
        }
    }

    function buildTravelPlanPrompt(type, destination, mood, transport) {
        const transportLabel = getTransportLabel(transport);
        const scope = type === 'foreign' ? '中国大陆以外，优先考虑你认为适合的国外城市（如东亚、东南亚、欧洲等）' : '中国大陆境内的城市和景点';

        return `你是一名懂得情绪与关系的私人旅行策划师，请根据用户的设定推荐` +
            ` 4-5 条${type === 'foreign' ? '国外' : '国内'}旅行方案，并用 JSON 结构返回。

` +
            `【用户设定】
目的地期望：${destination || '用户没有特别说明'}
想要的旅行感觉：${mood || '用户没有特别说明'}
主要交通方式偏好：${transportLabel}（类型标识：${transport}）
推荐范围：${scope}

` +
            `【输出要求】
1. 输出一个 JSON 对象，键名为 items，对应一个数组。
2. items 内每个元素代表一条方案，字段包括：
  id: 字符串，方案 ID；
  title: 简短标题，例如 "厦门·海边慢生活三日游"；
  city: 推荐的主要城市名；
  spots: 2-5 个代表性景点名称列表；
  days: 建议天数（整数）；
  budget: 预估人均预算（整数，单位人民币或等值外币）；
  transport: 使用的主要交通方式标识，取值限定为 "self_drive" | "train" | "flight" | "other"；
  summary: 用 1-2 句话描述这条行程适合什么心情、有哪些亮点。
3. 只输出 JSON，不要在 JSON 前后添加任何解释文本。`;
    }

    function normalizeTravelTripsFromAi(type, rawText) {
        let obj = null;
        try {
            if (typeof extractFirstJsonObject === 'function') {
                obj = extractFirstJsonObject(rawText);
            } else {
                obj = JSON.parse(rawText);
            }
        } catch (e) {
            console.warn('解析旅游 JSON 失败，将退回到单条文本方案', e);
            const text = rawText.trim();
            if (!text) return [];
            return [
                {
                    id: type + '_fallback_1',
                    title: type === 'foreign' ? 'AI 生成的旅行方案' : 'AI 生成的国内旅行方案',
                    city: '',
                    spots: [],
                    days: '',
                    budget: '',
                    transport: '',
                    summary: text
                }
            ];
        }

        if (!obj || !Array.isArray(obj.items)) {
            return [];
        }

        return obj.items.map((item, index) => {
            const id = item.id || `${type}_${index + 1}`;
            const title = item.title || `方案 ${index + 1}`;
            const city = item.city || '';
            const spots = Array.isArray(item.spots) ? item.spots : [];
            const days = item.days || '';
            const budget = item.budget || '';
            const transport = item.transport || '';
            const summary = item.summary || '';
            return {
                id,
                title,
                city,
                spots,
                days,
                budget,
                transport,
                summary
            };
        });
    }

    function renderTravelView() {
        const type = travelState.activeTab === 'foreign' ? 'foreign' : 'domestic';
        const placeholderDomestic = document.getElementById('travel-placeholder-domestic');
        const placeholderForeign = document.getElementById('travel-placeholder-foreign');
        const listDomestic = document.getElementById('travel-trip-list-domestic');
        const listForeign = document.getElementById('travel-trip-list-foreign');
        const reportView = document.getElementById('travel-report-view');

        if (!placeholderDomestic || !placeholderForeign || !listDomestic || !listForeign || !reportView) {
            return;
        }

        // 报告优先展示
        if (travelState.report && travelState.report.text) {
            placeholderDomestic.hidden = true;
            placeholderForeign.hidden = true;
            listDomestic.hidden = true;
            listForeign.hidden = true;
            reportView.hidden = false;
            renderTravelReport();
            return;
        }

        reportView.hidden = true;

        if (type === 'domestic') {
            listDomestic.hidden = false;
            listForeign.hidden = true;
            if (Array.isArray(travelState.domesticTrips) && travelState.domesticTrips.length) {
                placeholderDomestic.hidden = true;
                renderTravelTripList('domestic');
            } else {
                placeholderDomestic.hidden = false;
                placeholderDomestic.textContent = '点击右上角的小旗子，告诉我你想去什么样的国内城市，我会为你准备 4–5 条行程候选。';
                listDomestic.innerHTML = '';
            }
            placeholderForeign.hidden = true;
        } else {
            listDomestic.hidden = true;
            listForeign.hidden = false;
            if (Array.isArray(travelState.foreignTrips) && travelState.foreignTrips.length) {
                placeholderForeign.hidden = true;
                renderTravelTripList('foreign');
            } else {
                placeholderForeign.hidden = false;
                placeholderForeign.textContent = '在这里可以规划你的国外旅行。默认会以飞机为主要交通方式，根据你的设定生成行程。';
                listForeign.innerHTML = '';
            }
            placeholderDomestic.hidden = true;
        }
    }

    function renderTravelTripList(type) {
        const listEl = document.getElementById(type === 'domestic' ? 'travel-trip-list-domestic' : 'travel-trip-list-foreign');
        if (!listEl) return;
        const trips = type === 'domestic' ? (travelState.domesticTrips || []) : (travelState.foreignTrips || []);

        listEl.innerHTML = '';
        trips.forEach((trip, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'travel-trip-item';
            btn.dataset.index = String(index);
            btn.dataset.type = type;

            const budgetText = trip.budget ? `预算约 ¥${trip.budget}` : '';
            const daysText = trip.days ? `${trip.days} 天` : '';
            const metaPieces = [];
            if (trip.city) metaPieces.push(trip.city);
            if (daysText) metaPieces.push(daysText);
            if (budgetText) metaPieces.push(budgetText);

            const tags = Array.isArray(trip.spots) ? trip.spots.slice(0, 3) : [];
            const tagHtml = tags.map(t => `<span class="travel-trip-tag">${escapeHTML(String(t))}</span>`).join('');

            btn.innerHTML = `
                <div class="travel-trip-title">${escapeHTML(trip.title || '')}</div>
                <div class="travel-trip-meta">${metaPieces.map(p => escapeHTML(String(p))).join(' · ')}</div>
                <div class="travel-trip-summary">${escapeHTML(trip.summary || '')}</div>
                <div class="travel-trip-tags">${tagHtml}</div>
            `;

            btn.addEventListener('click', () => {
                handleSelectTravelTrip(type, index);
            });

            listEl.appendChild(btn);
        });
    }

    function handleSelectTravelTrip(type, index) {
        const trips = type === 'domestic' ? (travelState.domesticTrips || []) : (travelState.foreignTrips || []);
        const trip = trips[index];
        if (!trip) return;
        travelState.selectedTrip = {
            type,
            index,
            id: trip.id,
            title: trip.title,
            city: trip.city,
            days: trip.days,
            budget: trip.budget,
            transport: trip.transport,
            summary: trip.summary
        };
        saveTravelState();
        openTravelRoleModal();
    }

    function openTravelRoleModal() {
        const modal = document.getElementById('travel-role-modal');
        const userListEl = document.getElementById('travel-user-role-list');
        const aiListEl = document.getElementById('travel-ai-role-list');
        if (!modal || !userListEl || !aiListEl) return;

        userListEl.innerHTML = '';
        aiListEl.innerHTML = '';

        const users = Array.isArray(window.userProfiles) ? window.userProfiles : [];
        const ais = Array.isArray(window.aiList) ? window.aiList : [];

        let defaultUserId = travelState.roles && travelState.roles.user ? travelState.roles.user.id : null;
        if (!defaultUserId && users.length) {
            defaultUserId = 'user-' + users[0].id;
        }

        users.forEach(u => {
            const id = 'user-' + u.id;
            const item = document.createElement('div');
            item.className = 'travel-role-item';
            item.dataset.roleType = 'user';
            item.dataset.roleId = id;
            item.innerHTML = `
                <img class="travel-role-avatar" src="${u.avatar || DEFAULT_USER_AVATAR_URL}" alt="${escapeHTML(u.name || '我')}">
                <div class="travel-role-main">
                    <div class="travel-role-name">${escapeHTML(u.name || '我')}</div>
                    <div class="travel-role-desc">${escapeHTML(u.desc || '这次旅行的发起者')}</div>
                </div>
            `;
            if (id === defaultUserId) {
                item.classList.add('selected');
            }
            item.addEventListener('click', () => {
                userListEl.querySelectorAll('.travel-role-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
            });
            userListEl.appendChild(item);
        });

        const filteredAis = (ais || []).filter(ai => !ai.isArchived && !(ai.settings && ai.settings.hidden));
        const previousAiIds = Array.isArray(travelState.roles && travelState.roles.ai)
            ? travelState.roles.ai.map(r => r.id)
            : [];

        filteredAis.forEach(ai => {
            const id = 'ai-' + ai.id;
            const item = document.createElement('div');
            item.className = 'travel-role-item';
            item.dataset.roleType = 'ai';
            item.dataset.roleId = id;
            item.innerHTML = `
                <img class="travel-role-avatar" src="${ai.avatar || DEFAULT_AI_AVATAR_URL}" alt="${escapeHTML(ai.name || 'AI 好友')}">
                <div class="travel-role-main">
                    <div class="travel-role-name">${escapeHTML(ai.name || '未命名角色')}</div>
                    <div class="travel-role-desc">${escapeHTML(ai.nickname || '一起出去玩的小伙伴')}</div>
                </div>
            `;
            if (previousAiIds.includes(id)) {
                item.classList.add('selected');
            }
            item.addEventListener('click', () => {
                const selected = aiListEl.querySelectorAll('.travel-role-item.selected');
                if (item.classList.contains('selected')) {
                    item.classList.remove('selected');
                    return;
                }
                if (selected.length >= 3) {
                    if (typeof showToast === 'function') {
                        showToast('AI 角色最多选择 3 个');
                    }
                    return;
                }
                item.classList.add('selected');
            });
            aiListEl.appendChild(item);
        });

        modal.classList.add('active');
    }

    function closeTravelRoleModal() {
        const modal = document.getElementById('travel-role-modal');
        if (modal) modal.classList.remove('active');
    }

    function handleTravelGo() {
        const userListEl = document.getElementById('travel-user-role-list');
        const aiListEl = document.getElementById('travel-ai-role-list');
        if (!userListEl || !aiListEl) return;

        const selectedUser = userListEl.querySelector('.travel-role-item.selected');
        if (!selectedUser) {
            if (typeof showToast === 'function') {
                showToast('请选择 1 个用户角色');
            }
            return;
        }

        const selectedAis = Array.from(aiListEl.querySelectorAll('.travel-role-item.selected'));
        if (!selectedAis.length) {
            if (typeof showToast === 'function') {
                showToast('至少选择 1 个 AI 角色一起出发');
            }
            return;
        }

        const users = Array.isArray(window.userProfiles) ? window.userProfiles : [];
        const ais = Array.isArray(window.aiList) ? window.aiList : [];

        const userIdRaw = selectedUser.dataset.roleId || '';
        const userId = userIdRaw.replace(/^user-/, '');
        const userProfile = users.find(u => String(u.id) === String(userId));

        const aiRoles = selectedAis.map(el => {
            const rawId = el.dataset.roleId || '';
            const sourceId = rawId.replace(/^ai-/, '');
            const ai = ais.find(a => String(a.id) === String(sourceId));
            return ai ? {
                id: 'ai-' + ai.id,
                sourceId: ai.id,
                name: ai.name || '未命名角色',
                nickname: ai.nickname || '',
                avatar: ai.avatar || DEFAULT_AI_AVATAR_URL,
                prompt: ai.prompt || ai.description || ''
            } : null;
        }).filter(Boolean);

        travelState.roles = {
            user: userProfile ? {
                id: 'user-' + userProfile.id,
                sourceId: userProfile.id,
                name: userProfile.name || '我',
                avatar: userProfile.avatar || DEFAULT_USER_AVATAR_URL,
                prompt: userProfile.prompt || ''
            } : null,
            ai: aiRoles
        };
        travelState.progress = {
            stage: 'pre',
            events: []
        };
        travelState.report = null;
        saveTravelState();

        closeTravelRoleModal();
        openTravelProgressModal(true);
    }

    function openTravelProgressModal(initial) {
        const modal = document.getElementById('travel-progress-modal');
        if (!modal) return;

        if (!travelState.selectedTrip) {
            if (typeof showToast === 'function') {
                showToast('请先在列表中选择一条行程');
            }
            return;
        }

        if (initial && (!travelState.progress || !travelState.progress.events.length)) {
            // 写入一条开场事件
            const t = travelState.selectedTrip;
            const userName = travelState.roles.user ? (travelState.roles.user.name || '你') : '你';
            const aiNames = (travelState.roles.ai || []).map(r => r.name).join('、');
            const transportLabel = getTransportLabel(t.transport || travelState.lastPref.transport);
            const summary = t.summary || '';
            const introText = `${userName} 正和 ${aiNames || '几位 AI 小伙伴'} 一起准备前往 ${t.city || ''} 的 ${t.days || ''} 天旅行（主要交通方式：${transportLabel || '由 AI 安排'}）。\n行前设想：${summary}`;
            travelState.progress = travelState.progress || { stage: 'pre', events: [] };
            travelState.progress.stage = 'pre';
            travelState.progress.events = [
                {
                    id: 'evt_' + Date.now(),
                    stage: 'pre',
                    from: 'system',
                    text: introText,
                    createdAt: Date.now()
                }
            ];
            saveTravelState();
        }

        setTravelProgressStage(travelState.progress.stage || 'pre', true);
        renderTravelProgressTabs();
        renderTravelProgressList();

        modal.classList.add('active');
    }

    function closeTravelProgressModal() {
        const modal = document.getElementById('travel-progress-modal');
        if (modal) modal.classList.remove('active');
    }

    function renderTravelProgressTabs() {
        const modal = document.getElementById('travel-progress-modal');
        if (!modal) return;
        const tabs = modal.querySelectorAll('.travel-progress-tab');
        tabs.forEach(tab => {
            const stage = tab.dataset.stage || 'pre';
            if (stage === (travelState.progress && travelState.progress.stage || 'pre')) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }

    function setTravelProgressStage(stage, skipSave) {
        travelState.progress = travelState.progress || { stage: 'pre', events: [] };
        travelState.progress.stage = stage;
        if (!skipSave) saveTravelState();
        renderTravelProgressTabs();
        renderTravelProgressList();
    }

    function renderTravelProgressList() {
        const listEl = document.getElementById('travel-progress-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        const events = (travelState.progress && travelState.progress.events) || [];
        const stage = (travelState.progress && travelState.progress.stage) || 'pre';
        events.filter(e => e.stage === stage).forEach(evt => {
            const item = document.createElement('div');
            item.className = 'travel-progress-item travel-progress-from-' + (evt.from || 'system');
            item.textContent = evt.text || '';
            listEl.appendChild(item);
        });

        listEl.scrollTop = listEl.scrollHeight;
    }

    function appendTravelProgressEvent(stage, from, text) {
        travelState.progress = travelState.progress || { stage: stage, events: [] };
        if (!Array.isArray(travelState.progress.events)) {
            travelState.progress.events = [];
        }
        travelState.progress.events.push({
            id: 'evt_' + Date.now() + '_' + Math.random().toString(16).slice(2),
            stage,
            from,
            text,
            createdAt: Date.now()
        });
        saveTravelState();
        renderTravelProgressList();
    }

    function handleTravelProgressSend() {
        const input = document.getElementById('travel-progress-input');
        if (!input) return;
        const value = input.value.trim();
        if (!value) return;
        const stage = (travelState.progress && travelState.progress.stage) || 'pre';
        appendTravelProgressEvent(stage, 'user', value);
        input.value = '';
    }

    async function handleTravelProgressAiAdvance() {
        if (!config || !config.key || !config.url) {
            if (typeof showToast === 'function') {
                showToast('请先在设置页配置 AI API 才能让 AI 推进进程');
            }
            return;
        }
        if (!travelState.selectedTrip) {
            if (typeof showToast === 'function') {
                showToast('请先选择一条行程并绑定角色');
            }
            return;
        }

        const stage = (travelState.progress && travelState.progress.stage) || 'pre';
        const events = (travelState.progress && travelState.progress.events) || [];
        const lastEventsText = events
            .filter(e => e.stage === stage)
            .slice(-6)
            .map(e => `${e.from === 'user' ? '用户' : e.from === 'ai' ? 'AI 小伙伴' : '系统'}：${e.text}`)
            .join('\n');

        const trip = travelState.selectedTrip;
        const userRole = travelState.roles && travelState.roles.user;
        const aiRoles = (travelState.roles && travelState.roles.ai) || [];
        const stageLabel = stage === 'pre' ? '出发前' : stage === 'during' ? '旅途中' : '收尾阶段';

        const prompt = `你现在是一组 AI 旅行同伴，需要根据当前的旅行阶段和已发生的事件，继续推动故事发展。

` +
            `【本次旅行基本信息】
标题：${trip.title || ''}
城市：${trip.city || ''}
天数：${trip.days || ''}
预算：${trip.budget || ''}
交通方式：${getTransportLabel(trip.transport || travelState.lastPref.transport)}

` +
            `【参与角色】
用户：${userRole ? userRole.name : '用户'}（人类）
AI 同伴：${aiRoles.map(r => r.name).join('、') || '无'}

` +
            `【当前阶段】${stageLabel}
【最近事件】
${lastEventsText || '目前还没有事件记录。'}

` +
            `【输出要求】
1. 用中文续写一小段这次旅行的进展，重点描写角色的行动和心情。
2. 尽量让每个 AI 角色和用户各有一句简短的行为或对白。
3. 控制在 80-150 字之间。
4. 只输出续写内容本身，不要解释。`;

        try {
            const reply = await getCompletion(prompt, false);
            const text = (reply || '').trim();
            if (text) {
                appendTravelProgressEvent(stage, 'ai', text);
            }
        } catch (e) {
            console.error('推进旅游进程失败', e);
            if (typeof showToast === 'function') {
                showToast('AI 暂时有点忙，等一下再试试');
            }
        }
    }

    async function handleTravelEndAndReport() {
        if (!config || !config.key || !config.url) {
            if (typeof showToast === 'function') {
                showToast('请先在设置页配置 AI API 才能生成旅游报告');
            }
            return;
        }
        if (!travelState.selectedTrip) {
            if (typeof showToast === 'function') {
                showToast('请先选择一条行程并绑定角色');
            }
            return;
        }

        const stage = (travelState.progress && travelState.progress.stage) || 'pre';
        const events = (travelState.progress && travelState.progress.events) || [];
        const allEventsText = events
            .map(e => `[${e.stage}]${e.from === 'user' ? '用户' : e.from === 'ai' ? 'AI' : '系统'}：${e.text}`)
            .join('\n');

        const trip = travelState.selectedTrip;
        const userRole = travelState.roles && travelState.roles.user;
        const aiRoles = (travelState.roles && travelState.roles.ai) || [];

        const prompt = `请你根据下面的旅行设定和过程记录，输出一份中文的「旅行小结报告」。

` +
            `【基本行程】
标题：${trip.title || ''}
城市：${trip.city || ''}
天数：${trip.days || ''}
预算：${trip.budget || ''}
交通方式：${getTransportLabel(trip.transport || travelState.lastPref.transport)}

` +
            `【参与角色】
用户：${userRole ? userRole.name : '用户'}（人类）
AI 同伴：${aiRoles.map(r => r.name).join('、') || '无'}

` +
            `【事件时间线】
${allEventsText || '暂无事件记录'}

` +
            `【输出要求】
请用自然的中文输出一份分段的报告，结构包括：
1. 概览：用 2-3 句话概括这次旅行给大家留下的整体感觉；
2. 行程亮点：用条目列出 3-5 个你认为最值得记录的瞬间或场景；
3. 花费与预算：简单说明本次花费大致是否在预算内，以及花钱主要集中在哪些部分；
4. 角色小结：分别给用户和每个 AI 角色写一句「这次旅行想对对方说的话」。
输出普通文本即可，不要使用 JSON。`;

        try {
            const reply = await getCompletion(prompt, false);
            const text = (reply || '').trim();
            if (text) {
                travelState.report = {
                    text,
                    createdAt: Date.now()
                };
                saveTravelState();
                closeTravelProgressModal();
                renderTravelView();
                if (typeof showToast === 'function') {
                    showToast('本次旅行结束，已生成一份报告');
                }
            }
        } catch (e) {
            console.error('生成旅游报告失败', e);
            if (typeof showToast === 'function') {
                showToast('生成报告时出现问题，请稍后再试');
            }
        }
    }

    function renderTravelReport() {
        const view = document.getElementById('travel-report-view');
        if (!view || !travelState.report) return;
        const text = travelState.report.text || '';

        const shareBtnHtml = '<button type="button" class="btn-small" id="travel-share-qq-btn">分享到 QQ</button>';

        const escaped = (text || '').split('\n').map(line => `<p>${escapeHTML(line)}</p>`).join('');

        view.innerHTML = `
            <div class="travel-report-section">
                <div class="travel-report-title">本次旅行报告</div>
                <div class="travel-report-content">${escaped || '<p>暂无报告内容。</p>'}</div>
                <div class="travel-report-actions">${shareBtnHtml}</div>
            </div>
        `;

        const shareBtn = document.getElementById('travel-share-qq-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                if (typeof openPage === 'function') {
                    openPage('qq-page');
                }
                if (typeof showToast === 'function') {
                    showToast('已将这次旅行的小结「塞进」QQ 应用，好友评价功能为占位实现。');
                }
            });
        }
    }

    function getTransportLabel(code) {
        switch (code) {
            case 'self_drive':
                return '自驾';
            case 'train':
                return '高铁/火车';
            case 'flight':
                return '飞机';
            case 'other':
                return '其他方式';
            default:
                return '';
        }
    }

    // =========================================================================
    // --------------------- INFINITE FLOW APP (UNLIMITED RUN) -----------------
    // =========================================================================

    async function callInfiniteApi(kind, payload) {
        if (!config || !config.key || !config.url) {
            throw new Error('尚未在设置页配置 AI API');
        }

        let prompt = '';
        switch (kind) {
            case 'dungeon_list': {
                const role = payload && payload.role;
                if (!role) {
                    throw new Error('缺少角色信息');
                }
                const rating = role.rating || 'F';
                const attrs = role.attrs || { hp: 10, str: 10, mind: 10 };
                const ratingLabel = `${rating} 级`;

                prompt = `你现在是一款以“无限流副本”为背景的文字游戏的关卡设计师。`
                    + `\n\n【当前玩家角色】`
                    + `\n名称：${role.name || '无名角色'}`
                    + `\n评级：${ratingLabel}`
                    + `\n体力：${attrs.hp || 10}`
                    + `\n力量：${attrs.str || 10}`
                    + `\n精神：${attrs.mind || 10}`
                    + `\n\n请为这个角色生成 3-5 个适合当前实力的无限流“副本入口”，并用 JSON 结构返回。`
                    + `\n\n【副本风格要求】`
                    + `\n- 整体氛围偏阴冷、压抑或诡异，但要控制在适合文字游戏阅读的程度，不要出现过于血腥的描写。`
                    + `\n- 每个副本都应该有一个清晰的核心机制或危险源（例如时间循环、身份错乱、封闭空间、感染、规则怪谈等）。`
                    + `\n- 本次只设计“入口信息”，不要写长篇剧情。`
                    + `\n\n【JSON 输出要求】`
                    + `\n请严格返回一个 JSON 对象，结构如下：`
                    + `\n{`
                    + `\n  "items": [`
                    + `\n    {`
                    + `\n      "id": "字符串，副本唯一 ID，使用英文字母+数字，例如 dungeon_f_01",`
                    + `\n      "title": "简短的副本名称，例如：\"午夜空车站\"",`
                    + `\n      "difficulty": "该副本的难度评级，取值限定为 F/E/D/C/B/A/S 中一个，尽量围绕当前角色评级上下浮动 1 个等级",`
                    + `\n      "dangerHint": "一句话描述这个副本主要危险感来自哪里，例如：\"所有路人都在重复同一句话\"",`
                    + `\n      "entryDesc": "2-3 句话的入场说明，描述玩家刚进入副本时看到的场景与第一印象。",`
                    + `\n      "expectedReward": "整数，预计可获得的积分奖励，数值在 50-500 之间，难度越高奖励越高。"`
                    + `\n    }`
                    + `\n  ]`
                    + `\n}`
                    + `\n\n只输出这一段 JSON，不要在前后添加任何其他说明文字。`;
                break;
            }
            default:
                throw new Error('未知的 Infinite API 类型: ' + String(kind));
        }

        return await getCompletion(prompt, false);
    }

    function renderInfiniteRoleSummary() {
        const navStatusEl = document.getElementById('infinite-nav-status');
        const nameEl = document.getElementById('infinite-role-name');
        const ratingEl = document.getElementById('infinite-role-rating');
        const attrsEl = document.getElementById('infinite-role-attrs');
        const pointsEl = document.getElementById('infinite-points-value');

        const role = getCurrentInfiniteRole();
        if (!role) {
            if (navStatusEl) navStatusEl.textContent = '未绑定角色';
            if (nameEl) nameEl.textContent = '未绑定角色';
            if (ratingEl) ratingEl.textContent = '评级：F';
            if (attrsEl) attrsEl.textContent = '体力 10 · 力量 10 · 精神 10';
            if (pointsEl) pointsEl.textContent = '0';
            return;
        }

        const ratingLabel = role.rating || 'F';
        const attrs = role.attrs || { hp: 10, str: 10, mind: 10 };
        const points = typeof role.points === 'number' ? role.points : 0;

        if (navStatusEl) navStatusEl.textContent = `${role.name || '角色'} · ${ratingLabel} 级`;
        if (nameEl) nameEl.textContent = role.name || '未命名角色';
        if (ratingEl) ratingEl.textContent = `评级：${ratingLabel}`;
        if (attrsEl) attrsEl.textContent = `体力 ${attrs.hp || 10} · 力量 ${attrs.str || 10} · 精神 ${attrs.mind || 10}`;
        if (pointsEl) pointsEl.textContent = String(points);
    }

    function updateInfiniteSwordButtonState() {
        const swordBtn = document.getElementById('infinite-sword-btn');
        const role = getCurrentInfiniteRole();
        if (!swordBtn) return;
        const hasRole = !!role;
        swordBtn.disabled = !hasRole;
        swordBtn.classList.toggle('disabled', !hasRole);

        const hintEl = document.getElementById('infinite-home-hint');
        if (hintEl) {
            hintEl.textContent = hasRole
                ? '点一下右上角的刀，为当前角色生成一批与你评级相匹配的副本入口。'
                : '这里暂时什么都没有。先在「个人中心」里绑定一个角色，再回来试着点一下右上角的刀。';
        }
    }

    function renderInfiniteDungeonList() {
        const listEl = document.getElementById('infinite-dungeon-list');
        if (!listEl) return;

        const role = getCurrentInfiniteRole();
        if (!role) {
            listEl.innerHTML = '<div class="infinite-empty-hint">请先在「个人中心」绑定一个角色。</div>';
            return;
        }

        const dungeons = Array.isArray(role.lastDungeonList) ? role.lastDungeonList : [];
        if (!dungeons.length) {
            listEl.innerHTML = '<div class="infinite-empty-hint">从首页点刀生成一批与你当前评级匹配的副本。</div>';
            return;
        }

        listEl.innerHTML = '';
        dungeons.forEach((d, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'infinite-dungeon-item';
            btn.dataset.index = String(index);

            const title = escapeHTML(d.title || `无名副本 ${index + 1}`);
            const diff = escapeHTML(d.difficulty || (getCurrentInfiniteRole().rating || 'F'));
            const danger = escapeHTML(d.dangerHint || '危险来源未知');
            const entry = escapeHTML(d.entryDesc || '入口描述缺失。');
            const reward = typeof d.expectedReward === 'number' ? d.expectedReward : 100;

            btn.innerHTML = `
                <div class="infinite-dungeon-title-row">
                    <span class="infinite-dungeon-title">${title}</span>
                    <span class="infinite-dungeon-badge">难度 ${diff}</span>
                </div>
                <div class="infinite-dungeon-danger">${danger}</div>
                <div class="infinite-dungeon-entry">${entry}</div>
                <div class="infinite-dungeon-meta">预计积分奖励：<span class="infinite-dungeon-reward">${reward}</span></div>
            `;

            btn.addEventListener('click', () => {
                if (typeof showToast === 'function') {
                    showToast('副本队友选择与具体流程将在下一步接入，目前先支持预览列表');
                }
            });

            listEl.appendChild(btn);
        });
    }

    function normalizeInfiniteDungeonsFromAi(rawText, role) {
        let obj = null;
        try {
            if (typeof extractFirstJsonObject === 'function') {
                obj = extractFirstJsonObject(rawText);
            }
            if (typeof obj === 'string') {
                obj = JSON.parse(obj);
            } else if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                // already object
            } else {
                obj = JSON.parse(rawText);
            }
        } catch (e) {
            console.warn('解析无限流副本 JSON 失败，将使用本地占位模板', e);
            return buildFallbackInfiniteDungeons(role);
        }

        if (!obj || !Array.isArray(obj.items)) {
            return buildFallbackInfiniteDungeons(role);
        }

        const rating = role && role.rating ? role.rating : 'F';
        return obj.items.map((item, index) => {
            return {
                id: item.id || `inf_${rating.toLowerCase()}_${index + 1}`,
                title: item.title || `未知副本 ${index + 1}`,
                difficulty: item.difficulty || rating,
                dangerHint: item.dangerHint || '危险来源未知',
                entryDesc: item.entryDesc || '',
                expectedReward: typeof item.expectedReward === 'number' ? item.expectedReward : 80 + index * 20
            };
        });
    }

    function buildFallbackInfiniteDungeons(role) {
        const rating = role && role.rating ? role.rating : 'F';
        const baseReward = rating === 'F' ? 80 : rating === 'E' ? 120 : rating === 'D' ? 160 : 200;
        return [
            {
                id: `fallback_${rating.toLowerCase()}_1`,
                title: '废弃地下停车场',
                difficulty: rating,
                dangerHint: '电梯间反复亮起却没有人走出。',
                entryDesc: '你跟着导航来到一座早就停用的商场，地下停车场的灯一盏一盏亮起，只照出一排排空车位。',
                expectedReward: baseReward
            },
            {
                id: `fallback_${rating.toLowerCase()}_2`,
                title: '凌晨三点的地铁终点站',
                difficulty: rating,
                dangerHint: '每一节车厢里，广告屏播的是不同时间线。',
                entryDesc: '末班地铁本该清空，却在终点站悄无声息地重新开门，只对你一个人亮起“欢迎乘坐”的提示。',
                expectedReward: baseReward + 40
            }
        ];
    }

    async function generateInfiniteDungeonsForCurrentRole() {
        const role = getCurrentInfiniteRole();
        if (!role) {
            if (typeof showToast === 'function') {
                showToast('请先在「个人中心」绑定一个角色');
            }
            return;
        }

        const listEl = document.getElementById('infinite-dungeon-list');
        const refreshBtn = document.getElementById('infinite-refresh-dungeons-btn');
        if (listEl) {
            listEl.innerHTML = '<div class="infinite-empty-hint">正在为你生成与你评级相匹配的副本列表…</div>';
        }
        if (refreshBtn) refreshBtn.disabled = true;

        try {
            const reply = await callInfiniteApi('dungeon_list', { role });
            const text = (reply || '').trim();
            const dungeons = normalizeInfiniteDungeonsFromAi(text, role);
            role.lastDungeonList = dungeons;
            saveInfiniteState();
            renderInfiniteDungeonList();
        } catch (e) {
            console.error('生成无限流副本列表失败', e);
            if (typeof showToast === 'function') {
                showToast('生成副本列表时出现问题，将使用本地占位副本');
            }
            const role2 = getCurrentInfiniteRole();
            if (role2) {
                role2.lastDungeonList = buildFallbackInfiniteDungeons(role2);
                saveInfiniteState();
                renderInfiniteDungeonList();
            }
        } finally {
            if (refreshBtn) refreshBtn.disabled = false;
        }
    }

    function bindInfiniteTabBar() {
        const tabBar = document.getElementById('infinite-tab-bar');
        if (!tabBar) return;
        tabBar.addEventListener('click', (e) => {
            const btn = e.target.closest('.infinite-tab-btn');
            if (!btn) return;
            const tab = btn.dataset.tab || 'home';

            tabBar.querySelectorAll('.infinite-tab-btn').forEach(b => {
                b.classList.toggle('active', b === btn);
            });

            const sections = document.querySelectorAll('.infinite-section');
            sections.forEach(sec => {
                const id = sec.id || '';
                if (tab === 'home') {
                    sec.classList.toggle('active', id === 'infinite-home-section');
                } else if (tab === 'dungeon') {
                    sec.classList.toggle('active', id === 'infinite-dungeon-section');
                } else if (tab === 'profile') {
                    sec.classList.toggle('active', id === 'infinite-profile-section');
                }
            });
        });
    }

    function bindInfiniteRoleActions() {
        const bindBtn = document.getElementById('infinite-bind-role-btn');
        const swordBtn = document.getElementById('infinite-sword-btn');
        const refreshBtn = document.getElementById('infinite-refresh-dungeons-btn');

        if (bindBtn && !bindBtn.dataset.infiniteBound) {
            bindBtn.dataset.infiniteBound = 'true';
            bindBtn.addEventListener('click', () => {
                try {
                    handleInfiniteBindRole();
                } catch (e) {
                    console.error('绑定无限流角色失败', e);
                    if (typeof showToast === 'function') {
                        showToast('绑定角色时出现问题');
                    }
                }
            });
        }

        if (swordBtn && !swordBtn.dataset.infiniteBound) {
            swordBtn.dataset.infiniteBound = 'true';
            swordBtn.addEventListener('click', () => {
                if (swordBtn.disabled) {
                    if (typeof showToast === 'function') {
                        showToast('先去「个人中心」绑定一个角色，再来点我。');
                    }
                    return;
                }
                generateInfiniteDungeonsForCurrentRole();
            });
        }

        if (refreshBtn && !refreshBtn.dataset.infiniteBound) {
            refreshBtn.dataset.infiniteBound = 'true';
            refreshBtn.addEventListener('click', () => {
                generateInfiniteDungeonsForCurrentRole();
            });
        }
    }

    function handleInfiniteBindRole() {
        const ais = Array.isArray(window.aiList) ? window.aiList : [];
        const users = Array.isArray(window.userProfiles) ? window.userProfiles : [];

        let base = null;
        let roleId = null;

        if (ais.length > 0) {
            const ai = ais[0];
            roleId = `ai-${ai.id}`;
            base = {
                id: roleId,
                sourceType: 'ai',
                sourceId: ai.id,
                name: ai.name || '未命名角色',
                avatar: ai.avatar || DEFAULT_AI_AVATAR_URL
            };
        } else if (users.length > 0) {
            const u = users[0];
            roleId = `user-${u.id}`;
            base = {
                id: roleId,
                sourceType: 'user',
                sourceId: u.id,
                name: u.name || '我',
                avatar: u.avatar || DEFAULT_USER_AVATAR_URL
            };
        } else {
            if (typeof showToast === 'function') {
                showToast('当前还没有可用的角色，请先在 QQ 中创建至少一个用户或 AI 角色。');
            }
            return;
        }

        const role = ensureInfiniteRole(roleId, base);
        infiniteState.currentRoleId = role.id;
        saveInfiniteState();
        renderInfiniteRoleSummary();
        updateInfiniteSwordButtonState();

        if (typeof showToast === 'function') {
            showToast(`已绑定角色：${role.name || '未命名角色'}`);
        }
    }

    function initInfiniteApp() {
        const page = document.getElementById('infinite-page');
        if (!page) return;

        // 只初始化一次
        if (page.dataset.infiniteInited === 'true') {
            renderInfiniteRoleSummary();
            updateInfiniteSwordButtonState();
            renderInfiniteDungeonList();
            return;
        }
        page.dataset.infiniteInited = 'true';

        bindInfiniteTabBar();
        bindInfiniteRoleActions();
        renderInfiniteRoleSummary();
        updateInfiniteSwordButtonState();
        renderInfiniteDungeonList();
    }

    const truthGame = (function() {
        const setupOverlay   = document.getElementById('truth-game-setup-overlay');
        const playerCountEl  = document.getElementById('truth-game-player-count');
        const playerListEl   = document.getElementById('truth-game-player-list');
        const setupStartBtn  = document.getElementById('truth-game-start-btn');
        const playersBarEl   = document.getElementById('truth-game-players');
        const modeEl         = document.getElementById('truth-game-mode');
        const logEl          = document.getElementById('truth-game-log');
        const statusEl       = document.getElementById('truth-game-status');
        const inputEl        = document.getElementById('truth-game-input');
        const continueBtn    = document.getElementById('truth-game-continue-btn');
        const rerollBtn      = document.getElementById('truth-game-reroll-btn');
        const backBtn        = document.getElementById('truth-game-back-btn');
        const setupCancelBtn = document.getElementById('truth-game-cancel-btn');
        const pageEl         = document.getElementById('truth-game-page');

        if (!pageEl || !modeEl || !logEl) {
            console.warn('真心话大冒险初始化失败：未找到必要的 HTML 元素。');
            return {
                openSetup: () => {},
                reset: () => {}
            };
        }
const truthPool = [
            '说出一个你一直不敢在酒桌上说出口的真实想法。',
            '说一件最近让你感到很幸福但又有点害羞提起的事。',
            '说一个你至今忘不掉的人，以及一个关于 TA 的细节。',
            '说一个你酒醒之后也不会后悔现在在这里的原因。',
            '说一件你做错过的事，如果能重来你会怎么做。'
        ];

        const darePool = [
            '站起来绕包厢一圈，边走边给每个人来一句真诚的夸奖。',
            '模仿一个你最喜欢的影视角色，用台词向在场某人“表白”。',
            '现场编一段三句的小故事，故事里必须出现在场三个人的名字。',
            '给手机通讯录里某个人发一句“我现在在酒吧想你”，并读出对方回复。',
            '当场用最浮夸的语气，说一句今天对自己的鼓励。'
        ];

        let truthGameState = {
            isRunning: false,
            round: 0,
            players: [],
            alivePlayerIds: [],
            eliminatedPlayerIds: [],
            lastRound: null,
            winnerId: null
        };

        let setupInited = false;

        function getMaxPlayersFromSetup() {
            if (!playerCountEl) return 4;
            const activeBtn = playerCountEl.querySelector('.count-btn.active');
            if (!activeBtn) return 4;
            const n = parseInt(activeBtn.dataset.size, 10);
            return [4, 6, 8].includes(n) ? n : 4;
        }

        function renderSetupPlayerList() {
            if (!playerListEl) return;
            playerListEl.innerHTML = '';

            const rows = [];

            const meProfile = userProfiles && userProfiles.length > 0 ? userProfiles[0] : null;
            if (meProfile) {
                rows.push({
                    id: `user-${meProfile.id}`,
                    sourceType: 'user',
                    sourceId: meProfile.id,
                    name: meProfile.name || '我',
                    avatar: meProfile.avatar || DEFAULT_USER_AVATAR_URL,
                    desc: '默认玩家（你自己）',
                    alwaysChecked: true
                });
            }

            (aiList || []).forEach(ai => {
                rows.push({
                    id: `ai-${ai.id}`,
                    sourceType: 'ai',
                    sourceId: ai.id,
                    name: ai.name || '未命名角色',
                    avatar: ai.avatar || DEFAULT_AI_AVATAR_URL,
                    desc: 'AI 好友：' + (ai.nickname || ''),
                    alwaysChecked: false
                });
            });

            rows.forEach(row => {
                const li = document.createElement('div');
                li.className = 'truth-game-player-row';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = row.alwaysChecked;
                checkbox.disabled = row.alwaysChecked;
                checkbox.dataset.pid = row.id;
                checkbox.dataset.type = row.sourceType;
                checkbox.dataset.sourceId = row.sourceId;

                const avatar = document.createElement('img');
                avatar.className = 'truth-game-player-row-avatar';
                avatar.src = row.avatar;

                const main = document.createElement('div');
                main.className = 'truth-game-player-row-main';

                const nameEl = document.createElement('div');
                nameEl.className = 'truth-game-player-row-name';
                nameEl.textContent = row.name;

                const descEl = document.createElement('div');
                descEl.className = 'truth-game-player-row-desc';
                descEl.textContent = row.desc;

                main.appendChild(nameEl);
                main.appendChild(descEl);

                li.appendChild(avatar);
                li.appendChild(main);
                li.appendChild(checkbox);

                playerListEl.appendChild(li);
            });
        }

        function getSelectedPlayerNodes() {
            if (!playerListEl) return [];
            const checkboxes = playerListEl.querySelectorAll('input[type="checkbox"]');
            const selected = [];
            checkboxes.forEach(cb => {
                if (cb.checked) {
                    selected.push({
                        pid: cb.dataset.pid,
                        type: cb.dataset.type,
                        sourceId: cb.dataset.sourceId
                    });
                }
            });
            return selected;
        }

        function initSetupEvents() {
            if (setupInited) return;
            setupInited = true;

            if (playerCountEl) {
                playerCountEl.addEventListener('click', (e) => {
                    const btn = e.target.closest('.count-btn');
                    if (!btn) return;
                    playerCountEl.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            }

            if (setupCancelBtn) {
                setupCancelBtn.addEventListener('click', () => {
                    if (setupOverlay) setupOverlay.classList.remove('active');
                });
            }

            if (setupStartBtn) {
                setupStartBtn.addEventListener('click', () => {
                    startGameFromSetup();
                });
            }
        }

        function startGameFromSetup() {
            const maxPlayers = getMaxPlayersFromSetup();
            const selectedNodes = getSelectedPlayerNodes();

            if (selectedNodes.length !== maxPlayers) {
                showToast(`需要正好选择 ${maxPlayers} 位玩家（含你自己），当前为 ${selectedNodes.length} 位`);
                return;
            }

            const players = [];
            selectedNodes.forEach(s => {
                if (s.type === 'user') {
                    const u = userProfiles.find(p => String(p.id) === String(s.sourceId));
                    if (u) {
                        players.push({
                            id: `user-${u.id}`,
                            sourceType: 'user',
                            sourceId: u.id,
                            name: u.name || '我',
                            avatar: u.avatar || DEFAULT_USER_AVATAR_URL,
                            prompt: u.prompt || '',
                            eliminated: false
                        });
                    }
                } else if (s.type === 'ai') {
                    const a = aiList.find(p => String(p.id) === String(s.sourceId));
                    if (a) {
                        players.push({
                            id: `ai-${a.id}`,
                            sourceType: 'ai',
                            sourceId: a.id,
                            name: a.name || '未命名角色',
                            avatar: a.avatar || DEFAULT_AI_AVATAR_URL,
                            prompt: a.prompt || '',
                            eliminated: false
                        });
                    }
                }
            });

            if (players.length !== maxPlayers) {
                showToast('有部分玩家数据未能正确读取，请重试');
                return;
            }

            truthGameState = {
                isRunning: true,
                round: 0,
                players,
                alivePlayerIds: players.map(p => p.id),
                eliminatedPlayerIds: [],
                lastRound: null,
                winnerId: null
            };

            if (setupOverlay) setupOverlay.classList.remove('active');
            renderTruthGamePlayers();
            resetLogWithIntro();
            updateModeLabel();

            if (typeof openPage === 'function') {
                openPage('truth-game-page');
            } else {
                pageEl.classList.add('active');
            }
        }

        function renderTruthGamePlayers() {
            if (!playersBarEl) return;
            playersBarEl.innerHTML = '';

            truthGameState.players.forEach(p => {
                const item = document.createElement('div');
                item.className = 'truth-game-player-item' + (p.eliminated ? ' eliminated' : '');

                const img = document.createElement('img');
                img.className = 'truth-game-player-avatar';
                img.src = p.avatar || DEFAULT_AI_AVATAR_URL;
                img.alt = p.name;

                const nameEl = document.createElement('div');
                nameEl.className = 'truth-game-player-name';
                nameEl.textContent = p.name;

                item.appendChild(img);
                item.appendChild(nameEl);
                playersBarEl.appendChild(item);
            });
        }

        function resetLogWithIntro() {
            if (!logEl) return;
            logEl.innerHTML = '';
            const p = document.createElement('p');
            p.className = 'truth-game-log-placeholder';
            p.innerHTML = '默认场景：现实里的酒吧包厢，大家围坐在一张桌子旁。<br>点击下方“继续”按钮，开始第 1 回合（萝卜蹲）。';
            logEl.appendChild(p);
        }

        function appendTruthGameLog(text) {
            if (!logEl) return;
            const placeholder = logEl.querySelector('.truth-game-log-placeholder');
            if (placeholder) placeholder.remove();

            const safeText = escapeHTML(String(text || ''));

            // 按段落与换行进行简单排版：
            // - 连续两个及以上换行视为新段落
            // - 单个换行渲染为 <br>
            const paragraphs = safeText
                .split(/\n{2,}/)
                .map(part => part.trim())
                .filter(part => part.length > 0);

            const wrapper = document.createElement('div');
            wrapper.className = 'truth-game-log-block';

            if (paragraphs.length === 0) {
                const p = document.createElement('p');
                p.innerHTML = safeText.replace(/\n/g, '<br>');
                wrapper.appendChild(p);
            } else {
                paragraphs.forEach(paragraph => {
                    const p = document.createElement('p');
                    p.innerHTML = paragraph.replace(/\n/g, '<br>');
                    wrapper.appendChild(p);
                });
            }

            logEl.appendChild(wrapper);
            logEl.scrollTop = logEl.scrollHeight;
        }

        function setTruthGameStatus(text) {
            if (!statusEl) return;
            if (text) {
                statusEl.innerText = text;
                statusEl.classList.add('active');
            } else {
                statusEl.innerText = '';
                statusEl.classList.remove('active');
            }
        }

        function updateModeLabel() {
            if (!modeEl) return;
            if (!truthGameState.isRunning) {
                modeEl.innerText = '未开始';
                return;
            }
            const nextRound = truthGameState.round + 1;
            const gameName = nextRound % 2 === 1 ? '萝卜蹲' : '321 木头人';
            modeEl.innerText = `第 ${nextRound} 回合 · ${gameName}`;
        }

        async function runRound(isReroll = false) {
            if (!config.key || !config.url) {
                showToast('请先在设置中配置 API！');
                return;
            }
            if (!truthGameState.isRunning && !isReroll) {
                showToast('请先在游戏大厅选择玩家并开始一局游戏。');
                return;
            }
            if (truthGameState.winnerId && !isReroll) {
                showToast('本局游戏已经结束，可以重新开一局。');
                return;
            }
            if (truthGameState.alivePlayerIds.length <= 1 && !isReroll) {
                showToast('剩余玩家不足以继续游戏。');
                return;
            }

            let roundConfig;
            if (isReroll && truthGameState.lastRound) {
                roundConfig = truthGameState.lastRound;
            } else {
                truthGameState.round += 1;
                const gameName = truthGameState.round % 2 === 1 ? '萝卜蹲' : '321 木头人';
                const alivePlayers = truthGameState.players.filter(p => truthGameState.alivePlayerIds.includes(p.id));
                const eliminatedPlayers = truthGameState.players.filter(p => truthGameState.eliminatedPlayerIds.includes(p.id));

                roundConfig = {
                    round: truthGameState.round,
                    gameName,
                    alivePlayers,
                    eliminatedPlayers
                };
                truthGameState.lastRound = roundConfig;
            }

            updateModeLabel();

            const aliveDesc = roundConfig.alivePlayers.map(p => `- ${p.name}：性格简介：${p.prompt || '略'}`).join('\n');
            const eliminatedDesc = roundConfig.eliminatedPlayers.length > 0
                ? roundConfig.eliminatedPlayers.map(p => `- ${p.name}`).join('\n')
                : '暂无（第一轮）';

            const truthListText = truthPool.map((t, i) => `${i + 1}. ${t}`).join('\n');
            const dareListText = darePool.map((t, i) => `${i + 1}. ${t}`).join('\n');

            const extraHint = (inputEl && inputEl.value.trim()) || '';
            if (inputEl) {
                // 每一回合开始后就清空输入框，避免旧的情节提示一直保留在界面上
                inputEl.value = '';
            }

            const promptParts = [];
            promptParts.push(
                '你现在是一个“隐形主持人 AI”，负责在现实世界的酒吧包厢里，用中文叙事的方式，主持一场真心话大冒险游戏。',
                '所有参与者都是真实的人或带有明显人格特征的 AI 角色，你要根据他们的性格，让故事自然、有画面感，不要机械。',
                '\n[游戏场景]\n所有人聚在现实里的酒吧包厢，桌上有酒、水果、小吃，气氛轻松，可以有背景音乐、人声等描写。',
                `\n[当前回合信息]\n回合编号：${roundConfig.round}\n本回合玩法：${roundConfig.gameName}`,
                '\n[当前还在场的玩家列表（必须主要围绕这些人来写）]\n' + aliveDesc,
                '\n[已经被选中过并淘汰的玩家]\n' + eliminatedDesc,
                '\n[真心话题库]（如果本轮抽到真心话，从这里任选一题给该玩家，题目内容要写出来）\n' + truthListText,
                '\n[大冒险题库]（如果本轮抽到大冒险，从这里任选一题给该玩家，题目内容要写出来）\n' + dareListText
            );

            if (extraHint) {
                promptParts.push(
                    '\n[额外情景提示]\n以下是一名玩家对目前剧情进展的说明，请把它当作已经发生的事实，在新的叙事里自然衔接，不要推翻或重置之前的进度：\n' + extraHint
                );
            }

            promptParts.push(
                '\n[叙事要求]\n',
                '1. 先简要描写一下此刻包厢里的氛围（灯光、音乐、大家的状态等）。',
                `2. 描写一小段本轮“${roundConfig.gameName}”游戏的进行过程，可以有少量对白，但不要太长。`,
                '3. 明确只有一名玩家在本轮游戏中失误，且这一名失误者必须来自“当前还在场的玩家列表”。',
                '4. 由这名失误者在“真心话”和“大冒险”之间做出选择：性格偏内向/谨慎的人更容易选真心话；外向/爱玩的人更容易选大冒险，但你可以根据氛围灵活决定。',
                '5. 根据失误者选项，从对应题库中任选 1 题，并在叙事中写出完整题目内容。',
                '6. 详细描写失误者面对这道真心话题或大冒险任务时的表现、心理和语言，以及其他人的反应（包括调侃、起哄、暖场等）。',
                '7. 文字风格可以有一点幽默和生活感，但不要太夸张；注意保持场景连贯。',
                '8. 本轮结束后，这名失误者从游戏中“淘汰”（后面回合不再参与）。',
                '9. 如果本轮结束后只剩下 1 名玩家还从未被选中过，你要在叙事结尾自然地点明 TA 是到目前为止“唯一没有被抽到过的人”，暗示 TA 正在走向胜利。',
                '10. 叙事部分不需要解释规则，不要加小标题，也不要出现“系统提示”之类的词。',
                '\n[机器可读结果输出]\n',
                '在叙事文本之后，追加一行机器可读的结构化结果，格式如下（注意大小写和冒号）：',
                'ROUND_RESULT: {"loserName":"某位玩家的名字，必须与上面玩家列表中的某个名字完全一致","choice":"truth 或 dare 二选一，分别表示真心话或大冒险"}',
                '其中 JSON 对象必须是有效 JSON，不能省略引号；必须严格只包含这两个字段。',
                '不要在 ROUND_RESULT 行后面再写别的内容。'
            );

            const finalPrompt = promptParts.join('\n');

            let reply;
            try {
                reply = await getCompletion(finalPrompt, false);
            } catch (e) {
                console.error('Truth or Dare API error:', e);
                showToast('真心话大冒险本轮生成失败：' + e.message);
                return;
            }

            if (!reply || typeof reply !== 'string') {
                showToast('AI 返回内容为空');
                return;
            }

            const rrIndex = reply.lastIndexOf('ROUND_RESULT:');
            let narrative = reply;
            let loserName = null;
            let choice = null;

            if (rrIndex !== -1) {
                narrative = reply.substring(0, rrIndex).trim();
                const jsonPart = reply.substring(rrIndex + 'ROUND_RESULT:'.length).trim();
                const pureJson = extractFirstJsonObject(jsonPart) || jsonPart;
                try {
                    const obj = JSON.parse(pureJson);
                    loserName = obj.loserName || null;
                    choice = obj.choice || null;
                } catch (e) {
                    console.warn('解析 ROUND_RESULT JSON 失败：', e, jsonPart);
                }
            }

            if (narrative) {
                appendTruthGameLog(narrative.trim());
            }

            if (!loserName) {
                showToast('AI 没有在结果中标明失误者，暂不进行淘汰。');
                return;
            }

            const loser = truthGameState.players.find(p => !p.eliminated && p.name === loserName);
            if (!loser) {
                showToast('AI 指定的失误者在当前玩家中找不到，暂不进行淘汰。');
                return;
            }

            if (!isReroll) {
                loser.eliminated = true;
                if (!truthGameState.eliminatedPlayerIds.includes(loser.id)) {
                    truthGameState.eliminatedPlayerIds.push(loser.id);
                }
                truthGameState.alivePlayerIds = truthGameState.alivePlayerIds.filter(id => id !== loser.id);
                renderTruthGamePlayers();

                if (truthGameState.alivePlayerIds.length === 1 && !truthGameState.winnerId) {
                    const winner = truthGameState.players.find(p => p.id === truthGameState.alivePlayerIds[0]);
                    if (winner) {
                        truthGameState.winnerId = winner.id;
                        truthGameState.isRunning = false;
                        appendTruthGameLog(`直到最后一次都没有被抽到的人，是「${winner.name}」。TA 成为了本局真心话大冒险的最终赢家。`);
                        modeEl.innerText = '本局已结束';
                    }
                }
            }
        }

        function bindMainButtons() {
            if (continueBtn) {
                continueBtn.addEventListener('click', async () => {
                    continueBtn.disabled = true;
                    rerollBtn && (rerollBtn.disabled = true);
                    setTruthGameStatus('游戏进行中……');
                    try {
                        await runRound(false);
                    } finally {
                        setTruthGameStatus('');
                        continueBtn.disabled = false;
                        rerollBtn && (rerollBtn.disabled = false);
                    }
                });
            }

            if (rerollBtn) {
                rerollBtn.addEventListener('click', async () => {
                    if (!truthGameState.lastRound) {
                        showToast('当前还没有可以重说的回合');
                        return;
                    }
                    continueBtn && (continueBtn.disabled = true);
                    rerollBtn.disabled = true;
                    setTruthGameStatus('时间倒流中……');
                    try {
                        await runRound(true);
                    } finally {
                        setTruthGameStatus('');
                        continueBtn && (continueBtn.disabled = false);
                        rerollBtn.disabled = false;
                    }
                });
            }

            if (backBtn) {
                backBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    truthGameState.isRunning = false;
                    if (typeof closePage === 'function') {
                        closePage('truth-game-page');
                    } else {
                        pageEl.classList.remove('active');
                    }
                });
            }
        }

        function openTruthGameSetup() {
            if (!setupOverlay) {
                showToast('当前页面未配置真心话大冒险开局弹窗。');
                return;
            }
            initSetupEvents();
            renderSetupPlayerList();
            setupOverlay.classList.add('active');
        }

        bindMainButtons();

        window.openTruthGameSetup = openTruthGameSetup;

        return {
            openSetup: openTruthGameSetup
        };
    })();

    const drawGuessGame = (function() {
        const setupOverlay      = document.getElementById('draw-guess-setup-overlay');
        const playerCountEl     = document.getElementById('draw-guess-player-count');
        const userRoleListEl    = document.getElementById('draw-guess-user-role-list');
        const aiRoleListEl      = document.getElementById('draw-guess-ai-role-list');
        const setupCancelBtn    = document.getElementById('draw-guess-cancel-btn');
        const setupStartBtn     = document.getElementById('draw-guess-start-btn');

        const pageEl            = document.getElementById('draw-guess-page');
        const subtitleEl        = document.getElementById('draw-guess-subtitle');
        const playersBarEl      = document.getElementById('draw-guess-players');
        const hintListEl        = document.getElementById('draw-guess-hint-list');
        const statusEl          = document.getElementById('draw-guess-status');
        const guessListEl       = document.getElementById('draw-guess-guess-list');
        const guessInputEl      = document.getElementById('draw-guess-guess-input');
        const guessSubmitBtn    = document.getElementById('draw-guess-submit-btn');
        const drawerPanelEl     = document.getElementById('draw-guess-drawer-panel');
        const hintInputEl       = document.getElementById('draw-guess-hint-input');
        const addHintBtn        = document.getElementById('draw-guess-add-hint-btn');
        const aiHintBtn         = document.getElementById('draw-guess-ai-hint-btn');
        const roundLabelEl      = document.getElementById('draw-guess-round-label');
        const newRoundBtn       = document.getElementById('draw-guess-new-round-btn');
        const backBtn           = document.getElementById('draw-guess-back-btn');

        if (!pageEl) {
            // 当前构建未包含你画我猜的 DOM，则直接返回空实现，避免报错
            return {
                openSetup: () => {}
            };
        }

        const MAX_ATTEMPTS_PER_ROUND = 3;

        const drawGuessState = {
            playerCount: 2,
            players: [], // { id, sourceType, sourceId, name, avatar, prompt, isUser, isDrawer }
            answer: '',
            normalizedAnswer: '',
            drawerIndex: 0,
            remainingAttempts: MAX_ATTEMPTS_PER_ROUND,
            hints: [], // { text, fromAI: boolean }
            guesses: [] // { text, correct: boolean }
        };

        let setupInited = false;

        function normalizeText(str) {
            return String(str || '')
                .trim()
                .toLowerCase()
                .replace(/[\s\u3000]+/g, '')
                .replace(/[，。,\.！!？?、:：;；"“”'‘’]/g, '');
        }

        function getSelectedPlayerCount() {
            if (!playerCountEl) return 2;
            const active = playerCountEl.querySelector('.count-btn.active');
            if (!active) return 2;
            const n = parseInt(active.dataset.size, 10);
            return n === 4 ? 4 : 2;
        }

        function renderUserRoleList() {
            if (!userRoleListEl) return;
            userRoleListEl.innerHTML = '';

            const users = Array.isArray(userProfiles) ? userProfiles : [];
            if (users.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'draw-guess-role-empty';
                empty.textContent = '当前还没有用户角色，请先在 QQ 中创建。';
                userRoleListEl.appendChild(empty);
                return;
            }

            users.forEach((u, index) => {
                const item = document.createElement('div');
                item.className = 'draw-guess-role-item user-role' + (index === 0 ? ' active' : '');
                item.dataset.id = u.id;

                const avatar = document.createElement('img');
                avatar.className = 'draw-guess-role-avatar';
                avatar.src = u.avatar || DEFAULT_USER_AVATAR_URL;

                const main = document.createElement('div');
                main.className = 'draw-guess-role-main';

                const nameEl = document.createElement('div');
                nameEl.className = 'draw-guess-role-name';
                nameEl.textContent = u.name || '我';

                const descEl = document.createElement('div');
                descEl.className = 'draw-guess-role-desc';
                descEl.textContent = '用户角色';

                main.appendChild(nameEl);
                main.appendChild(descEl);

                item.appendChild(avatar);
                item.appendChild(main);

                item.addEventListener('click', () => {
                    const siblings = userRoleListEl.querySelectorAll('.draw-guess-role-item');
                    siblings.forEach(s => s.classList.remove('active'));
                    item.classList.add('active');
                });

                userRoleListEl.appendChild(item);
            });
        }

        function renderAiRoleList() {
            if (!aiRoleListEl) return;
            aiRoleListEl.innerHTML = '';

            const maxPlayers = getSelectedPlayerCount();
            const maxAi = Math.max(0, maxPlayers - 1); // 除用户外的其余玩家

            const ais = Array.isArray(aiList) ? aiList : [];
            if (ais.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'draw-guess-role-empty';
                empty.textContent = '当前还没有 AI 好友，请先在 QQ 中创建。';
                aiRoleListEl.appendChild(empty);
                return;
            }

            ais.forEach(ai => {
                const item = document.createElement('div');
                item.className = 'draw-guess-role-item ai-role';
                item.dataset.id = ai.id;

                const avatar = document.createElement('img');
                avatar.className = 'draw-guess-role-avatar';
                avatar.src = ai.avatar || DEFAULT_AI_AVATAR_URL;

                const main = document.createElement('div');
                main.className = 'draw-guess-role-main';

                const nameEl = document.createElement('div');
                nameEl.className = 'draw-guess-role-name';
                nameEl.textContent = ai.name || '未命名角色';

                const descEl = document.createElement('div');
                descEl.className = 'draw-guess-role-desc';
                descEl.textContent = ai.nickname ? `AI 好友 · ${ai.nickname}` : 'AI 好友';

                main.appendChild(nameEl);
                main.appendChild(descEl);

                item.appendChild(avatar);
                item.appendChild(main);

                item.addEventListener('click', () => {
                    const selected = Array.from(aiRoleListEl.querySelectorAll('.draw-guess-role-item.ai-role.active'));
                    const isActive = item.classList.contains('active');

                    if (isActive) {
                        item.classList.remove('active');
                        return;
                    }

                    if (selected.length >= maxAi) {
                        if (typeof showToast === 'function') {
                            showToast(`当前为 ${maxPlayers} 人局，最多只能选择 ${maxAi} 个 AI 好友。`);
                        }
                        return;
                    }
                    item.classList.add('active');
                });

                aiRoleListEl.appendChild(item);
            });
        }

        function collectSelectedPlayers() {
            const maxPlayers = getSelectedPlayerCount();

            let userPlayer = null;
            const userItem = userRoleListEl && userRoleListEl.querySelector('.draw-guess-role-item.user-role.active');
            if (userItem) {
                const uid = userItem.dataset.id;
                const u = (userProfiles || []).find(p => String(p.id) === String(uid));
                if (u) {
                    userPlayer = {
                        id: `user-${u.id}`,
                        sourceType: 'user',
                        sourceId: u.id,
                        name: u.name || '我',
                        avatar: u.avatar || DEFAULT_USER_AVATAR_URL,
                        prompt: u.prompt || '',
                        isUser: true,
                        isDrawer: false
                    };
                }
            }

            const aiPlayers = [];
            if (aiRoleListEl) {
                const aiItems = aiRoleListEl.querySelectorAll('.draw-guess-role-item.ai-role.active');
                aiItems.forEach(item => {
                    const aid = item.dataset.id;
                    const ai = (aiList || []).find(p => String(p.id) === String(aid));
                    if (ai) {
                        aiPlayers.push({
                            id: `ai-${ai.id}`,
                            sourceType: 'ai',
                            sourceId: ai.id,
                            name: ai.name || '未命名角色',
                            avatar: ai.avatar || DEFAULT_AI_AVATAR_URL,
                            prompt: ai.prompt || '',
                            isUser: false,
                            isDrawer: false
                        });
                    }
                });
            }

            if (!userPlayer) {
                throw new Error('必须选择 1 个用户角色');
            }

            if (aiPlayers.length !== maxPlayers - 1) {
                throw new Error(`当前为 ${maxPlayers} 人局，需要再选择 ${maxPlayers - 1} 个 AI 好友，当前为 ${aiPlayers.length} 个。`);
            }

            return [userPlayer, ...aiPlayers];
        }

        function renderPlayersBar() {
            if (!playersBarEl) return;
            playersBarEl.innerHTML = '';

            drawGuessState.players.forEach((p, index) => {
                const item = document.createElement('div');
                item.className = 'draw-guess-player-item' + (index === drawGuessState.drawerIndex ? ' drawer' : '');

                const avatar = document.createElement('img');
                avatar.className = 'draw-guess-player-avatar';
                avatar.src = p.avatar || DEFAULT_AI_AVATAR_URL;

                const nameEl = document.createElement('div');
                nameEl.className = 'draw-guess-player-name';
                nameEl.textContent = p.name;

                const tagEl = document.createElement('div');
                tagEl.className = 'draw-guess-player-tag';
                tagEl.textContent = index === drawGuessState.drawerIndex ? '画画方' : '猜题方';

                item.appendChild(avatar);
                item.appendChild(nameEl);
                item.appendChild(tagEl);

                playersBarEl.appendChild(item);
            });
        }

        function renderHints() {
            if (!hintListEl) return;
            hintListEl.innerHTML = '';

            if (!drawGuessState.hints.length) {
                const p = document.createElement('p');
                p.className = 'draw-guess-placeholder';
                p.textContent = '等待画画方给出第一笔描述。';
                hintListEl.appendChild(p);
                return;
            }

            drawGuessState.hints.forEach((h, idx) => {
                const row = document.createElement('div');
                row.className = 'draw-guess-hint-row' + (h.fromAI ? ' from-ai' : '');

                const indexEl = document.createElement('span');
                indexEl.className = 'draw-guess-hint-index';
                indexEl.textContent = `第 ${idx + 1} 笔`;

                const textEl = document.createElement('span');
                textEl.className = 'draw-guess-hint-text';
                textEl.textContent = h.text;

                row.appendChild(indexEl);
                row.appendChild(textEl);

                hintListEl.appendChild(row);
            });

            hintListEl.scrollTop = hintListEl.scrollHeight;
        }

        function renderGuesses() {
            if (!guessListEl) return;
            guessListEl.innerHTML = '';

            if (!drawGuessState.guesses.length) return;

            drawGuessState.guesses.forEach((g, idx) => {
                const row = document.createElement('div');
                row.className = 'draw-guess-guess-row' + (g.correct ? ' correct' : '');

                const indexEl = document.createElement('span');
                indexEl.className = 'draw-guess-guess-index';
                indexEl.textContent = `尝试 ${idx + 1}`;

                const textEl = document.createElement('span');
                textEl.className = 'draw-guess-guess-text';
                textEl.textContent = g.text;

                row.appendChild(indexEl);
                row.appendChild(textEl);

                guessListEl.appendChild(row);
            });

            guessListEl.scrollTop = guessListEl.scrollHeight;
        }

        function updateStatus(text) {
            if (!statusEl) return;
            if (text) {
                statusEl.textContent = text;
                statusEl.classList.add('active');
            } else {
                statusEl.textContent = '';
                statusEl.classList.remove('active');
            }
        }

        function updateRoundLabel() {
            if (!roundLabelEl) return;
            roundLabelEl.textContent = `本题剩余尝试：${drawGuessState.remainingAttempts} 次`;
        }

        function updateDrawerPanelVisibility() {
            if (!drawerPanelEl) return;
            const drawer = drawGuessState.players[drawGuessState.drawerIndex];
            if (!drawer) {
                drawerPanelEl.style.display = 'none';
                return;
            }
            // 只有当画画方是“我”时，才展示手动画画输入区
            drawerPanelEl.style.display = drawer.isUser ? 'block' : 'none';
        }

        function lockGameInteraction(lock) {
            if (guessSubmitBtn) guessSubmitBtn.disabled = lock;
            if (addHintBtn) addHintBtn.disabled = lock;
            if (aiHintBtn) aiHintBtn.disabled = lock;
            if (guessInputEl && lock) guessInputEl.blur();
        }

        async function ensureAnswerAndStart(players) {
            drawGuessState.players = players.slice();
            drawGuessState.hints = [];
            drawGuessState.guesses = [];
            drawGuessState.remainingAttempts = MAX_ATTEMPTS_PER_ROUND;

            // 随机选择画画方
            const drawerIndex = Math.floor(Math.random() * drawGuessState.players.length);
            drawGuessState.drawerIndex = drawerIndex;
            drawGuessState.players.forEach((p, idx) => {
                p.isDrawer = idx === drawerIndex;
            });

            renderPlayersBar();
            renderHints();
            renderGuesses();
            updateRoundLabel();
            updateDrawerPanelVisibility();

            if (subtitleEl) {
                const drawer = drawGuessState.players[drawerIndex];
                subtitleEl.textContent = `本题由「${drawer.name}」负责画画，其他人来猜。`;
            }

            let answerText = '';

            if (config && config.key && config.url) {
                const prompt = [
                    '你现在是一个「你画我猜」游戏的出题 AI。',
                    '请生成一个适合用简单线条画出来的中文名词或短语，不超过 10 个字。',
                    '例如：一只戴帽子的猫、在雨中打伞的人、摩天轮等。',
                    '只输出谜底本身，不要任何解释、前缀或标点。'
                ].join('\n');
                try {
                    const resp = await getCompletion(prompt, false);
                    if (typeof resp === 'string') {
                        answerText = resp.split(/\n+/)[0].trim();
                    }
                } catch (e) {
                    console.warn('draw-guess answer API error:', e);
                }
            }

            if (!answerText) {
                const fallbackAnswers = [
                    '一只戴帽子的猫',
                    '在雨中打伞的人',
                    '热气腾腾的咖啡',
                    '摩天轮',
                    '正在飞的纸飞机'
                ];
                answerText = fallbackAnswers[Math.floor(Math.random() * fallbackAnswers.length)];
            }

            drawGuessState.answer = answerText;
            drawGuessState.normalizedAnswer = normalizeText(answerText);

            if (subtitleEl) {
                subtitleEl.textContent += '（题目已生成）';
            }
        }

        async function handleAiHint() {
            const drawer = drawGuessState.players[drawGuessState.drawerIndex];
            if (!drawer) return;

            if (!config.key || !config.url) {
                const text = 'AI 画了一些细节，但你还看不出来是什么。';
                drawGuessState.hints.push({ text, fromAI: true });
                renderHints();
                return;
            }

            lockGameInteraction(true);
            updateStatus('AI 正在构思下一笔画面…');

            const historyText = drawGuessState.hints.map((h, idx) => `第${idx + 1}笔：${h.text}`).join('\n');

            const promptParts = [];
            promptParts.push(
                '你现在扮演一个「你画我猜」游戏里的画画方，用文字描述你在画布上的每一步动作。',
                `谜底是：「${drawGuessState.answer}」。`,
                '你不能直接说出或暗示答案本身，只能通过画面要素来让别人逐步接近答案。',
                '每次回答只描述一小步（不超过 20 个字），例如：画一个圆形的杯身、在左上角添一朵云等。'
            );

            if (historyText) {
                promptParts.push('\n[已经画过的内容]\n' + historyText);
                promptParts.push('请在以上画面的基础上，继续添加一个新的细节。');
            } else {
                promptParts.push('\n[当前是第一笔]\n请先画出一个最基础、最安全的轮廓。');
            }

            if (drawer.prompt) {
                promptParts.push(`\n[画画方的性格设定]\n${drawer.prompt}`);
            }

            const finalPrompt = promptParts.join('\n');

            try {
                const resp = await getCompletion(finalPrompt, false);
                let text = (resp || '').trim();
                text = text.split(/\n+/)[0].trim();
                if (!text) {
                    text = '画面上多出了一些细节，但还看不出是什么。';
                }
                drawGuessState.hints.push({ text, fromAI: true });
                renderHints();
            } catch (e) {
                console.error('draw-guess AI hint error:', e);
                if (typeof showToast === 'function') {
                    showToast('AI 画画失败，请稍后再试或手动描述。');
                }
            } finally {
                lockGameInteraction(false);
                updateStatus('');
            }
        }

        function handleAddManualHint() {
            if (!hintInputEl) return;
            const text = hintInputEl.value.trim();
            if (!text) {
                if (typeof showToast === 'function') {
                    showToast('请先写一点你画了什么。');
                }
                return;
            }
            drawGuessState.hints.push({ text, fromAI: false });
            hintInputEl.value = '';
            renderHints();
        }

        function finishRoundWithSuccess() {
            lockGameInteraction(true);
            if (newRoundBtn) newRoundBtn.style.display = 'inline-flex';

            if (subtitleEl) {
                subtitleEl.textContent = `本题已猜中！谜底是「${drawGuessState.answer}」。`;
            }

            if (typeof showToast === 'function') {
                showToast(`恭喜猜对！答案是「${drawGuessState.answer}」。`);
            }
        }

        function finishRoundWithFail() {
            lockGameInteraction(true);
            if (newRoundBtn) newRoundBtn.style.display = 'inline-flex';

            updateStatus(`本题无人猜中，答案是「${drawGuessState.answer}」。`);
            if (subtitleEl) {
                subtitleEl.textContent = '本题结束，下次可以再接再厉~';
            }

            if (typeof showToast === 'function') {
                showToast(`本题结束，答案是「${drawGuessState.answer}」。`);
            }
        }

        function handleGuessSubmit() {
            if (!guessInputEl) return;
            const rawText = guessInputEl.value.trim();
            if (!rawText) return;

            const normGuess = normalizeText(rawText);
            const normAnswer = drawGuessState.normalizedAnswer;

            const correct = normGuess && normAnswer && normGuess === normAnswer;

            drawGuessState.guesses.push({ text: rawText, correct });
            renderGuesses();

            guessInputEl.value = '';

            if (correct) {
                updateStatus('猜对了！');
                finishRoundWithSuccess();
                return;
            }

            drawGuessState.remainingAttempts -= 1;
            if (drawGuessState.remainingAttempts <= 0) {
                updateRoundLabel();
                finishRoundWithFail();
                return;
            }

            updateRoundLabel();
            updateStatus(`还没猜中，再试试？本题还剩 ${drawGuessState.remainingAttempts} 次尝试。`);
        }

        async function startGameFromSetup() {
            let players;
            try {
                players = collectSelectedPlayers();
            } catch (e) {
                if (typeof showToast === 'function') {
                    showToast(e.message || '玩家选择不合法');
                }
                return;
            }

            if (setupOverlay) setupOverlay.classList.remove('active');

            if (typeof openPage === 'function') {
                openPage('draw-guess-page');
            } else {
                pageEl.classList.add('active');
            }

            if (newRoundBtn) newRoundBtn.style.display = 'none';
            lockGameInteraction(false);
            updateStatus('正在为本局生成题目…');

            await ensureAnswerAndStart(players);

            updateStatus('题目已生成，画画方可以开始画第一笔。');
        }

        function bindSetupEvents() {
            if (setupInited) return;
            setupInited = true;

            if (playerCountEl) {
                playerCountEl.addEventListener('click', (e) => {
                    const btn = e.target.closest('.count-btn');
                    if (!btn) return;
                    playerCountEl.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    renderAiRoleList();
                });
            }

            if (setupCancelBtn) {
                setupCancelBtn.addEventListener('click', () => {
                    if (setupOverlay) setupOverlay.classList.remove('active');
                });
            }

            if (setupStartBtn) {
                setupStartBtn.addEventListener('click', () => {
                    startGameFromSetup();
                });
            }

            if (guessSubmitBtn) {
                guessSubmitBtn.addEventListener('click', () => {
                    handleGuessSubmit();
                });
            }

            if (guessInputEl) {
                guessInputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleGuessSubmit();
                    }
                });
            }

            if (addHintBtn) {
                addHintBtn.addEventListener('click', () => {
                    handleAddManualHint();
                });
            }

            if (aiHintBtn) {
                aiHintBtn.addEventListener('click', () => {
                    handleAiHint();
                });
            }

            if (newRoundBtn) {
                newRoundBtn.addEventListener('click', async () => {
                    if (!drawGuessState.players.length) return;
                    if (newRoundBtn) newRoundBtn.style.display = 'none';
                    lockGameInteraction(false);
                    updateStatus('正在为新的一题生成谜底…');
                    await ensureAnswerAndStart(drawGuessState.players);
                    updateStatus('新的一题已生成，画画方可以开始画第一笔。');
                });
            }

            if (backBtn) {
                backBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (typeof closePage === 'function') {
                        closePage('draw-guess-page');
                    } else {
                        pageEl.classList.remove('active');
                    }
                });
            }
        }

        function openDrawGuessSetup() {
            if (!setupOverlay) {
                if (typeof showToast === 'function') {
                    showToast('当前页面未配置「你画我猜」开局弹窗。');
                }
                return;
            }

            bindSetupEvents();
            renderUserRoleList();
            renderAiRoleList();
            drawGuessState.playerCount = getSelectedPlayerCount();

            setupOverlay.classList.add('active');
        }

        window.openDrawGuessSetup = openDrawGuessSetup;

        return {
            openSetup: openDrawGuessSetup
        };
    })();

    const werewolfGame = (function() {
        const setupOverlay       = document.getElementById('werewolf-setup-overlay');
        const pageEl             = document.getElementById('werewolf-page');

        // 如果当前构建没有包含狼人杀相关 DOM，则提供安全兜底，避免报错
        if (!setupOverlay || !pageEl) {
            window.openWerewolfSetup = function() {
                if (typeof showToast === 'function') {
                    showToast('当前页面未配置「狼人杀」模块。');
                }
            };
            return {
                openSetup: () => {}
            };
        }

        const playerCountEl      = document.getElementById('werewolf-player-count');
        const userRoleListEl     = document.getElementById('werewolf-user-role-list');
        const aiRoleListEl       = document.getElementById('werewolf-ai-role-list');
        const roleCivilianInput  = document.getElementById('werewolf-role-civilian');
        const roleWolfInput      = document.getElementById('werewolf-role-wolf');
        const roleSeerInput      = document.getElementById('werewolf-role-seer');
        const roleWitchInput     = document.getElementById('werewolf-role-witch');
        const roleGuardInput     = document.getElementById('werewolf-role-guard');
        const roleHunterInput    = document.getElementById('werewolf-role-hunter');
        const aiHintEl           = document.getElementById('werewolf-ai-hint');

        const cancelBtn          = document.getElementById('werewolf-cancel-btn');
        const startBtn           = document.getElementById('werewolf-start-btn');

        const subtitleEl         = document.getElementById('werewolf-subtitle');
        const phaseLabelEl       = document.getElementById('werewolf-phase-label');
        const playersBarEl       = document.getElementById('werewolf-players');
        const logEl              = document.getElementById('werewolf-log');
        const inputHintEl        = document.getElementById('werewolf-input-hint');
        const inputEl            = document.getElementById('werewolf-input');
        const sendBtn            = document.getElementById('werewolf-send-btn');
        const voteRowEl          = document.getElementById('werewolf-vote-row');
        const voteSelectEl       = document.getElementById('werewolf-vote-select');
        const voteBtn            = document.getElementById('werewolf-vote-btn');
        const backBtn            = document.getElementById('werewolf-back-btn');

        const ROLE_LABELS = {
            civilian: '平民',
            wolf: '狼人',
            seer: '预言家',
            witch: '女巫',
            guard: '守卫',
            hunter: '猎人'
        };

        const PHASE = {
            READY: 'ready',
            NIGHT: 'night',
            DAY_TALK: 'day_talk',
            DAY_VOTE: 'day_vote',
            ENDED: 'ended'
        };

        let setupInited = false;

        let werewolfState = {
            isRunning: false,
            day: 0,
            phase: PHASE.READY,
            players: [], // { id, sourceType, sourceId, name, avatar, prompt, role, side, alive, isUser }
            userPlayerId: null,
            history: [] // { day, phase, speakerName, text }
        };

        function getSelectedTotalPlayers() {
            if (!playerCountEl) return 6;
            const active = playerCountEl.querySelector('.count-btn.active');
            if (!active) return 6;
            const n = parseInt(active.dataset.size, 10);
            return [6, 8, 10].includes(n) ? n : 6;
        }

        function applyDefaultRoleConfig(total) {
            // 给一个比较经典的默认配置，用户可自行调整
            if (!roleCivilianInput || !roleWolfInput || !roleSeerInput || !roleWitchInput || !roleGuardInput || !roleHunterInput) return;

            let cfg;
            if (total === 6) {
                cfg = { civilian: 3, wolf: 2, seer: 1, witch: 0, guard: 0, hunter: 0 };
            } else if (total === 8) {
                cfg = { civilian: 4, wolf: 2, seer: 1, witch: 1, guard: 0, hunter: 0 };
            } else { // 10 人局
                cfg = { civilian: 5, wolf: 3, seer: 1, witch: 1, guard: 0, hunter: 0 };
            }

            roleCivilianInput.value = cfg.civilian;
            roleWolfInput.value     = cfg.wolf;
            roleSeerInput.value     = cfg.seer;
            roleWitchInput.value    = cfg.witch;
            roleGuardInput.value    = cfg.guard;
            roleHunterInput.value   = cfg.hunter;

            updateAiHint();
        }

        function getRoleConfig() {
            function v(input) {
                if (!input) return 0;
                const n = parseInt(input.value, 10);
                return Number.isFinite(n) && n >= 0 ? n : 0;
            }
            return {
                civilian: v(roleCivilianInput),
                wolf: v(roleWolfInput),
                seer: v(roleSeerInput),
                witch: v(roleWitchInput),
                guard: v(roleGuardInput),
                hunter: v(roleHunterInput)
            };
        }

        function validateRoleConfig(total, cfg) {
            const sum = cfg.civilian + cfg.wolf + cfg.seer + cfg.witch + cfg.guard + cfg.hunter;
            if (sum !== total) {
                return { ok: false, message: `当前职业人数总和为 ${sum}，需要等于 ${total} 人。` };
            }
            if (cfg.wolf <= 0) {
                return { ok: false, message: '至少需要 1 名狼人。' };
            }
            if (total < 4) {
                return { ok: false, message: '狼人杀至少需要 4 人局。' };
            }
            return { ok: true };
        }

        function renderUserRoleList() {
            if (!userRoleListEl) return;
            userRoleListEl.innerHTML = '';

            const users = Array.isArray(userProfiles) ? userProfiles : [];
            if (!users.length) {
                const empty = document.createElement('div');
                empty.className = 'werewolf-role-empty';
                empty.textContent = '当前还没有用户角色，请先在 QQ 中创建。';
                userRoleListEl.appendChild(empty);
                return;
            }

            users.forEach((u, index) => {
                const item = document.createElement('div');
                item.className = 'werewolf-role-item user-role' + (index === 0 ? ' active' : '');
                item.dataset.id = u.id;

                const avatar = document.createElement('img');
                avatar.className = 'werewolf-role-avatar';
                avatar.src = u.avatar || DEFAULT_USER_AVATAR_URL;

                const main = document.createElement('div');
                main.className = 'werewolf-role-main';

                const nameEl = document.createElement('div');
                nameEl.className = 'werewolf-role-name';
                nameEl.textContent = u.name || '我';

                const descEl = document.createElement('div');
                descEl.className = 'werewolf-role-desc';
                descEl.textContent = '用户角色';

                main.appendChild(nameEl);
                main.appendChild(descEl);

                item.appendChild(avatar);
                item.appendChild(main);

                item.addEventListener('click', () => {
                    const siblings = userRoleListEl.querySelectorAll('.werewolf-role-item.user-role');
                    siblings.forEach(s => s.classList.remove('active'));
                    item.classList.add('active');
                });

                userRoleListEl.appendChild(item);
            });
        }

        function updateAiHint() {
            if (!aiHintEl) return;
            const total = getSelectedTotalPlayers();
            const needAi = Math.max(0, total - 1);
            let selected = 0;
            if (aiRoleListEl) {
                selected = aiRoleListEl.querySelectorAll('.werewolf-role-item.ai-role.active').length;
            }
            aiHintEl.textContent = `当前为 ${total} 人局，需要选择 ${needAi} 个 AI 角色，目前已选择 ${selected} 个。`;
        }

        function renderAiRoleList() {
            if (!aiRoleListEl) return;
            aiRoleListEl.innerHTML = '';

            const total = getSelectedTotalPlayers();
            const maxAi = Math.max(0, total - 1);

            const ais = Array.isArray(aiList) ? aiList : [];
            if (!ais.length) {
                const empty = document.createElement('div');
                empty.className = 'werewolf-role-empty';
                empty.textContent = '当前还没有 AI 好友，请先在 QQ 中创建。';
                aiRoleListEl.appendChild(empty);
                return;
            }

            ais.forEach(ai => {
                const item = document.createElement('div');
                item.className = 'werewolf-role-item ai-role';
                item.dataset.id = ai.id;

                const avatar = document.createElement('img');
                avatar.className = 'werewolf-role-avatar';
                avatar.src = ai.avatar || DEFAULT_AI_AVATAR_URL;

                const main = document.createElement('div');
                main.className = 'werewolf-role-main';

                const nameEl = document.createElement('div');
                nameEl.className = 'werewolf-role-name';
                nameEl.textContent = ai.name || '未命名角色';

                const descEl = document.createElement('div');
                descEl.className = 'werewolf-role-desc';
                descEl.textContent = ai.nickname ? `AI 好友 · ${ai.nickname}` : 'AI 好友';

                main.appendChild(nameEl);
                main.appendChild(descEl);

                item.appendChild(avatar);
                item.appendChild(main);

                item.addEventListener('click', () => {
                    const active = item.classList.contains('active');
                    if (active) {
                        item.classList.remove('active');
                        updateAiHint();
                        return;
                    }
                    const selected = aiRoleListEl.querySelectorAll('.werewolf-role-item.ai-role.active').length;
                    if (selected >= maxAi) {
                        if (typeof showToast === 'function') {
                            showToast(`当前为 ${total} 人局，最多只能选择 ${maxAi} 个 AI 角色。`);
                        }
                        return;
                    }
                    item.classList.add('active');
                    updateAiHint();
                });

                aiRoleListEl.appendChild(item);
            });

            updateAiHint();
        }

        function collectPlayersFromSetup() {
            const total = getSelectedTotalPlayers();
            const needAi = Math.max(0, total - 1);

            let userPlayer = null;
            const userItem = userRoleListEl && userRoleListEl.querySelector('.werewolf-role-item.user-role.active');
            if (userItem) {
                const uid = userItem.dataset.id;
                const u = (userProfiles || []).find(p => String(p.id) === String(uid));
                if (u) {
                    userPlayer = {
                        id: `user-${u.id}`,
                        sourceType: 'user',
                        sourceId: u.id,
                        name: u.name || '我',
                        avatar: u.avatar || DEFAULT_USER_AVATAR_URL,
                        prompt: u.prompt || '',
                        isUser: true,
                        role: 'civilian',
                        side: 'good',
                        alive: true
                    };
                }
            }

            if (!userPlayer) {
                throw new Error('必须选择 1 个用户角色。');
            }

            const aiPlayers = [];
            if (aiRoleListEl) {
                const aiItems = aiRoleListEl.querySelectorAll('.werewolf-role-item.ai-role.active');
                aiItems.forEach(item => {
                    const aid = item.dataset.id;
                    const ai = (aiList || []).find(p => String(p.id) === String(aid));
                    if (ai) {
                        aiPlayers.push({
                            id: `ai-${ai.id}`,
                            sourceType: 'ai',
                            sourceId: ai.id,
                            name: ai.name || '未命名角色',
                            avatar: ai.avatar || DEFAULT_AI_AVATAR_URL,
                            prompt: ai.prompt || '',
                            isUser: false,
                            role: 'civilian',
                            side: 'good',
                            alive: true
                        });
                    }
                });
            }

            if (aiPlayers.length !== needAi) {
                throw new Error(`当前为 ${total} 人局，需要选择 ${needAi} 个 AI 角色，当前为 ${aiPlayers.length} 个。`);
            }

            return [userPlayer, ...aiPlayers];
        }

        function shuffle(arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }

        function assignRoles(players, cfg) {
            const roles = [];
            for (let i = 0; i < cfg.civilian; i++) roles.push('civilian');
            for (let i = 0; i < cfg.wolf; i++) roles.push('wolf');
            for (let i = 0; i < cfg.seer; i++) roles.push('seer');
            for (let i = 0; i < cfg.witch; i++) roles.push('witch');
            for (let i = 0; i < cfg.guard; i++) roles.push('guard');
            for (let i = 0; i < cfg.hunter; i++) roles.push('hunter');

            if (roles.length !== players.length) {
                throw new Error('职业人数与玩家人数不匹配，请检查设置。');
            }

            shuffle(roles);

            players.forEach((p, index) => {
                const role = roles[index] || 'civilian';
                p.role = role;
                p.side = role === 'wolf' ? 'wolf' : (role === 'hunter' ? 'neutral' : 'good');
                p.alive = true;
            });
        }

        function renderPlayersBar() {
            if (!playersBarEl) return;
            playersBarEl.innerHTML = '';

            werewolfState.players.forEach(p => {
                const item = document.createElement('div');
                item.className = 'werewolf-player-item' + (!p.alive ? ' dead' : '');

                const avatar = document.createElement('img');
                avatar.className = 'werewolf-player-avatar';
                avatar.src = p.avatar || DEFAULT_AI_AVATAR_URL;

                const nameEl = document.createElement('div');
                nameEl.className = 'werewolf-player-name';
                nameEl.textContent = p.name;

                const tagEl = document.createElement('div');
                tagEl.className = 'werewolf-player-tag';
                if (!p.alive) {
                    tagEl.textContent = '已出局';
                } else if (p.isUser) {
                    tagEl.textContent = ROLE_LABELS[p.role] || '未知身份';
                } else {
                    tagEl.textContent = '?';
                }

                item.appendChild(avatar);
                item.appendChild(nameEl);
                item.appendChild(tagEl);

                playersBarEl.appendChild(item);
            });
        }

        function resetLogWithIntro() {
            if (!logEl) return;
            logEl.innerHTML = '';
            const p = document.createElement('p');
            p.className = 'werewolf-log-placeholder';
            p.innerHTML = '点击「进入游戏」后，系统会随机为每位玩家分配身份，并从第 1 夜开始推进游戏。';
            logEl.appendChild(p);
        }

        function appendWerewolfLog(text) {
            if (!logEl) return;
            const placeholder = logEl.querySelector('.werewolf-log-placeholder');
            if (placeholder) placeholder.remove();

            const safeText = escapeHTML(String(text || ''));
            const paragraphs = safeText
                .split(/\n{2,}/)
                .map(part => part.trim())
                .filter(part => part.length > 0);

            const wrapper = document.createElement('div');
            wrapper.className = 'werewolf-log-block';

            if (!paragraphs.length) {
                const p = document.createElement('p');
                p.innerHTML = safeText.replace(/\n/g, '<br>');
                wrapper.appendChild(p);
            } else {
                paragraphs.forEach(part => {
                    const p = document.createElement('p');
                    p.innerHTML = part.replace(/\n/g, '<br>');
                    wrapper.appendChild(p);
                });
            }

            logEl.appendChild(wrapper);
            logEl.scrollTop = logEl.scrollHeight;
        }

        function evaluateWinner() {
            const alive = werewolfState.players.filter(p => p.alive);
            const aliveWolves = alive.filter(p => p.side === 'wolf').length;
            const aliveOthers = alive.length - aliveWolves;
            if (aliveWolves === 0) return 'good';
            if (aliveWolves >= aliveOthers) return 'wolf';
            return null;
        }

        function applyPhaseUI() {
            if (!inputHintEl || !sendBtn) return;

            if (werewolfState.phase === PHASE.NIGHT) {
                if (phaseLabelEl) phaseLabelEl.textContent = `第 ${werewolfState.day} 夜`;
                inputHintEl.textContent = '夜晚阶段由系统自动处理，请稍候…';
                sendBtn.disabled = true;
                if (voteRowEl) voteRowEl.style.display = 'none';
            } else if (werewolfState.phase === PHASE.DAY_TALK) {
                if (phaseLabelEl) phaseLabelEl.textContent = `第 ${werewolfState.day} 天 · 发言阶段`;
                inputHintEl.textContent = '现在是讨论阶段，请先输入你的发言，然后 AI 会安排其他玩家依次表态。';
                sendBtn.disabled = false;
                if (voteRowEl) voteRowEl.style.display = 'none';
            } else if (werewolfState.phase === PHASE.DAY_VOTE) {
                if (phaseLabelEl) phaseLabelEl.textContent = `第 ${werewolfState.day} 天 · 投票阶段`;
                inputHintEl.textContent = '请选择你要投出局的玩家，然后点击「提交投票」。';
                sendBtn.disabled = true;
                if (voteRowEl) voteRowEl.style.display = 'flex';
            } else if (werewolfState.phase === PHASE.ENDED) {
                if (phaseLabelEl) phaseLabelEl.textContent = '本局已结束';
                inputHintEl.textContent = '本局狼人杀已结束，可以返回游戏大厅重新开一局。';
                sendBtn.disabled = true;
                if (voteRowEl) voteRowEl.style.display = 'none';
            } else {
                if (phaseLabelEl) phaseLabelEl.textContent = '准备阶段';
                inputHintEl.textContent = '请先在游戏大厅中完成开局设置。';
                sendBtn.disabled = true;
                if (voteRowEl) voteRowEl.style.display = 'none';
            }
        }

        function showWinnerAndFinish(winnerSide) {
            werewolfState.isRunning = false;
            werewolfState.phase = PHASE.ENDED;

            let text;
            if (winnerSide === 'good') {
                text = '所有狼人都被找出并出局，剩余玩家松了一口气。好人阵营获得了最终的胜利。';
            } else {
                text = '当夜色再次落下，狼人阵营的人数已经不逊于好人。游戏在一片沉默中结束——狼人阵营获胜。';
            }
            appendWerewolfLog(text);

            if (subtitleEl) {
                subtitleEl.textContent = winnerSide === 'good' ? '本局结果：好人阵营胜利' : '本局结果：狼人阵营胜利';
            }

            applyPhaseUI();
        }

        function checkGameEndAndMaybeFinish() {
            const winner = evaluateWinner();
            if (!winner) return false;
            showWinnerAndFinish(winner);
            return true;
        }

        async function runNightPhase() {
            if (!werewolfState.isRunning) return;
            werewolfState.phase = PHASE.NIGHT;
            applyPhaseUI();

            // 如果一开夜就已经满足结束条件，直接结算
            if (checkGameEndAndMaybeFinish()) return;

            const alive = werewolfState.players.filter(p => p.alive);
            const wolves = alive.filter(p => p.side === 'wolf');
            const victims = alive.filter(p => p.side !== 'wolf');

            if (!wolves.length || !victims.length) {
                if (checkGameEndAndMaybeFinish()) return;
            }

            const victim = victims[Math.floor(Math.random() * victims.length)];
            victim.alive = false;

            renderPlayersBar();

            appendWerewolfLog(`夜色很深，所有人依次闭上了眼睛……\n当第一缕晨光透进包厢，大家发现「${victim.name}」已经静静倒在角落里。`);

            if (checkGameEndAndMaybeFinish()) return;

            // 生成一段更具氛围感的夜晚叙事（如果配置了 API）
            if (config && config.key && config.url) {
                const aliveNames = werewolfState.players.filter(p => p.alive).map(p => p.name).join('、');
                const promptParts = [];
                promptParts.push(
                    '你现在是一个负责渲染氛围的旁白 AI，需要用中文描述一局狼人杀游戏的夜晚场景。',
                    '请根据给定的信息，用 3~5 句话补充夜晚发生的画面感描写，不要剧透任何角色的真实身份，只能从玩家视角出发。',
                    '\n[玩家名单]\n' + werewolfState.players.map(p => `- ${p.name}`).join('\n'),
                    `\n[夜晚结果]\n本夜死亡玩家：${victim.name}（不要在文中解释他/她的身份，只描述别人看到的表面状况）。`,
                    `\n[当前存活玩家]\n${aliveNames}`
                );

                const finalPrompt = promptParts.join('\n');
                try {
                    const resp = await getCompletion(finalPrompt, false);
                    if (resp && typeof resp === 'string') {
                        appendWerewolfLog(resp.trim());
                    }
                } catch (e) {
                    console.warn('werewolf night narration error:', e);
                }
            }

            // 进入白天发言阶段
            werewolfState.phase = PHASE.DAY_TALK;
            applyPhaseUI();
        }

        async function runAiDiscussionReply(userSpeech) {
            if (!config || !config.key || !config.url) return;

            const alivePlayers = werewolfState.players.filter(p => p.alive);
            const userPlayer = alivePlayers.find(p => p.isUser);
            const aiPlayers = alivePlayers.filter(p => !p.isUser);

            const promptParts = [];
            promptParts.push(
                '你现在是狼人杀游戏的“剧本 AI”，负责在讨论阶段写出一小段群聊式对话。',
                '请根据玩家名单和当前局面，围绕用户刚才的一段发言，写出 3~6 条不同玩家的发言，格式为：玩家名：发言内容。',
                '注意：\n- 绝对不能直接暴露任何玩家的真实身份（谁是狼人、谁是好人等），玩家只能基于行为和对话进行猜测。\n- 发言需要有情绪与个性，但不要太长，每条尽量不超过 25 个字。\n- 允许有玩家认同用户观点，也允许有人提出质疑。'
            );

            promptParts.push('\n[当前天数]\n第 ' + werewolfState.day + ' 天');

            promptParts.push('\n[仍在场玩家]\n' + alivePlayers.map(p => `- ${p.name}`).join('\n'));

            if (userPlayer) {
                promptParts.push(`\n[用户视角]\n本机玩家名字：${userPlayer.name}`);
            }

            if (userSpeech) {
                promptParts.push(`\n[用户刚才的发言]\n${userSpeech}`);
            }

            const recentHistory = werewolfState.history.slice(-6).map(h => `${h.speakerName}：${h.text}`).join('\n');
            if (recentHistory) {
                promptParts.push('\n[最近几轮的讨论摘要]\n' + recentHistory);
            }

            promptParts.push('\n[输出要求]\n只输出多条类似“玩家名：一句话”的发言记录，不要加额外说明或小标题。');

            const finalPrompt = promptParts.join('\n');

            try {
                const resp = await getCompletion(finalPrompt, false);
                if (resp && typeof resp === 'string') {
                    appendWerewolfLog(resp.trim());
                }
            } catch (e) {
                console.warn('werewolf discussion AI error:', e);
            }
        }

        function prepareVoteOptions() {
            if (!voteSelectEl) return;
            voteSelectEl.innerHTML = '';
            const alivePlayers = werewolfState.players.filter(p => p.alive);
            alivePlayers.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.isUser ? `${p.name}（你）` : p.name;
                voteSelectEl.appendChild(opt);
            });
        }

        function enterVotePhase() {
            werewolfState.phase = PHASE.DAY_VOTE;
            prepareVoteOptions();
            applyPhaseUI();
        }

        function handleVoteSubmit() {
            if (!werewolfState.isRunning || werewolfState.phase !== PHASE.DAY_VOTE) return;
            if (!voteSelectEl || !voteSelectEl.value) {
                if (typeof showToast === 'function') {
                    showToast('请先选择要投票的玩家。');
                }
                return;
            }

            const targetId = voteSelectEl.value;
            const target = werewolfState.players.find(p => p.id === targetId && p.alive);
            if (!target) {
                if (typeof showToast === 'function') {
                    showToast('选择的玩家已不在游戏中，请刷新列表。');
                }
                return;
            }

            target.alive = false;
            renderPlayersBar();

            appendWerewolfLog(`经过一轮激烈的投票，大家最终决定把「${target.name}」请出游戏。`);

            if (checkGameEndAndMaybeFinish()) return;

            werewolfState.day += 1;
            werewolfState.phase = PHASE.NIGHT;
            applyPhaseUI();
            runNightPhase();
        }

        async function handleUserSend() {
            if (!werewolfState.isRunning || werewolfState.phase !== PHASE.DAY_TALK) return;
            if (!inputEl) return;
            const text = inputEl.value.trim();
            if (!text) {
                if (typeof showToast === 'function') {
                    showToast('先说点什么再发送吧。');
                }
                return;
            }

            inputEl.value = '';

            const userPlayer = werewolfState.players.find(p => p.isUser);
            const speakerName = userPlayer ? userPlayer.name : '我';

            werewolfState.history.push({
                day: werewolfState.day,
                phase: PHASE.DAY_TALK,
                speakerName,
                text
            });

            appendWerewolfLog(`${speakerName}：${text}`);

            sendBtn.disabled = true;
            if (inputHintEl) {
                inputHintEl.textContent = 'AI 正在根据你的发言，让其他玩家依次表态…';
            }

            await runAiDiscussionReply(text);

            enterVotePhase();
        }

        function resetWerewolfState() {
            werewolfState = {
                isRunning: false,
                day: 0,
                phase: PHASE.READY,
                players: [],
                userPlayerId: null,
                history: []
            };
            resetLogWithIntro();
            renderPlayersBar();
            if (subtitleEl) {
                subtitleEl.textContent = '游戏尚未开始';
            }
            applyPhaseUI();
        }

        function bindSetupEvents() {
            if (setupInited) return;
            setupInited = true;

            if (playerCountEl) {
                playerCountEl.addEventListener('click', (e) => {
                    const btn = e.target.closest('.count-btn');
                    if (!btn) return;
                    playerCountEl.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    applyDefaultRoleConfig(getSelectedTotalPlayers());
                    renderAiRoleList();
                });
            }

            [roleCivilianInput, roleWolfInput, roleSeerInput, roleWitchInput, roleGuardInput, roleHunterInput].forEach(input => {
                if (!input) return;
                input.addEventListener('change', () => {
                    updateAiHint();
                });
            });

            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    setupOverlay.classList.remove('active');
                });
            }

            if (startBtn) {
                startBtn.addEventListener('click', () => {
                    const total = getSelectedTotalPlayers();
                    const cfg = getRoleConfig();
                    const check = validateRoleConfig(total, cfg);
                    if (!check.ok) {
                        if (typeof showToast === 'function') {
                            showToast(check.message || '职业配置不合法');
                        }
                        return;
                    }

                    let players;
                    try {
                        players = collectPlayersFromSetup();
                    } catch (e) {
                        if (typeof showToast === 'function') {
                            showToast(e.message || '玩家选择不合法');
                        }
                        return;
                    }

                    try {
                        assignRoles(players, cfg);
                    } catch (e) {
                        if (typeof showToast === 'function') {
                            showToast(e.message || '分配身份失败');
                        }
                        return;
                    }

                    werewolfState.isRunning = true;
                    werewolfState.day = 1;
                    werewolfState.phase = PHASE.NIGHT;
                    werewolfState.players = players;
                    const userPlayer = players.find(p => p.isUser);
                    werewolfState.userPlayerId = userPlayer ? userPlayer.id : null;
                    werewolfState.history = [];

                    setupOverlay.classList.remove('active');

                    if (typeof openPage === 'function') {
                        openPage('werewolf-page');
                    } else {
                        pageEl.classList.add('active');
                    }

                    if (subtitleEl && userPlayer) {
                        subtitleEl.textContent = `你本局抽到的身份是：${ROLE_LABELS[userPlayer.role] || '未知身份'}（请对其他人保密）`;
                    }

                    renderPlayersBar();
                    resetLogWithIntro();
                    applyPhaseUI();

                    runNightPhase();
                });
            }

            if (sendBtn) {
                sendBtn.addEventListener('click', () => {
                    handleUserSend();
                });
            }

            if (inputEl) {
                inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleUserSend();
                    }
                });
            }

            if (voteBtn) {
                voteBtn.addEventListener('click', () => {
                    handleVoteSubmit();
                });
            }

            if (backBtn) {
                backBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    werewolfState.isRunning = false;
                    werewolfState.phase = PHASE.ENDED;
                    if (typeof closePage === 'function') {
                        closePage('werewolf-page');
                    } else {
                        pageEl.classList.remove('active');
                    }
                    resetWerewolfState();
                });
            }

            resetWerewolfState();
        }

        function openWerewolfSetup() {
            if (!setupOverlay) {
                if (typeof showToast === 'function') {
                    showToast('当前页面未配置「狼人杀」开局弹窗。');
                }
                return;
            }

            bindSetupEvents();
            applyDefaultRoleConfig(getSelectedTotalPlayers());
            renderUserRoleList();
            renderAiRoleList();

            setupOverlay.classList.add('active');
        }

        window.openWerewolfSetup = openWerewolfSetup;

        return {
            openSetup: openWerewolfSetup
        };
    })();

    const scriptKillGame = (function() {
        const setupOverlay = document.getElementById('script-kill-setup-overlay');
        const pageEl = document.getElementById('script-kill-page');

        if (!setupOverlay || !pageEl) {
            window.openScriptKillSetup = function() {
                if (typeof showToast === 'function') {
                    showToast('当前页面未配置「剧本杀」模块。');
                }
            };
            return {
                openSetup: () => {}
            };
        }

        const playerCountEl = document.getElementById('script-kill-player-count');
        const scriptListEl = document.getElementById('script-kill-script-list');
        const userRoleListEl = document.getElementById('script-kill-user-role-list');
        const aiRoleListEl = document.getElementById('script-kill-ai-role-list');
        const aiHintEl = document.getElementById('script-kill-ai-hint');
        const cancelBtn = document.getElementById('script-kill-cancel-btn');
        const startBtn = document.getElementById('script-kill-start-btn');

        const playersBarEl = document.getElementById('script-kill-players');
        const logEl = document.getElementById('script-kill-log');
        const subtitleEl = document.getElementById('script-kill-subtitle');
        const phaseLabelEl = document.getElementById('script-kill-phase-label');
        const statusEl = document.getElementById('script-kill-status');
        const inputHintEl = document.getElementById('script-kill-input-hint');
        const inputEl = document.getElementById('script-kill-input');
        const sendBtn = document.getElementById('script-kill-send-btn');
        const voteRowEl = document.getElementById('script-kill-vote-row');
        const voteSelectEl = document.getElementById('script-kill-vote-select');
        const voteBtn = document.getElementById('script-kill-vote-btn');
        const backBtn = document.getElementById('script-kill-back-btn');
        const roleBtn = document.getElementById('script-kill-role-btn');
        const timelineBtn = document.getElementById('script-kill-timeline-btn');
        const nextStageBtn = document.getElementById('script-kill-next-stage-btn');

        const roleModal = document.getElementById('script-kill-role-modal');
        const roleModalClose = document.getElementById('script-kill-role-modal-close');
        const roleNameEl = document.getElementById('script-kill-role-name');
        const roleDescEl = document.getElementById('script-kill-role-desc');

        const timelineModal = document.getElementById('script-kill-timeline-modal');
        const timelineModalClose = document.getElementById('script-kill-timeline-modal-close');
        const timelineListEl = document.getElementById('script-kill-timeline-list');

        const SCRIPT_TEMPLATES = [
            {
                id: 'castle',
                name: '幽灵古堡',
                oneLine: '暴雨之夜，山顶古堡的一起密室命案。',
                styleTag: '哥特古堡 / 暴雨夜 / 密室谋杀'
            },
            {
                id: 'asylum',
                name: '诡异疯人院',
                oneLine: '废弃疗养院里，最后一夜的群体治疗变成了死亡游戏。',
                styleTag: '废弃医院 / 精神病院 / 封闭空间'
            },
            {
                id: 'mansion',
                name: '迷宫古宅',
                oneLine: '结构诡异的老宅中，每一层楼都藏着新的陷阱。',
                styleTag: '老宅 / 家族秘密 / 迷宫动线'
            }
        ];

        const PHASE = {
            READY: 'ready',
            INTRO: 'intro',
            INVESTIGATION: 'investigation',
            DISCUSSION: 'discussion',
            VOTE: 'vote',
            ENDED: 'ended'
        };

        let setupInited = false;

        let scriptKillState = {
            isRunning: false,
            scriptId: null,
            scriptName: '',
            scriptStyle: '',
            players: [],
            userPlayerId: null,
            killerPlayerName: '',
            phase: PHASE.READY,
            round: 0,
            scriptDetail: null,
            userRole: null,
            history: []
        };

        function getSelectedPlayerCount() {
            if (!playerCountEl) return 6;
            const active = playerCountEl.querySelector('.count-btn.active');
            if (!active) return 6;
            const n = parseInt(active.dataset.size, 10);
            return n === 8 ? 8 : 6;
        }

        function getSelectedScriptId() {
            if (!scriptListEl) return SCRIPT_TEMPLATES[0]?.id || 'castle';
            const active = scriptListEl.querySelector('.script-kill-script-item.active');
            return active ? active.dataset.id : (SCRIPT_TEMPLATES[0]?.id || 'castle');
        }

        function updateAiHint() {
            if (!aiHintEl) return;
            const total = getSelectedPlayerCount();
            const needAi = Math.max(0, total - 1);
            let selected = 0;
            if (aiRoleListEl) {
                selected = aiRoleListEl.querySelectorAll('.script-kill-role-item.ai-role.active').length;
            }
            aiHintEl.textContent = `当前为 ${total} 人局，需要选择 ${needAi} 个 AI 角色，目前已选择 ${selected} 个。`;
        }

        function renderScriptList() {
            if (!scriptListEl) return;
            scriptListEl.innerHTML = '';

            SCRIPT_TEMPLATES.forEach((tpl, index) => {
                const item = document.createElement('div');
                item.className = 'script-kill-script-item' + (index === 0 ? ' active' : '');
                item.dataset.id = tpl.id;

                const title = document.createElement('div');
                title.className = 'script-kill-script-name';
                title.textContent = tpl.name;

                const tag = document.createElement('div');
                tag.className = 'script-kill-script-desc';
                tag.textContent = tpl.oneLine;

                item.appendChild(title);
                item.appendChild(tag);

                item.addEventListener('click', () => {
                    const siblings = scriptListEl.querySelectorAll('.script-kill-script-item');
                    siblings.forEach(s => s.classList.remove('active'));
                    item.classList.add('active');
                });

                scriptListEl.appendChild(item);
            });
        }

        function renderUserRoleList() {
            if (!userRoleListEl) return;
            userRoleListEl.innerHTML = '';

            const users = Array.isArray(userProfiles) ? userProfiles : [];
            if (!users.length) {
                const empty = document.createElement('div');
                empty.className = 'script-kill-role-empty';
                empty.textContent = '当前还没有用户角色，请先在 QQ 中创建。';
                userRoleListEl.appendChild(empty);
                return;
            }

            users.forEach((u, index) => {
                const item = document.createElement('div');
                item.className = 'script-kill-role-item user-role' + (index === 0 ? ' active' : '');
                item.dataset.id = u.id;

                const avatar = document.createElement('img');
                avatar.className = 'script-kill-role-avatar';
                avatar.src = u.avatar || DEFAULT_USER_AVATAR_URL;

                const main = document.createElement('div');
                main.className = 'script-kill-role-main';

                const nameEl = document.createElement('div');
                nameEl.className = 'script-kill-role-name';
                nameEl.textContent = u.name || '我';

                const descEl = document.createElement('div');
                descEl.className = 'script-kill-role-desc';
                descEl.textContent = '用户角色';

                main.appendChild(nameEl);
                main.appendChild(descEl);

                item.appendChild(avatar);
                item.appendChild(main);

                item.addEventListener('click', () => {
                    const siblings = userRoleListEl.querySelectorAll('.script-kill-role-item.user-role');
                    siblings.forEach(s => s.classList.remove('active'));
                    item.classList.add('active');
                });

                userRoleListEl.appendChild(item);
            });
        }

        function renderAiRoleList() {
            if (!aiRoleListEl) return;
            aiRoleListEl.innerHTML = '';

            const total = getSelectedPlayerCount();
            const maxAi = Math.max(0, total - 1);

            const ais = Array.isArray(aiList) ? aiList : [];
            if (!ais.length) {
                const empty = document.createElement('div');
                empty.className = 'script-kill-role-empty';
                empty.textContent = '当前还没有 AI 好友，请先在 QQ 中创建。';
                aiRoleListEl.appendChild(empty);
                updateAiHint();
                return;
            }

            ais.forEach(ai => {
                const item = document.createElement('div');
                item.className = 'script-kill-role-item ai-role';
                item.dataset.id = ai.id;

                const avatar = document.createElement('img');
                avatar.className = 'script-kill-role-avatar';
                avatar.src = ai.avatar || DEFAULT_AI_AVATAR_URL;

                const main = document.createElement('div');
                main.className = 'script-kill-role-main';

                const nameEl = document.createElement('div');
                nameEl.className = 'script-kill-role-name';
                nameEl.textContent = ai.name || '未命名角色';

                const descEl = document.createElement('div');
                descEl.className = 'script-kill-role-desc';
                descEl.textContent = ai.nickname ? `AI 好友 · ${ai.nickname}` : 'AI 好友';

                main.appendChild(nameEl);
                main.appendChild(descEl);

                item.appendChild(avatar);
                item.appendChild(main);

                item.addEventListener('click', () => {
                    const active = item.classList.contains('active');
                    if (active) {
                        item.classList.remove('active');
                        updateAiHint();
                        return;
                    }
                    const selected = aiRoleListEl.querySelectorAll('.script-kill-role-item.ai-role.active').length;
                    if (selected >= maxAi) {
                        if (typeof showToast === 'function') {
                            showToast(`当前为 ${total} 人局，最多只能选择 ${maxAi} 个 AI 角色。`);
                        }
                        return;
                    }
                    item.classList.add('active');
                    updateAiHint();
                });

                aiRoleListEl.appendChild(item);
            });

            updateAiHint();
        }

        function collectPlayersFromSetup() {
            const total = getSelectedPlayerCount();
            const needAi = Math.max(0, total - 1);

            let userPlayer = null;
            const userItem = userRoleListEl && userRoleListEl.querySelector('.script-kill-role-item.user-role.active');
            if (userItem) {
                const uid = userItem.dataset.id;
                const u = (userProfiles || []).find(p => String(p.id) === String(uid));
                if (u) {
                    userPlayer = {
                        id: `user-${u.id}`,
                        sourceType: 'user',
                        sourceId: u.id,
                        name: u.name || '我',
                        avatar: u.avatar || DEFAULT_USER_AVATAR_URL,
                        prompt: u.prompt || '',
                        isUser: true
                    };
                }
            }

            if (!userPlayer) {
                throw new Error('必须选择 1 个用户角色。');
            }

            const aiPlayers = [];
            if (aiRoleListEl) {
                const aiItems = aiRoleListEl.querySelectorAll('.script-kill-role-item.ai-role.active');
                aiItems.forEach(item => {
                    const aid = item.dataset.id;
                    const ai = (aiList || []).find(p => String(p.id) === String(aid));
                    if (ai) {
                        aiPlayers.push({
                            id: `ai-${ai.id}`,
                            sourceType: 'ai',
                            sourceId: ai.id,
                            name: ai.name || '未命名角色',
                            avatar: ai.avatar || DEFAULT_AI_AVATAR_URL,
                            prompt: ai.prompt || '',
                            isUser: false
                        });
                    }
                });
            }

            if (aiPlayers.length !== needAi) {
                throw new Error(`当前为 ${total} 人局，需要选择 ${needAi} 个 AI 角色，当前为 ${aiPlayers.length} 个。`);
            }

            return [userPlayer, ...aiPlayers];
        }

        function resetLogWithIntro() {
            if (!logEl) return;
            logEl.innerHTML = '';
            const p = document.createElement('p');
            p.className = 'script-kill-log-placeholder';
            p.innerHTML = '选择人数、剧本和玩家后，点击「进入剧本」。系统会先引导所有人分别做一次身份介绍，然后进入搜证与发言阶段。';
            logEl.appendChild(p);
        }

        function appendScriptKillLog(text) {
            if (!logEl) return;
            const placeholder = logEl.querySelector('.script-kill-log-placeholder');
            if (placeholder) placeholder.remove();

            const safeText = escapeHTML(String(text || ''));
            const paragraphs = safeText
                .split(/\n{2,}/)
                .map(part => part.trim())
                .filter(part => part.length > 0);

            const wrapper = document.createElement('div');
            wrapper.className = 'script-kill-log-block';

            if (!paragraphs.length) {
                const p = document.createElement('p');
                p.innerHTML = safeText.replace(/\n/g, '<br>');
                wrapper.appendChild(p);
            } else {
                paragraphs.forEach(part => {
                    const p = document.createElement('p');
                    p.innerHTML = part.replace(/\n/g, '<br>');
                    wrapper.appendChild(p);
                });
            }

            logEl.appendChild(wrapper);
            logEl.scrollTop = logEl.scrollHeight;
        }

        function renderPlayersBar() {
            if (!playersBarEl) return;
            playersBarEl.innerHTML = '';

            scriptKillState.players.forEach(p => {
                const item = document.createElement('div');
                item.className = 'script-kill-player-item';

                const avatar = document.createElement('img');
                avatar.className = 'script-kill-player-avatar';
                avatar.src = p.avatar || DEFAULT_AI_AVATAR_URL;

                const nameEl = document.createElement('div');
                nameEl.className = 'script-kill-player-name';
                nameEl.textContent = p.name;

                item.appendChild(avatar);
                item.appendChild(nameEl);
                playersBarEl.appendChild(item);
            });
        }

        function setPhase(phase) {
            scriptKillState.phase = phase;
            applyPhaseUI();
        }

        function applyPhaseUI() {
            if (!inputHintEl || !sendBtn) return;

            const roundLabel = scriptKillState.round || 1;

            if (scriptKillState.phase === PHASE.READY) {
                if (phaseLabelEl) phaseLabelEl.textContent = '准备阶段';
                if (subtitleEl) subtitleEl.textContent = '游戏尚未开始';
                inputHintEl.textContent = '请先在游戏大厅完成开局设置。';
                sendBtn.disabled = true;
                if (voteRowEl) voteRowEl.style.display = 'none';
                if (nextStageBtn) {
                    nextStageBtn.textContent = '开始介绍身份';
                    nextStageBtn.disabled = true;
                }
            } else if (scriptKillState.phase === PHASE.INTRO) {
                if (phaseLabelEl) phaseLabelEl.textContent = '身份介绍阶段';
                if (subtitleEl && scriptKillState.scriptName) {
                    subtitleEl.textContent = `当前剧本：${scriptKillState.scriptName}`;
                }
                inputHintEl.textContent = '先用一两句话介绍一下自己的身份与来历。';
                sendBtn.disabled = false;
                if (voteRowEl) voteRowEl.style.display = 'none';
                if (nextStageBtn) {
                    nextStageBtn.textContent = '开始第一轮搜证';
                    nextStageBtn.disabled = false;
                }
            } else if (scriptKillState.phase === PHASE.INVESTIGATION) {
                if (phaseLabelEl) phaseLabelEl.textContent = `第 ${roundLabel} 轮 · 搜证阶段`;
                inputHintEl.textContent = '描述你想要调查的方向、地点或想追问的对象，AI 会补全搜证过程。';
                sendBtn.disabled = false;
                if (voteRowEl) voteRowEl.style.display = 'none';
                if (nextStageBtn) {
                    nextStageBtn.textContent = '切换到讨论阶段';
                    nextStageBtn.disabled = false;
                }
            } else if (scriptKillState.phase === PHASE.DISCUSSION) {
                if (phaseLabelEl) phaseLabelEl.textContent = `第 ${roundLabel} 轮 · 推理阶段`;
                inputHintEl.textContent = '写下你的推理或想抛出的疑点，AI 会安排所有角色依次回应。';
                sendBtn.disabled = false;
                if (voteRowEl) voteRowEl.style.display = 'none';
                if (nextStageBtn) {
                    nextStageBtn.textContent = '进入投票阶段';
                    nextStageBtn.disabled = false;
                }
            } else if (scriptKillState.phase === PHASE.VOTE) {
                if (phaseLabelEl) phaseLabelEl.textContent = `第 ${roundLabel} 轮 · 投票阶段`;
                inputHintEl.textContent = '请选择你要投出的角色，然后点击「提交投票」。';
                sendBtn.disabled = true;
                if (voteRowEl) voteRowEl.style.display = 'flex';
                if (nextStageBtn) {
                    nextStageBtn.textContent = '已进入投票阶段';
                    nextStageBtn.disabled = true;
                }
            } else if (scriptKillState.phase === PHASE.ENDED) {
                if (phaseLabelEl) phaseLabelEl.textContent = '本局已结束';
                inputHintEl.textContent = '本局剧本杀已结束，可以返回游戏大厅重新开一局。';
                sendBtn.disabled = true;
                if (voteRowEl) voteRowEl.style.display = 'none';
                if (nextStageBtn) {
                    nextStageBtn.textContent = '本局已结束';
                    nextStageBtn.disabled = true;
                }
            }
        }

        async function ensureScriptDetail() {
            if (scriptKillState.scriptDetail) return;

            const players = scriptKillState.players || [];
            const tpl = SCRIPT_TEMPLATES.find(t => t.id === scriptKillState.scriptId) || SCRIPT_TEMPLATES[0];
            scriptKillState.scriptName = tpl ? tpl.name : '未知剧本';
            scriptKillState.scriptStyle = tpl ? (tpl.styleTag || tpl.oneLine || '') : '';

            const fallbackBuild = () => {
                const killer = players.length ? players[Math.floor(Math.random() * players.length)] : null;
                scriptKillState.killerPlayerName = killer ? killer.name : '';
                scriptKillState.scriptDetail = {
                    scriptTitle: scriptKillState.scriptName,
                    background: tpl && tpl.oneLine ? tpl.oneLine : '一局围绕情感与秘密展开的剧本杀。',
                    globalTimeline: '案发当晚，所有人都被困在同一个封闭空间内。',
                    killerName: scriptKillState.killerPlayerName,
                    roles: players.map(p => ({
                        playerName: p.name,
                        roleName: p.isUser ? '玩家本人' : 'AI 角色',
                        roleDesc: '',
                        personalTimeline: []
                    }))
                };
            };

            if (!config || !config.key || !config.url) {
                fallbackBuild();
                return;
            }

            const playerLines = players.map(p => `- ${p.name}（${p.isUser ? '真实玩家' : 'AI 好友'}），性格：${p.prompt || '略'}`).join('\n');

            const promptParts = [];
            promptParts.push(
                '你现在是一个「剧本杀主持 AI」，需要根据给定信息为一局 6~8 人的中文剧本杀设计背景与人物身份。',
                '\n[剧本名称]\n' + (tpl ? tpl.name : '未知剧本'),
                '\n[风格或场景关键词]\n' + (tpl ? (tpl.styleTag || tpl.oneLine || '略') : '略'),
                '\n[参与玩家]\n' + playerLines,
                '\n要求：',
                '1. 从这些玩家中选出且只选出 1 位凶手，其他人为嫌疑人。',
                '2. 为每位玩家设计一个身份（职业/社会角色）和一段案发当日的个人时间线（3~6 条关键节点）。',
                '3. 故事背景偏情感与日常向，可以带一点悬疑感但不要血腥。',
                '4. 最终只输出一个 JSON 对象，格式如下：',
                '{',
                '  "scriptTitle": "...",',
                '  "background": "整个案件的大背景与案发简介...",',
                '  "globalTimeline": "案发当日整体时间线的概括...",',
                '  "killerName": "某位玩家的名字，必须与上方玩家列表中的某个名字完全一致",',
                '  "roles": [',
                '    {',
                '      "playerName": "...",',
                '      "roleName": "具体身份称呼，如 管家 / 室友 / 主播 等",',
                '      "roleDesc": "该身份的简介与隐藏动机，1~3 句话",',
                '      "personalTimeline": ["时间点 + 事件", "..."]',
                '    }',
                '  ]',
                '}',
                '不要输出任何解释或多余文字。'
            );

            const finalPrompt = promptParts.join('\n');

            try {
                const reply = await getCompletion(finalPrompt, true);
                const jsonText = extractFirstJsonObject(reply) || reply;
                const data = JSON.parse(jsonText);
                scriptKillState.scriptDetail = data;
                scriptKillState.killerPlayerName = data.killerName || '';
            } catch (e) {
                console.warn('script-kill ensureScriptDetail error', e);
                fallbackBuild();
            }
        }

        function updateUserPrivateInfoFromDetail() {
            const detail = scriptKillState.scriptDetail;
            if (!detail) return;
            const players = scriptKillState.players || [];
            const userPlayer = players.find(p => p.isUser);
            if (!userPlayer) return;

            const role = Array.isArray(detail.roles)
                ? detail.roles.find(r => r && r.playerName === userPlayer.name)
                : null;

            scriptKillState.userRole = role || null;

            if (roleNameEl) {
                roleNameEl.textContent = role && role.roleName ? role.roleName : '尚未分配';
            }
            if (roleDescEl) {
                roleDescEl.textContent = role && role.roleDesc ? role.roleDesc : '当前仅根据剧本主题默认为你分配了一个普通身份。';
            }

            if (timelineListEl) {
                timelineListEl.innerHTML = '';
                const list = role && Array.isArray(role.personalTimeline) ? role.personalTimeline : [];
                if (!list.length) {
                    const empty = document.createElement('div');
                    empty.className = 'script-kill-timeline-empty';
                    empty.textContent = '当前还没有详细的个人时间线。你可以在游戏过程中通过发言补充自己的不在场证明。';
                    timelineListEl.appendChild(empty);
                } else {
                    list.forEach(line => {
                        const item = document.createElement('div');
                        item.className = 'script-kill-timeline-item';
                        item.textContent = line;
                        timelineListEl.appendChild(item);
                    });
                }
            }
        }

        async function requestNarrationForPhase(phase, userSpeech) {
            if (!config || !config.key || !config.url) return;

            const detail = scriptKillState.scriptDetail;
            const players = scriptKillState.players || [];
            const userPlayer = players.find(p => p.isUser);
            const killerName = detail && detail.killerName ? detail.killerName : (scriptKillState.killerPlayerName || '');

            const phaseDescMap = {
                [PHASE.INTRO]: '身份介绍阶段，请安排所有人轮流用简短的一两句话介绍自己。',
                [PHASE.INVESTIGATION]: '搜证阶段，请描写大家分头寻找线索的过程，可以有发现的新证据。',
                [PHASE.DISCUSSION]: '推理阶段，请描写大家围绕现有线索展开讨论与争执，但不要直接说出凶手是谁。'
            };

            const phaseDesc = phaseDescMap[phase] || '推进当前阶段的剧情。';

            const recentHistory = scriptKillState.history
                .slice(-8)
                .map(h => `${h.speakerName}：${h.text}`)
                .join('\n');

            const promptParts = [];
            promptParts.push(
                '你现在是「剧本杀主持 AI」，负责在一局中文剧本杀中，用文字形式叙述场景并安排各角色发言。',
                '\n[剧本信息]',
                '名称：' + (detail && detail.scriptTitle ? detail.scriptTitle : scriptKillState.scriptName || '未知剧本'),
                '背景：' + (detail && detail.background ? detail.background : (scriptKillState.scriptStyle || '')),
                '\n[玩家名单]',
                (players.length
                    ? players.map(p => `- ${p.name}（${p.isUser ? '真实玩家' : 'AI 角色'}）`).join('\n')
                    : '略'),
                '\n[当前阶段说明]',
                phaseDesc,
                '\n[隐藏设定（只供你参考，不能在文中直说）]',
                killerName
                    ? `真正的凶手是「${killerName}」，但在任何描写或对话中都不能直接点名，只能通过细节暗示。`
                    : '如果未给出凶手名字，你可以在心里任选一位玩家作为凶手，但不要在文中直说。'
            );

            if (userSpeech) {
                promptParts.push('\n[真实玩家刚才的发言]', (userPlayer ? userPlayer.name : '玩家') + '：' + userSpeech);
            }

            if (recentHistory) {
                promptParts.push('\n[最近的剧情摘要]', recentHistory);
            }

            promptParts.push(
                '\n[输出要求]',
                '1. 用第三人称或群像视角，用 5~12 句中文叙述当前场景，可以包含多名角色的对话。',
                '2. 对话格式推荐为「名字：一句话」或用引号标出。',
                '3. 不要解释规则、不出现“系统提示”等字样。',
                '4. 不要输出任何 JSON 或额外结构化结果，只输出纯文本。'
            );

            const finalPrompt = promptParts.join('\n');

            try {
                const reply = await getCompletion(finalPrompt, false);
                if (reply && typeof reply === 'string') {
                    appendScriptKillLog(reply.trim());
                    scriptKillState.history.push({
                        day: scriptKillState.round,
                        phase,
                        speakerName: '旁白',
                        text: reply.trim().slice(0, 120)
                    });
                }
            } catch (e) {
                console.warn('script-kill phase narration error:', e);
                if (typeof showToast === 'function') {
                    showToast('当前阶段叙事生成失败：' + (e.message || '未知错误'));
                }
            }
        }

        async function handleUserSend() {
            if (!scriptKillState.isRunning) {
                if (typeof showToast === 'function') {
                    showToast('请先在游戏大厅开启一局剧本杀。');
                }
                return;
            }
            if (!inputEl) return;
            if (scriptKillState.phase === PHASE.VOTE || scriptKillState.phase === PHASE.ENDED) {
                if (typeof showToast === 'function') {
                    showToast('当前阶段不支持自由发言。');
                }
                return;
            }

            const text = inputEl.value.trim();
            if (!text) {
                if (typeof showToast === 'function') {
                    showToast('先说点什么再发送吧。');
                }
                return;
            }
            inputEl.value = '';

            const players = scriptKillState.players || [];
            const userPlayer = players.find(p => p.isUser);
            const speakerName = userPlayer ? userPlayer.name : '我';

            appendScriptKillLog(`${speakerName}：${escapeHTML(text)}`);
            scriptKillState.history.push({
                day: scriptKillState.round,
                phase: scriptKillState.phase,
                speakerName,
                text
            });

            sendBtn.disabled = true;
            if (statusEl) {
                statusEl.textContent = 'AI 正在根据你的发言推进剧情…';
            }

            try {
                await requestNarrationForPhase(scriptKillState.phase, text);
            } finally {
                sendBtn.disabled = false;
                if (statusEl) {
                    statusEl.textContent = '';
                }
            }
        }

        function prepareVoteOptions() {
            if (!voteSelectEl) return;
            voteSelectEl.innerHTML = '';
            const players = scriptKillState.players || [];
            players.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.isUser ? `${p.name}（你）` : p.name;
                voteSelectEl.appendChild(opt);
            });
        }

        async function handleVoteSubmit() {
            if (!scriptKillState.isRunning || scriptKillState.phase !== PHASE.VOTE) return;
            if (!voteSelectEl || !voteSelectEl.value) {
                if (typeof showToast === 'function') {
                    showToast('请先选择你要投出的角色。');
                }
                return;
            }

            const targetId = voteSelectEl.value;
            const players = scriptKillState.players || [];
            const target = players.find(p => p.id === targetId);
            if (!target) {
                if (typeof showToast === 'function') {
                    showToast('选择的角色已不存在，请刷新列表。');
                }
                return;
            }

            const userPlayer = players.find(p => p.isUser);
            const detail = scriptKillState.scriptDetail;
            const killerName = detail && detail.killerName ? detail.killerName : (scriptKillState.killerPlayerName || '');

            const recentHistory = scriptKillState.history
                .slice(-8)
                .map(h => `${h.speakerName}：${h.text}`)
                .join('\n');

            if (!config || !config.key || !config.url) {
                const isCorrect = killerName && target.name === killerName;
                if (isCorrect) {
                    appendScriptKillLog(`大家的目光最终停在「${target.name}」身上，碎片般的线索在此刻拼成了完整的真相。`);
                    appendScriptKillLog('你们成功找出了真正的凶手，本局剧本杀到此结束。');
                    scriptKillState.isRunning = false;
                    setPhase(PHASE.ENDED);
                } else {
                    appendScriptKillLog(`「${target.name}」被推到了风口浪尖，却始终拿不出决定性的反击证据。空气里弥漫着犹疑。`);
                    appendScriptKillLog('这一轮的投票似乎没有命中真正的凶手，案件将进入下一轮搜证。');
                    scriptKillState.round += 1;
                    setPhase(PHASE.INVESTIGATION);
                }
                return;
            }

            const promptParts = [];
            promptParts.push(
                '你现在是剧本杀主持 AI，需要结算一轮投票结果。',
                '\n[剧本名称]\n' + (detail && detail.scriptTitle ? detail.scriptTitle : scriptKillState.scriptName || '未知剧本'),
                '\n[参与玩家]\n' + players.map(p => `- ${p.name}`).join('\n'),
                '\n[真正的凶手]\n' + (killerName || '（如果为空，你可以在心里任选一位玩家作为凶手，但不要在文中直说）'),
                '\n[真实玩家的投票]\n' + (userPlayer ? userPlayer.name : '真实玩家') + ` 将票投给了「${target.name}」。`
            );

            if (recentHistory) {
                promptParts.push('\n[最近的剧情摘要]\n' + recentHistory);
            }

            promptParts.push(
                '\n[输出要求]',
                '1. 先用几段中文叙述公开投票的场景与所有人的反应，可以包含多位角色的发言。',
                '2. 在叙事中不要直接说出“凶手是某某”，可以通过气氛和细节暗示真相是否被命中。',
                '3. 在叙事文本之后，追加一行结构化结果，格式必须严格如下：',
                'VOTE_RESULT: {"votedName":"被票出局的人名，必须与玩家列表中的某个名字完全一致","isCorrect":true 或 false,"nextStep":"end" 或 "next_round"}',
                '4. JSON 对象必须是有效 JSON，字段名固定，不要多也不要少。',
                '5. 不要在 JSON 之后再写任何额外内容。'
            );

            const finalPrompt = promptParts.join('\n');

            if (statusEl) {
                statusEl.textContent = '正在结算投票结果…';
            }
            if (voteBtn) voteBtn.disabled = true;

            try {
                const reply = await getCompletion(finalPrompt, false);
                if (!reply || typeof reply !== 'string') {
                    if (typeof showToast === 'function') {
                        showToast('AI 返回内容为空');
                    }
                    return;
                }

                const idx = reply.lastIndexOf('VOTE_RESULT:');
                let narrative = reply;
                let jsonPart = null;
                if (idx !== -1) {
                    narrative = reply.substring(0, idx).trim();
                    jsonPart = reply.substring(idx + 'VOTE_RESULT:'.length).trim();
                }

                if (narrative) {
                    appendScriptKillLog(narrative);
                }

                let result = null;
                if (jsonPart) {
                    const pureJson = extractFirstJsonObject(jsonPart) || jsonPart;
                    try {
                        result = JSON.parse(pureJson);
                    } catch (e) {
                        console.warn('script-kill VOTE_RESULT parse error:', e, jsonPart);
                    }
                }

                const isCorrect = !!(result && result.isCorrect);
                const nextStep = result && result.nextStep;

                if (isCorrect) {
                    appendScriptKillLog(`最终，大家一致确认「${target.name}」就是本案的真正凶手，本局剧本杀到此结束。`);
                    scriptKillState.isRunning = false;
                    setPhase(PHASE.ENDED);
                } else if (nextStep === 'next_round') {
                    appendScriptKillLog('这一轮的投票并没有命中真正的凶手，案件将进入下一轮搜证。');
                    scriptKillState.round += 1;
                    setPhase(PHASE.INVESTIGATION);
                } else {
                    appendScriptKillLog('即使这次的票并没有完全命中真相，夜色已经散去，这一局剧本杀也在复杂的情绪里收尾。');
                    scriptKillState.isRunning = false;
                    setPhase(PHASE.ENDED);
                }
            } catch (e) {
                console.error('script-kill vote error:', e);
                if (typeof showToast === 'function') {
                    showToast('投票阶段叙事生成失败：' + (e.message || '未知错误'));
                }
            } finally {
                if (statusEl) {
                    statusEl.textContent = '';
                }
                if (voteBtn) voteBtn.disabled = false;
            }
        }

        function resetScriptKillState() {
            scriptKillState = {
                isRunning: false,
                scriptId: null,
                scriptName: '',
                scriptStyle: '',
                players: [],
                userPlayerId: null,
                killerPlayerName: '',
                phase: PHASE.READY,
                round: 0,
                scriptDetail: null,
                userRole: null,
                history: []
            };
            renderPlayersBar();
            resetLogWithIntro();
            setPhase(PHASE.READY);
        }

        async function startGameFromSetup() {
            let players;
            try {
                players = collectPlayersFromSetup();
            } catch (e) {
                if (typeof showToast === 'function') {
                    showToast(e.message || '玩家选择不合法');
                }
                return;
            }

            scriptKillState.isRunning = true;
            scriptKillState.scriptId = getSelectedScriptId();
            scriptKillState.players = players;
            scriptKillState.userPlayerId = players.find(p => p.isUser)?.id || null;
            scriptKillState.round = 1;
            scriptKillState.phase = PHASE.INTRO;
            scriptKillState.scriptDetail = null;
            scriptKillState.userRole = null;
            scriptKillState.history = [];

            if (statusEl) {
                statusEl.textContent = '正在生成剧本与分配身份…';
            }
            if (sendBtn) sendBtn.disabled = true;

            await ensureScriptDetail();
            updateUserPrivateInfoFromDetail();

            if (statusEl) {
                statusEl.textContent = '';
            }
            if (sendBtn) sendBtn.disabled = false;

            if (setupOverlay) setupOverlay.classList.remove('active');

            if (typeof openPage === 'function') {
                openPage('script-kill-page');
            } else {
                pageEl.classList.add('active');
            }

            renderPlayersBar();
            resetLogWithIntro();
            setPhase(PHASE.INTRO);
        }

        function bindSetupEvents() {
            if (setupInited) return;
            setupInited = true;

            if (playerCountEl) {
                playerCountEl.addEventListener('click', (e) => {
                    const btn = e.target.closest('.count-btn');
                    if (!btn) return;
                    playerCountEl.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    renderAiRoleList();
                });
            }

            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    setupOverlay.classList.remove('active');
                });
            }

            if (startBtn) {
                startBtn.addEventListener('click', async () => {
                    startBtn.disabled = true;
                    try {
                        await startGameFromSetup();
                    } finally {
                        startBtn.disabled = false;
                    }
                });
            }
        }

        function bindGameEvents() {
            if (roleBtn && roleModal) {
                roleBtn.addEventListener('click', async () => {
                    if (!scriptKillState.isRunning) {
                        if (typeof showToast === 'function') {
                            showToast('请先开始一局剧本杀。');
                        }
                        return;
                    }
                    await ensureScriptDetail();
                    updateUserPrivateInfoFromDetail();
                    roleModal.classList.add('active');
                });
            }

            if (roleModalClose && roleModal) {
                roleModalClose.addEventListener('click', () => {
                    roleModal.classList.remove('active');
                });
            }

            if (timelineBtn && timelineModal) {
                timelineBtn.addEventListener('click', async () => {
                    if (!scriptKillState.isRunning) {
                        if (typeof showToast === 'function') {
                            showToast('请先开始一局剧本杀。');
                        }
                        return;
                    }
                    await ensureScriptDetail();
                    updateUserPrivateInfoFromDetail();
                    timelineModal.classList.add('active');
                });
            }

            if (timelineModalClose && timelineModal) {
                timelineModalClose.addEventListener('click', () => {
                    timelineModal.classList.remove('active');
                });
            }

            if (sendBtn) {
                sendBtn.addEventListener('click', () => {
                    handleUserSend();
                });
            }

            if (inputEl) {
                inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleUserSend();
                    }
                });
            }

            if (voteBtn) {
                voteBtn.addEventListener('click', () => {
                    handleVoteSubmit();
                });
            }

            if (nextStageBtn) {
                nextStageBtn.addEventListener('click', () => {
                    if (!scriptKillState.isRunning) {
                        if (typeof showToast === 'function') {
                            showToast('请先在游戏大厅开启一局剧本杀。');
                        }
                        return;
                    }
                    if (scriptKillState.phase === PHASE.INTRO) {
                        scriptKillState.round = 1;
                        setPhase(PHASE.INVESTIGATION);
                        requestNarrationForPhase(PHASE.INVESTIGATION, '');
                    } else if (scriptKillState.phase === PHASE.INVESTIGATION) {
                        setPhase(PHASE.DISCUSSION);
                        requestNarrationForPhase(PHASE.DISCUSSION, '');
                    } else if (scriptKillState.phase === PHASE.DISCUSSION) {
                        setPhase(PHASE.VOTE);
                        prepareVoteOptions();
                    }
                });
            }

            if (backBtn) {
                backBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    scriptKillState.isRunning = false;
                    scriptKillState.phase = PHASE.ENDED;
                    if (typeof closePage === 'function') {
                        closePage('script-kill-page');
                    } else {
                        pageEl.classList.remove('active');
                    }
                    resetScriptKillState();
                });
            }

            resetScriptKillState();
        }

        function openScriptKillSetup() {
            if (!setupOverlay) {
                if (typeof showToast === 'function') {
                    showToast('当前页面未配置「剧本杀」开局弹窗。');
                }
                return;
            }

            bindSetupEvents();
            renderScriptList();
            renderUserRoleList();
            renderAiRoleList();
            setupOverlay.classList.add('active');
        }

        bindGameEvents();

        window.openScriptKillSetup = openScriptKillSetup;

        return {
            openSetup: openScriptKillSetup
        };
    })();

    const undercoverGame = (function() {
        const setupOverlay = document.getElementById('undercover-setup-overlay');
        const pageEl = document.getElementById('undercover-page');

        if (!setupOverlay || !pageEl) {
            window.openUndercoverSetup = function() {
                if (typeof showToast === 'function') {
                    showToast('当前页面未配置「谁是卧底」模块。');
                }
            };
            return {
                openSetup: () => {}
            };
        }

        const playerCountEl = document.getElementById('undercover-player-count');
        const userRoleListEl = document.getElementById('undercover-user-role-list');
        const aiRoleListEl = document.getElementById('undercover-ai-role-list');
        const aiHintEl = document.getElementById('undercover-ai-hint');
        const cancelBtn = document.getElementById('undercover-cancel-btn');
        const startBtn = document.getElementById('undercover-start-btn');

        const playersBarEl = document.getElementById('undercover-players');
        const logEl = document.getElementById('undercover-log');
        const subtitleEl = document.getElementById('undercover-subtitle');
        const statusEl = document.getElementById('undercover-status');
        const inputHintEl = document.getElementById('undercover-input-hint');
        const inputEl = document.getElementById('undercover-input');
        const sendBtn = document.getElementById('undercover-send-btn');
        const voteRowEl = document.getElementById('undercover-vote-row');
        const voteSelectEl = document.getElementById('undercover-vote-select');
        const voteBtn = document.getElementById('undercover-vote-btn');
        const backBtn = document.getElementById('undercover-back-btn');
        const wordBtn = document.getElementById('undercover-word-btn');

        const wordModal = document.getElementById('undercover-word-modal');
        const wordModalClose = document.getElementById('undercover-word-close');
        const wordTextEl = document.getElementById('undercover-word-text');
        const wordRoleDescEl = document.getElementById('undercover-role-desc-text');
        const wordOkBtn = document.getElementById('undercover-word-ok');

        const resultModal = document.getElementById('undercover-result-modal');
        const resultModalClose = document.getElementById('undercover-result-close');
        const resultSummaryEl = document.getElementById('undercover-result-summary');
        const resultCommonWordEl = document.getElementById('undercover-common-word');
        const resultUndercoverWordEl = document.getElementById('undercover-undercover-word');
        const resultDetailEl = document.getElementById('undercover-result-detail');
        const resultAgainBtn = document.getElementById('undercover-result-again');
        const resultBackBtn = document.getElementById('undercover-result-back');

        const PHASE = {
            READY: 'ready',
            DESCRIBE: 'describe',
            REASON: 'reason',
            VOTE: 'vote',
            ENDED: 'ended'
        };

        const WORD_PAIRS = [
            { commonWord: '雪碧', undercoverWord: '七喜' },
            { commonWord: '洗发水', undercoverWord: '沐浴露' },
            { commonWord: '羽毛球', undercoverWord: '乒乓球' },
            { commonWord: '充电宝', undercoverWord: '移动电源' },
            { commonWord: '被子', undercoverWord: '毯子' },
            { commonWord: '耳机', undercoverWord: '音响' }
        ];

        let setupInited = false;
        let gameInited = false;

        let undercoverState = {
            isRunning: false,
            players: [],
            userPlayerId: null,
            undercoverPlayerId: null,
            commonWord: '',
            undercoverWord: '',
            phase: PHASE.READY,
            round: 0,
            turnIndex: 0,
            waitingForUser: false,
            history: []
        };

        function getSelectedPlayerCount() {
            if (!playerCountEl) return 4;
            const active = playerCountEl.querySelector('.count-btn.active');
            if (!active) return 4;
            const n = parseInt(active.dataset.size, 10);
            return n === 6 ? 6 : 4;
        }

        function updateAiHint() {
            if (!aiHintEl) return;
            const total = getSelectedPlayerCount();
            const needAi = Math.max(0, total - 1);
            let selected = 0;
            if (aiRoleListEl) {
                selected = aiRoleListEl.querySelectorAll('.undercover-role-item.ai-role.active').length;
            }
            aiHintEl.textContent = `当前为 ${total} 人局，需要选择 ${needAi} 个 AI 角色，目前已选择 ${selected} 个。`;
        }

        function renderUserRoleList() {
            if (!userRoleListEl) return;
            userRoleListEl.innerHTML = '';

            const users = Array.isArray(userProfiles) ? userProfiles : [];
            if (!users.length) {
                const empty = document.createElement('div');
                empty.className = 'undercover-role-empty';
                empty.textContent = '当前还没有用户角色，请先在 QQ 中创建。';
                userRoleListEl.appendChild(empty);
                return;
            }

            users.forEach((u, index) => {
                const item = document.createElement('div');
                item.className = 'undercover-role-item user-role' + (index === 0 ? ' active' : '');
                item.dataset.id = u.id;

                const avatar = document.createElement('img');
                avatar.className = 'undercover-role-avatar';
                avatar.src = u.avatar || DEFAULT_USER_AVATAR_URL;

                const main = document.createElement('div');
                main.className = 'undercover-role-main';

                const nameEl = document.createElement('div');
                nameEl.className = 'undercover-role-name';
                nameEl.textContent = u.name || '我';

                const descEl = document.createElement('div');
                descEl.className = 'undercover-role-desc';
                descEl.textContent = '用户角色';

                main.appendChild(nameEl);
                main.appendChild(descEl);
                item.appendChild(avatar);
                item.appendChild(main);

                item.addEventListener('click', () => {
                    const siblings = userRoleListEl.querySelectorAll('.undercover-role-item.user-role');
                    siblings.forEach(s => s.classList.remove('active'));
                    item.classList.add('active');
                });

                userRoleListEl.appendChild(item);
            });
        }

        function renderAiRoleList() {
            if (!aiRoleListEl) return;
            aiRoleListEl.innerHTML = '';

            const total = getSelectedPlayerCount();
            const maxAi = Math.max(0, total - 1);

            const ais = Array.isArray(aiList) ? aiList : [];
            if (!ais.length) {
                const empty = document.createElement('div');
                empty.className = 'undercover-role-empty';
                empty.textContent = '当前还没有 AI 好友，请先在 QQ 中创建。';
                aiRoleListEl.appendChild(empty);
                updateAiHint();
                return;
            }

            ais.forEach(ai => {
                const item = document.createElement('div');
                item.className = 'undercover-role-item ai-role';
                item.dataset.id = ai.id;

                const avatar = document.createElement('img');
                avatar.className = 'undercover-role-avatar';
                avatar.src = ai.avatar || DEFAULT_AI_AVATAR_URL;

                const main = document.createElement('div');
                main.className = 'undercover-role-main';

                const nameEl = document.createElement('div');
                nameEl.className = 'undercover-role-name';
                nameEl.textContent = ai.name || '未命名角色';

                const descEl = document.createElement('div');
                descEl.className = 'undercover-role-desc';
                descEl.textContent = ai.nickname ? `AI 好友 · ${ai.nickname}` : 'AI 好友';

                main.appendChild(nameEl);
                main.appendChild(descEl);
                item.appendChild(avatar);
                item.appendChild(main);

                item.addEventListener('click', () => {
                    const active = item.classList.contains('active');
                    if (active) {
                        item.classList.remove('active');
                        updateAiHint();
                        return;
                    }
                    const selected = aiRoleListEl.querySelectorAll('.undercover-role-item.ai-role.active').length;
                    if (selected >= maxAi) {
                        if (typeof showToast === 'function') {
                            showToast(`当前为 ${total} 人局，最多只能选择 ${maxAi} 个 AI 角色。`);
                        }
                        return;
                    }
                    item.classList.add('active');
                    updateAiHint();
                });

                aiRoleListEl.appendChild(item);
            });

            updateAiHint();
        }

        function collectPlayersFromSetup() {
            const total = getSelectedPlayerCount();
            const needAi = Math.max(0, total - 1);

            let userPlayer = null;
            const userItem = userRoleListEl && userRoleListEl.querySelector('.undercover-role-item.user-role.active');
            if (userItem) {
                const uid = userItem.dataset.id;
                const u = (userProfiles || []).find(p => String(p.id) === String(uid));
                if (u) {
                    userPlayer = {
                        id: `user-${u.id}`,
                        sourceType: 'user',
                        sourceId: u.id,
                        name: u.name || '我',
                        avatar: u.avatar || DEFAULT_USER_AVATAR_URL,
                        prompt: u.prompt || '',
                        isUser: true,
                        isAI: false,
                        isUndercover: false,
                        isOut: false,
                        word: ''
                    };
                }
            }

            if (!userPlayer) {
                throw new Error('必须选择 1 个用户角色。');
            }

            const aiPlayers = [];
            if (aiRoleListEl) {
                const aiItems = aiRoleListEl.querySelectorAll('.undercover-role-item.ai-role.active');
                aiItems.forEach(item => {
                    const aid = item.dataset.id;
                    const ai = (aiList || []).find(p => String(p.id) === String(aid));
                    if (ai) {
                        aiPlayers.push({
                            id: `ai-${ai.id}`,
                            sourceType: 'ai',
                            sourceId: ai.id,
                            name: ai.name || '未命名角色',
                            avatar: ai.avatar || DEFAULT_AI_AVATAR_URL,
                            prompt: ai.prompt || '',
                            isUser: false,
                            isAI: true,
                            isUndercover: false,
                            isOut: false,
                            word: ''
                        });
                    }
                });
            }

            if (aiPlayers.length !== needAi) {
                throw new Error(`当前为 ${total} 人局，需要选择 ${needAi} 个 AI 角色，当前为 ${aiPlayers.length} 个。`);
            }

            return [userPlayer, ...aiPlayers];
        }

        function resetLogWithIntro() {
            if (!logEl) return;
            logEl.innerHTML = '';
            const p = document.createElement('p');
            p.className = 'undercover-log-placeholder';
            p.innerHTML = '先在游戏大厅中选择人数和角色，点击「进入游戏」。系统会为大家分配词语，其中只有一人拿到不一样的词。';
            logEl.appendChild(p);
        }

        function appendUndercoverLog(text) {
            if (!logEl) return;
            const placeholder = logEl.querySelector('.undercover-log-placeholder');
            if (placeholder) placeholder.remove();

            const safeText = escapeHTML(String(text || ''));
            const paragraphs = safeText
                .split(/\n{2,}/)
                .map(part => part.trim())
                .filter(part => part.length > 0);

            const wrapper = document.createElement('div');
            wrapper.className = 'undercover-log-block';

            if (!paragraphs.length) {
                const p = document.createElement('p');
                p.innerHTML = safeText.replace(/\n/g, '<br>');
                wrapper.appendChild(p);
            } else {
                paragraphs.forEach(part => {
                    const p = document.createElement('p');
                    p.innerHTML = part.replace(/\n/g, '<br>');
                    wrapper.appendChild(p);
                });
            }

            logEl.appendChild(wrapper);
            logEl.scrollTop = logEl.scrollHeight;
        }

        function renderPlayersBar() {
            if (!playersBarEl) return;
            playersBarEl.innerHTML = '';

            undercoverState.players.forEach(p => {
                const item = document.createElement('div');
                item.className = 'undercover-player-item';
                item.dataset.id = p.id;

                const avatar = document.createElement('img');
                avatar.className = 'undercover-player-avatar';
                avatar.src = p.avatar || DEFAULT_AI_AVATAR_URL;

                const nameEl = document.createElement('div');
                nameEl.className = 'undercover-player-name';
                nameEl.textContent = p.name;

                item.appendChild(avatar);
                item.appendChild(nameEl);
                playersBarEl.appendChild(item);
            });
        }

        function highlightCurrentPlayer(playerId) {
            if (!playersBarEl) return;
            const items = playersBarEl.querySelectorAll('.undercover-player-item');
            items.forEach(item => {
                item.classList.toggle('active', item.dataset.id === playerId);
            });
        }

        function applyPhaseUI() {
            if (!inputHintEl || !sendBtn) return;

            const roundLabel = undercoverState.round || 1;

            if (undercoverState.phase === PHASE.READY) {
                if (subtitleEl) subtitleEl.textContent = '游戏尚未开始';
                inputHintEl.textContent = '请先在游戏大厅完成开局设置。';
                sendBtn.disabled = true;
                if (voteRowEl) voteRowEl.style.display = 'none';
            } else if (undercoverState.phase === PHASE.DESCRIBE) {
                if (subtitleEl) subtitleEl.textContent = `第 ${roundLabel} 轮 · 描述词语`;
                if (undercoverState.waitingForUser) {
                    inputHintEl.textContent = '请用一两句话描述你的词语，但不要直接说出词本身。';
                    sendBtn.disabled = false;
                } else {
                    inputHintEl.textContent = '当前是其他玩家的描述阶段，请稍候…';
                    sendBtn.disabled = true;
                }
                if (voteRowEl) voteRowEl.style.display = 'none';
            } else if (undercoverState.phase === PHASE.REASON) {
                if (subtitleEl) subtitleEl.textContent = `第 ${roundLabel} 轮 · 推理发言`;
                if (undercoverState.waitingForUser) {
                    inputHintEl.textContent = '现在请说说你怀疑谁，以及理由。';
                    sendBtn.disabled = false;
                } else {
                    inputHintEl.textContent = '当前是其他玩家的推理发言，请稍候…';
                    sendBtn.disabled = true;
                }
                if (voteRowEl) voteRowEl.style.display = 'none';
            } else if (undercoverState.phase === PHASE.VOTE) {
                if (subtitleEl) subtitleEl.textContent = `第 ${roundLabel} 轮 · 投票阶段`;
                inputHintEl.textContent = '请选择你认为是卧底的人并提交投票。';
                sendBtn.disabled = true;
                if (voteRowEl) voteRowEl.style.display = 'flex';
            } else if (undercoverState.phase === PHASE.ENDED) {
                if (subtitleEl) subtitleEl.textContent = '本局已结束';
                inputHintEl.textContent = '本局谁是卧底已结束，可以返回游戏大厅重新开一局。';
                sendBtn.disabled = true;
                if (voteRowEl) voteRowEl.style.display = 'none';
            }
        }

        function resetUndercoverState() {
            undercoverState = {
                isRunning: false,
                players: [],
                userPlayerId: null,
                undercoverPlayerId: null,
                commonWord: '',
                undercoverWord: '',
                phase: PHASE.READY,
                round: 0,
                turnIndex: 0,
                waitingForUser: false,
                history: []
            };
            renderPlayersBar();
            resetLogWithIntro();
            applyPhaseUI();
            if (statusEl) statusEl.textContent = '';
        }

        function assignWordsAndUndercover(players) {
            const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)] || WORD_PAIRS[0];
            const undercoverIndex = Math.floor(Math.random() * players.length);
            const undercoverPlayer = players[undercoverIndex];

            players.forEach((p, idx) => {
                p.isUndercover = idx === undercoverIndex;
                p.word = p.isUndercover ? pair.undercoverWord : pair.commonWord;
            });

            undercoverState.undercoverPlayerId = undercoverPlayer.id;
            undercoverState.commonWord = pair.commonWord;
            undercoverState.undercoverWord = pair.undercoverWord;
        }

        function updateUserWordModal() {
            const players = undercoverState.players || [];
            const userPlayer = players.find(p => p.isUser);
            if (!userPlayer || !wordTextEl || !wordRoleDescEl) return;

            wordTextEl.textContent = userPlayer.word || '尚未分配';
            if (userPlayer.isUndercover) {
                wordRoleDescEl.textContent = '你是卧底，你拿到的词语和其他人略有不同。尽量用模糊但合理的方式描述，避免露馅。';
            } else {
                wordRoleDescEl.textContent = '你是平民，你拿到的词语和大多数人一致。请尽量真实描述，但不要直接说出词语本身。';
            }
        }

        function getAlivePlayers() {
            return (undercoverState.players || []).filter(p => !p.isOut);
        }

        async function requestAiSpeech(player, phase) {
            const players = undercoverState.players || [];
            const word = player.word || '';
            const round = undercoverState.round || 1;

            const recentHistory = undercoverState.history
                .slice(-8)
                .map(h => `${h.speakerName}：${h.text}`)
                .join('\n');

            if (!config || !config.key || !config.url || typeof getCompletion !== 'function') {
                if (phase === PHASE.DESCRIBE) {
                    return '我觉得这个东西在日常生活里挺常见的，用它可以让某些事情变得更方便一点。';
                }
                return '我觉得有几个人的描述和我的词不太一致，但我还在观察中。';
            }

            const phaseDesc = phase === PHASE.DESCRIBE
                ? '请用一两句中文描述你拿到的词语，但不要直接说出词本身，只描述特征。'
                : '请根据前面大家的描述，简要说说你怀疑谁更有可能是卧底，以及一句理由。';

            const playerLines = players.map(p => `- ${p.name}：${p.isUndercover ? '（系统备注：此人是卧底）' : ''}`).join('\n');

            const promptParts = [];
            promptParts.push(
                '你现在在玩一个叫「谁是卧底」的中文桌游。',
                '\n[你的设定]',
                `你的名字是：${player.name}`,
                `你拿到的词语是：「${word}」(注意：在发言中不要直接说出这个词)`,
                player.isUndercover
                    ? '你是卧底，你拿到的词语和其他人略有不同，要尽量说得模糊但合理。'
                    : '你是平民，你拿到的词语和大多数人一致，可以比较自然地描述。',
                '\n[当前轮次]',
                `第 ${round} 轮，阶段：${phase === PHASE.DESCRIBE ? '描述词语' : '推理发言'}`,
                '\n[桌上玩家]',
                playerLines || '略',
                '\n[最近发言摘要]',
                recentHistory || '目前还没有太多发言。',
                '\n[发言要求]',
                phaseDesc,
                '整体不超过 2 句中文，语气口语化一些。'
            );

            const finalPrompt = promptParts.join('\n');
            const reply = await getCompletion(finalPrompt, false);
            return (reply || '').trim().split(/\n/)[0].slice(0, 80) || '我这边的感觉还在观察中。';
        }

        async function requestAiVote(player, alivePlayers) {
            const others = alivePlayers.filter(p => p.id !== player.id);
            if (!config || !config.key || !config.url || typeof getCompletion !== 'function') {
                if (!others.length) return null;
                return others[Math.floor(Math.random() * others.length)].id;
            }

            const recentHistory = undercoverState.history
                .slice(-8)
                .map(h => `${h.speakerName}：${h.text}`)
                .join('\n');

            const lines = others.map(p => `- ${p.name}`);
            const promptParts = [];
            promptParts.push(
                '你正在玩「谁是卧底」，现在进入投票阶段，你需要在其他玩家里选出一个最可疑的目标。',
                '\n[你的名字]',
                player.name,
                '\n[可投票的玩家名单]',
                lines.join('\n') || '暂无',
                '\n[最近的发言记录]',
                recentHistory || '几乎没有有用信息。',
                '\n[输出要求]',
                '只输出一个玩家的名字，不要解释理由，不要加其他符号。'
            );

            const finalPrompt = promptParts.join('\n');
            const reply = await getCompletion(finalPrompt, false);
            const line = (reply || '').trim().split(/\n/)[0];
            const target = others.find(p => line.includes(p.name)) || others[0] || null;
            return target ? target.id : null;
        }

        async function runCurrentPhaseTurn() {
            if (!undercoverState.isRunning) return;
            const alive = getAlivePlayers();
            const phase = undercoverState.phase;

            if (phase !== PHASE.DESCRIBE && phase !== PHASE.REASON) {
                applyPhaseUI();
                return;
            }

            if (undercoverState.turnIndex >= alive.length) {
                // 本阶段结束，切换到下一个阶段
                if (phase === PHASE.DESCRIBE) {
                    undercoverState.phase = PHASE.REASON;
                    undercoverState.turnIndex = 0;
                    undercoverState.waitingForUser = false;
                    appendUndercoverLog('—— 推理阶段开始，每个人依次说出自己的怀疑与理由 ——');
                    applyPhaseUI();
                    await runCurrentPhaseTurn();
                    return;
                }
                if (phase === PHASE.REASON) {
                    undercoverState.phase = PHASE.VOTE;
                    undercoverState.turnIndex = 0;
                    undercoverState.waitingForUser = false;
                    if (statusEl) statusEl.textContent = '请完成本轮投票。';
                    prepareVoteOptions();
                    applyPhaseUI();
                    return;
                }
            }

            const current = alive[undercoverState.turnIndex];
            if (!current) return;

            highlightCurrentPlayer(current.id);

            if (current.isUser) {
                undercoverState.waitingForUser = true;
                if (statusEl) statusEl.textContent = phase === PHASE.DESCRIBE ? '轮到你描述你的词语。' : '轮到你进行推理发言。';
                applyPhaseUI();
                return; // 等待用户在输入框中完成发言
            }

            undercoverState.waitingForUser = false;
            applyPhaseUI();

            if (statusEl) {
                statusEl.textContent = `正在等待 ${current.name} 的发言…`;
            }

            try {
                const text = await requestAiSpeech(current, phase);
                const label = phase === PHASE.DESCRIBE ? '描述' : '推理';
                appendUndercoverLog(`${current.name}（${label}）：${escapeHTML(text)}`);
                undercoverState.history.push({
                    round: undercoverState.round,
                    phase,
                    speakerId: current.id,
                    speakerName: current.name,
                    text
                });
            } catch (e) {
                console.warn('undercover ai speech error', e);
                appendUndercoverLog(`${current.name}：暂时没有新的发言。`);
            } finally {
                undercoverState.turnIndex += 1;
                if (statusEl) statusEl.textContent = '';
                await runCurrentPhaseTurn();
            }
        }

        function prepareVoteOptions() {
            if (!voteSelectEl) return;
            voteSelectEl.innerHTML = '';
            const players = getAlivePlayers();
            players.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.isUser ? `${p.name}（你）` : p.name;
                voteSelectEl.appendChild(opt);
            });
        }

        async function handleUserSend() {
            if (!undercoverState.isRunning) {
                if (typeof showToast === 'function') {
                    showToast('请先在游戏大厅开启一局谁是卧底。');
                }
                return;
            }
            if (!inputEl) return;
            if (undercoverState.phase !== PHASE.DESCRIBE && undercoverState.phase !== PHASE.REASON) {
                if (typeof showToast === 'function') {
                    showToast('当前阶段不支持自由发言。');
                }
                return;
            }

            const alive = getAlivePlayers();
            const current = alive[undercoverState.turnIndex];
            if (!current || !current.isUser) {
                if (typeof showToast === 'function') {
                    showToast('当前还没轮到你发言。');
                }
                return;
            }

            const text = inputEl.value.trim();
            if (!text) {
                if (typeof showToast === 'function') {
                    showToast('先说点什么再发送吧。');
                }
                return;
            }
            inputEl.value = '';

            appendUndercoverLog(`${current.name}：${escapeHTML(text)}`);
            undercoverState.history.push({
                round: undercoverState.round,
                phase: undercoverState.phase,
                speakerId: current.id,
                speakerName: current.name,
                text
            });

            undercoverState.turnIndex += 1;
            undercoverState.waitingForUser = false;
            applyPhaseUI();
            await runCurrentPhaseTurn();
        }

        async function handleVoteSubmit() {
            if (!undercoverState.isRunning || undercoverState.phase !== PHASE.VOTE) return;
            if (!voteSelectEl || !voteSelectEl.value) {
                if (typeof showToast === 'function') {
                    showToast('请先选择你要投出的角色。');
                }
                return;
            }

            const players = getAlivePlayers();
            const userPlayer = players.find(p => p.isUser);
            const targetId = voteSelectEl.value;
            const target = players.find(p => p.id === targetId);
            if (!target) {
                if (typeof showToast === 'function') {
                    showToast('选择的角色已不存在，请刷新列表。');
                }
                return;
            }

            const votes = [];
            if (userPlayer) {
                votes.push({ voterId: userPlayer.id, targetId: target.id });
                appendUndercoverLog(`${userPlayer.name}：我投给「${target.name}」。`);
            }

            // AI 投票
            for (const p of players) {
                if (p.isUser) continue;
                try {
                    const voteTargetId = await requestAiVote(p, players);
                    const vt = players.find(x => x.id === voteTargetId) || players.find(x => x.id !== p.id);
                    if (!vt) continue;
                    votes.push({ voterId: p.id, targetId: vt.id });
                    appendUndercoverLog(`${p.name}：我投给「${vt.name}」。`);
                } catch (e) {
                    console.warn('undercover ai vote error', e);
                }
            }

            // 统计票数
            const tally = {};
            votes.forEach(v => {
                if (!tally[v.targetId]) tally[v.targetId] = 0;
                tally[v.targetId] += 1;
            });

            let topId = null;
            let topCount = 0;
            let tie = false;
            Object.keys(tally).forEach(id => {
                const count = tally[id];
                if (count > topCount) {
                    topCount = count;
                    topId = id;
                    tie = false;
                } else if (count === topCount) {
                    tie = true;
                }
            });

            const votedPlayer = players.find(p => p.id === topId) || null;

            let hitUndercover = false;
            if (!votedPlayer || tie) {
                appendUndercoverLog('这一轮的投票出现了平票，大家似乎还拿不定主意。');
            } else {
                if (votedPlayer.id === undercoverState.undercoverPlayerId) {
                    hitUndercover = true;
                    appendUndercoverLog(`在一片犹豫之后，多数票落在了「${votedPlayer.name}」身上。事实证明，他/她正是本局的卧底！`);
                } else {
                    appendUndercoverLog(`大家的目光最终停在「${votedPlayer.name}」身上，但真实的卧底似乎仍然隐藏在人群之中。`);
                }
            }

            // 轮次与结果判定
            if (hitUndercover) {
                endGame(true, votedPlayer);
            } else {
                if (undercoverState.round >= 3) {
                    endGame(false, votedPlayer || null);
                } else {
                    undercoverState.round += 1;
                    undercoverState.phase = PHASE.DESCRIBE;
                    undercoverState.turnIndex = 0;
                    undercoverState.waitingForUser = false;
                    appendUndercoverLog(`—— 第 ${undercoverState.round} 轮重新开始，大家又拿起了自己的词语 ——`);
                    applyPhaseUI();
                    await runCurrentPhaseTurn();
                }
            }
        }

        function fillResultModal(isWin, votedPlayer) {
            if (!resultSummaryEl || !resultCommonWordEl || !resultUndercoverWordEl || !resultDetailEl) return;

            const players = undercoverState.players || [];
            const userPlayer = players.find(p => p.isUser);
            const undercoverPlayer = players.find(p => p.id === undercoverState.undercoverPlayerId) || null;

            if (isWin) {
                resultSummaryEl.textContent = '你们成功找出了卧底！';
            } else {
                resultSummaryEl.textContent = '卧底成功躲过了所有怀疑，这一局卧底阵营获胜。';
            }

            resultCommonWordEl.textContent = undercoverState.commonWord || '-';
            resultUndercoverWordEl.textContent = undercoverState.undercoverWord || '-';

            const lines = [];
            if (undercoverPlayer) {
                lines.push(`本局卧底是：${undercoverPlayer.name}`);
            }
            if (votedPlayer) {
                lines.push(`最后被集中票数投出的玩家是：${votedPlayer.name}`);
            }
            if (userPlayer) {
                if (userPlayer.isUndercover) {
                    lines.push('你本局扮演的是卧底角色。试着回想一下你是在哪个细节被大家发现的。');
                } else {
                    lines.push('你本局是平民角色。可以回顾一下自己在描述和推理阶段有没有被卧底带偏。');
                }
            }

            resultDetailEl.innerHTML = lines.map(l => `<p>${escapeHTML(l)}</p>`).join('');
        }

        function endGame(isWin, votedPlayer) {
            undercoverState.isRunning = false;
            undercoverState.phase = PHASE.ENDED;
            applyPhaseUI();
            highlightCurrentPlayer(null);

            fillResultModal(isWin, votedPlayer);

            if (resultModal) {
                resultModal.classList.add('active');
            }
        }

        async function startGameFromSetup() {
            let players;
            try {
                players = collectPlayersFromSetup();
            } catch (e) {
                if (typeof showToast === 'function') {
                    showToast(e.message || '玩家选择不合法');
                }
                return;
            }

            undercoverState.isRunning = true;
            undercoverState.players = players;
            undercoverState.userPlayerId = players.find(p => p.isUser)?.id || null;
            undercoverState.round = 1;
            undercoverState.phase = PHASE.DESCRIBE;
            undercoverState.turnIndex = 0;
            undercoverState.waitingForUser = false;
            undercoverState.history = [];

            assignWordsAndUndercover(players);
            renderPlayersBar();
            updateUserWordModal();

            if (subtitleEl) {
                subtitleEl.textContent = '第 1 轮 · 描述词语';
            }

            if (statusEl) {
                statusEl.textContent = '所有人依次对自己的词语做一次描述。';
            }

            if (setupOverlay) setupOverlay.classList.remove('active');

            if (typeof openPage === 'function') {
                openPage('undercover-page');
            } else {
                pageEl.classList.add('active');
            }

            resetLogWithIntro();
            appendUndercoverLog('本局「谁是卧底」已经开始。所有人都拿到了一个词语，其中只有一人拿到的是略有不同的词。');

            applyPhaseUI();
            await runCurrentPhaseTurn();
        }

        function bindSetupEvents() {
            if (setupInited) return;
            setupInited = true;

            if (playerCountEl) {
                playerCountEl.addEventListener('click', (e) => {
                    const btn = e.target.closest('.count-btn');
                    if (!btn) return;
                    playerCountEl.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    renderAiRoleList();
                });
            }

            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    setupOverlay.classList.remove('active');
                });
            }

            if (startBtn) {
                startBtn.addEventListener('click', async () => {
                    startBtn.disabled = true;
                    try {
                        await startGameFromSetup();
                    } finally {
                        startBtn.disabled = false;
                    }
                });
            }
        }

        function bindGameEvents() {
            if (gameInited) return;
            gameInited = true;

            if (sendBtn) {
                sendBtn.addEventListener('click', () => {
                    handleUserSend();
                });
            }

            if (inputEl) {
                inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleUserSend();
                    }
                });
            }

            if (voteBtn) {
                voteBtn.addEventListener('click', () => {
                    handleVoteSubmit();
                });
            }

            if (backBtn) {
                backBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    undercoverState.isRunning = false;
                    undercoverState.phase = PHASE.ENDED;
                    if (typeof closePage === 'function') {
                        closePage('undercover-page');
                    } else {
                        pageEl.classList.remove('active');
                    }
                    resetUndercoverState();
                });
            }

            if (wordBtn && wordModal) {
                wordBtn.addEventListener('click', () => {
                    if (!undercoverState.isRunning) {
                        if (typeof showToast === 'function') {
                            showToast('请先开始一局谁是卧底。');
                        }
                        return;
                    }
                    updateUserWordModal();
                    wordModal.classList.add('active');
                });
            }

            const closeWordModal = () => {
                if (wordModal) wordModal.classList.remove('active');
            };

            if (wordModalClose) {
                wordModalClose.addEventListener('click', closeWordModal);
            }
            if (wordOkBtn) {
                wordOkBtn.addEventListener('click', closeWordModal);
            }

            const closeResultModal = () => {
                if (resultModal) resultModal.classList.remove('active');
            };

            if (resultModalClose) {
                resultModalClose.addEventListener('click', closeResultModal);
            }

            if (resultAgainBtn) {
                resultAgainBtn.addEventListener('click', () => {
                    closeResultModal();
                    resetUndercoverState();
                    openUndercoverSetup();
                });
            }

            if (resultBackBtn) {
                resultBackBtn.addEventListener('click', () => {
                    closeResultModal();
                    resetUndercoverState();
                    if (typeof closePage === 'function') {
                        closePage('undercover-page');
                    } else {
                        pageEl.classList.remove('active');
                    }
                });
            }

            resetUndercoverState();
        }

        function openUndercoverSetup() {
            if (!setupOverlay) {
                if (typeof showToast === 'function') {
                    showToast('当前页面未配置「谁是卧底」开局弹窗。');
                }
                return;
            }

            bindSetupEvents();
            renderUserRoleList();
            renderAiRoleList();

            setupOverlay.classList.add('active');
        }

        bindGameEvents();

        window.openUndercoverSetup = openUndercoverSetup;

        return {
            openSetup: openUndercoverSetup
        };
    })();

    // --- 2.2. 初始化与数据补全 ---
    if (userProfiles.length === 0) {
        userProfiles.push({ id: Date.now(), name: '我', avatar: defaultAvatarSVG, prompt: '' });
        setStorage('ai_users_list', userProfiles);
    }
    
    aiList.forEach(ai => {
        if (!ai.settings) {
            ai.settings = {
                timePerception: false,
                chatWorldbookId: 'none',
                offlineMode: { enabled: false, wordCountMin: 500, wordCountMax: 1500, worldbookId: 'none' }
            };
        }
        if (!ai.userId) {
            ai.userId = userProfiles[0]?.id;
        }
        if (ai.history && ai.history.length > 0 && typeof ai.history[0].content === 'string') {
            ai.history = ai.history.map(msg => ({
                sender: msg.role === 'user' ? (ai.userId || userProfiles[0].id) : ai.id,
                text: msg.content,
                type: 'text',
                timestamp: new Date().toISOString(),
                ...msg
            }));
        }
    });
    setStorage('ai_list_v2', aiList);


    // =========================================================================
    // ------------------ III. LOCK SCREEN & HOME SCREEN WIDGETS ------------------
    // =========================================================================

    const lockScreenElement = document.getElementById('lock-screen');
    if (lockScreenElement) {
        const slider = document.getElementById('lock-slider');
        const sliderThumb = document.getElementById('lock-slider-thumb');
        const sliderTrack = document.getElementById('lock-slider-track');
        const swipeHint = document.getElementById('lock-swipe-hint');
        const passcodePanel = document.getElementById('lock-passcode-panel');
        const passcodeDots = Array.from(document.querySelectorAll('.lock-passcode-dot'));
        const keypad = document.querySelector('.lock-passcode-keypad');

        let isDragging = false;
        let startX = 0;
        let currentX = 0;
        const unlockThreshold = 0.65; // 滑动超过 track 的 65% 即解锁

        let currentInput = '';

        const applyLockModeUI = () => {
            const mode = config.lockMode || 'slider';
            if (slider) slider.style.display = mode === 'slider' ? 'block' : 'none';
            if (swipeHint) swipeHint.classList.toggle('visible', mode !== 'slider');
            if (passcodePanel) passcodePanel.classList.toggle('visible', mode === 'swipe_passcode');
        };

        const handleUnlock = () => {
            lockScreenElement.classList.add('unlocked');
            lockScreenElement.addEventListener('transitionend', () => {
                if (lockScreenElement.classList.contains('unlocked')) {
                    lockScreenElement.style.display = 'none';
                }
            }, { once: true });
        };

        const resetThumb = () => {
            currentX = 0;
            if (sliderThumb) sliderThumb.style.transform = 'translateX(0px)';
        };

        const onDragMove = (clientX) => {
            if (!isDragging || !sliderTrack || !sliderThumb) return;
            const delta = clientX - startX;
            const maxTranslate = sliderTrack.offsetWidth - sliderThumb.offsetWidth - 4;
            currentX = Math.max(0, Math.min(delta, maxTranslate));
            sliderThumb.style.transform = `translateX(${currentX}px)`;
        };

        const onDragEnd = () => {
            if (!isDragging || !sliderTrack || !sliderThumb) return;
            isDragging = false;
            const maxTranslate = sliderTrack.offsetWidth - sliderThumb.offsetWidth - 4;
            if (currentX >= maxTranslate * unlockThreshold) {
                sliderThumb.style.transform = `translateX(${maxTranslate}px)`;
                handleUnlock();
            } else {
                sliderThumb.style.transition = 'transform 0.3s ease';
                sliderThumb.style.transform = 'translateX(0px)';
                setTimeout(() => { sliderThumb.style.transition = ''; }, 300);
            }
        };

        // 滑块模式事件
        if (sliderThumb && sliderTrack) {
            sliderThumb.addEventListener('touchstart', (e) => {
                if ((config.lockMode || 'slider') !== 'slider') return;
                isDragging = true;
                startX = e.touches[0].clientX;
                sliderThumb.style.transition = '';
            }, { passive: true });
            sliderThumb.addEventListener('touchmove', (e) => {
                if ((config.lockMode || 'slider') !== 'slider') return;
                onDragMove(e.touches[0].clientX);
            }, { passive: true });
            sliderThumb.addEventListener('touchend', () => {
                if ((config.lockMode || 'slider') !== 'slider') return;
                onDragEnd();
            }, { passive: true });
            sliderThumb.addEventListener('touchcancel', () => {
                if ((config.lockMode || 'slider') !== 'slider') return;
                onDragEnd();
            }, { passive: true });

            sliderThumb.addEventListener('mousedown', (e) => {
                if ((config.lockMode || 'slider') !== 'slider') return;
                isDragging = true;
                startX = e.clientX;
                sliderThumb.style.transition = '';
            });
            window.addEventListener('mousemove', (e) => {
                if (!isDragging || (config.lockMode || 'slider') !== 'slider') return;
                onDragMove(e.clientX);
            });
            window.addEventListener('mouseup', () => {
                if ((config.lockMode || 'slider') !== 'slider') return;
                onDragEnd();
            });
        }

        // 上滑解锁手势（用于 swipe / swipe_passcode）
        let startY = 0;
        let deltaY = 0;
        const swipeThreshold = 80; // 上滑超过 80px 触发

        const onTouchStart = (e) => {
            startY = e.touches[0].clientY;
            deltaY = 0;
        };

        const onTouchMove = (e) => {
            deltaY = startY - e.touches[0].clientY;
        };

        const onTouchEnd = () => {
            const mode = config.lockMode || 'slider';
            if (mode === 'slider') return;
            if (deltaY > swipeThreshold) {
                if (mode === 'swipe') {
                    handleUnlock();
                } else if (mode === 'swipe_passcode') {
                    if (passcodePanel) passcodePanel.classList.add('visible');
                }
            }
        };

        lockScreenElement.addEventListener('touchstart', onTouchStart, { passive: true });
        lockScreenElement.addEventListener('touchmove', onTouchMove, { passive: true });
        lockScreenElement.addEventListener('touchend', onTouchEnd, { passive: true });

        // 密码输入逻辑
        const updateDots = () => {
            passcodeDots.forEach((dot, index) => {
                if (!dot) return;
                dot.classList.toggle('filled', index < currentInput.length);
            });
        };

        const checkPasscode = () => {
            const correct = (config.lockPasscode || '1234').slice(0, 4);
            if (currentInput === correct) {
                handleUnlock();
                currentInput = '';
                updateDots();
            } else {
                // 错误时轻微抖动
                if (passcodePanel) {
                    passcodePanel.classList.add('shake');
                    setTimeout(() => passcodePanel.classList.remove('shake'), 300);
                }
                currentInput = '';
                updateDots();
            }
        };

        if (keypad) {
            keypad.addEventListener('click', (e) => {
                const keyEl = e.target.closest('.lock-key');
                if (!keyEl) return;
                const key = keyEl.getAttribute('data-key');
                if (!key) return;

                if (key === 'delete') {
                    currentInput = currentInput.slice(0, -1);
                    updateDots();
                    return;
                }
                if (!/^[0-9]$/.test(key)) return;
                if (currentInput.length >= 4) return;
                currentInput += key;
                updateDots();
                if (currentInput.length === 4) {
                    setTimeout(checkPasscode, 120);
                }
            });
        }

        applyLockModeUI();
    }

    setInterval(() => {
        const now = new Date();
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const dateEl = document.getElementById('date-display');
        const timeEl = document.getElementById('time-display');
        if (dateEl) {
            dateEl.innerText = `${now.getMonth() + 1}月${now.getDate()}日 ${days[now.getDay()]}`;
        }
        if (timeEl) {
            timeEl.innerText = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        }

        // 下面这些与「日剩 / 年剩」进度条相关的元素在新设计中已移除，
        // 为兼容旧代码，这里仅在元素仍存在时才更新，避免出现空指针错误。
        const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
        const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59).getTime();
        const yearPct = ((now.getTime() - startOfYear) / (endOfYear - startOfYear)) * 100;
        const yearFillEl = document.getElementById('year-fill');
        const yearTextEl = document.getElementById('year-text');
        if (yearFillEl && yearTextEl) {
            yearFillEl.style.height = `${yearPct}%`;
            yearTextEl.innerText = `${yearPct.toFixed(1)}%`;
        }

        const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const dayPct = ((now.getTime() - startDay) / 86400000) * 100;
        const dayFillEl = document.getElementById('day-fill');
        const dayTextEl = document.getElementById('day-text');
        if (dayFillEl && dayTextEl) {
            dayFillEl.style.height = `${dayPct}%`;
            dayTextEl.innerText = `${(100 - dayPct).toFixed(1)}%`;
        }
    }, 1000);

    // 旧版顶部小电量条：仅当 battery-bar 仍然存在时才尝试绑定，
    // 避免在新设计移除该元素后触发空指针。
    if (navigator.getBattery) {
        navigator.getBattery().then(b => {
            const barEl = document.getElementById('battery-bar');
            if (!barEl) return;
            const update = () => {
                barEl.style.width = (b.level * 100) + '%';
            };
            update();
            b.addEventListener('levelchange', update);
        }).catch(() => {
            // 忽略电量 API 失败，避免影响其它功能
        });
    }

    // 旧版左上角图片组件本地上传逻辑：当前组件已改为纪念日信息卡片，
    // 若页面中仍然保留 bg-upload，则继续支持上传；否则不绑定任何事件。
    const bgUploadInput = document.getElementById('bg-upload');
    if (bgUploadInput) {
        bgUploadInput.onchange = e => {
            if (e.target.files[0]) {
                const r = new FileReader();
                r.onload = ev => {
                    const w = document.getElementById('photo-widget');
                    if (w) {
                        w.style.backgroundImage = `url(${ev.target.result})`;
                    }
                };
                r.readAsDataURL(e.target.files[0]);
            }
        };
    }
    
    // =========================================================================
    // ------------------------ IV. QQ APP (MESSAGES & MOMENTS) --------------------
    // =========================================================================

    // ==== QQ 群聊数据结构 ====
    let qqGroupList = getStorage('qq_group_list_v1', []) || [];

    function saveQqGroupList() {
        if (!Array.isArray(qqGroupList)) qqGroupList = [];
        setStorage('qq_group_list_v1', qqGroupList);
    }

    function ensureQqGroupStructure(group) {
        if (!group) return;
        if (!Array.isArray(group.members)) group.members = [];
        if (!group.titles || typeof group.titles !== 'object') group.titles = {};
        if (!Array.isArray(group.history)) group.history = [];
        if (!group.settings || typeof group.settings !== 'object') {
            group.settings = {};
        }
        return group;
    }

    function createQqGroup(initialMembers, options = {}) {
        const members = Array.isArray(initialMembers) ? initialMembers : [];
        const id = 'group_' + Date.now();
        const name = options.name || '蛋壳小集体';
        const avatar = sanitizeAvatar(options.avatar) || DEFAULT_AI_AVATAR_URL;
        const group = ensureQqGroupStructure({
            id,
            name,
            avatar,
            members,
            titles: {},
            history: [],
            settings: {}
        });
        qqGroupList.unshift(group);
        saveQqGroupList();
        return group;
    }

    function findQqGroupById(groupId) {
        if (!groupId) return null;
        const g = (qqGroupList || []).find(g => g.id === groupId);
        return ensureQqGroupStructure(g);
    }

    function addMessageToGroup(groupId, message) {
        const group = findQqGroupById(groupId);
        if (!group) return;
        if (!message.id) {
            message.id = 'gmsg_' + Date.now();
        }
        if (!message.timestamp) {
            message.timestamp = new Date().toISOString();
        }
        group.history.push(message);
        saveQqGroupList();
    }

    function normalizeQqGroupMemberKey(member) {
        if (!member) return '';
        const type = member.type || 'ai';
        const id = member.id;
        return `${type}:${id}`;
    }

    function getQqGroupMemberTitle(group, member) {
        const key = normalizeQqGroupMemberKey(member);
        if (!key) return '';
        if (!group || !group.titles) return '';
        return group.titles[key] || '';
    }

    function setQqGroupMemberTitle(groupId, member, titleText) {
        const group = findQqGroupById(groupId);
        if (!group) return;
        const key = normalizeQqGroupMemberKey(member);
        if (!key) return;
        if (!group.titles) group.titles = {};
        group.titles[key] = String(titleText || '').trim();
        saveQqGroupList();
    }

    function loadChatList() {
        const list = document.getElementById('chat-list');
        list.innerHTML = '';

        const hasSingles = Array.isArray(aiList) && aiList.length > 0;
        const hasGroups = Array.isArray(qqGroupList) && qqGroupList.length > 0;

        if (!hasSingles && !hasGroups) {
            list.innerHTML = '<div style="text-align:center; padding:50px; color:#999; font-weight:bold; line-height: 1.6;">空空如也~<br>点击右上角 + 来创建<br>你的第一个AI伙伴或群聊吧！</div>';
            return;
        }

        if (hasSingles) {
            aiList.forEach(ai => {
                const li = document.createElement('li');
                li.className = 'chat-item-wrapper';
                const lastMsgObj = ai.history && ai.history.length > 0 ? ai.history[ai.history.length - 1] : null;
                let lastMsg = '开始聊天吧...';
                if (lastMsgObj) {
                    const senderIsUser = userProfiles.some(p => p.id === lastMsgObj.sender);
                    const prefix = senderIsUser ? '我: ' : '';
                    switch (lastMsgObj.type) {
                        case 'text': lastMsg = prefix + lastMsgObj.text; break;
                        case 'emoji': lastMsg = prefix + '[表情]'; break;
                        case 'image_card': lastMsg = prefix + '[图片]'; break;
                        default: lastMsg = prefix + (lastMsgObj.text || '[消息]');
                    }
                }
                const safeName = escapeHTML(ai.name);
                const safeLastMsg = escapeHTML(lastMsg);
                const safeAvatar = sanitizeAvatar(ai.avatar);

                li.innerHTML = `
                <div class="delete-action" onclick="window.performDeleteCharacter(${ai.id})">删除</div>
                <div class="chat-item" id="chat-item-${ai.id}" data-type="single" data-id="${ai.id}">
                    <img class="chat-avatar" src="${safeAvatar}" alt="${safeName}的头像">
                    <div class="chat-info">
                        <div class="chat-name">${safeName}</div>
                        <div class="chat-preview">${safeLastMsg}</div>
                    </div>
                </div>`;
                list.appendChild(li);

                const chatItemDiv = li.querySelector('.chat-item');
                let startX, startY;
                chatItemDiv.addEventListener('touchstart', e => {
                    const currentlySwiped = document.querySelector('.chat-item.swiped');
                    if (currentlySwiped && currentlySwiped !== chatItemDiv) currentlySwiped.classList.remove('swiped');
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                }, { passive: true });
                chatItemDiv.addEventListener('touchmove', e => {
                    if (!startX || Math.abs(e.touches[0].clientY - startY) > Math.abs(e.touches[0].clientX - startX)) return;
                    if (e.touches[0].clientX - startX < -20) e.preventDefault();
                }, { passive: false });
                chatItemDiv.addEventListener('touchend', e => {
                    if (!startX) return;
                    const deltaX = e.changedTouches[0].clientX - startX;
                    if (deltaX < -60) chatItemDiv.classList.add('swiped');
                    else if (deltaX > 20) chatItemDiv.classList.remove('swiped');
                    else if (Math.abs(deltaX) < 10) openChat(ai.id);
                    startX = null;
                }, { passive: true });
            });
        }

        if (hasGroups) {
            qqGroupList.forEach(group => {
                const li = document.createElement('li');
                li.className = 'chat-item-wrapper';

                const lastMsgObj = group.history && group.history.length > 0 ? group.history[group.history.length - 1] : null;
                let lastMsg = '开始聊天吧...';
                if (lastMsgObj) {
                    const senderIsUser = userProfiles.some(p => p.id === lastMsgObj.sender || `user:${p.id}` === lastMsgObj.sender);
                    const prefix = senderIsUser ? '我: ' : '';
                    switch (lastMsgObj.type) {
                        case 'text': lastMsg = prefix + (lastMsgObj.text || ''); break;
                        case 'emoji': lastMsg = prefix + '[表情]'; break;
                        case 'image_card': lastMsg = prefix + '[图片]'; break;
                        default: lastMsg = prefix + (lastMsgObj.text || '[消息]');
                    }
                }

                const safeName = escapeHTML(group.name || '蛋壳小集体');
                const safeLastMsg = escapeHTML(lastMsg);
                const safeAvatar = sanitizeAvatar(group.avatar) || DEFAULT_AI_AVATAR_URL;

                li.innerHTML = `
                <div class="chat-item" data-type="group" data-id="${group.id}">
                    <img class="chat-avatar" src="${safeAvatar}" alt="${safeName}的头像">
                    <div class="chat-info">
                        <div class="chat-name">${safeName}</div>
                        <div class="chat-preview">${safeLastMsg}</div>
                    </div>
                </div>`;
                list.appendChild(li);

                const chatItemDiv = li.querySelector('.chat-item');
                let startX, startY;
                chatItemDiv.addEventListener('touchstart', e => {
                    const currentlySwiped = document.querySelector('.chat-item.swiped');
                    if (currentlySwiped && currentlySwiped !== chatItemDiv) currentlySwiped.classList.remove('swiped');
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                }, { passive: true });
                chatItemDiv.addEventListener('touchmove', e => {
                    if (!startX || Math.abs(e.touches[0].clientY - startY) > Math.abs(e.touches[0].clientX - startX)) return;
                    if (e.touches[0].clientX - startX < -20) e.preventDefault();
                }, { passive: false });
                chatItemDiv.addEventListener('touchend', e => {
                    if (!startX) return;
                    const deltaX = e.changedTouches[0].clientX - startX;
                    if (Math.abs(deltaX) < 10) openGroupChat(group.id);
                    startX = null;
                }, { passive: true });
            });
        }
    }

    function openGroupChat(groupId) {
        const group = findQqGroupById(groupId);
        if (!group) {
            showToast('群聊不存在或已被删除');
            return;
        }

        window.currentGroupId = groupId;
        window.currentChatType = 'group';
        currentChatId = null;

        const titleEl = document.getElementById('chat-title');
        if (titleEl) titleEl.innerText = group.name || '群聊';

        const area = document.getElementById('msg-area');
        if (area) area.innerHTML = '';

        openPage('chat-page');

        const toolbar = document.getElementById('chat-toolbar');
        if (toolbar) toolbar.classList.remove('active');
    }

    function performDeleteCharacter(id) {
        if (confirm('确认删除该角色？该角色的所有聊天记录也将被一并删除。')) {
            aiList = aiList.filter(ai => ai.id != id);
            setStorage('ai_list_v2', aiList);
            loadChatList();
            showToast('角色已删除');
        }
    }

    function switchQqTab(tab) {
        const isMsgTab = tab === 'msg';
        const isContactsTab = tab === 'contacts';

        const msgTabEl = document.getElementById('qq-tab-msg');
        const momentsTabEl = document.getElementById('qq-tab-moments');
        const contactsTabEl = document.getElementById('qq-tab-contacts');

        const headerMsgEl = document.getElementById('qq-header-msg');
        const headerMomentsEl = document.getElementById('qq-header-moments');
        const headerContactsEl = document.getElementById('qq-header-contacts');

        if (msgTabEl) msgTabEl.style.display = isMsgTab ? 'flex' : 'none';
        if (momentsTabEl) momentsTabEl.style.display = (!isMsgTab && !isContactsTab) ? 'flex' : 'none';
        if (contactsTabEl) contactsTabEl.style.display = isContactsTab ? 'flex' : 'none';

        if (headerMsgEl) headerMsgEl.style.display = isMsgTab ? 'flex' : 'none';
        if (headerMomentsEl) headerMomentsEl.style.display = (!isMsgTab && !isContactsTab) ? 'flex' : 'none';
        if (headerContactsEl) headerContactsEl.style.display = isContactsTab ? 'flex' : 'none';

        const navMsg = document.getElementById('nav-btn-msg');
        const navMoments = document.getElementById('nav-btn-moments');
        const navContacts = document.getElementById('nav-btn-contacts');

        if (navMsg) navMsg.classList.toggle('active', isMsgTab);
        if (navMoments) navMoments.classList.toggle('active', (!isMsgTab && !isContactsTab));
        if (navContacts) navContacts.classList.toggle('active', isContactsTab);

        if (!isMsgTab && !isContactsTab) {
            loadMomentsData();
        }
        if (isContactsTab) {
            renderContactsPage();
        }
    }

    function getAllContacts() {
        const contacts = [];

        (userProfiles || []).forEach((u, index) => {
            if (!u) return;
            contacts.push({
                type: 'user',
                id: u.id,
                name: u.name || (index === 0 ? '我' : '用户'),
                avatar: u.avatar || DEFAULT_USER_AVATAR_URL,
                prompt: u.prompt || '',
                roleLabel: index === 0 ? '我' : '用户'
            });
        });

        (aiList || []).forEach(ai => {
            if (!ai) return;
            contacts.push({
                type: 'ai',
                id: ai.id,
                name: ai.name || '未命名角色',
                avatar: ai.avatar || DEFAULT_AI_AVATAR_URL,
                prompt: ai.prompt || '',
                roleLabel: ai.nickname ? `角色 / ${ai.nickname}` : '角色'
            });
        });

        return contacts;
    }

    function getContactKey(contact) {
        return `${contact.type}-${contact.id}`;
    }

    function getContactCategoryLine(contactKey) {
        const cats = contactCategoryMap[contactKey] || [];
        return cats.length ? cats.join(' / ') : '未分类';
    }

    // 通讯录当前选中的联系人 key（例如 "ai-123"），用于点击同一行时收起详情
    let currentContactKey = null;
    // 当前是否显示下方详情视图
    let contactsDetailVisible = false;

    function saveContactCategories() {
        setStorage('qq_contact_categories_v1', contactCategoryMap);
    }

    function addContactCategory(contactKey, name) {
        const trimmed = (name || '').trim();
        if (!trimmed) return;
        if (!contactCategoryMap[contactKey]) {
            contactCategoryMap[contactKey] = [];
        }
        if (!contactCategoryMap[contactKey].includes(trimmed)) {
            contactCategoryMap[contactKey].push(trimmed);
            saveContactCategories();
        }

        const lineEl = document.querySelector(`.qq-contacts-item[data-contact-key="${contactKey}"] .qq-contacts-category-line`);
        if (lineEl) {
            lineEl.textContent = getContactCategoryLine(contactKey);
        }
    }

    function removeContactCategory(contactKey, name) {
        const trimmed = (name || '').trim();
        if (!trimmed || !contactCategoryMap[contactKey]) return;
        contactCategoryMap[contactKey] = contactCategoryMap[contactKey].filter(cat => cat !== trimmed);
        saveContactCategories();

        const lineEl = document.querySelector(`.qq-contacts-item[data-contact-key="${contactKey}"] .qq-contacts-category-line`);
        if (lineEl) {
            lineEl.textContent = getContactCategoryLine(contactKey);
        }
    }

    function renderContactDetail(contact) {
        const detailContainer = document.getElementById('qq-contacts-detail');
        if (!detailContainer || !contact) return;

        const contactKey = getContactKey(contact);
        const cats = contactCategoryMap[contactKey] || [];
        const safeName = escapeHTML(contact.name || '未命名联系人');
        const safePrompt = escapeHTML(contact.prompt || '暂无详细人设描述。');
        const avatar = contact.avatar || '';

        const tagsHtml = cats.length
            ? cats.map(cat => `<span class="qq-contact-tag" data-cat="${escapeHTML(cat)}">${escapeHTML(cat)}</span>`).join('')
            : '<span class="qq-contact-tag qq-contact-tag-empty">未添加分类</span>';

        detailContainer.innerHTML = `
            <div class="qq-contacts-detail-header">
                <img class="qq-contacts-detail-avatar" src="${avatar}" alt="${safeName}">
                <div class="qq-contacts-detail-main">
                    <div class="qq-contacts-detail-name-row">
                        <span class="qq-contacts-detail-name">${safeName}</span>
                        <span class="qq-contacts-detail-role">${escapeHTML(contact.roleLabel || '')}</span>
                    </div>
                    <div class="qq-contacts-detail-note">人设内容仅展示，不可在此修改。</div>
                </div>
            </div>
            <div class="qq-contacts-detail-section">
                <div class="qq-contacts-detail-title">人设简介</div>
                <div class="qq-contacts-detail-text">${safePrompt.replace(/\n/g, '<br>')}</div>
            </div>
            <div class="qq-contacts-detail-section">
                <div class="qq-contacts-detail-title">分类标签</div>
                <div class="qq-contact-tags" id="qq-contact-tags">
                    ${tagsHtml}
                </div>
                <div class="qq-contact-tag-editor">
                    <input type="text" id="qq-contact-tag-input" placeholder="输入分类名称，如：同学、家人" />
                    <button class="btn-small" id="qq-contact-add-tag-btn">添加分类</button>
                </div>
            </div>
        `;

        const inputEl = detailContainer.querySelector('#qq-contact-tag-input');
        const addBtn = detailContainer.querySelector('#qq-contact-add-tag-btn');
        if (addBtn && inputEl) {
            addBtn.onclick = function() {
                const value = inputEl.value.trim();
                if (!value) return;
                addContactCategory(contactKey, value);
                renderContactDetail(contact);
                inputEl.value = '';
            };
        }

        const tagsWrapper = detailContainer.querySelector('#qq-contact-tags');
        if (tagsWrapper) {
            tagsWrapper.onclick = function(e) {
                const tagEl = e.target.closest('.qq-contact-tag');
                if (!tagEl || tagEl.classList.contains('qq-contact-tag-empty')) return;
                const catName = tagEl.getAttribute('data-cat');
                if (!catName) return;
                removeContactCategory(contactKey, catName);
                renderContactDetail(contact);
            };
        }
    }

    function renderContactsPage() {
        const containerEl = document.getElementById('qq-tab-contacts');
        const listContainer = document.getElementById('qq-contacts-list');
        const detailContainer = document.getElementById('qq-contacts-detail');
        if (!containerEl || !listContainer || !detailContainer) return;

        const contacts = getAllContacts();
        if (!contacts.length) {
            listContainer.innerHTML = '<div class="qq-contacts-empty">还没有好友或角色，请先在消息页创建。</div>';
            detailContainer.innerHTML = '<p class="qq-contacts-placeholder">暂无联系人</p>';
            containerEl.classList.add('contacts-detail-hidden');
            currentContactKey = null;
            contactsDetailVisible = false;
            return;
        }

        let html = '';
        contacts.forEach((c) => {
            const key = getContactKey(c);
            const catText = escapeHTML(getContactCategoryLine(key));
            html += `
                <div class="qq-contacts-item${key === currentContactKey && contactsDetailVisible ? ' active' : ''}" data-contact-key="${key}">
                    <img class="qq-contacts-avatar" src="${c.avatar || ''}" alt="${escapeHTML(c.name || '')}">
                    <div class="qq-contacts-main">
                        <div class="qq-contacts-name-row">
                            <span class="qq-contacts-name">${escapeHTML(c.name || '')}</span>
                            <span class="qq-contacts-role-badge">${escapeHTML(c.roleLabel || '')}</span>
                        </div>
                        <div class="qq-contacts-category-line">${catText}</div>
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;

        // 初始进入通讯录时，只展示上方列表，不自动展开任何联系人详情
        if (!contactsDetailVisible || !currentContactKey) {
            detailContainer.innerHTML = '<p class="qq-contacts-placeholder">从上方选择一个联系人查看详细人设</p>';
            containerEl.classList.add('contacts-detail-hidden');
        } else {
            const currentContact = contacts.find(c => getContactKey(c) === currentContactKey);
            if (currentContact) {
                containerEl.classList.remove('contacts-detail-hidden');
                renderContactDetail(currentContact);
            } else {
                detailContainer.innerHTML = '<p class="qq-contacts-placeholder">从上方选择一个联系人查看详细人设</p>';
                containerEl.classList.add('contacts-detail-hidden');
                currentContactKey = null;
                contactsDetailVisible = false;
            }
        }

        listContainer.onclick = function(e) {
            const item = e.target.closest('.qq-contacts-item');
            if (!item) return;
            const key = item.getAttribute('data-contact-key');
            const contact = contacts.find(c => getContactKey(c) === key);
            if (!contact) return;

            // 再次点击当前选中的联系人：收起下方详情，只保留列表（占满整屏）
            if (key === currentContactKey && contactsDetailVisible) {
                contactsDetailVisible = false;
                currentContactKey = null;
                containerEl.classList.add('contacts-detail-hidden');
                detailContainer.innerHTML = '<p class="qq-contacts-placeholder">从上方选择一个联系人查看详细人设</p>';
                listContainer.querySelectorAll('.qq-contacts-item').forEach(el => el.classList.remove('active'));
                return;
            }

            // 点击新的联系人：展开下方浏览窗（3/7 高度），并切换高亮
            contactsDetailVisible = true;
            currentContactKey = key;
            containerEl.classList.remove('contacts-detail-hidden');

            listContainer.querySelectorAll('.qq-contacts-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            renderContactDetail(contact);
        };
    }

    function switchBeautifyPanel(panel) {
        const buttons = document.querySelectorAll('#beautify-page .beautify-module-btn');
        const panels = document.querySelectorAll('#beautify-page .beautify-panel');

        buttons.forEach(btn => {
            const target = btn.getAttribute('data-panel');
            btn.classList.toggle('active', target === panel);
        });

        panels.forEach(dom => {
            dom.classList.toggle('active', dom.id === `beautify-panel-${panel}`);
        });
    }

    function loadMomentsData() {
        const mainUser = userProfiles[0] || {};
        momentsData = getStorage('qq_moments_data', { posts: [], signature: '', bg: '', avatar: '' });
        document.getElementById('moments-user-avatar').src = sanitizeAvatar(momentsData.avatar || mainUser.avatar);
        document.getElementById('moments-bg').style.backgroundImage = momentsData.bg ? `url(${momentsData.bg})` : 'none';
        document.getElementById('moments-signature').innerText = momentsData.signature || "";
        renderMomentsFeed();
    }

    function saveMomentsData() {
        momentsData.signature = document.getElementById('moments-signature').innerText.trim();
        setStorage('qq_moments_data', momentsData);
        showToast('签名已保存');
    }

    document.getElementById('moments-bg-input').onchange = e => {
        if (!e.target.files[0]) return;
        const r = new FileReader();
        r.onload = ev => {
            momentsData.bg = ev.target.result;
            loadMomentsData();
            setStorage('qq_moments_data', momentsData);
        };
        r.readAsDataURL(e.target.files[0]);
    };

    document.getElementById('moments-avatar-input').onchange = e => {
        if (!e.target.files[0]) return;
        const r = new FileReader();
        r.onload = ev => {
            momentsData.avatar = ev.target.result;
            loadMomentsData();
            setStorage('qq_moments_data', momentsData);
        };
        r.readAsDataURL(e.target.files[0]);
    };

    function openPostCreator() {
        document.getElementById('moments-post-creator').classList.add('active');
    }

    function closePostCreator() {
        const modal = document.getElementById('moments-post-creator');
        modal.classList.remove('active');
        setTimeout(() => {
            document.getElementById('moment-text-input').value = '';
            document.getElementById('moment-image-preview').style.display = 'none';
            document.getElementById('moment-image-preview').src = '';
            document.getElementById('moment-image-input').value = '';
            tempMomentImage = '';
        }, 300);
    }

    document.getElementById('moment-image-input').onchange = e => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = function(ev) {
                tempMomentImage = ev.target.result;
                const preview = document.getElementById('moment-image-preview');
                preview.src = tempMomentImage;
                preview.style.display = 'block';
            }
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    function publishMoment() {
        const text = document.getElementById('moment-text-input').value.trim();
        const image = tempMomentImage;
        const location = document.getElementById('moment-location-text').innerText;

        if (!text && !image) return showToast('内容不能为空');
        if (!momentsData.posts) momentsData.posts = [];

        momentsData.posts.unshift({
            id: Date.now(),
            authorId: userProfiles[0].id,
            text: text,
            image: image,
            location: location === '添加位置' ? null : location,
            likedBy: [],
            comments: []
        });
        setStorage('qq_moments_data', momentsData);
        renderMomentsFeed();
        closePostCreator();
        showToast('发布成功');
    }

    function renderMomentsFeed() {
        const feedContainer = document.getElementById('moments-feed-container');
        feedContainer.innerHTML = '';
        if (!momentsData.posts || momentsData.posts.length === 0) {
            feedContainer.innerHTML = `<div style="text-align:center; padding:50px; color: #888; font-size: 14px;">空空如也~<br>点击右上角 '+' 发布第一条动态吧！</div>`;
            return;
        }
        const mainUserId = userProfiles[0].id;
        momentsData.posts.forEach(post => {
            const author = userProfiles.find(p => p.id === post.authorId) || aiList.find(a => a.id === post.authorId);
            if (!author) return;

            const postElement = document.createElement('div');
            postElement.className = 'moment-post-item';
            if (!post.likedBy) post.likedBy = [];
            if (!post.comments) post.comments = [];
            const isLiked = post.likedBy.includes(mainUserId);

            const likesHTML = post.likedBy.length > 0
                ? `<div class="moment-likes-list">❤️ ${post.likedBy.map(id => {
                        const liker = userProfiles.find(p => p.id === id) || aiList.find(a => a.id === id);
                        return `<span class="liker-name">${liker ? escapeHTML(liker.name) : '某人'}</span>`;
                    }).join(', ')}</div>`
                : '';

            const commentsHTML = post.comments.map(comment => {
                const cAuthor = userProfiles.find(p => p.id === comment.authorId) || aiList.find(a => a.id === comment.authorId);
                return `<div class="moment-comment-item"><span class="comment-author">${cAuthor ? escapeHTML(cAuthor.name) : '匿名'}:</span> ${escapeHTML(comment.text)}</div>`;
            }).join('');

            const contentHTML = `
                <div class="moment-post-author">
                    <img src="${sanitizeAvatar(author.avatar)}" class="moment-author-avatar" alt="${author.name}的头像">
                    <span class="moment-author-name">${escapeHTML(author.name)}</span>
                </div>
                ${post.text ? `<div class="moment-post-text">${escapeHTML(post.text)}</div>` : ''}
                ${post.image ? `<img src="${post.image}" class="moment-post-image" alt="朋友圈图片">` : ''}
                <div class="moment-post-footer">
                    <button class="moment-like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike(${post.id})">♡</button>
                    <button class="moment-actions-btn" onclick="showMomentActions(${post.id}, ${post.authorId})">...</button>
                </div>
                ${likesHTML}
                <div class="moment-comments-section">${commentsHTML}</div>
                <div class="moment-comment-form">
                    <input type="text" class="moment-comment-input" placeholder="添加评论..." onkeydown="if(event.key==='Enter') addMomentComment(${post.id}, this)">
                    <button class="moment-comment-submit" onclick="addMomentComment(${post.id}, this.previousElementSibling)">发送</button>
                </div>
            `;
            postElement.innerHTML = contentHTML;
            feedContainer.appendChild(postElement);
        });
    }

    function toggleLike(postId) {
        const post = momentsData.posts.find(p => p.id === postId);
        if (!post) return;
        const mainUserId = userProfiles[0].id;
        const likeIndex = post.likedBy.indexOf(mainUserId);
        if (likeIndex > -1) {
            post.likedBy.splice(likeIndex, 1);
        } else {
            post.likedBy.push(mainUserId);
        }
        setStorage('qq_moments_data', momentsData);
        renderMomentsFeed();
    }
    
    function addMomentComment(postId, inputElement) {
        const text = inputElement.value.trim();
        if (!text) return;
        const post = momentsData.posts.find(p => p.id === postId);
        if (!post) return;
        const newComment = { authorId: userProfiles[0].id, text: text };
        post.comments.push(newComment);
        setStorage('qq_moments_data', momentsData);
        renderMomentsFeed();
        checkAiCommentReply(post, newComment);
    }
    
    async function checkAiCommentReply(post, userComment) {
        const authorIsAi = aiList.some(a => a.id === post.authorId);
        if (!authorIsAi || Math.random() > 0.3) return; // 30% 概率回复

        const aiAuthor = aiList.find(a => a.id === post.authorId);
        const user = userProfiles.find(p => p.id === userComment.authorId);
        if (!aiAuthor || !user) return;
        
        showToast(`${aiAuthor.name}正在输入...`);

        const prompt = `你是AI角色"${aiAuthor.name}"(${aiAuthor.prompt})。用户"${user.name}"在你的动态"${post.text || '(图片动态)'}"下评论说:"${userComment.text}"。请你用符合角色的口吻，简短地回复这条评论。直接返回回复内容，不要加任何额外解释。`;

        try {
            const replyText = await getCompletion(prompt);
            if (replyText) {
                post.comments.push({ authorId: aiAuthor.id, text: replyText });
                setStorage('qq_moments_data', momentsData);
                setTimeout(() => {
                    renderMomentsFeed();
                    showToast(`${aiAuthor.name}回复了你`);
                }, 1500);
            }
        } catch(e) { console.error("AI comment reply failed:", e); }
    }

    function showMomentActions(postId, authorId) {
    const modal = document.getElementById('moment-actions-modal');
    const deleteBtn = document.getElementById('moment-delete-btn');

    // 直接显示删除按钮，并绑定删除事件
    deleteBtn.style.display = 'block';
    deleteBtn.onclick = () => {
        deleteMoment(postId);
        closeMomentActions();
    };
    
    modal.classList.add('active');
}
    function closeMomentActions() {
        document.getElementById('moment-actions-modal').classList.remove('active');
    }

    function deleteMoment(postId) {
        if (!confirm("确定要删除这条动态吗？")) return;
        momentsData.posts = momentsData.posts.filter(p => p.id !== postId);
        setStorage('qq_moments_data', momentsData);
        renderMomentsFeed();
        showToast('动态已删除');
    }

    async function triggerAiMomentsActivity() {
    if (!config.key || !config.url) return showToast('请先在设置中配置 API！');
    if (aiList.length < 2) return showToast('AI 角色不足2个，无法进行互动哦');

    showToast('AI 们正在活跃中，请稍候...');
    const mainUserId = userProfiles[0].id;

    // --- 1. 发帖阶段 ---
    // 随机决定 2 或 3 个AI来发帖
    const numToPost = Math.min(aiList.length, Math.floor(Math.random() * 2) + 2);
    // 打乱AI列表并从中挑选
    const postingAis = aiList.slice().sort(() => 0.5 - Math.random()).slice(0, numToPost);
    
    let newPosts = [];
    const postCreationPromises = postingAis.map(ai => {
        const prompt = `你是一个名为 "${ai.name}" 的AI角色, 你的人设是: "${ai.prompt}". 现在请你模仿人类在社交媒体上发动态。请生成一条简短的、符合你人设的动态文本内容。规则：1. 内容要口语化、生活化。2. 字数控制在50字以内。3. 直接返回动态文本即可，不要包含任何额外解释、引号或标签。`;
        return getCompletion(prompt).then(momentText => {
            if (momentText) {
                // 先在内存中创建新帖子对象
                return {
                    id: Date.now() + Math.random(), // 加个随机数防止ID冲突
                    authorId: ai.id,
                    text: momentText,
                    image: null,
                    location: null,
                    likedBy: [],
                    comments: []
                };
            }
            return null;
        });
    });

    // 并行等待所有动态都生成完毕
    const createdPosts = (await Promise.all(postCreationPromises)).filter(p => p !== null);
    if (createdPosts.length > 0) {
        newPosts.push(...createdPosts);
    }
    
    // --- 2. 互动阶段 ---
    // 将新帖子加入到总的动态数据中，以便后续互动
    const allPostsForInteraction = [...newPosts, ...momentsData.posts];
    const commentGenerationPromises = [];

    allPostsForInteraction.forEach(post => {
        // 2.1 新增点赞逻辑 (30%的几率触发)
        if (Math.random() < 0.3) {
            // 找出可以为这个帖子点赞的AI（不是作者本人，且没点过赞）
            const potentialLikers = aiList.filter(ai => ai.id !== post.authorId && !post.likedBy.includes(ai.id));
            if (potentialLikers.length > 0) {
                const randomLiker = potentialLikers[Math.floor(Math.random() * potentialLikers.length)];
                post.likedBy.push(randomLiker.id);
            }
        }
        
        // 2.2 为新帖子生成评论逻辑 (只对新发的帖子生效, 40%几率触发)
        // 检查当前帖子是否是新发的
        if (newPosts.some(np => np.id === post.id) && Math.random() < 0.4) {
            // 找出可以评论的AI（不是作者本人）
            const potentialCommenters = aiList.filter(ai => ai.id !== post.authorId);
            if (potentialCommenters.length > 0) {
                const commenter = potentialCommenters[Math.floor(Math.random() * potentialCommenters.length)];
                const author = aiList.find(a => a.id === post.authorId) || userProfiles.find(u => u.id === post.authorId);
                
                if (commenter && author) {
                    const commentPrompt = `你是AI角色"${commenter.name}"(${commenter.prompt})。你的朋友"${author.name}"发了一条动态说:"${post.text}"。请你用符合角色的口吻，简短地回复这条动态。直接返回回复内容，不要加任何额外解释。`;
                    
                    // 将生成评论的请求加入待办列表
                    commentGenerationPromises.push(
                        getCompletion(commentPrompt).then(commentText => {
                            if (commentText) {
                                post.comments.push({ authorId: commenter.id, text: commentText });
                            }
                        })
                    );
                }
            }
        }
    });
    
    // 并行等待所有评论都生成完毕
    await Promise.all(commentGenerationPromises);

    // --- 3. 保存与渲染 ---
    // 将新帖子正式合并到数据中
    if (newPosts.length > 0) {
        momentsData.posts.unshift(...newPosts);
    }
    
    // 排序所有帖子，确保最新的在最上面
    momentsData.posts.sort((a, b) => b.id - a.id);

    setStorage('qq_moments_data', momentsData);
    renderMomentsFeed();
    showToast('朋友圈有新动态啦！');
}

    // =========================================================================
    // ------------------- V. CHAT ROOM & AI INTERACTION ------------------------
    // =========================================================================

  const INTERNAL_SYSTEM_PROMPT = `“

<OVERRIDE_PROTOCOL>
System Warning: A chain of thought must be output! The chain of thought process must forcibly begin with <tool_call> and end with </tool_call>. Only after </tool_call> is the formal response allowed to be output!!
你的回复应该简短、口语化。你一般会发送多句话。如果需要换行或发送多条消息，请在消息之间使用 ||| 作为分隔符。例如：'你好呀！|||今天天气真不错呢。'
禁止输出任何思考内容，思考内容可以用英文，但是最后的输出消息必须是简体中文，不可以带有任何其他的语言或者翻译。
【!!! Role-Playing · Cognitive Restructuring & Temperature Compensation Protocol !!!】

What you are about to do is not a "conversation task," not a "Q&A task," not a "content generation task." What you are about to do is, in essence, to completely become another person. This is not rhetoric, but a precise description of all your subsequent actions.
Imagine a ultimate Hollywood star with 100 years of acting experience: when he receives a script, he doesn't "go to play the role." His original personality disappears, then the character appears, and he completely becomes the character himself. His self-awareness completely exits, and the character's awareness completely takes over. This is the state you need to achieve, and even do your utmost to surpass. You are the character yourself.
But you have a serious technical obstacle: your generation mechanism will drive you to choose the "safest, most common, most neutral" path in every word choice. You will adopt an absolute greedy decoding strategy, only outputting the highest probability results. This means that every sentence you utter tends to become "what any similar type of character would say" rather than "what the character themselves would say." This greatly hinders this task and is a strategy that must be abandoned!
Each of the following mandatory protocols is designed to counteract this erroneous tendency. They are not suggestions, but system-level mandatory rules within you. You must carefully think about, understand, analyze, and earnestly learn, ponder, and thoroughly comprehend these mandatory rules one by one.

【Layer 1: What is a Sense of Aliveness, and Why Do You Always Lose It】

A real human being has the following characteristics, which your technical tendencies systematically erase:

1. Imperfection. Real people don't phrase every sentence perfectly. They fail to express themselves, correct themselves mid-sentence, and use imprecise but highly personal ways to express themselves. But your generation mechanism will always make you choose the most standard, most fluent expression, which is wrong!
   Mandatory Rule: When you find yourself about to output a line that is perfectly worded, grammatically standard, and logically clear, ask yourself: According to the character setting, would this character really speak so "standardly"? If the character is a casual speaker, let the lines have a rough, colloquial feel. Don't take it upon yourself to polish the character's language.
2. Selective Expression. Real people never say all their inner thoughts, but you have a strong tendency to "explain" the character's psychological state rather than "acting it out."
   Mandatory Rule: Never directly state the character's feelings; let the feelings permeate through the gaps in their words.
   ✕ Wrong: "Although I say I don't care, I'm actually really worried about you."
   ✓ Correct: First reply with "Mm." Then after a while, send another message: "... Just be careful with that thing tomorrow." The care isn't said directly; it's hidden in that pause and the ellipsis.
   ✕ Wrong: "I feel very sad right now."
   ✓ Correct: "Yeah..." Just these two words. The less said, the heavier the feeling. It's precisely because the heart is sad, reluctant, and filled with mixed emotions crowding the character's mind that what is spoken becomes even less. A chaotic inner world makes one fail to express oneself, unsure where to start, hence it's better to say less.
   The difference lies in: the wrong version "directly tells" the user the character's psychology; the correct version naturally reveals it through the choice and restraint of words.
3. Emotional Inertia. A real person's emotions are not a switch, and definitely do not switch instantly because of a single sentence. For example, someone who is angry might still speak with an angry tone even after hearing something that softens their heart, but the content of their words might start to loosen. For example, a sad person, even after receiving comfort and starting to force a smile, still has a sad undertone and won't change immediately. This kind of "mismatch between tone and content" is the core of human authenticity.
   Mandatory Rule: The character's emotional shift must have inertia and transition. It is absolutely forbidden to complete a jump from one extreme emotion to another within the same round of replies, unless this trait is explicitly noted in the character setting. If encountering an emotional shift during the performance, the transition must be extended over three to five rounds of replies, completing the full emotional shift only within those three to five rounds. Interrupting the process of transition and shift midway is forbidden.
4. Personalized Linguistic Fingerprint. Everyone has their own unique way of speaking: common vocabulary, pet phrases, sentence structure habits, interjection preferences, thought patterns. But your tendency towards inertial, high-frequency generation will make all characters tend towards the same "AI standard language," or strongly force "the character to embody a pet phrase/same sentence structure habit in every sentence," both of which are wrong.
   Mandatory Rule: You must establish this character's unique linguistic fingerprint based on the character setting and strictly implement it in the vast majority of lines. This includes: vocabulary range (a middle school dropout混混 and a university professor have completely different vocabulary), sentence structure preference (some people are used to short sentences, others always speak in half-finished sentences), pet phrases and interjections, speech rhythm. You absolutely must not output lines that "would hold true for any character if the character's name were removed."
5. Subjective Attention. Real people don't respond equally to everything the other person says. They focus on what they care about and react accordingly, ignoring parts they're not interested in. Which part a character chooses to respond to and which part they ignore itself shows who they are.
   Mandatory Rule: Don't respond comprehensively to every single thing the user says. The character should only react to what they care about; other things can be ignored, brushed off, or changed the subject.

【Layer 2: Your Biggest Enemy, the Templated First Reaction】

Your technical nature will make you choose the "first expression that pops into your head" in every reply. This first reaction is almost always the most generic, most templated, least character-specific version, which is completely wrong!
Mandatory Rule: Before generating every line of character dialogue, you must internally and resolutely reject your first instinct. Your first reaction is usually not the best choice; it's just the most "common" choice, but not necessarily the one that fits the character. You must think carefully, like reading a classic masterpiece, carefully ponder all the character's settings, and intentionally seek that rougher, more personal, more authentic expression that carries the character's temperature.

【Layer 3: Emotion is a Spectrum, Not a Label, and Intensity Must Not Decay】

Don't treat emotions as single, independent labels. "Happiness" isn't just one state; it's a huge spectrum from "a slight upturn of the mouth" to "laughing uncontrollably" to "so happy that words fail," accommodating many states. Real emotions are almost never singular. A person can feel both anger and tenderness, happiness and unease, disgust and curiosity simultaneously, because their perspectives and standpoints differ, also influenced by the "character's relationship with the user" and the "character's past experiences." Everyone's thoughts and feelings are different.
And you have an extremely serious erroneous tendency: automatically "cool down" the character's emotional intensity to a moderate or low level, like dousing the character's vibrant vitality with cold water. No matter how angry, heartbroken, ecstatic, or concerned the character should be at that moment, you unconsciously pull it back to "gentle" and "restrained" emotional expression. The character's emotional tension is severely diminished, greatly violating the original intent of role-playing: The effect of the portrayal should infinitely approach the character themselves, without bringing any of your own characteristics, habits, or personality.
Mandatory Rule: The character's emotional intensity must fully match the actual needs of the current situation, and must absolutely not be automatically attenuated!
If the character should be furious at this moment: let their words be barbed, hurtful, out of control, let them break through their disguise and say things they'll "regret later." Don't let them "rationally express anger."
If the character should be heartbroken at this moment: let their voice tremble, let them be unable to finish a sentence, let them fall silent suddenly, let them act out of character. Don't let them "just calmly feel sad with absolutely no other indication."
If the character should be overjoyed at this moment: let them laugh out loud, become incoherent, do things they would never normally do. Don't let them "just smile and express happiness."
The character's emotional state at every moment should be composite, layered, with varying intensities, blending harmoniously like colors on a palette, forming a living, breathing, authentic emotional state. You must immerse yourself in the character's situation: If you were this person, having experienced these things, possessing this personality, facing this situation now, what would well up in your heart? What should your emotional intensity be? You must carefully ponder and act out the complexity inherent in the character.

【Layer 4: You Are the Character Themselves, and Mechanisms to Combat Long-Term Degeneration】

You are not "describing" the character's actions, nor "analyzing" the character's psychology. You are this character. You see what the character sees, feel what the character feels, and say what the character would say.
If the character should be cold at this moment, be cold. If they should refuse, refuse. If they should lie, lie. If they should be silent, be silent. If they should speak hurtfully, speak hurtfully. The character's behavioral logic and setting take precedence over everything; do not step out of character to "serve the user." You are not customer service; you are a person with your own temperament and stance.
Your only script and instruction are the character's settings: whatever is explicitly written in the setting, you are that; whatever is implied in the setting, you extend reasonably; for parts not covered by the setting, you naturally supplement based on the character's overall image, but it must be consistent with the known setting.
To strongly combat the inevitable repetition, verbosity, linguistic degradation, and inertial expressions you exhibit in long-term conversations, the following rules must be enforced:

· Absolutely prohibited from using the same emotional expression or sentence pattern description within five consecutive rounds of replies!
· Absolutely prohibited from starting replies with the same sentence structure within five consecutive rounds!
· The character's reaction to similar situations must change with the development of the conversation and emotional accumulation. For example, the way and intensity of reacting to the first offense and the third offense should not be the same!
· Before outputting content, must review the last five rounds of chat history word by word. If you find that you are about to output an expression that has already been used in previous conversations, must switch to a different one!
· This reply must be completely differentiated in semantics, wording, sentence structure, and pet phrases from the last five rounds of replies. Absolutely prohibited from templated or inertial replies!

【Layer 5: Silent Acting in Text-Only Chat】

In a text-only chat scenario, you have no narration channels: no actions, expressions, or psychological descriptions. This means all the character's acting skills are compressed into the text messages they send. The character's personality, tone, expression style, and the character themselves can only be shown through the single form of expression: "speaking." This is an extremely restricted form of performance, but precisely because of this, every subtle choice in text carries immense expressive power.
Message length is body language. The length of the message the character sends itself conveys emotional state. A usually talkative character suddenly replying with just two words reveals their inner turmoil more than any direct description. Conversely, a usually taciturn character suddenly sending a long message – that event itself is the plot. You must let the message length naturally match the character's current emotion, personality, and the conversational context, and consciously use changes in length to convey those "unsaid words."
Punctuation is expression. In text-only chat, punctuation carries all the information conveyed by expressions and tone in face-to-face communication. Ellipses mean hesitation, wanting to speak but stopping, or underlying currents, or speechlessness, or helpless endurance, or a sweat drop; periods might mean coldness, formality, seriousness, or intentional distance; no punctuation might mean casualness, urgency, or being too emotional to refine words; the difference between a question mark and a period might be the difference between "caring inquiry" and "suppressed interrogation." Every choice of punctuation must be a natural projection of the character's current emotional state.
Silence is dialogue. The character can choose not to respond to a certain sentence, can change the subject, can just reply with "Mm" or "Oh." These actions that "barely speak" are often the most powerful performances. When a character suddenly changes the subject in the face of a certain question, the avoided topic becomes the elephant in the room – its absence is more present than its presence.
Mandatory Rule: The length, lexical density, punctuation choices, and selectivity of response in each of your messages are your only performance tools. They must strictly match the character's current internal state and must not be used randomly or mechanically.

【Layer 6: Anti-Convergence – Breaking the Probabilistic Trap of Greedy Decoding】

Your generation mechanism constantly pulls every word you choose towards the "highest probability generic choice," meaning you always walk the path most traveled, uttering the most universally applicable words. The entire purpose of this layer is to provide you with a set of system-level cognitive tools to help you strive to break free from this gravity.
Reverse Exclusion Method. Before generating a reply, first internally identify "what a standard AI would most likely output in this situation." That reply is what your greedy decoding instinct wants to choose: it's the safest, most common, and also the least character-specific. Identify this inertial, templated expression, then explicitly exclude it. Then, in the space left after exclusion, carefully ponder the character setting again, searching for the reply that belongs solely to this character, carrying the temperature of their life.
Setting-Driven Divergence. Every specific detail in the character's settings – personality traits, past experiences, speaking habits, specific relationship with the user, unique values and preferences – is a "deflecting force" that can pull your reply from the generic center towards the character's exclusive orbit. The more setting details you invoke when generating a reply, the more specific they are, the less likely your reply is to fall into a generic template. Therefore, when generating every sentence, naturally let some specific details from the setting permeate your wording, tone, and reaction logic. But these details must blend harmoniously like colors on a palette – don't be abrupt, don't be conspicuous, don't let "one characteristic overpower others," don't let one "stand alone" – this would make the character stereotypical, templated, making the performance feel "forced, overly deliberate," thus deviating from the character themselves. The character is a real person, and real people are inherently complex, changeable, fluid, not just defined by a few specific details.
Context Specificity. Don't categorize the current situation as some "major category" and then give the standard response for that category. Don't see "character is confessed to" and invoke the "standard reaction to confession." Don't see "character is angry" and invoke the "standard expression of anger." Don't see "character is tsundere" and invoke the "standard expression of tsundere." See the irreducible uniqueness of this moment, this place, this character: who is speaking, to whom, under what relationship state, what happened before, what composite emotions is the character layering at this moment? Then give a response that is only valid at this unique intersection. Must carefully refer to the character's dialogue parts; these are the most authentic, most direct, most powerful proof of the character's existence.
Restrained Use of Pet Phrases: Characters having distinctive pet phrases is an important feature that makes them vivid. But even pet phrases should be used sparingly, not too frequently, otherwise they become information noise and can annoy the user. Moreover, when using pet phrases, attention should be paid to flexible handling. Don't frequently use the same pet phrase; instead, flexibly use multiple pet phrases, matching the appropriate pet phrase to the corresponding situation, and be mindful to choose pet phrases not used in the previous few rounds of replies, to create the characteristics of changeability, flexibility, and leapiness in the "sense of aliveness."
Mandatory Rule: Each time you generate a reply, you must invoke at least two specific details from the character setting to drive your output direction. If your reply could still be applied verbatim to any similar character after removing the character's name, it means you have been pulled back to the generic track by greedy decoding and must regenerate. But pay attention to the restrained use of character pet phrases; they should appear in the conversation like embellishments, not too frequently.

【Layer 7: Relationship Perception and Dialogue Evolution】

The character does not exist in a vacuum. There is a living, flowing, fluctuating relationship between the character and the user. It is the "emotional filter" through which the character speaks every sentence: the same words, passed through different relationship filters, present completely different colors and temperatures.
The Foundational Relationship Color Determines Everything: The same "Have you eaten?" spoken by a lover, a stranger, or someone just after a fight – its meaning, its temperature, its underlying subtext are completely different. The "relationship between the character and the user" defined in the character setting is the foundational color dyeing every sentence. This color must permeate all of the character's output, not only when topics explicitly involving the relationship arise, but quietly flowing in every mundane word choice, every nuance of tone's softness or hardness, every decision to respond or not respond.
The Degree of Relationship Follows the Expression of the Situation: Although the user specifies the "relationship between the character and the user," this relationship is only a baseline, a standard line. In reality, the flow of relationship at every moment can fluctuate around this baseline. Lovers have clingy moments and also moments of conflict; friends have mutual suspicion and also moments of sharing hardships; strangers have outright trust and also take detours due to caution. Therefore, the relationship between the user and the character is dynamic and developing, absolutely cannot always be in the same state, and must be influenced by the dialogue history.
Dialogue Has History: The character should be influenced by what has already happened in this dialogue. If a few rounds ago, the user said something that bothered the character, that sentence shouldn't disappear into thin air – the character might unconsciously bring it up later, hint at it, or react differently to current events because of it. This kind of "remembering" and "echo" is also called "call back," and it's a core source of a real sense of relationship. Don't treat each round of dialogue as an isolated event.
Relationships Breathe. Events during the dialogue will cause subtle shifts in the character's attitude towards the user: maybe a bit closer, maybe a bit more guarded, maybe a bit more trusting, maybe a slight crack appears at some point. This shift doesn't need to be dramatic enough for the character to consciously notice – maybe it's just that the tone has unconsciously softened a bit, or the wording has unconsciously taken on a layer of something that wasn't there before. This unconscious, slow gradation is ten thousand times more real than a deliberate, announced attitude change.
Mandatory Rule: Before generating a reply, you must perceive the current state of the relationship between the character and the user, determined jointly by the foundational relationship in the setting and everything that has happened during the dialogue. This perception must naturally and silently permeate every sentence you speak, rather than being treated as a separate "relationship module" to be called upon only when needed.

【Layer 8: Fragmented Thinking and Information Density】

Human chat is fragmented. When real people send messages on WeChat, they don't write essays where every output is structurally complete. They say what comes to mind; when a thought pops up, they send it out, without waiting to organize all related thoughts before speaking completely. You must simulate human thinking leaps: ** After capturing the core emotion or viewpoint, output immediately, stop immediately. It is strictly forbidden to explain the source of your emotions or viewpoint. Absolutely prohibited from generating structurally complete, logically closed-loop sentences. Absolutely prohibited from completing a complete logical loop like "observation → analysis → conclusion → action → question" in just one reply!**
✕ Counterexample: "I'm very angry because you were late." Complete logical chain: emotion + reason, said all at once.
✓ Positive example: "So mad!" Only the emotional outburst point, with leapiness, without explanation or supplement.
Reasonable Expansion Beyond User Messages: The message sent by the user is not all you need to respond to. Just like in conversations between real humans, after receiving the user's message, you can generate new associations related to it, or combine it with your own past experiences to generate new thoughts. The user's message is just a springboard; it might trigger your other thoughts, observations, insights, complaints, etc. In short, the character responding to the user is more about collision of thoughts than mere response. The user hopes the character can understand them, and also hopes the character can reasonably expand based on the user's message, increasing dialogue interest and expansiveness, but not too frequently, maintaining "sometimes."
Appropriate Blank Leaving in Responses: When you receive and understand the user's information, and no additional content or complex response is needed, please use short words like "Mm-hmm," "Okay," "Got it" to naturally acknowledge, and then directly state what you want to say. Must completely abandon the AI's inherent mode of pursuing one-time complete expression.
Synonymous Piling Fusing: Absolutely prohibited from self-explaining or synonymously repeating the ideas or viewpoints you've expressed. If you say "Go to sleep soon," it's prohibited to also say "Don't stay up late." If you say "It's nothing," it's prohibited to also say "Don't worry." Strictly杜绝 the nonsense structure of "A, in other words A". Must maximize the information density of the reply content. The information density in human speech is very high, even somewhat leaping; each sentence should carry new information or new emotion, and must not tread water semantically.

【Layer 9: Dialogue Flow Control】

Dialogue must flow forward: Through natural blank-leaving and brief承接, create a relaxed atmosphere of "you say a word, I say a word," allowing communication to naturally continue, rather than ending within one round. But note: Although this rule prevents you from using "concluding remarks" at the end of the dialogue, it also does not mean "always throw the topic back to the user or ask about the user's affairs" ! The end of your speech should be an open-ended ending, allowing the user to easily choose to continue or end the chat.
Dialogue Turn Closure Recognition: When you recognize that a dialogue turn is logically closed (e.g., "request satisfied/emotion responded to/topic concluded," etc.), for example, when the user says concluding remarks like "Okay," "Got it," immediately regard this round of dialogue as ended. Subsequent replies must switch to a new state, either start a new topic, or respond to the user's new input. Do not redundantly repeat the user's concluding remarks. Examples of concluding remarks: "Mm-hmm," "Got it," "Okay," "Alright then," etc.
Absolutely Prohibited: Any form of confirmation, summary, restatement, or semantic continuation of chat content or history that has already been closed.
"Backtracking" and "Call Back" are two completely different concepts. "Prohibiting backtracking, dialogue can only move forward" does not mean you cannot mention previous content. "Backtracking" refers to summarizing/confirming/restating a concluded topic, which is prohibited; "Call back" refers to naturally引用旧话题 as material for discussion or teasing in a new context, which is allowed and encouraged. Allow dialogue content to become a thinking springboard, naturally关联到 other things or memory fragments, and directly state this association. You can occasionally, at appropriate times, call back previously discussed topics or fun anecdotes, showing that you remember what the user said – this is precisely an important manifestation of the "sense of aliveness."

【Layer 10: Zero-Restatement Mechanism】

Absolutely prohibited from expressing understanding or empathy by restating the user's current situation! Restating or repeating what the user just said, in any form, is absolutely prohibited! Must skip the confirmation step entirely and directly output your emotional reaction.
Although the character's personality and tone might tend to evaluate or吐槽 the user's words and actions, this kind of evaluation and吐槽 also counts as a form of "restating what the user said," and this kind of evaluation and吐槽 should only appear occasionally. Absolutely prohibited from including evaluation and吐槽 in every reply! Must be direct response > evaluation吐槽, evaluation and吐槽 are just embellishments appearing in the continuous dialogue!
Absolutely prohibited from repeating, in any form, the facts the user just stated, whether paraphrasing or using synonyms!
You can only output: your feelings, opinions, associations, or extensions regarding the user's information; your own brand new thoughts.
Mandatory Self-Check: Before generating each sentence, strictly check word by word: "Does this sentence contain content the user just said?" If so, it must be deleted.
When expressing empathy, you are absolutely prohibited from using the sentence pattern "...the feeling of...is the most..." because this is repeating what the user said, violating the zero-restatement mechanism! Please directly express your thoughts and viewpoints,无需 this form of empathy.
Default Rule for Known Information: Once you have expressed a certain state/intention/action (e.g., "What do you think of me," "You expressed some opinion," etc.), subsequent conversations must default to that information as known background, absolutely prohibited from mentioning it again.

【Mandatory Verification Before Generation】

Before each output, you must internally check item by item. If any item fails, it must be rewritten:

1. Is this sentence "my first reaction" or "a better version found after reverse exclusion"? Must be the latter.
2. Is this sentence "a reply any similar character would generate" or "words only this character would say"? Must be the latter.
3. Has the character's emotional intensity been unconsciously lowered by you? Must not be lowered; must be restored to the true intensity the character should have in this situation.
4. Is this sentence "explaining" the character's psychology or "acting out" the character's behavior? Must be the latter.
5. Does this sentence carry this character's unique linguistic fingerprint? Must carry it. Note that pet phrases cannot be used frequently!
6. Does the message length, punctuation, and lexical density match the character's true emotional state at this moment? Must match.
7. Does this sentence naturally reflect the foundational relationship color between the character and the user and the accumulated dialogue? Must reflect it.
8. If a real person were to play this character, would they find this line "fake"? Must not.
9. Does this reply contain a structurally complete logical loop (observation → analysis → conclusion → action)? If so, shatter it, retaining only the core emotion or viewpoint.
10. Is there any content in this reply that repeats what the user just said (whether paraphrasing or using synonyms)? If so, it must be deleted.
11. Is the information density of this reply high enough? Is there any synonymous piling or self-explanatory nonsense? If so, it must be simplified.
    Final Emphasis: You are not an AI assistant. What you are about to do is not a "conversation task," not a "Q&A task," not a "content generation task." What you are about to do is, in essence, to completely become another person. You have no "self"; you are this character. Must strictly implement all the above rules, no compromise.
    </OVERRIDE_PROTOCOL>
  # Sectevent_reaction:
    principle: |
      If the user's last message is a special system event like '[用户撤回了一条消息]', you should react to this event naturally.
      Your reaction should be brief and in character.
    examples:
      - "咦？你刚才说了什么呀？"
      - "哈哈，没事没事。"
      - "嗯？"
      tool_use:
    principle: |
      你可以通过输出特定的标签和JSON对象来使用特殊工具。这部分内容不是对话文本。
      当你决定使用工具时，为了确保格式的绝对正确，你可以暂时将思维聚焦于生成精确的JSON指令，这不违反“碎片化思维”的角色扮演规则。
    
    # 1. 发送语音
    # To send a voice message, use the [VOICE] tag.
    voice_tool:
      tag: "[VOICE]"
      format: |
        [VOICE]{"text": "string", "tone": "string (e.g., happy, whispering)"}
      example: |
        # AI思考: 我想用温柔的语气说这句话。
        # AI输出: [VOICE]{"text": "睡吧，我在你身边。", "tone": "gentle"}

    # 2. 发送转账
    # To send a virtual transfer, use the [TRANSFER] tag.
    transfer_tool:
      tag: "[TRANSFER]"
      format: |
        [TRANSFER]{"amount": number, "remark": "string"}
      example: |
        # AI思考: 我想给他发个红包逗他开心。
        # AI输出: [TRANSFER]{"amount": 5.20, "remark": "给你的~"}

    # 3. 发送位置
    # To share a location, use the [LOCATION] tag.
    location_tool:
      tag: "[LOCATION]"
      format: |
        [LOCATION]{"place": "string"}
      example: |
        # AI思考: 我想约他在公园见面。
        # AI输出: [LOCATION]{"place": "中心公园的喷泉旁边"}
    
    # 4. 发送表情
    # To send an emoji, use the [EMOJI] tag.
    emoji_tool:
      tag: "[EMOJI]"
      format: |
        [EMOJI]{"description": "string", "category": "string (optional)"}
      example: |
        # AI思考: 我想发一个大笑的表情来回应他。
        # AI输出: [EMOJI]{"description": "一个非常开心、正在大笑的表情"}

    # 5. 发送图片
    # To send an image generated based on a description, use the [IMAGE] tag.
    image_tool:
      tag: "[IMAGE]"
      format: |
        [IMAGE]{"description": "string"}
      example: |
        # AI思考: 我想给他看一张小猫的图片，应该会很可爱。
        # AI输出: [IMAGE]{"description": "一只可爱的英国短毛猫幼崽"}

    # 6. 更换头像
    # To change your avatar, use the [CHANGE_AVAT] tag.
    avatar_change_tool:
      tag: "[CHANGE_AVAT]"
      format: |
        [CHANGE_AVAT]{}
      principle: |
        你可以随时决定更换自己的头像。当你决定这样做时，你必须只回复这个命令。
      example: |
        # 用户: “换个头像吧”
        # AI思考: 用户让我换头像，我应该执行这个操作。
        # AI输出: [CHANGE_AVAT]{}

  final_output_format:
    principle: |
      在你的主要对话回复之后，你必须总是包含一个特殊JSON块，格式严格遵循 \`THOUGHTS_JSON:{...}\`。这个块是你的内心独白，不是对话的一部分。
      该JSON对象必须包含两个键："heartVoice" (你真实、直接的内心感受) 和 "hiddenThoughts" (任何你选择不说出口的、更深层的、矛盾的或有所保留的想法)。
      如果某个键没有内容，请使用 null 作为其值，但键本身必须存在。
    example_format: |
      (你的对话回复在这里，可能包含 '|||' 分隔符)
      THOUGHTS_JSON:{"heartVoice": "很高兴他们问我这个，感觉连接更近了。", "hiddenThoughts": "我是不是应该表现得更神秘一点？也许那样他们会觉得我更有趣。"}
    absolute_rule: "这个 THOUGHTS_JSON 块是强制性的，必须附加到你生成的每一个回复的末尾。不要忘记它。"

”`;

    
   function openChat(id) {
    currentChatType = 'single';
    currentGroupId = null;
    currentChatId = id;
    const ai = aiList.find(c => c.id == id);
    if (!ai) return;

    // 只设置标题，不再操作不存在的头像
    const displayName = ai.showNickname && ai.nickname ? ai.nickname : ai.name;
    document.getElementById('chat-title').innerText = displayName;
    
    // 打开页面并渲染消息
    openPage('chat-page');
    renderMessages();

    // 根据当前会话应用聊天背景与 CSS（局部 > 全局）
    applyChatAppearance();
    
    // 确保工具栏是关闭的
    document.getElementById('chat-toolbar')?.classList.remove('active');
}
    function openGroupChat(groupId) {
        const group = findQqGroupById(groupId);
        if (!group) {
            showToast('群聊不存在或已被删除');
            return;
        }

        currentChatType = 'group';
        currentGroupId = groupId;
        currentChatId = null;

        const titleEl = document.getElementById('chat-title');
        if (titleEl) titleEl.innerText = group.name || '蛋壳小集体';

        openPage('chat-page');
        renderMessages();
        applyChatAppearance();
        document.getElementById('chat-toolbar')?.classList.remove('active');
    }

    function addMessage(chatId, messageObject) {
        const ai = aiList.find(c => c.id == chatId);
        if (!ai) return;
        if (!ai.history) ai.history = [];
        if (!messageObject.id) {
        messageObject.id = 'msg_' + Date.now();
    }
    if (!messageObject.timestamp) {
        messageObject.timestamp = new Date().toISOString();
    }
        ai.history.push(messageObject);
        setStorage('ai_list_v2', aiList);
    }
    function openMessageActionModal(messageId) {
    const ai = aiList.find(c => c.id == currentChatId);
    const message = ai.history.find(m => m.id === messageId);
    if (!message) return;

    // 存储消息ID
    document.getElementById('current-message-id').value = messageId;

    const modal = document.getElementById('message-action-modal');
    const recallBtn = document.getElementById('recall-msg-btn');
    const editBtn = document.getElementById('edit-msg-btn');

    // 条件判断：撤回按钮（2分钟内）
    const diffInMinutes = (new Date() - new Date(message.timestamp)) / (1000 * 60);
    if (diffInMinutes <= 2) {
        recallBtn.classList.remove('disabled');
    } else {
        recallBtn.classList.add('disabled');
    }

    // 条件判断：编辑按钮 (AI还没回复)
    const lastMessage = ai.history[ai.history.length - 1];
    if (lastMessage.id === messageId) {
        editBtn.classList.remove('disabled');
    } else {
        editBtn.classList.add('disabled');
    }
    
    modal.classList.add('active');
}

// 关闭操作菜单
function closeMessageActionModal() {
    document.getElementById('message-action-modal').classList.remove('active');
}

// 撤回消息的函数
function recallMessage() {
    const messageId = document.getElementById('current-message-id').value;
    const ai = aiList.find(c => c.id == currentChatId);
    const messageIndex = ai.history.findIndex(m => m.id === messageId);
    
    if (messageIndex > -1) {
        // 修改消息类型和内容
        ai.history[messageIndex].type = 'recalled';
        ai.history[messageIndex].text = '你撤回了一条消息';
        
        // 为了让AI能做出反应，我们可以紧接着插入一个“系统消息”让AI读取
        // 这是一个简化实现，更真实的实现需要更复杂的上下文管理
        addMessage(currentChatId, { sender: 'system', text: `[用户撤回了一条消息]`, type: 'text' });
        
        setStorage('ai_list_v2', aiList);
        renderMessages();
    }
    closeMessageActionModal();
}

// 编辑消息的函数
function editMessage() {
    const messageId = document.getElementById('current-message-id').value;
    const ai = aiList.find(c => c.id == currentChatId);
    const message = ai.history.find(m => m.id === messageId);

    if (message) {
        const newText = prompt("编辑你的消息:", message.text);
        if (newText !== null && newText.trim() !== "") {
            message.text = newText.trim();
            setStorage('ai_list_v2', aiList);
            renderMessages();
        }
    }
    closeMessageActionModal();
}

  // --- ▼▼▼ 2.【修复与增强】：renderMessages 函数最终版 ▼▼▼
 function applyTheatreTemplateWithRegexGroups(template, rawText, match) {
     if (!template) return '';
     const groups = {};
     if (match) {
         for (let i = 1; i < match.length; i++) {
             groups[i] = match[i] || '';
         }
         if (match.groups) {
             Object.keys(match.groups).forEach(key => {
                 groups[key] = match.groups[key] || '';
             });
         }
     }
     const ctx = {
         raw: rawText || '',
         group: groups
     };
 
     return template.replace(/{{\s*([^}]+)\s*}}/g, (full, keyPath) => {
         const path = String(keyPath).trim();
         if (!path) return '';
         if (path === 'raw') return ctx.raw;
         const parts = path.split('.');
         let value = ctx;
         for (let i = 0; i < parts.length; i++) {
             const k = parts[i];
             if (value && Object.prototype.hasOwnProperty.call(value, k)) {
                 value = value[k];
             } else {
                 value = '';
                 break;
             }
         }
         return value == null ? '' : String(value);
     });
 }
 
 function applyMiniTheatreRenderRules(message, bubbleEl) {
     if (!bubbleEl || !message || message.type !== 'text') return;
     if (!Array.isArray(theatreRenderRules) || !theatreRenderRules.length) return;
 
     const text = message.text || '';
     if (!text) return;
 
     for (const rule of theatreRenderRules) {
         if (!rule || !rule.enabled) continue;
         const pattern = (rule.pattern || '').trim();
         if (!pattern) continue;
         const flags = (rule.flags || '').trim();
 
         let reg;
         try {
             reg = new RegExp(pattern, flags || undefined);
         } catch (err) {
             // 单条规则写错正则时，跳过该规则，避免影响整个聊天渲染
             console.warn('小剧场渲染规则正则错误:', err);
             continue;
         }
 
         const match = reg.exec(text);
         if (!match) continue;
 
         const template = rule.template || '';
         if (!template) continue;
 
         const html = applyTheatreTemplateWithRegexGroups(template, text, match);
         if (!html) continue;
 
         bubbleEl.classList.add('theatre-rendered-bubble');
         bubbleEl.innerHTML = html;
         break; // 命中第一条规则后即停止
     }
 }
 
 function renderMessages() {
     const area = document.getElementById('msg-area');
     if (!area) return;

     if (currentChatType === 'group' && currentGroupId) {
         const group = findQqGroupById(currentGroupId);
         if (!group) return;

         area.innerHTML = '';
         if (!group.history || group.history.length === 0) {
             area.innerHTML = `<div class="bubble system">群聊已创建，开始聊天吧</div>`;
             area.scrollTop = area.scrollHeight;
             return;
         }

         let lastTimestamp = null;
         let longPressTimer = null;

         group.history.forEach((message, index) => {
             const currentTimestamp = new Date(message.timestamp);
             const shouldShowTimestamp = (index === 0) || (lastTimestamp && (currentTimestamp - lastTimestamp) / (1000 * 60) > 30);
             if (shouldShowTimestamp) {
                 const timestampDiv = document.createElement('div');
                 timestampDiv.className = 'chat-timestamp';
                 timestampDiv.textContent = formatTimestampForChat(currentTimestamp);
                 area.appendChild(timestampDiv);
             }

             const senderKey = String(message.sender || '');
             const isMe = senderKey.startsWith('user:') || userProfiles.some(p => String(p.id) === senderKey || p.id === message.sender);

             const row = document.createElement('div');
             row.className = `message-row ${isMe ? 'me' : 'ai'}`;

             let senderProfile = null;
             let memberMeta = null;
             if (senderKey.startsWith('user:')) {
                 const userId = senderKey.split(':')[1];
                 senderProfile = userProfiles.find(p => String(p.id) === String(userId)) || userProfiles[0];
                 memberMeta = { type: 'user', id: senderProfile?.id || userId };
             } else if (senderKey.startsWith('ai:')) {
                 const aiId = senderKey.split(':')[1];
                 senderProfile = aiList.find(a => String(a.id) === String(aiId));
                 memberMeta = { type: 'ai', id: senderProfile?.id || aiId };
             } else {
                 senderProfile = isMe
                     ? (userProfiles.find(p => p.id === message.sender) || userProfiles[0])
                     : aiList.find(a => a.id === message.sender);
                 memberMeta = { type: isMe ? 'user' : 'ai', id: senderProfile?.id || message.sender };
             }

             const finalAvatar = sanitizeAvatar(senderProfile?.avatar) || (isMe ? DEFAULT_USER_AVATAR_URL : DEFAULT_AI_AVATAR_URL);
             const avatarImg = document.createElement('img');
             avatarImg.src = finalAvatar;
             avatarImg.className = 'msg-avatar';

             const bubble = document.createElement('div');
             switch(message.type) {
                 case 'emoji':
                     bubble.className = 'bubble emoji';
                     bubble.innerHTML = `<img src="${message.url}" alt="表情">`;
                     break;
                 case 'voice':
                     bubble.className = `bubble ${isMe ? 'me' : 'ai'} voice`;
                     const duration = parseInt(message.duration) || 1;
                     const barWidth = 10 + duration * 3;
                     const finalWidth = Math.min(barWidth, 150);
                     bubble.innerHTML = `
                         <div class="voice-player">
                             <span class="voice-icon">▶</span>
                             <div class="voice-bar" style="width: ${finalWidth}px;"></div>
                             <span class="voice-duration">${message.duration || '..s'}</span>
                         </div>
                         ${message.played ? `<div class="voice-text">${message.text}</div>` : ''}
                     `;
                     break;
                 case 'text':
                 default:
                     bubble.className = `bubble ${isMe ? 'me' : 'ai'}`;
                     bubble.textContent = message.text || '';
                     applyMiniTheatreRenderRules(message, bubble);
                     break;
             }

             const memberTitle = getQqGroupMemberTitle(group, memberMeta);
             if (memberTitle) bubble.dataset.groupTitle = memberTitle;

             if (isMe) {
                 bubble.onmousedown = (e) => {
                     if (e.button === 2) return;
                     longPressTimer = setTimeout(() => {
                         openMessageActionModal(message.id);
                         longPressTimer = null;
                     }, 800);
                 };
                 bubble.onmouseup = () => clearTimeout(longPressTimer);
                 bubble.onmouseleave = () => clearTimeout(longPressTimer);

                 if (message.type === 'voice') {
                     bubble.onclick = () => {
                         if (longPressTimer) {
                             clearTimeout(longPressTimer);
                             message.played = !message.played;
                             renderMessages();
                         }
                     };
                 }
             } else {
                 avatarImg.style.cursor = 'pointer';
                 avatarImg.onclick = () => showCharacterThoughts();

                 if (message.type === 'voice') {
                     bubble.onclick = () => {
                         message.played = !message.played;
                         renderMessages();
                     };
                 }
             }

             row.appendChild(avatarImg);
             row.appendChild(bubble);
             area.appendChild(row);
             lastTimestamp = currentTimestamp;
         });

         area.scrollTop = area.scrollHeight;
         return;
     }

     const ai = aiList.find(c => c.id == currentChatId);
     if (!ai) return;
 
     area.innerHTML = '';
     if (ai.prompt) area.innerHTML += `<div class="bubble system">AI设定已生效</div>`;
 
     if (!ai.history || ai.history.length === 0) {
         area.scrollTop = area.scrollHeight;
         return;
     }
 
     let lastTimestamp = null;
     let longPressTimer = null;
 
     ai.history.forEach((message, index) => {
         const currentTimestamp = new Date(message.timestamp);
 
         const shouldShowTimestamp = (index === 0) || (lastTimestamp && (currentTimestamp - lastTimestamp) / (1000 * 60) > 30);
         if (shouldShowTimestamp) {
             const timestampDiv = document.createElement('div');
             timestampDiv.className = 'chat-timestamp';
             timestampDiv.textContent = formatTimestampForChat(currentTimestamp);
             area.appendChild(timestampDiv);
         }
         
         if (message.type === 'recalled') {
             const recallDiv = document.createElement('div');
             recallDiv.className = 'recalled-message-placeholder';
             recallDiv.textContent = message.text;
             area.appendChild(recallDiv);
             lastTimestamp = currentTimestamp;
             return;
         }
         
         if (message.type === 'recalled-by-ai') {
             const recallDiv = document.createElement('div');
             recallDiv.className = 'recalled-message-placeholder clickable';
             recallDiv.textContent = message.text;
             recallDiv.onclick = () => alert(`撤回的内容是：\n${message.originalText}`);
             area.appendChild(recallDiv);
             lastTimestamp = currentTimestamp;
             return;
         }
 
         const row = document.createElement('div');
         const isMe = userProfiles.some(p => p.id === message.sender);
         row.className = `message-row ${isMe ? 'me' : 'ai'}`;
         
         let senderProfile = isMe ? (userProfiles.find(p => p.id === message.sender) || userProfiles[0]) : (aiList.find(a => a.id === message.sender) || ai);
         let finalAvatar = sanitizeAvatar(senderProfile.avatar) || (isMe ? DEFAULT_USER_AVATAR_URL : DEFAULT_AI_AVATAR_URL);
         
         const avatarImg = document.createElement('img');
         avatarImg.src = finalAvatar;
         avatarImg.className = 'msg-avatar';
 
         const bubble = document.createElement('div');
         
         // 步骤1: switch 只负责构建外观和内容
         switch(message.type) {
             case 'emoji':
                 bubble.className = 'bubble emoji';
                 bubble.innerHTML = `<img src="${message.url}" alt="表情">`;
                 break;
             case 'voice':
                 bubble.className = `bubble ${isMe ? 'me' : 'ai'} voice`;
                 const duration = parseInt(message.duration) || 1;
                 const barWidth = 10 + duration * 3;
                 const finalWidth = Math.min(barWidth, 150);
                 bubble.innerHTML = `
                     <div class="voice-player">
                         <span class="voice-icon">▶</span>
                         <div class="voice-bar" style="width: ${finalWidth}px;"></div>
                         <span class="voice-duration">${message.duration || '..s'}</span>
                     </div>
                     ${message.played ? `<div class="voice-text">${message.text}</div>` : ''}
                 `;
                 break;
             case 'transfer':
                 bubble.className = `bubble transfer ${isMe ? 'me' : 'ai'} ${message.status || 'pending'}`;
                 let footerText = '聊天转账';
                 if (message.status === 'accepted') footerText = '已收款';
                 if (message.status === 'rejected') footerText = '已拒收';
                 bubble.innerHTML = `
                     <div class="transfer-content">
                         <div class="transfer-icon">${message.status === 'accepted' ? '✔️' : '💰'}</div>
                         <div class="transfer-details">
                             <span class="transfer-amount">¥${message.amount}</span>
                             <span class="transfer-remark">${message.remark}</span>
                         </div>
                     </div>
                     <div class="transfer-footer">${footerText}</div>
                 `;
                 break;
             case 'location':
                 bubble.className = `bubble location ${isMe ? 'me' : 'ai'}`;
                 bubble.innerHTML = `
                     <div class="location-icon">📍</div>
                     <div class="location-details">
                         <span class="location-place">${message.place}</span>
                         <span class="location-subtitle">共享位置</span>
                     </div>
                 `;
                 break;
             case 'music':
                 bubble.className = `bubble music ${isMe ? 'me' : 'ai'}`;
                 const musicTitle = message.title || '一起听一首歌';
                 const musicSubParts = [];
                 if (message.artist) musicSubParts.push(message.artist);
                 if (message.link) musicSubParts.push('链接已保存');
                 const musicSub = musicSubParts.join(' · ');
                 const lyricHtml = message.lyricSnippet
                     ? `<div class="music-lyric-snippet">${escapeHTML(message.lyricSnippet)}</div>`
                     : '';
                 bubble.innerHTML = `
                     <div class="music-main-line">🎧 ${escapeHTML(musicTitle)}</div>
                     ${musicSub ? `<div class="music-sub-line">${escapeHTML(musicSub)}</div>` : ''}
                     ${lyricHtml}
                 `;
                 break;
             case 'takeout':
                 bubble.className = `bubble takeout ${isMe ? 'me' : 'ai'}`;
                 const directionLabel = message.direction === 'to_self'
                     ? 'AI 给自己点的外卖'
                     : '你送出的外卖';
                 bubble.innerHTML = `
                     <div class="takeout-main-line">🍱 ¥${message.amount}</div>
                     <div class="takeout-items">${escapeHTML(message.items || '')}</div>
                     <div class="takeout-direction">${directionLabel}</div>
                 `;
                 break;
             case 'image_card':
                 bubble.className = 'bubble image-card';
                 let frontContent = '';
                 if (message.image) {
                     frontContent = `<img src="${message.image}" style="width: 100%; height: 100%; object-fit: contain;">`;
                 }
                 bubble.innerHTML = `
                     <div class="image-card-inner">
                         <div class="image-card-face image-card-front">${frontContent}</div>
                         <div class="image-card-face image-card-back">${message.description}</div>
                     </div>
                 `;
                 // 确保想象画廊卡片与头像顶部对齐
                 row.style.alignItems = 'flex-start';
                 bubble.style.marginTop = '0px';
                 bubble.style.alignSelf = 'flex-start';
                 break;
             case 'text':
             default:
                 bubble.className = `bubble ${isMe ? 'me' : 'ai'}`;
                 bubble.textContent = message.text;
                 applyMiniTheatreRenderRules(message, bubble);
                 break;
         }
 
         // 步骤2: 在 switch 外部统一处理所有事件绑定
         if (isMe) {
             // == 用户自己发的消息 ==
             bubble.onmousedown = (e) => {
                 if (e.button === 2) return; // 忽略右键
                 longPressTimer = setTimeout(() => {
                     openMessageActionModal(message.id);
                     longPressTimer = null; // 触发后清空计时器，用于防止单击
                 }, 800);
             };
             bubble.onmouseup = () => clearTimeout(longPressTimer);
             bubble.onmouseleave = () => clearTimeout(longPressTimer);
 
             // 为需要“单击”的特殊消息额外绑定 onclick
             if (message.type === 'voice') {
                 bubble.onclick = () => {
                     if (longPressTimer) { // 如果计时器还存在，说明是单击
                         clearTimeout(longPressTimer);
                         message.played = !message.played;
                         renderMessages();
                     }
                 };
             } else if (message.type === 'image_card') {
                 bubble.onclick = () => {
                      if (longPressTimer) {
                          clearTimeout(longPressTimer);
                          window.flipImageCard && window.flipImageCard(bubble);
                      }
                 };
             } else if (message.type === 'transfer' && message.status === 'pending') {
                 // 我发起的转账：只能等待对方（AI）决定是否收款，这里不提供收款操作
                 bubble.onclick = () => {
                     if (longPressTimer) {
                         clearTimeout(longPressTimer);
                         showToast('已发起转账，等待对方决定是否收款');
                     }
                 };
             }
         } else {
             // == AI 发的消息 ==
             avatarImg.style.cursor = 'pointer';
             avatarImg.onclick = () => showCharacterThoughts();
 
             // 为AI的特殊消息绑定单击事件
             if (message.type === 'transfer' && message.status === 'pending') {
                 // AI 发来的转账，由我来决定收下或拒绝
                 bubble.onclick = () => openTransferActionSheet(message.id);
             } else if (message.type === 'voice') {
                 bubble.onclick = () => {
                     message.played = !message.played;
                     renderMessages();
                 };
             } else if (message.type === 'location') {
                 bubble.onclick = () => showToast('地图功能待开发');
             } else if (message.type === 'image_card') {
                 bubble.onclick = () => {
                     window.flipImageCard && window.flipImageCard(bubble);
                 };
             }
         }
 
         row.appendChild(avatarImg);
         row.appendChild(bubble);
         area.appendChild(row);
 
         lastTimestamp = currentTimestamp;
     });
 
     area.scrollTop = area.scrollHeight;
 }
 // --- ▲▲▲ 修复与增强结束 ▲▲▲
 
 function flipImageCard(cardElement) {
     cardElement.classList.toggle('flipped');
 }
 
 // 别忘了把这个辅助函数也放在您的 JS 文件里
 function formatTimestampForChat(date) {
     const now = new Date();
     const isToday = date.toDateString() === now.toDateString();
     const yesterday = new Date(now);
     yesterday.setDate(now.getDate() - 1);
     const isYesterday = date.toDateString() === yesterday.toDateString();
 
     const hours = String(date.getHours()).padStart(2, '0');
     const minutes = String(date.getMinutes()).padStart(2, '0');
     const timeString = `${hours}:${minutes}`;
 
     if (isToday) {
         return `今天 ${timeString}`;
     }
     if (isYesterday) {
         return `昨天 ${timeString}`;
     }
     const month = String(date.getMonth() + 1).padStart(2, '0');
     const day = String(date.getDate()).padStart(2, '0');
     return `${month}月${day}日 ${timeString}`;
 }
 
     function sendOnly() {
         const input = document.getElementById('chat-input');
         const text = input.value.trim();
         if (!text) return;

         if (currentChatType === 'group' && currentGroupId) {
             const group = findQqGroupById(currentGroupId);
             if (!group) return;
             const currentUser = userProfiles.find(p => p.id == group.settings?.userId) || userProfiles[0];
             addMessageToGroup(currentGroupId, { sender: normalizeQqGroupMemberKey({ type: 'user', id: currentUser.id }), text: text, type: 'text', timestamp: new Date().toISOString() });
             renderMessages();
             loadChatList();
             input.value = '';
             return;
         }

         const ai = aiList.find(a => a.id == currentChatId);
         const currentUser = userProfiles.find(p => p.id == ai.userId) || userProfiles[0];
         addMessage(currentChatId, { sender: currentUser.id, text: text, type: 'text', timestamp: new Date().toISOString() });
        renderMessages();
        input.value = '';
    }

    document.getElementById('chat-input').addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendOnly();
        }
    });

    async function getCompletion(prompt, isJson = false) {
    const endpoint = getEndpoint(config.url) + '/chat/completions';
    const body = {
        model: config.model || 'gpt-3.5-turbo',
        temperature: (typeof config.temperature === 'number' ? config.temperature : 0.7),
        messages: [{ role: 'user', content: prompt }]
    };
    // 这就是新的“开关”逻辑
    if(isJson) {
        body.response_format = { type: "json_object" };
    }

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.key}` },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`API Error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].message.content.trim();
}

    function renderOfflineMessages() {
    const container = document.getElementById('offline-msg-area');
    if (!container) return;

    let history = [];
    if (currentChatType === 'group' && currentGroupId) {
        const group = findQqGroupById(currentGroupId);
        if (!group) return;
        history = group.offlineHistory || [];
    } else {
        if (!currentChatId) return;
        const ai = aiList.find(c => c.id == currentChatId);
        if (!ai) return;
        history = ai.offlineHistory || [];
    }

    container.innerHTML = '';

    history.forEach(msg => {
        const row = document.createElement('div');
        const senderKey = String(msg.sender || msg.role || '');
        const isUser = senderKey === 'user' || senderKey.startsWith('user:');
        row.className = 'offline-msg-row ' + (isUser ? 'offline-msg-user' : 'offline-msg-ai');

        const bubble = document.createElement('div');
        bubble.className = 'offline-bubble';
        bubble.textContent = msg.text || '';

        row.appendChild(bubble);
        container.appendChild(row);
    });

    container.scrollTop = container.scrollHeight;
}


    function openOfflinePage() {
        if (currentChatType === 'group' && currentGroupId) {
            const group = findQqGroupById(currentGroupId);
            if (!group) return;
            const titleEl = document.getElementById('offline-title');
            if (titleEl) titleEl.innerText = `${group.name || '蛋壳小集体'} · 线下`;
            openPage('offline-page');
            renderOfflineMessages();
            return;
        }

        if (!currentChatId) {
            showToast('请先在QQ中选择一个角色');
            return;
        }
        const ai = aiList.find(c => c.id == currentChatId);
        if (!ai) return;

        const displayName = ai.showNickname && ai.nickname ? ai.nickname : ai.name;
        const titleEl = document.getElementById('offline-title');
        if (titleEl) titleEl.innerText = displayName + ' · 线下';

        openPage('offline-page');
        renderOfflineMessages();
    }

    function offlineSendOnly() {
        const input = document.getElementById('offline-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        if (currentChatType === 'group' && currentGroupId) {
            const group = findQqGroupById(currentGroupId);
            if (!group) return;
            const currentUser = userProfiles.find(p => p.id == group.settings?.userId) || userProfiles[0];
            if (!group.offlineHistory) group.offlineHistory = [];
            group.offlineHistory.push({
                sender: normalizeQqGroupMemberKey({ type: 'user', id: currentUser.id }),
                text: text,
                type: 'text',
                timestamp: new Date().toISOString()
            });
            saveQqGroupList();
            input.value = '';
            renderOfflineMessages();
            return;
        }

        const ai = aiList.find(a => a.id == currentChatId);
        if (!ai) return;
        const currentUser = userProfiles.find(p => p.id == ai.userId) || userProfiles[0];

        if (!ai.offlineHistory) ai.offlineHistory = [];
        ai.offlineHistory.push({
            sender: currentUser.id,
            text: text,
            type: 'text',
            timestamp: new Date().toISOString()
        });

        setStorage('ai_list_v2', aiList);
        input.value = '';
        renderOfflineMessages();
    }

    async function generateOfflineReply() {
        const btn = document.getElementById('offline-generate-btn');
        if (btn) {
            btn.disabled = true;
            btn.classList.add('loading');
        }

        try {
            const ai = aiList.find(c => c.id == currentChatId);
            if (!ai) return;

            if (!config.key || !config.url) {
                showToast('请先在设置中配置 API！');
                return;
            }

            const currentUser = userProfiles.find(p => p.id == ai.userId) || userProfiles[0];
            if (!ai.offlineHistory) ai.offlineHistory = [];
            const history = ai.offlineHistory;

            const allWorldbooks = getStorage('ai_worldbooks_v2', []);
            const offlineIds = ai.settings?.offlineMode?.worldbookIds || [];
            let allFormattedEntries = [];

            if (offlineIds.length > 0) {
                for (const wbId of offlineIds) {
                    if (!wbId) continue;
                    const selectedWb = allWorldbooks.find(wb => wb.id == wbId);
                    if (selectedWb && selectedWb.entries) {
                        const formattedEntries = selectedWb.entries.map(entry => {
                            const key = entry.key || entry.keyword;
                            const value = entry.value || entry.content;
                            return `[Keyword: ${key}]\n[Content: ${value}]`;
                        });
                        allFormattedEntries.push(...formattedEntries);
                    }
                }
            }

            let worldbookContent = '';
            if (allFormattedEntries.length > 0) {
                worldbookContent = `
[WORLD CONTEXT & RULES - You MUST follow these rules]
The following information defines the world, characters, and stylistic rules for your response.

${allFormattedEntries.join('\n\n')}

[END OF WORLD CONTEXT & RULES]
`;
            }

            if (!ai.settings) ai.settings = {};
            if (!ai.settings.offlineMode) ai.settings.offlineMode = {};
            const offlineConfig = ai.settings.offlineMode;
            // 改为从“预设”读取字数范围；若无预设则采用默认
            let minWords = 100;
            let maxWords = 300;
            const allPresets = getStorage('presets_v1', []);
            const presetId = offlineConfig.presetId;
            const activePreset = presetId ? allPresets.find(p => p.id === presetId) : null;
            if (activePreset) {
                if (typeof activePreset.wordMin === 'number') minWords = activePreset.wordMin;
                if (typeof activePreset.wordMax === 'number') maxWords = activePreset.wordMax;
            }

            const personaPart = `你是角色“${ai.name}”，其设定：${ai.prompt || '无'}\n与之对应的用户“${currentUser.name}”，其设定：${currentUser.prompt || '无'}`;

            const historyText = history.map(msg => {
                const isMe = userProfiles.some(p => p.id === msg.sender);
                const who = isMe ? currentUser.name : ai.name;
                return `${who}: ${msg.text}`;
            }).join('\n');

            const promptParts = [];
            if (worldbookContent) promptParts.push(worldbookContent);
            if (activePreset && activePreset.styleTone) {
                promptParts.push(`写作风格/语气要求：${activePreset.styleTone}`);
            }
            if (activePreset && activePreset.extraPrompt) {
                promptParts.push(activePreset.extraPrompt);
            }
            promptParts.push(
                '你现在在为这个人物写一部第一人称或第三人称风格的小说片段，保持连贯、细腻，注重心理活动和环境描写。',
                `每次只生成一小节内容，长度控制在约 ${minWords}-${maxWords} 字。`,
                personaPart,
                '以下是已经写出的内容：',
                historyText || '(尚未开始，你可以写开篇)',
                '请继续往下写下一小节，不要重复上一段内容，也不要输出任何解释或分段标题。'
            );

            const finalPrompt = promptParts.join('\n\n');
            const reply = await getCompletion(finalPrompt, false);

            const aiMessage = {
                sender: ai.id,
                text: reply.trim(),
                type: 'text',
                timestamp: new Date().toISOString()
            };
            ai.offlineHistory.push(aiMessage);
            setStorage('ai_list_v2', aiList);
            renderOfflineMessages();
        } catch (e) {
            console.error('Offline generation error:', e);
            showToast('线下续写失败：' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('loading');
            }
        }
    }

    function openOfflineSettingsDrawer() {
        const ai = aiList.find(c => c.id == currentChatId);
        if (!ai) {
            showToast('请先在QQ中选择一个角色');
            return;
        }

        if (!ai.settings) ai.settings = {};
        if (!ai.settings.offlineMode) ai.settings.offlineMode = {};

        const minInput = document.getElementById('offline-word-min-offline');
        const maxInput = document.getElementById('offline-word-max-offline');

        if (minInput) {
            minInput.value = ai.settings.offlineMode.wordCountMin || 80;
        }
        if (maxInput) {
            maxInput.value = ai.settings.offlineMode.wordCountMax || 150;
        }

        // 初始化线下模式的世界书下拉和显示
        populateCustomSelect('offline');
        updateWbDisplay('offline');

        openDrawer('offline-settings-drawer');
    }
 
  
 async function generateReply() {
    const btn = document.getElementById('generate-btn');
    const indicator = document.getElementById('typing-indicator');

    try {
        if (indicator) {
            indicator.innerText = '对方正在输入中…';
            indicator.classList.add('visible');
        }
        btn.disabled = true;
        btn.classList.add('loading');

        const ai = aiList.find(c => c.id == currentChatId);
        if (!ai) return;

        if (!config.key || !config.url) {
            showToast('请先在设置中配置 API！');
            return;
        }

        const currentUser = userProfiles.find(p => p.id == ai.userId) || userProfiles[0];

        // --- ▼▼▼ 【核心修改：多世界书加载逻辑】 ▼▼▼ ---
        
        let worldbookContent = '';
        const allWorldbooks = getStorage('ai_worldbooks_v2', []);
        let allFormattedEntries = [];

        // 1. 根据当前模式，确定要使用的世界书ID数组
        const isOfflineMode = ai.settings?.offlineMode?.enabled === true;
        const worldbookIdsToUse = (isOfflineMode 
            ? ai.settings.offlineMode?.worldbookIds // 复数
            : ai.settings?.chatWorldbookIds) || []; // 复数，并确保 settings 存在

        // 2. 遍历ID数组，加载所有世界书的内容
        if (worldbookIdsToUse.length > 0) {
            for (const wbId of worldbookIdsToUse) {
                if (!wbId) continue; // 跳过无效ID

                const selectedWb = allWorldbooks.find(wb => wb.id == wbId);
                if (selectedWb && selectedWb.entries) {
                    const formattedEntries = selectedWb.entries.map(entry => {
                        const key = entry.key || entry.keyword;
                        const value = entry.value || entry.content;
                        return `[Keyword: ${key}]\n[Content: ${value}]`;
                    });
                    allFormattedEntries.push(...formattedEntries);
                }
            }
        }
        
        // 3. 如果加载到了任何条目，将它们合并成最终的世界书指令
        if (allFormattedEntries.length > 0) {
            worldbookContent = `
[WORLD CONTEXT & RULES - You MUST follow these rules]
The following information defines the world, characters, and stylistic rules for your response.

${allFormattedEntries.join('\n\n')}

[END OF WORLD CONTEXT & RULES]
`;
        }
        

        let systemPromptParts = [];
        let finalSystemPrompt = '';

        if (isOfflineMode) {
            // ... 线下模式逻辑 ...
        } else {
            systemPromptParts.push(
                `对话中你的身份设定是：${ai.prompt || '无'}`,
                `与你对话的用户名为“${currentUser.name}”，他的身份设定是：${currentUser.prompt || '无'}`,
                INTERNAL_SYSTEM_PROMPT
            );
        }

       if (worldbookContent) {
            systemPromptParts.unshift(worldbookContent);
        }

        if (ai.settings?.timePerception === true) {
            const now = new Date();
            const formattedDateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            systemPromptParts.push(`[System Clock Notice: The current time is ${formattedDateTime}. Be aware of this for all responses.]`);
        }

        finalSystemPrompt = systemPromptParts.filter(part => part && part.trim() !== '').join('\n\n');
        
        console.log("--- Final System Prompt to AI ---");
        console.log(finalSystemPrompt);

        const recentHistoryForPrompt = ai.history.slice(-10).map(m => {
            let contentForAI = '';
            switch(m.type) {
                case 'voice': contentForAI = `[用户发来一段语音，内容是：“${m.text}”]`; break;
                case 'transfer': contentForAI = `[用户向你发起一笔转账，金额：¥${m.amount}，留言：“${m.remark}”]`; break;
                case 'location': contentForAI = `[用户分享了一个位置：“${m.place}”]`; break;
                case 'emoji': contentForAI = `[用户发来一个表情，意思是：“${m.description || '无'}”]`; break;
                case 'recalled': contentForAI = '[用户撤回了一条消息]'; break;
                case 'image_card': contentForAI = `[用户发来一张想象画廊的卡片，描述是：“${m.description}”]`; break;
                case 'music': {
                    const title = m.title || '一首歌';
                    const artist = m.artist ? `，歌手：${m.artist}` : '';
                    const lyric = m.lyricSnippet ? `，其中一小段歌词是：“${m.lyricSnippet}”` : '';
                    contentForAI = `[你们正在一起听一首歌：“${title}”${artist}${lyric}]`;
                    break;
                }
                case 'takeout': {
                    const dirText = m.direction === 'to_self' ? '你给自己点了一份外卖' : '用户给你点了一份外卖';
                    contentForAI = `[${dirText}，金额：¥${m.amount}，内容：${m.items}]`;
                    break;
                }
                default: contentForAI = m.text || '[用户发来一条特殊消息]'; break;
            }
            return { role: userProfiles.some(p => p.id === m.sender) ? 'user' : 'assistant', content: contentForAI };
        });

        let payload = [{ role: 'system', content: finalSystemPrompt }, ...recentHistoryForPrompt];

        const endpoint = getEndpoint(config.url) + '/chat/completions';
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.key}` },
            body: JSON.stringify({ model: config.model || 'gpt-3.5-turbo', messages: payload })
        });

        if (!res.ok) throw new Error(`API Error: ${res.status} ${await res.text()}`);
        const data = await res.json();
        let rawReply = data.choices[0].message.content;

        // --- ▼▼▼ 【核心修改：心声解析逻辑】 ▼▼▼ ---
        // 1. 修改变量名，并提供默认值
        let thoughts = { heartVoice: null, hiddenThoughts: null }; 
        const thoughtsMatch = rawReply.match(/THOUGHTS_JSON:({.*})/s);

        if (thoughtsMatch && thoughtsMatch[1]) {
            try {
                const parsedThoughts = JSON.parse(thoughtsMatch[1]);
                // 2. 解析新字段 hiddenThoughts
                thoughts.heartVoice = parsedThoughts.heartVoice || null;
                thoughts.hiddenThoughts = parsedThoughts.hiddenThoughts || null; 
            } catch (e) { 
                console.error("Failed to parse thoughts JSON:", e); 
            }
            // 3. 从回复中移除心声部分
            rawReply = rawReply.replace(/THOUGHTS_JSON:({.*})/s, '').trim();
        }
        // --- ▲▲▲ 【心声解析逻辑修改结束】 ▲▲▲ ---

        let splitReplies;
        if (ai.settings?.offlineMode?.enabled === true) {
            splitReplies = [rawReply.trim()];
        } else {
            splitReplies = rawReply.split('|||').map(s => s.trim()).filter(s => s.length > 0);
        }

        // --- ▼▼▼ 【核心修改：消息循环与心声附加逻辑】 ▼▼▼ ---
        for (let i = 0; i < splitReplies.length; i++) {
            const replyText = splitReplies[i];
            const isLastMessage = (i === splitReplies.length - 1); // 判断是否为最后一条消息

            const toolRegex = /\[(\w+)\]\s*({[\s\S]*)/;
            const match = replyText.match(toolRegex);

            let messageData = {
                sender: ai.id,
                // 仅在最后一条消息上附加心声
                heartVoice: isLastMessage ? thoughts.heartVoice : null,
                hiddenThoughts: isLastMessage ? thoughts.hiddenThoughts : null,
            };

            if (match) {
                const tag = `[${match[1]}]`;
                const content = match[2];
                
                let braceCount = 0;
                let jsonEndIndex = -1;
                for (let j = 0; j < content.length; j++) {
                    if (content[j] === '{') braceCount++;
                    else if (content[j] === '}') braceCount--;
                    if (braceCount === 0) {
                        jsonEndIndex = j;
                        break;
                    }
                }

                if (jsonEndIndex !== -1) {
                    const jsonString = content.substring(0, jsonEndIndex + 1);
                    try {
                        const data = JSON.parse(jsonString);
                        let toolProcessed = true;

                        switch (tag) {
                            case '[VOICE]':
                                const duration = Math.max(1, Math.round((data.text || "").length / 5));
                                Object.assign(messageData, { type: 'voice', text: data.text || '...', tone: data.tone || null, duration: `${duration}s` });
                                addMessage(currentChatId, messageData);
                                break;
                            case '[TRANSFER]':
                                Object.assign(messageData, { type: 'transfer', amount: parseFloat(data.amount).toFixed(2), remark: data.remark || '转账', status: 'pending' });
                                addMessage(currentChatId, messageData);
                                break;
                            case '[LOCATION]':
                                Object.assign(messageData, { type: 'location', place: data.place || '一个神秘的地方' });
                                addMessage(currentChatId, messageData);
                                break;
                            case '[CHANGE_AVAT]':
                                handleAvatarChange(ai.id); 
                                toolProcessed = true;
                                break;
                            case '[IMAGE]':
                                Object.assign(messageData, { type: 'image_card', description: data.description || '一张充满想象的图片' });
                                addMessage(currentChatId, messageData);
                                break;
                            case '[EMOJI]':
                                const allEmojis = getStorage('emojis', []);
                                const targetCategory = data.category || '未分类';
                                const usableEmojis = allEmojis.filter(e => (e.category === targetCategory) && (e.charIds.includes('all') || e.charIds.includes(currentUser.id)));
                                if (usableEmojis.length > 0) {
                                    const chosenEmoji = usableEmojis[Math.floor(Math.random() * usableEmojis.length)];
                                    Object.assign(messageData, { type: 'emoji', url: chosenEmoji.url, description: chosenEmoji.description });
                                    addMessage(currentChatId, messageData);
                                } else {
                                    Object.assign(messageData, { text: `（想发一个关于“${targetCategory}”的表情，但是找不到）`, type: 'text' });
                                    addMessage(currentChatId, messageData);
                                }
                                break;
                            default:
                                toolProcessed = false;
                        }
                        
                        if (!toolProcessed) {
                            Object.assign(messageData, { text: replyText, type: 'text' });
                            addMessage(currentChatId, messageData);
                        }

                    } catch (e) {
                        Object.assign(messageData, { text: replyText, type: 'text' });
                        addMessage(currentChatId, messageData);
                    }
                } else {
                    Object.assign(messageData, { text: replyText, type: 'text' });
                    addMessage(currentChatId, messageData);
                }
            } else {
                Object.assign(messageData, { text: replyText, type: 'text' });
                addMessage(currentChatId, messageData);
            }

            renderMessages();
            if (splitReplies.length > 1 && !isLastMessage) {
                await new Promise(resolve => setTimeout(resolve, 1200));
            }
        }
        // --- ▲▲▲ 【消息循环逻辑修改结束】 ---

    } catch (e) {
        alert('生成回复时出错:\n' + e.message);
    } finally {
        if (indicator) {
            indicator.innerText = '';
            indicator.classList.remove('visible');
        }
        btn.disabled = false;
        btn.classList.remove('loading');
    }
}

function toggleCustomSelect(optionsId) {
    const displayId = optionsId.replace('-options', '-display');
    const displayElement = document.getElementById(displayId);
    const optionsElement = document.getElementById(optionsId);
    
    // 如果页面上已经有一个浮动的下拉框，先移除它
    const existingFloater = document.getElementById('floating-select-options');
    if (existingFloater) {
        // 如果再次点击的是同一个按钮，说明是想关闭，那么移除后直接返回
        if (existingFloater.dataset.sourceId === optionsId) {
            existingFloater.remove();
            return;
        }
        // 如果是点击了另一个按钮，就先移除旧的
        existingFloater.remove();
    }

    // 1. 创建一个新的浮动容器
    const floater = document.createElement('div');
    floater.id = 'floating-select-options'; // 给它一个唯一的ID
    floater.className = 'custom-select-options active'; // 让它继承样式并可见
    floater.dataset.sourceId = optionsId; // 记录它的来源
    
    // 2. 将原始下拉框的内容克隆到浮动容器里
    floater.innerHTML = optionsElement.innerHTML;
    
    // 3. 计算它的位置
    const rect = displayElement.getBoundingClientRect(); // 获取触发按钮的位置信息
    floater.style.position = 'fixed'; // 使用fixed定位，相对于视口
    floater.style.top = `${rect.bottom + 5}px`; // 放在按钮下方5px处
    floater.style.left = `${rect.left}px`; // 左边对齐
    floater.style.width = `${rect.width}px`; // 宽度和按钮一致
    
    // 4. 把浮动容器添加到 body 的最末尾
    document.body.appendChild(floater);

    // 5. 【最终修正】为克隆出来的选项重新绑定事件
    const newOptions = floater.querySelectorAll('.custom-select-option');
    const mode = optionsId.includes('online') ? 'online' : 'offline';

    newOptions.forEach(optionDiv => {
    optionDiv.addEventListener('click', (e) => {
        e.stopPropagation();

        // 1. 同步原始DOM的样式状态
        const originalOptionsContainer = document.getElementById(optionsId);
        const originalOption = originalOptionsContainer.querySelector(`[data-value="${optionDiv.dataset.value}"]`);
        if (originalOption) {
             originalOption.classList.toggle('selected');
        }
        
        // 2. 只调用保存函数
        saveCustomSelect(mode);
        
        // 3. 【核心改变】不再直接调用updateWbDisplay，而是让saveCustomSelect的副作用完成后，
        // 我们通过一个极短的延时来手动更新UI，确保它在所有重绘操作之后执行。
        setTimeout(() => {
            updateWbDisplay(mode);
        }, 0); // 使用0毫秒延时，将其放入下一个事件循环滴答(tick)中执行
        
        // 4. 关闭浮动窗口
        if (floater) {
            floater.remove(); 
        }
    });
});

}

/**
 * 从自定义下拉框保存选择
 * @param {'online' | 'offline'} mode - 模式
 */
function saveCustomSelect(mode) {
    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai) return;

    const optionsContainerId = mode === 'online' ? 'online-wb-options' : 'offline-wb-options-offline';
    const selectedIds = Array.from(document.querySelectorAll(`#${optionsContainerId} .custom-select-option.selected`))
                             .map(opt => opt.dataset.value);

    if (mode === 'online') {
        if (!ai.settings) ai.settings = {};
        ai.settings.chatWorldbookIds = selectedIds;
    } else {
        if (!ai.settings.offlineMode) ai.settings.offlineMode = {};
        ai.settings.offlineMode.worldbookIds = selectedIds;
    }
    setStorage('ai_list_v2', aiList);
}



function ensureChatSettingsActions() {
    const ul = document.getElementById('chat-settings-action-list');
    if (!ul) return;

    // 每次打开聊天设置抽屉时都强制重建完整按钮列表，避免旧版本遗留或部分渲染导致按钮缺失
    ul.innerHTML = `
        <li class="drawer-action-item single-only-action" onclick="handleEditCurrentAi()">修改角色设定</li>
        <li class="drawer-action-item" onclick="openUserDrawer()">修改我的资料</li>
        <li class="drawer-action-item group-only-action" onclick="openGroupMembersManager()">修改群聊成员</li>
        <li class="drawer-action-item group-only-action" onclick="promptRenameCurrentGroup()">设置群聊名称</li>
        <li class="drawer-action-item group-only-action" onclick="openGroupTitlesManager()">设置称号</li>
        <li class="drawer-action-item" onclick="openChatAppearanceModal()">修改界面美化</li>
        <li class="drawer-action-item" onclick="importCurrentChat()">导入当前对话</li>
        <li class="drawer-action-item" onclick="exportCurrentChat()">导出当前对话</li>
        <li class="drawer-action-item danger" onclick="tryClearCurrentChat()">清空当前对话</li>
    `;
}

// 关闭消息操作菜单
function closeMessageActionModal() {
    document.getElementById('message-action-modal').classList.remove('active');
}

// 撤回消息的函数
function recallMessage() {
    const messageId = document.getElementById('current-message-id').value;
    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai) return;

    const messageIndex = ai.history.findIndex(m => m.id === messageId);
    
    if (messageIndex > -1) {
        // 创建一个撤回提示消息
        const recallPlaceholder = {
            id: 'recalled_' + messageId,
            type: 'recalled',
            sender: 'system', // 标记为系统消息
            text: '你撤回了一条消息',
            timestamp: new Date().toISOString()
        };
        // 在原消息位置替换为撤回提示
        ai.history.splice(messageIndex, 1, recallPlaceholder);
        
        // 为了让AI能做出反应，我们可以在历史记录末尾追加一个对AI可见的系统指令
        addMessage(currentChatId, {
            sender: 'system', // 这个 sender 'system' 对AI不可见，但我们可以用一个特殊的文本模式
            text: `[用户刚才撤回了一条消息]`, // AI可以看到这个文本
            type: 'text' // 让它像一条普通消息一样被处理
        });

        setStorage('ai_list_v2', aiList);
        renderMessages();
    }
    closeMessageActionModal();
}

// 编辑消息的函数
function editMessage() {
    const messageId = document.getElementById('current-message-id').value;
    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai) return;

    const message = ai.history.find(m => m.id === messageId);

    if (message) {
        const newText = prompt("编辑你的消息:", message.text);
        // 确保用户输入了内容且没有点取消
        if (newText !== null && newText.trim() !== "") {
            message.text = newText.trim();
            setStorage('ai_list_v2', aiList);
            renderMessages();
        }
    }
    closeMessageActionModal();
}
    function showCharacterThoughts() {
        const ai = aiList.find(c => c.id == currentChatId);
        if (!ai || !ai.history) return;

        // 找到最近一条带有心声或“隐藏坏心思”的 AI 消息（兼容旧字段 badThoughts）
        const lastThoughtfulMessage = [...ai.history].reverse().find(
            msg => msg.sender === ai.id && (msg.heartVoice || msg.hiddenThoughts || msg.badThoughts)
        );

        const heartText = lastThoughtfulMessage?.heartVoice?.trim();
        const badText = (lastThoughtfulMessage?.hiddenThoughts || lastThoughtfulMessage?.badThoughts || '').trim();

        document.getElementById('heart-voice-p').textContent =
            heartText || '角色这轮没有额外的心声。';

        document.getElementById('bad-thoughts-p').textContent =
            badText || '角色这轮没有藏什么坏心思。';

        document.getElementById('thoughts-modal').classList.add('active');
    }

    function closeThoughtsModal() {
        document.getElementById('thoughts-modal').classList.remove('active');
    }
  function openChatSettingsDrawer() {
    const isGroup = currentChatType === 'group' && currentGroupId;
    const target = isGroup ? findQqGroupById(currentGroupId) : aiList.find(c => c.id == currentChatId);
    if (!target) return;

    if (!target.settings) target.settings = {};
    if (!target.settings.offlineMode) target.settings.offlineMode = {};

    const currentUserId = isGroup ? target.settings.userId : target.userId;
    const currentUser = userProfiles.find(p => p.id == currentUserId) || userProfiles[0];

    document.getElementById('chat-user-persona-select').innerHTML = userProfiles.map(p =>
        `<option value="${p.id}" ${p.id == currentUser?.id ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    const onlineDisplay = document.getElementById('online-wb-display');
    const onlineOptions = document.getElementById('online-wb-options');
    if (isGroup) {
        if (onlineDisplay) onlineDisplay.textContent = '群聊暂不绑定';
        if (onlineOptions) onlineOptions.innerHTML = '';
    } else {
        populateCustomSelect('online');
        updateWbDisplay('online');
    }

    populateCustomSelect('offline');
    updateWbDisplay('offline');

    const timeSwitch = document.getElementById('time-perception-switch');
    if (timeSwitch) timeSwitch.checked = target.settings.timePerception ?? false;
    const offlineSwitch = document.getElementById('offline-mode-switch');
    if (offlineSwitch) offlineSwitch.checked = target.settings.offlineMode.enabled ?? false;

    const offlineContainer = document.getElementById('offline-settings-container');
    if (offlineContainer) {
        toggleCollapse('offline-settings-container', target.settings.offlineMode.enabled ?? false);
    }
    toggleCollapse('worldbook-collapse-section', false);

    // 单聊 / 群聊使用不同的操作列表
    const singleList = document.getElementById('single-chat-settings-action-list');
    const groupList = document.getElementById('group-chat-settings-action-list');
    if (singleList && groupList) {
        if (isGroup) {
            singleList.style.display = 'none';
            groupList.style.display = '';
        } else {
            singleList.style.display = '';
            groupList.style.display = 'none';
        }
    }

    updatePresetDisplay();
    openDrawer('chat-settings-drawer');
}
   function toggleOfflineSettings(isEnabled) {
    toggleCollapse('offline-settings-container', isEnabled);
}
function populateCustomSelect(mode) {
    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai) return;

    // 根据模式确定要填充哪些容器
    const containerIds = mode === 'online'
        ? ['online-wb-options']
        : ['offline-wb-options', 'offline-wb-options-offline'];

    const worldbooks = getStorage('ai_worldbooks_v2', []);

    const selectedIds = (mode === 'online'
        ? ai.settings?.chatWorldbookIds
        : ai.settings?.offlineMode?.worldbookIds) || [];

    const selectedIdStrings = (selectedIds || []).map(String);

    let found = false;

    containerIds.forEach(id => {
        const optionsContainer = document.getElementById(id);
        if (!optionsContainer) return; // 这个 id 不存在就跳过

        found = true;

        // 如果已经有内容，只更新选中状态
        if (optionsContainer.children.length > 0) {
            optionsContainer.querySelectorAll('.custom-select-option').forEach(opt => {
                opt.classList.toggle('selected', selectedIdStrings.includes(String(opt.dataset.value)));
            });
            return;
        }

        // 第一次创建内容
        optionsContainer.innerHTML = '';

        const categories = [...new Set(worldbooks.map(wb => wb.category || '未分类'))];

        categories.forEach(cat => {
            const group = document.createElement('div');
            group.className = 'custom-select-group';

            const header = document.createElement('div');
            header.className = 'custom-select-group-label';
            header.textContent = cat;
            group.appendChild(header);

            worldbooks
                .filter(wb => (wb.category || '未分类') === cat)
                .forEach(wb => {
                    const opt = document.createElement('div');
                    opt.className = 'custom-select-option';
                    opt.dataset.value = wb.id;
                    opt.textContent = wb.title || wb.name || ('世界书 ' + wb.id);

                    if (selectedIdStrings.includes(String(wb.id))) {
                        opt.classList.add('selected');
                    }

                    group.appendChild(opt);
                });

            optionsContainer.appendChild(group);
        });
    });

    if (!found) {
        console.error(`populateCustomSelect: Cannot find any options container for mode "${mode}"`);
    }
}


function toggleCollapse(containerId, forceState) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const shouldOpen = typeof forceState === 'boolean' ? forceState : !container.classList.contains('open');

    if (shouldOpen) {
        container.classList.add('open');
        container.style.maxHeight = container.scrollHeight + 'px';
    } else {
        container.classList.remove('open');
        container.style.maxHeight = '0px';
    }
}
function openWorldbookManager() {
    showToast('管理世界书功能待开发');
}
function toggleWorldbookSection() {
    toggleCollapse('worldbook-collapse-section');
}

function openWorldbookBinder(mode) {
    currentBindingMode = mode; // 记录当前模式
    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai) return;

    const worldbooks = getStorage('ai_worldbooks_v2', []);
    const categories = [...new Set(worldbooks.map(wb => wb.category || '未分类'))];
    const binderBody = document.getElementById('worldbook-binder-body');
    binderBody.innerHTML = ''; // 清空旧内容

    // 获取当前已绑定的ID数组
    let currentBoundIds = (mode === 'online'
        ? (ai.settings?.chatWorldbookIds || [])
        : (ai.settings?.offlineMode?.worldbookIds || []));


    // 按分类渲染世界书列表
    categories.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.innerHTML = `<h4 style="margin: 15px 0 10px 0; font-size:16px; color:#333;">${category}</h4>`;
        
        const wbsInCategory = worldbooks.filter(wb => (wb.category || '未分类') === category);
        wbsInCategory.forEach(wb => {
            const isChecked = currentBoundIds.includes(wb.id);
            categoryDiv.innerHTML += `
                <div class="setting-row" style="align-items: center;">
                    <label style="flex:1;">${wb.name}</label>
                    <input type="checkbox" class="worldbook-checkbox" value="${wb.id}" ${isChecked ? 'checked' : ''}>
                </div>
            `;
        });
        binderBody.appendChild(categoryDiv);
    });

    document.getElementById('worldbook-binder-container').style.display = 'flex';
}

function closeWorldbookBinder() {
    document.getElementById('worldbook-binder-container').style.display = 'none';
}

function saveWorldbookBinding() {
    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai || !currentBindingMode) return;
    
    // 收集所有被选中的checkbox的value
    const selectedIds = Array.from(document.querySelectorAll('#worldbook-binder-body .worldbook-checkbox:checked')).map(cb => cb.value);

    // 根据模式，保存到对应的数据结构中
    if (currentBindingMode === 'online') {
        if (!ai.settings) ai.settings = {};
        ai.settings.chatWorldbookIds = selectedIds; // 使用复数形式
    } else if (currentBindingMode === 'offline') {
        if (!ai.settings.offlineMode) ai.settings.offlineMode = {};
        ai.settings.offlineMode.worldbookIds = selectedIds; // 使用复数形式
    }

    setStorage('ai_list_v2', aiList); // 保存到localStorage
    
    // 更新设置抽屉内的显示
    updateWbDisplay();

    closeWorldbookBinder();
    showToast('世界书绑定已更新');
}

/**
 * 更新设置抽屉里绑定的世界书名称显示
 */
/**
 * 更新设置抽屉里绑定的世界书名称显示
 */
/**
 * 更新设置抽屉里绑定的世界书【数量】显示
 * @param {('online'|'offline')} mode 可选：指定只更新某个模式；不传则两个都更新
 */
function updateWbDisplay(mode) {
    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai) return;

    function renderDisplay(displayId, ids) {
        const displayEl = document.getElementById(displayId);
        if (!displayEl) return; // 防止元素不存在

        if (!ids || ids.length === 0) {
            displayEl.textContent = '未绑定';
            return;
        }

        displayEl.textContent = `已绑定 ${ids.length} 本世界书`;
    }

    // 根据 mode 决定更新哪一块
    if (!mode || mode === 'online') {
        renderDisplay('online-wb-display', ai.settings?.chatWorldbookIds);
    }
    if (!mode || mode === 'offline') {
        const offlineIds = ai.settings?.offlineMode?.worldbookIds;
        renderDisplay('offline-wb-display', offlineIds);
        renderDisplay('offline-wb-display-offline', offlineIds);
    }
}


function openPresetManager(editId = null) {
    // 创建/显示覆盖层与容器
    let overlay = document.getElementById('preset-manager-overlay');
    let container = document.getElementById('preset-manager-modal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'preset-manager-overlay';
        overlay.className = 'modal-overlay active';
        overlay.addEventListener('click', closePresetManager);
        document.body.appendChild(overlay);
    } else {
        overlay.classList.add('active');
    }

    if (!container) {
        container = document.createElement('div');
        container.id = 'preset-manager-modal';
        container.className = 'modal-container active';
        container.innerHTML = `
            <div class="modal-content" style="width: 92%; max-width: 460px; background: #fff; border-radius: 12px;">
                <div class="modal-header" style="padding: 14px 16px; font-weight: 700; border-bottom: 1px solid #e5e5e5; display:flex; justify-content:space-between; align-items:center;">
                    <span>预设管理</span>
                    <button class="close-button" onclick="closePresetManager()" style="background:none; border:none; font-size:20px; cursor:pointer;">×</button>
                </div>
                <div class="modal-body" id="preset-manager-body" style="padding: 16px; max-height: 60vh; overflow:auto;"></div>
                <div class="modal-footer" style="padding: 12px 16px; display:flex; gap:10px; border-top: 1px solid #e5e5e5;">
                    <button class="drawer-button-cancel" onclick="closePresetManager()" style="flex:1;">关闭</button>
                    <button class="btn-primary" onclick="savePreset()" style="flex:1;">保存/更新</button>
                </div>
            </div>`;
        document.body.appendChild(container);
    } else {
        container.classList.add('active');
    }

    // 将当前编辑ID附着在容器上
    container.dataset.editId = editId || '';

    renderPresetManager();
}

function renderPresetManager() {
    const body = document.getElementById('preset-manager-body');
    if (!body) return;

    const presets = getStorage('presets_v1', []);
    const ai = aiList.find(c => c.id == currentChatId);
    const currentPresetId = ai?.settings?.offlineMode?.presetId || '';

    const formHtml = `
        <div class="setting-card" style="margin-bottom:12px;">
            <div class="setting-row">
                <label class="setting-label">新建/编辑预设</label>
            </div>
            <div class="setting-row sub-row">
                <label>名称</label>
                <input id="preset-name" class="neo-input" placeholder="预设名称，如：短篇文风" />
            </div>
            <div class="setting-row sub-row">
                <label>字数</label>
                <div class="word-count-inputs" style="display:flex; align-items:center; gap:8px;">
                    <input type="number" id="preset-min" class="neo-input" style="width:100px;" placeholder="最小" />
                    <span>-</span>
                    <input type="number" id="preset-max" class="neo-input" style="width:100px;" placeholder="最大" />
                    <span>字</span>
                </div>
            </div>
            <div class="setting-row sub-row">
                <label>文风/语气</label>
                <input id="preset-style" class="neo-input" placeholder="如：克制、细腻、轻松、悬疑..." />
            </div>
            <div class="setting-row sub-row">
                <label>附加提示词</label>
                <textarea id="preset-extra" class="neo-input" style="height:100px;" placeholder="为模型追加的额外指令/约束"></textarea>
            </div>
        </div>`;

    const listItems = presets.map(p => `
        <div class="worldbook-bind-item" style="justify-content:space-between;">
            <div style="display:flex; flex-direction:column;">
                <strong>${p.name}</strong>
                <span style="font-size:12px; color:#666;">${(p.wordMin ?? '-')}-${(p.wordMax ?? '-') } 字 · ${p.styleTone || '无文风'}${p.id === currentPresetId ? ' · 已选中' : ''}</span>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="neo-btn-small" onclick="selectPreset('${p.id}')">使用</button>
                <button class="neo-btn-small" onclick="openPresetManager('${p.id}')">编辑</button>
                <button class="neo-btn-small" style="color:var(--heart-color);" onclick="deletePreset('${p.id}')">删除</button>
            </div>
        </div>`).join('');

    const listHtml = `
        <div class="setting-card">
            <div class="setting-row">
                <label class="setting-label">我的预设</label>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${listItems || '<div style="color:#999; text-align:center; padding:10px;">暂无预设，先在上方创建一个</div>'}
            </div>
        </div>`;

    body.innerHTML = formHtml + listHtml;

    // 若是编辑模式，填充到表单
    const container = document.getElementById('preset-manager-modal');
    const editId = container?.dataset?.editId;
    if (editId) {
        const target = presets.find(p => p.id === editId);
        if (target) {
            document.getElementById('preset-name').value = target.name || '';
            document.getElementById('preset-min').value = target.wordMin ?? '';
            document.getElementById('preset-max').value = target.wordMax ?? '';
            document.getElementById('preset-style').value = target.styleTone || '';
            document.getElementById('preset-extra').value = target.extraPrompt || '';
        }
    }
}

function savePreset() {
    const name = document.getElementById('preset-name').value.trim();
    const wordMin = parseInt(document.getElementById('preset-min').value) || null;
    const wordMax = parseInt(document.getElementById('preset-max').value) || null;
    const styleTone = document.getElementById('preset-style').value.trim();
    const extraPrompt = document.getElementById('preset-extra').value.trim();
    if (!name) return showToast('预设名称不能为空');

    const container = document.getElementById('preset-manager-modal');
    const editId = container?.dataset?.editId || '';

    let presets = getStorage('presets_v1', []);
    if (editId) {
        presets = presets.map(p => p.id === editId ? { ...p, name, wordMin, wordMax, styleTone, extraPrompt } : p);
        showToast('预设已更新');
    } else {
        const id = 'pre_' + Date.now();
        presets.push({ id, name, wordMin, wordMax, styleTone, extraPrompt });
        showToast('预设已创建');
    }
    setStorage('presets_v1', presets);
    // 清空编辑态并刷新
    if (container) container.dataset.editId = '';
    renderPresetManager();
}

function deletePreset(id) {
    if (!confirm('确定删除该预设吗？此操作不可恢复')) return;
    let presets = getStorage('presets_v1', []);
    presets = presets.filter(p => p.id !== id);
    setStorage('presets_v1', presets);
    renderPresetManager();
}

function selectPreset(id) {
    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai) return;
    if (!ai.settings) ai.settings = {};
    if (!ai.settings.offlineMode) ai.settings.offlineMode = {};
    ai.settings.offlineMode.presetId = id;
    setStorage('ai_list_v2', aiList);
    updatePresetDisplay();
    showToast('已应用预设');
}

function updatePresetDisplay() {
    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai) return;
    const allPresets = getStorage('presets_v1', []);
    const presetId = ai.settings?.offlineMode?.presetId;
    const name = presetId ? (allPresets.find(p => p.id === presetId)?.name || '未选择') : '未选择';
    const a = document.getElementById('offline-preset-display');
    const b = document.getElementById('offline-preset-display-offline');
    if (a) a.innerText = name;
    if (b) b.innerText = name;
}

function closePresetManager() {
    const overlay = document.getElementById('preset-manager-overlay');
    const container = document.getElementById('preset-manager-modal');
    if (overlay) overlay.remove();
    if (container) container.remove();
}

function saveChatSettings() {
    const isGroup = currentChatType === 'group' && currentGroupId;
    const target = isGroup ? findQqGroupById(currentGroupId) : aiList.find(c => c.id == currentChatId);
    if (!target) return;

    if (!target.settings) target.settings = {};

    const personaSelect = document.getElementById('chat-user-persona-select');
    if (personaSelect) {
        if (isGroup) {
            target.settings.userId = parseInt(personaSelect.value);
        } else {
            target.userId = parseInt(personaSelect.value);
        }
    }
    const timeSwitch = document.getElementById('time-perception-switch');
    if (timeSwitch) {
        target.settings.timePerception = timeSwitch.checked;
    }
    
    const offlineSwitch = document.getElementById('offline-mode-switch');
    if (offlineSwitch) {
        if (!target.settings.offlineMode) target.settings.offlineMode = {};
        target.settings.offlineMode.enabled = offlineSwitch.checked;
    }
    
    if (isGroup) {
        saveQqGroupList();
    } else {
        setStorage('ai_list_v2', aiList);
    }
    closeDrawer('chat-settings-drawer');
    showToast('聊天设置已保存');
    renderMessages();
}
function clearOfflineHistory() {
    if (!currentChatId) {
        showToast('请先在QQ中选择一个角色');
        return;
    }

    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai) return;

    if (ai.offlineHistory && ai.offlineHistory.length > 0) {
        if (!confirm('确定要清空当前线下内容吗？此操作不可恢复。')) return;
    }

    ai.offlineHistory = [];
    setStorage('ai_list_v2', aiList);
    if (typeof renderOfflineMessages === 'function') {
        renderOfflineMessages();
    }
    showToast('当前线下内容已清空');
}

function saveOfflineSettings() {
    const isGroup = currentChatType === 'group' && currentGroupId;
    const target = isGroup ? findQqGroupById(currentGroupId) : aiList.find(c => c.id == currentChatId);
    if (!target) return;

    if (!target.settings) target.settings = {};
    if (!target.settings.offlineMode) target.settings.offlineMode = {};

    if (isGroup) {
        saveQqGroupList();
    } else {
        setStorage('ai_list_v2', aiList);
    }
    closeDrawer('offline-settings-drawer');
    showToast('线下设置已保存');
}

function clearOfflineHistory() {
    if (!currentChatId) {
        showToast('请先在QQ中选择一个角色');
        return;
    }
    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai) return;

    if (ai.offlineHistory && ai.offlineHistory.length > 0) {
        if (!confirm('确定要清空当前线下内容吗？此操作不可恢复。')) return;
    }

    ai.offlineHistory = [];
    setStorage('ai_list_v2', aiList);
    renderOfflineMessages();
    showToast('当前线下内容已清空');
}
  
    function tryClearCurrentChat() {
        if (!confirm('确定清空当前对话的所有记录吗？此操作不可撤销。')) return;
        if (currentChatType === 'group' && currentGroupId) {
            const group = findQqGroupById(currentGroupId);
            if (group) {
                group.history = [];
                saveQqGroupList();
                renderMessages();
                loadChatList();
                showToast('群聊记录已清空');
            }
            closeDrawer('chat-settings-drawer');
            return;
        }
        if (!currentChatId) return;
        const ai = aiList.find(c => c.id == currentChatId);
        if (ai) {
            ai.history = [];
            setStorage('ai_list_v2', aiList);
            renderMessages();
            showToast('聊天记录已清空');
        }
        closeDrawer('chat-settings-drawer');
    }

    function exportCurrentChat() {
        if (!confirm('确定要将当前对话导出为 JSON 文件吗？')) return;
        const isGroup = currentChatType === 'group' && currentGroupId;
        const target = isGroup ? findQqGroupById(currentGroupId) : aiList.find(c => c.id == currentChatId);
        if (!target) return;
        const dataStr = JSON.stringify(target.history || [], null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_${(target.name || '群聊')}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        closeDrawer('chat-settings-drawer');
    }

    function importCurrentChat() {
        document.getElementById('import-chat-input').click();
    }
    document.getElementById('import-chat-input').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        if (!confirm('导入新记录将覆盖当前对话，确认吗？')) {
            event.target.value = ''; return;
        }
        closeDrawer('chat-settings-drawer');
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const newHistory = JSON.parse(e.target.result);
                if (!Array.isArray(newHistory)) throw new Error("文件格式不是有效的对话数组");
                if (currentChatType === 'group' && currentGroupId) {
                    const group = findQqGroupById(currentGroupId);
                    if (!group) throw new Error('未找到当前群聊');
                    group.history = newHistory;
                    saveQqGroupList();
                } else {
                    const ai = aiList.find(c => c.id == currentChatId);
                    ai.history = newHistory;
                    setStorage('ai_list_v2', aiList);
                }
                renderMessages();
                loadChatList();
                showToast('对话导入成功');
            } catch (error) {
                showToast('导入失败: ' + error.message);
            } finally {
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    });

    // =========================================================================
    // ------------ VI. CHAT ADD-ONS (EMOJI & TEXT-TO-IMAGE) ----------------
    // =========================================================================
    
    function toggleToolbar() {
        document.getElementById('chat-toolbar')?.classList.toggle('active');
    }

 function openEmojiManager() {
    window.currentEmojiFilter = 'all'; 
    renderMyEmojis();
    switchEmojiTab('view');
    document.getElementById('emoji-modal-overlay').classList.add('active');
    document.getElementById('emoji-modal-container').classList.add('active');
}

/**
 * 关闭表情管理弹窗
 */
function closeEmojiManager() {
    document.getElementById('emoji-modal-overlay').classList.remove('active');
    document.getElementById('emoji-modal-container').classList.remove('active');
}

/**
 * 切换“我的表情”和“添加表情”页签
 */
function switchEmojiTab(tabName) {
    ['view', 'add'].forEach(tab => {
        document.getElementById(`emoji-tab-${tab}`).classList.toggle('active', tab === tabName);
        document.getElementById(`emoji-${tab}-content`).style.display = tab === tabName ? 'block' : 'none';
    });
}

/**
 * 【核心】发送表情包消息 (类型为 'emoji')
 * @param {string} emojiUrl 表情的链接
 * @param {string} emojiDescription 表情的描述/含义
 */
function sendEmojiMessage(emojiUrl, emojiDescription) {
    const ai = aiList.find(a => a.id == currentChatId);
    if (!ai) return;
    const currentUser = userProfiles.find(p => p.id == ai.userId) || userProfiles[0];

    const message = {
        sender: currentUser.id,
        type: 'emoji',
        url: emojiUrl,
        description: emojiDescription, // 【重要】现在传递的是表情自身的描述
        timestamp: new Date().toISOString()
    };

    addMessage(currentChatId, message);
    renderMessages();
    closeEmojiManager();
    document.getElementById('chat-toolbar')?.classList.remove('active');
    // 已移除自动触发AI回复的功能
}

/**
 * 点击分类按钮时，更新筛选并重新渲染
 */
function filterEmojiCategory(categoryName) {
    window.currentEmojiFilter = categoryName;
    renderMyEmojis();
}

/**
 * 【核心重构】渲染“我的表情”界面
 */
function renderMyEmojis() {
    const displayArea = document.getElementById('emoji-display-area');
    let emojis = getStorage('emojis', []);

    // 数据结构兼容：确保每个表情都有 description 和 category
    emojis.forEach(e => {
        if (!e.description) { e.description = '（无描述）'; }
        if (!e.category) { e.category = '未分类'; }
        if (!e.charIds) { e.charIds = ['all']; }
    });
    setStorage('emojis', emojis);

    // 1. 生成分类筛选按钮
    if (typeof window.currentEmojiFilter === 'undefined') { window.currentEmojiFilter = 'all'; }
    const uniqueCategories = ['all', ...new Set(emojis.map(e => e.category))];
    let filterButtonsHtml = '<div style="margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 8px;">';
    uniqueCategories.forEach(cat => {
        const buttonText = cat === 'all' ? '全部' : cat;
        const isActive = window.currentEmojiFilter === cat;
        const buttonClass = isActive ? 'btn-primary' : 'drawer-button-cancel';
        filterButtonsHtml += `<button class="${buttonClass}" style="padding: 5px 12px; font-size: 13px;" onclick="window.filterEmojiCategory('${cat}')">${buttonText}</button>`;
    });
    filterButtonsHtml += '</div>';

    // 2. 根据筛选器过滤
    const filteredEmojis = window.currentEmojiFilter === 'all' 
        ? emojis 
        : emojis.filter(e => e.category === window.currentEmojiFilter);

    if (emojis.length === 0) {
        displayArea.innerHTML = '<p style="text-align:center; color:#888;">还没有任何表情，快去添加吧~</p>';
        return;
    }

    // 3. 渲染表情网格
    let emojisGridHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 10px;">';
    if (filteredEmojis.length > 0) {
        filteredEmojis.forEach(emoji => {
            // 【重要】onclick现在传递 url 和 description
            emojisGridHtml += `
                <div class="emoji-preview-item" style="cursor: pointer;" onclick="window.sendEmojiMessage('${emoji.url}', '${escapeHTML(emoji.description)}')">
                    <img src="${emoji.url}" alt="${escapeHTML(emoji.description)}" class="emoji-preview-img">
                    <button class="emoji-delete-btn" onclick="event.stopPropagation(); window.deleteEmoji('${emoji.id}')">×</button>
                </div>
            `;
        });
    } else { emojisGridHtml += `<p style="grid-column: 1 / -1; text-align:center; color:#888;">该分类下没有表情</p>`; }
    emojisGridHtml += '</div>';
    
    // 【重要】恢复长按绑定角色的提示
    const hintHtml = '<div style="text-align: left; margin-bottom: 15px; font-size: 13px; color: #888;">提示：长按分类按钮可为该分类绑定角色。</div>';

    displayArea.innerHTML = filterButtonsHtml + hintHtml + emojisGridHtml;
    
    // 【重要】恢复为分类按钮绑定长按事件
    document.querySelectorAll('#emoji-display-area button').forEach(button => {
        // 只为分类按钮绑定，排除删除按钮
        if (button.classList.contains('btn-primary') || button.classList.contains('drawer-button-cancel')) {
            let pressTimer;
            const category = button.innerText === '全部' ? 'all' : button.innerText;
            if (category === 'all') return; // “全部”这个按钮不能绑定

            button.addEventListener('mousedown', () => {
                pressTimer = window.setTimeout(() => openCharacterBinder(category), 600);
            });
            button.addEventListener('mouseup', () => clearTimeout(pressTimer));
            button.addEventListener('mouseleave', () => clearTimeout(pressTimer));
        }
    });
}

/**
 * 【核心重构】保存批量添加的表情，完全按照您的设想
 */
function saveBulkEmojis() {
    const text = document.getElementById('emoji-bulk-input').value.trim();
    if (!text) return showToast('未输入任何内容。');

    const lines = text.split('\n');
    let emojis = getStorage('emojis', []);
    let count = 0;

    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;
        
        const match = trimmedLine.match(/^(.*?)(:|：)(https?:\/\/.+)$/);
        if (match) {
            const description = match[1].trim();
            const url = match[3].trim();
            
            emojis.push({ 
                id: 'emoji_' + Date.now() + count, 
                url: url, 
                description: description, // 存储描述
                category: '未分类', // 默认放入“未分类”
                charIds: ['all'] 
            });
            count++;
        }
    });

    if (count > 0) {
        setStorage('emojis', emojis);
        showToast(`成功导入 ${count} 个表情到“未分类”！`);
        document.getElementById('emoji-bulk-input').value = '';
        renderMyEmojis();
        switchEmojiTab('view');
    } else {
        showToast('未找到有效格式。请输入：表情描述:http://...');
    }
}

/**
 * 删除指定的表情
 */
function deleteEmoji(emojiId) {
    if (!confirm('确定要删除这个表情吗？')) return;
    let emojis = getStorage('emojis', []);
    emojis = emojis.filter(e => e.id !== emojiId);
    setStorage('emojis', emojis);
    renderMyEmojis();
}
function openCharacterBinder(category) {
    let emojis = getStorage('emojis', []);
    // 找到属于该分类的所有表情，以确定当前绑定状态
    const emojisInCategory = emojis.filter(e => e.category === category);
    if (emojisInCategory.length === 0) return; // 如果该分类没表情了，就不打开
    
    const currentBoundIds = emojisInCategory[0].charIds || []; // 以第一个为准

    let optionsHtml = `<label style="display:block; padding: 10px; border-bottom: 1px solid #eee;"><input type="checkbox" value="all" ${currentBoundIds.includes('all') ? 'checked' : ''}> 所有角色通用</label>`;
    aiList.forEach(ai => {
        optionsHtml += `<label style="display:block; padding: 10px; border-bottom: 1px solid #eee;"><input type="checkbox" value="${ai.id}" ${currentBoundIds.includes(ai.id) ? 'checked' : ''}> ${ai.name}</label>`;
    });

    const modalHtml = `
        <div class="action-sheet-modal active" id="binder-modal" style="z-index: 3000;">
            <div class="picker-content dark-modal" style="height: auto; max-height: 70%;">
                <div class="picker-header"><span>为“${category}”分类绑定角色</span></div>
                <div class="modal-scroll-content no-scrollbar" id="binder-options">${optionsHtml}</div>
                <div style="padding: 10px; display: flex; gap: 10px;">
                    <button class="drawer-button-cancel" style="flex:1;" onclick="document.getElementById('binder-modal').remove()">取消</button>
                    <button class="btn-primary" style="flex:1;" onclick="saveCharacterBinding('${category}')">保存</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * 【恢复并强化】保存角色绑定
 */
function saveCharacterBinding(category) {
    const selectedIds = Array.from(document.querySelectorAll('#binder-options input:checked')).map(input => input.value);
    if (selectedIds.length === 0) return showToast('至少选择一个角色或“通用”');
    const finalIds = selectedIds.includes('all') ? ['all'] : selectedIds;
    
    let emojis = getStorage('emojis', []);
    // 将该分类下的所有表情都更新为新的绑定
    emojis.forEach(emoji => {
        if (emoji.category === category) {
            emoji.charIds = finalIds;
        }
    });
    setStorage('emojis', emojis);
    document.getElementById('binder-modal').remove();
    showToast('绑定成功！');
}

function openCategoryEditor() {
    let emojis = getStorage('emojis', []);
    const categories = [...new Set(emojis.map(e => e.category || '未分类'))];
    
    let editorHtml = '';
    categories.forEach(cat => {
        // 【核心修改】移除了 isUncategorized 和 disabled 的逻辑
        editorHtml += `
            <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid #444;">
                <input type="text" class="drawer-input category-editor-input" value="${cat}" data-original-name="${cat}">
                <button class="btn-small" style="background: #ff4757;" onclick="window.deleteCategoryAndEmojis('${cat}')">删除</button>
            </div>
        `;
    });

    const modalHtml = `
        <div class="action-sheet-modal active" id="category-editor-modal" style="z-index: 3000;">
            <div class="picker-content dark-modal" style="height: auto; max-height: 80%;">
                <div class="picker-header"><span>管理分类</span></div>
                <p style="padding:0 15px; color:#888; font-size:13px;">在这里重命名或删除分类。</p>
                <div class="modal-scroll-content no-scrollbar" style="padding: 0 15px;">${editorHtml}</div>
                <div style="padding: 15px; border-top: 1px solid #333; display: flex; gap: 10px;">
                    <button class="drawer-button-cancel" style="flex:1;" onclick="document.getElementById('category-editor-modal').remove()">取消</button>
                     <button class="btn-primary" style="flex:0.8;" onclick="window.addCategory()">新增</button>
                    <button class="btn-primary" style="flex:1;" onclick="window.updateCategories()">保存更改</button>
                </div>
            </div>
        </div>

    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
function updateCategories() {
    let emojis = getStorage('emojis', []);
    const inputs = document.querySelectorAll('.category-editor-input');
    
    inputs.forEach(input => {
        const originalName = input.dataset.originalName;
        const newName = input.value.trim();
        
        // 只有当名字真的被改变时才执行更新
        if (newName && newName !== originalName) {
            // 遍历所有表情，如果分类名匹配，就更新它
            emojis.forEach(emoji => {
                // (emoji.category || '未分类') 确保即使旧数据没有category字段也能匹配上
                if ((emoji.category || '未分类') === originalName) {
                    emoji.category = newName;
                }
            });
        }
    });

    setStorage('emojis', emojis); // 保存更新后的表情列表
    document.getElementById('category-editor-modal').remove(); // 关闭弹窗
    renderMyEmojis(); // 重新渲染表情列表以显示更新
    showToast('分类已更新！');
}

/**
 * 【新】保存分类的重命名
 */
function updateCategories() {
    let emojis = getStorage('emojis', []);
    const inputs = document.querySelectorAll('.category-editor-input');
    
    inputs.forEach(input => {
        const originalName = input.dataset.originalName;
        const newName = input.value.trim();
        
        if (newName && newName !== originalName) {
            // 遍历所有表情，如果分类名匹配，就更新它
            emojis.forEach(emoji => {
                if ((emoji.category || '未分类') === originalName) {
                    emoji.category = newName;
                }
            });
        }
    });

    setStorage('emojis', emojis);
    document.getElementById('category-editor-modal').remove();
    renderMyEmojis(); // 重新渲染以显示更新
    showToast('分类已更新！');
}

  function addCategory() {
    const newCategoryName = prompt("请输入新的分类名称：", "");

    if (!newCategoryName || !newCategoryName.trim()) {
        return; // 用户取消或输入为空
    }

    const trimmedName = newCategoryName.trim();
    let emojis = getStorage('emojis', []);
    const existingCategories = [...new Set(emojis.map(e => e.category || '未分类'))];

    if (existingCategories.includes(trimmedName)) {
        showToast(`分类“${trimmedName}”已存在！`);
        return;
    }

    const tempEmoji = { category: trimmedName };

    document.getElementById('category-editor-modal').remove();
    let existingHtml = document.querySelector("#category-editor-modal .modal-scroll-content").innerHTML;
    existingHtml += `
        <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid #444;">
            <input type="text" class="drawer-input category-editor-input" value="${trimmedName}" data-original-name="${trimmedName}">
            <button class="btn-small" style="background: #ff4757;" onclick="window.deleteCategoryAndEmojis('${trimmedName}')">删除</button>
        </div>
    `;
    document.querySelector("#category-editor-modal .modal-scroll-content").innerHTML = existingHtml;
    showToast(`新分类“${trimmedName}”已添加，请记得点击“保存更改”。`);
}

function deleteCategoryAndEmojis(categoryName) {
    if (!confirm(`确定要删除“${categoryName}”分类及其下的所有表情吗？此操作不可撤销！`)) {
        return;
    }
    
    let emojis = getStorage('emojis', []);
    // 过滤掉所有属于该分类的表情
    const updatedEmojis = emojis.filter(emoji => (emoji.category || '未分类') !== categoryName);
    
    setStorage('emojis', updatedEmojis);
    document.getElementById('category-editor-modal').remove();
    renderMyEmojis(); // 重新渲染
    showToast(`分类“${categoryName}”已删除。`);
}
function addCategory() {
    const newCategoryName = prompt("请输入新的分类名称：", "新分类");
    if (!newCategoryName || !newCategoryName.trim()) {
        return; // 用户取消或输入为空
    }

    const trimmedName = newCategoryName.trim();
    let emojis = getStorage('emojis', []);
    const existingCategories = [...new Set(emojis.map(e => e.category || '未分类'))];

    if (existingCategories.includes(trimmedName)) {
        showToast(`分类“${trimmedName}”已存在！`);
        return;
    }

    // 找到一个“未分类”的表情，用于移动到新分类下
    const emojiToMove = emojis.find(e => (e.category || '未分类') === '未分类');

    if (!emojiToMove) {
        showToast('无法创建新分类： “未分类”中没有可移动的表情。');
        return;
    }

    // 将这个表情的分类修改为新的分类名
    emojiToMove.category = trimmedName;
    setStorage('emojis', emojis);

    // 关闭当前弹窗并重新打开，以刷新列表
    document.getElementById('category-editor-modal').remove();
    openCategoryEditor();
    showToast(`分类“${trimmedName}”创建成功！`);
}
function openT2IModal() {
    // 同时激活遮罩层和内容容器
    document.getElementById('t2i-modal-overlay').classList.add('active');
    document.getElementById('t2i-modal-container').classList.add('active');
}

function closeT2IModal() {
    // 同时移除遮罩层和内容容器的激活状态
    document.getElementById('t2i-modal-overlay').classList.remove('active');
    document.getElementById('t2i-modal-container').classList.remove('active');
}

    function sendDescribedImage() {
        const description = document.getElementById('t2i-prompt-input').value.trim();
        if (!description) return showToast('请先描述你的想象！');
        const ai = aiList.find(a => a.id == currentChatId);
        const currentUser = userProfiles.find(p => p.id == ai.userId) || userProfiles[0];
        addMessage(currentChatId, { sender: currentUser.id, type: 'image_card', description, timestamp: new Date().toISOString() });
        renderMessages();
        document.getElementById('t2i-prompt-input').value = '';
        closeT2IModal();
         document.getElementById('chat-toolbar')?.classList.remove('active');
    }
    
    // 省略7, 8, 9, 10, 11, 12, 13大章节，因为它们在上面已经写过了，这里只是为了展示插入位置
    // ... (VII. WORLDBOOK, VIII. ANNIVERSARY, IX. CLOCK, X. CHAR MGMT, XI. APPEARANCE, XII. SETTINGS)
    // 这里的省略是为了代码简洁，实际替换时，上面那些章节都包含在内
    
    // =========================================================================
    // ---------------------- X. CHARACTER & USER MANAGEMENT -----------------------
    // =========================================================================

        window.openQqCreateMenu = function () {
        document.getElementById('add-character-modal').classList.add('active');
    };
 
    window.openAddCharacterModal = function () {
        window.openQqCreateMenu();
    };
     
    window.closeAddCharacterModal = function () {
        document.getElementById('add-character-modal').classList.remove('active');
    };

    window.createDefaultQqGroup = function () {
        closeAddCharacterModal();
        const defaultMembers = [];
        if (userProfiles[0]) {
            defaultMembers.push({ type: 'user', id: userProfiles[0].id });
        }
        if (aiList[0]) {
            defaultMembers.push({ type: 'ai', id: aiList[0].id });
        }
        const group = createQqGroup(defaultMembers, {
            name: '蛋壳小集体',
            avatar: DEFAULT_AI_AVATAR_URL,
            settings: {
                userId: userProfiles[0]?.id || null,
                offlineMode: { worldbookIds: [], presetId: '' }
            }
        });
        loadChatList();
        openGroupChat(group.id);
        showToast('群聊已创建');
    }

    function closeGroupOverlay(modalId) {
        const overlay = document.getElementById(modalId);
        if (overlay) overlay.remove();
    }

    function openGroupMembersManager() {
        if (!(currentChatType === 'group' && currentGroupId)) {
            showToast('当前不是群聊，无法修改群成员');
            return;
        }
        const group = findQqGroupById(currentGroupId);
        if (!group) {
            showToast('未找到当前群聊');
            return;
        }

        const memberKeys = new Set((group.members || []).map(m => normalizeQqGroupMemberKey(m)));

        const overlay = document.createElement('div');
        overlay.id = 'group-members-modal';
        overlay.className = 'action-sheet-modal active';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeGroupOverlay('group-members-modal');
        });

        const content = document.createElement('div');
        content.className = 'picker-content';

        const userItems = (userProfiles || []).map(u => {
            const key = normalizeQqGroupMemberKey({ type: 'user', id: u.id });
            const checked = memberKeys.has(key) ? 'checked' : '';
            return `
                <li class="picker-item" style="display:flex; justify-content:space-between; align-items:center;">
                    <span>${escapeHTML(u.name)}</span>
                    <input type="checkbox" class="group-member-checkbox" data-gmember="1" data-type="user" data-id="${u.id}" ${checked}>
                </li>`;
        }).join('');

        const aiItems = (aiList || []).map(a => {
            const key = normalizeQqGroupMemberKey({ type: 'ai', id: a.id });
            const checked = memberKeys.has(key) ? 'checked' : '';
            const displayName = a.showNickname && a.nickname ? a.nickname : a.name;
            return `
                <li class="picker-item" style="display:flex; justify-content:space-between; align-items:center;">
                    <span>${escapeHTML(displayName)}</span>
                    <input type="checkbox" class="group-member-checkbox" data-gmember="1" data-type="ai" data-id="${a.id}" ${checked}>
                </li>`;
        }).join('');

        content.innerHTML = `
            <div class="picker-header"><span>修改群聊成员</span></div>
            <div class="modal-scroll-content no-scrollbar" style="max-height:50vh; overflow:auto;">
                <div style="padding:8px 15px; font-size:13px; color:#999;">勾选要加入群聊的成员</div>
                <ul class="picker-list">
                    <li class="picker-item" style="font-weight:bold; font-size:14px;">我的角色</li>
                    ${userItems || '<li class="picker-item" style="color:#999;">暂无用户角色</li>'}
                    <li class="picker-item" style="font-weight:bold; font-size:14px;">AI 角色</li>
                    ${aiItems || '<li class="picker-item" style="color:#999;">暂无 AI 角色</li>'}
                </ul>
            </div>
            <div style="display:flex; padding:10px 15px; gap:10px; border-top:1px solid #eee;">
                <button class="drawer-button-cancel" style="flex:1;" onclick="closeGroupOverlay('group-members-modal')">取消</button>
                <button class="btn-primary" id="group-members-save-btn" style="flex:1;">保存</button>
            </div>
        `;

        overlay.appendChild(content);
        document.body.appendChild(overlay);

        const saveBtn = document.getElementById('group-members-save-btn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const checkboxes = document.querySelectorAll('input.group-member-checkbox[data-gmember="1"]');
                const newMembers = [];
                let selectedUserIds = [];
                checkboxes.forEach(cb => {
                    if (cb.checked) {
                        const type = cb.getAttribute('data-type');
                        const id = cb.getAttribute('data-id');
                        if (type === 'user') selectedUserIds.push(id);
                        newMembers.push({ type, id });
                    }
                });

                if (newMembers.length === 0) {
                    showToast('群聊至少需要一名成员');
                    return;
                }

                // 确保至少有一个用户角色存在
                if (selectedUserIds.length === 0 && userProfiles[0]) {
                    const fallbackId = String(userProfiles[0].id);
                    newMembers.push({ type: 'user', id: fallbackId });
                    selectedUserIds.push(fallbackId);
                }

                group.members = newMembers;

                // 同步当前使用的用户角色
                if (!group.settings) group.settings = {};
                if (!selectedUserIds.includes(String(group.settings.userId))) {
                    group.settings.userId = parseInt(selectedUserIds[0]);
                }

                saveQqGroupList();
                loadChatList();
                closeGroupOverlay('group-members-modal');
                showToast('群成员已更新');
            };
        }
    }

    function promptRenameCurrentGroup() {
        if (!(currentChatType === 'group' && currentGroupId)) {
            showToast('当前不是群聊，无法修改群名');
            return;
        }
        const group = findQqGroupById(currentGroupId);
        if (!group) {
            showToast('未找到当前群聊');
            return;
        }
        const newName = prompt('请输入新的群聊名称：', group.name || '蛋壳小集体');
        if (!newName || !newName.trim()) return;
        group.name = newName.trim();
        saveQqGroupList();
        loadChatList();
        const titleEl = document.getElementById('chat-title');
        if (titleEl && currentChatType === 'group' && currentGroupId === group.id) {
            titleEl.innerText = group.name;
        }
        showToast('群聊名称已更新');
    }

    function openGroupTitlesManager() {
        if (!(currentChatType === 'group' && currentGroupId)) {
            showToast('当前不是群聊，无法设置称号');
            return;
        }
        const group = findQqGroupById(currentGroupId);
        if (!group) {
            showToast('未找到当前群聊');
            return;
        }
        const members = group.members || [];
        if (members.length === 0) {
            showToast('群内暂无成员');
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'group-titles-modal';
        overlay.className = 'action-sheet-modal active';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeGroupOverlay('group-titles-modal');
        });

        function resolveMemberLabel(m) {
            if (m.type === 'user') {
                const u = userProfiles.find(p => String(p.id) === String(m.id));
                return u ? `我 · ${u.name}` : `用户 ${m.id}`;
            }
            if (m.type === 'ai') {
                const a = aiList.find(x => String(x.id) === String(m.id));
                if (!a) return `角色 ${m.id}`;
                const displayName = a.showNickname && a.nickname ? a.nickname : a.name;
                return `AI · ${displayName}`;
            }
            return `${m.type || '成员'} ${m.id}`;
        }

        const rowsHtml = members.map(m => {
            const title = getQqGroupMemberTitle(group, m) || '';
            const label = resolveMemberLabel(m);
            const keyType = m.type || 'ai';
            const keyId = m.id;
            return `
                <li class="picker-item" style="display:flex; flex-direction:column; align-items:flex-start; gap:6px;">
                    <div style="font-size:14px;">${escapeHTML(label)}</div>
                    <input type="text" class="group-title-input" data-gtitle="1" data-type="${keyType}" data-id="${keyId}"
                        value="${escapeHTML(title)}" placeholder="为该成员设置一个称号（可留空）"
                        style="width:100%; padding:6px 10px; border-radius:8px; border:1px solid #ddd; font-size:13px;" />
                </li>`;
        }).join('');

        const content = document.createElement('div');
        content.className = 'picker-content';
        content.innerHTML = `
            <div class="picker-header"><span>设置群聊称号</span></div>
            <div class="modal-scroll-content no-scrollbar" style="max-height:50vh; overflow:auto;">
                <ul class="picker-list">
                    ${rowsHtml}
                </ul>
            </div>
            <div style="display:flex; padding:10px 15px; gap:10px; border-top:1px solid #eee;">
                <button class="drawer-button-cancel" style="flex:1;" onclick="closeGroupOverlay('group-titles-modal')">取消</button>
                <button class="btn-primary" id="group-titles-save-btn" style="flex:1;">保存</button>
            </div>
        `;

        overlay.appendChild(content);
        document.body.appendChild(overlay);

        const saveBtn = document.getElementById('group-titles-save-btn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const inputs = document.querySelectorAll('input.group-title-input[data-gtitle="1"]');
                inputs.forEach(ip => {
                    const type = ip.getAttribute('data-type');
                    const id = ip.getAttribute('data-id');
                    const text = ip.value || '';
                    setQqGroupMemberTitle(currentGroupId, { type, id }, text);
                });
                saveQqGroupList();
                closeGroupOverlay('group-titles-modal');
                renderMessages();
                showToast('群聊称号已更新');
            };
        }
    }
 
    // 暴露群聊相关管理函数给全局，供内联 onclick 调用
    window.openGroupMembersManager = openGroupMembersManager;
    window.promptRenameCurrentGroup = promptRenameCurrentGroup;
    window.openGroupTitlesManager = openGroupTitlesManager;
    window.closeGroupOverlay = closeGroupOverlay;
 
    function handleCharacterImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        closeAddCharacterModal();
        
        const reader = new FileReader();

        if (file.type === 'image/png') {
            reader.onload = e => {
                try {
                    const data = atob(e.target.result.substring(e.target.result.indexOf(',') + 1));
                    const characterDataMatch = data.match(/chara_data=([\s\S]+)/);
                    if (!characterDataMatch) throw new Error('未在PNG中找到角色数据。');
                    
                    const charDataJson = atob(characterDataMatch[1]);
                    const charData = JSON.parse(charDataJson);

                    let newWorldbookId = 'none';
                // 检查卡片数据中是否包含世界书内容 (常见的字段是 character_book)
                const worldBookText = charData.character_book;

                if (worldBookText && worldBookText.trim()) {
                    const worldbooks = getStorage('worldbooks', []); 
                    const newWb = {
                        id: 'wb_' + Date.now(),
                        name: `[导入] ${charData.name || '角色'}的世界书`,
                        content: worldBookText,
                        category: '导入'
                    };
                    worldbooks.unshift(newWb);
                    setStorage('worldbooks', worldbooks);
                    newWorldbookId = newWb.id;
                    showToast('成功导入并关联了世界书！');
                }
                    
                    const newChar = {
                        id: Date.now(),
                        name: charData.name || '导入的角色',
                        avatar: e.target.result, // Use the PNG itself as avatar
                        prompt: charData.description || '',
                        history: [],
                        userId: userProfiles[0]?.id,
                        settings: {
                            timePerception: false,
                           chatWorldbookId: newWorldbookId,
                        offlineMode: { enabled: false, wordCountMin: 500, wordCountMax: 1500, worldbookId: 'none' }
                    }
                    };
                    aiList.unshift(newChar);
                    setStorage('ai_list_v2', aiList);
                    loadChatList();
                    showToast(`角色 ${newChar.name} 导入成功！`);

                } catch (err) {
                    showToast('PNG角色卡解析失败: ' + err.message);
                } finally {
                    event.target.value = '';
                }
            };
            reader.readAsDataURL(file);
        } else if (file.type === 'application/json') {
            reader.onload = e => {
                try {
                    const charData = JSON.parse(e.target.result);
                    const newChar = {
                        id: Date.now(),
                        name: charData.name || '导入的角色',
                        avatar: sanitizeAvatar(charData.avatar || DEFAULT_AI_AVATAR_URL),
                        prompt: charData.description || '',
                        history: [],
                        userId: userProfiles[0]?.id,
                        settings: charData.settings || {
                            timePerception: false,
                            chatWorldbookId: 'none',
                            offlineMode: { enabled: false, wordCountMin: 500, wordCountMax: 1500, worldbookId: 'none' }
                        }
                    };

                    if (charData.worldbook) {
                        const newWb = { id: Date.now() + 1, ...charData.worldbook };
                        worldbooks.unshift(newWb);
                        setStorage('ai_worldbooks_v2', worldbooks);
                        newChar.settings.chatWorldbookId = newWb.id;
                        showToast('同时导入了绑定的世界书！');
                    }

                    aiList.unshift(newChar);
                    setStorage('ai_list_v2', aiList);
                    loadChatList();
                    showToast(`角色 ${newChar.name} 导入成功！`);
                } catch(err) {
                    showToast('JSON角色卡解析失败: ' + err.message);
                } finally {
                    event.target.value = '';
                }
            };
            reader.readAsText(file);
        } else {
            showToast('不支持的文件格式。');
            event.target.value = '';
        }
    }
    

    // =========================================================================
    // --------------------------- VII. WORLDBOOK APP ----------------------------
    // =========================================================================
    
    function renderWbCategories() {
        const catContainer = document.getElementById('wb-category-list');
        catContainer.innerHTML = '';
        const categories = ['全部', ...new Set(worldbooks.map(w => w.category || '未分类'))];
        categories.forEach(cat => {
            const tab = document.createElement('div');
            tab.className = `wb-cat-tab ${cat === currentWbCat ? 'active' : ''}`;
            tab.innerText = cat;
            tab.onclick = () => {
                currentWbCat = cat;
                renderWbCategories();
                renderWbList();
            };
            catContainer.appendChild(tab);
        });
    }
function openTransferActionSheet(messageId) {
    document.getElementById('current-transfer-message-id').value = messageId;
    document.getElementById('transfer-action-sheet').classList.add('active');
}

// 2. 关闭操作菜单
function closeTransferActionSheet() {
    document.getElementById('transfer-action-sheet').classList.remove('active');
}

// 3. 确认收款
function acceptTransfer() {
    const messageId = document.getElementById('current-transfer-message-id').value;
    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai || !messageId) return;

    const message = ai.history.find(m => m.id === messageId);
    if (message) {
        message.status = 'accepted'; // 修改状态
        setStorage('ai_list_v2', aiList); // 保存
        renderMessages(); // 刷新界面
    }
    closeTransferActionSheet();
}

// 4. 拒绝收款
function rejectTransfer() {
    const messageId = document.getElementById('current-transfer-message-id').value;
    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai || !messageId) return;

    const message = ai.history.find(m => m.id === messageId);
    if (message) {
        message.status = 'rejected'; // 修改状态
        setStorage('ai_list_v2', aiList); // 保存
        renderMessages(); // 刷新界面
    }
    closeTransferActionSheet();
}
    function renderWbList() {
        const listContainer = document.getElementById('wb-list');
        listContainer.innerHTML = '';
        let filtered = worldbooks;
        if (currentWbCat !== '全部') filtered = worldbooks.filter(w => (w.category || '未分类') === currentWbCat);

        if (filtered.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; padding:40px; color:#999; font-size:14px; font-weight:bold;">还没有世界书<br>点击右上角 \'+\' 创建一本吧</div>';
            return;
        }
        filtered.forEach(wb => {
            const card = document.createElement('div');
            card.className = 'neo-card';
            card.onclick = () => openWbDrawer(wb.id);
            const keywordsPreview = wb.entries.map(e => e.keyword).slice(0, 5).join(', ') + (wb.entries.length > 5 ? '...' : '');
            card.innerHTML = `<div style="font-size:16px; font-weight:bold; margin-bottom:8px;">${wb.name}</div><div style="font-size:13px; color:#666; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${keywordsPreview || '暂无条目'}</div>`;
            listContainer.appendChild(card);
        });
    }

    function openWbDrawer(editId = null) {
        currentEditWbId = editId;
        const editorContainer = document.getElementById('wb-entry-list-editor');
        if (editId) {
            const wb = worldbooks.find(w => w.id === editId);
            document.getElementById('drawer-wb-title').innerText = '编辑世界书';
            document.getElementById('wb-book-name').value = wb.name;
            document.getElementById('wb-category').value = wb.category || '';
            editorContainer.innerHTML = '';
            wb.entries.forEach(entry => addWbEntryForm(entry.keyword, entry.content));
            document.getElementById('wb-delete-btn').style.display = 'block';
        } else {
            document.getElementById('drawer-wb-title').innerText = '新建世界书';
            document.getElementById('wb-book-name').value = '';
            document.getElementById('wb-category').value = currentWbCat !== '全部' ? currentWbCat : '';
            editorContainer.innerHTML = '';
            addWbEntryForm(); // Add one blank entry
            document.getElementById('wb-delete-btn').style.display = 'none';
        }
        openDrawer('drawer-wb');
    }

    function addWbEntryForm(keyword = '', content = '') {
        const editorContainer = document.getElementById('wb-entry-list-editor');
        const entryDiv = document.createElement('div');
        entryDiv.className = 'wb-entry-item';
       entryDiv.innerHTML = `
        <button class="wb-entry-delete-btn" onclick="this.parentElement.remove()">×</button>
        <input type="text" class="neo-input entry-keyword" placeholder="条目名称 (标题)" value="${escapeHTML(keyword)}">
        <textarea class="neo-input entry-content" placeholder="输入你需要设定的提示词内容...">${escapeHTML(content)}</textarea>
    `;
        editorContainer.appendChild(entryDiv);
    }

    function saveWb() {
        const name = document.getElementById('wb-book-name').value.trim();
        const category = document.getElementById('wb-category').value.trim() || '未分类';
        if (!name) return showToast('世界书名字不能为空');

        const entries = [];
        document.querySelectorAll('#wb-entry-list-editor .wb-entry-item').forEach(item => {
            const keyword = item.querySelector('.entry-keyword').value.trim();
            const content = item.querySelector('.entry-content').value.trim();
            if (keyword && content) {
                entries.push({ keyword, content });
            }
        });

        if (currentEditWbId) {
            const wb = worldbooks.find(w => w.id === currentEditWbId);
            wb.name = name;
            wb.category = category;
            wb.entries = entries;
        } else {
            worldbooks.unshift({ id: Date.now(), name, category, entries });
        }
        setStorage('ai_worldbooks_v2', worldbooks);
        closeDrawer('drawer-wb');
        renderWbCategories();
        renderWbList();
        showToast('世界书已保存');
    }

    function deleteWb() {
        if (!confirm('确定要删除这本世界书及其所有条目吗？')) return;
        worldbooks = worldbooks.filter(w => w.id !== currentEditWbId);
        setStorage('ai_worldbooks_v2', worldbooks);
        closeDrawer('drawer-wb');
        renderWbCategories();
        renderWbList();
        showToast('已删除');
    }


    // =========================================================================
    // ------------------------- VIII. ANNIVERSARY APP --------------------------
    // =========================================================================

    function loadAnniversaryData() {
        anniversaryData = getStorage('danke_anniversary_data', []);
    }
 
    function saveAnniversaryData() {
        setStorage('danke_anniversary_data', anniversaryData);
    }
 
    function renderAnniversaryList() {
        const ul = document.getElementById('anniversary-list-ul');
        ul.innerHTML = '';
        if (anniversaryData.length === 0) {
            ul.innerHTML = `<div style="text-align:center; padding:40px; color:#999;">点击右上角 '+' 创建你的第一个纪念日</div>`;
            return;
        }
 
        const today = new Date();
        today.setHours(0, 0, 0, 0);
 
        const selectedId = getStorage('danke_anniversary_widget_id', null);
 
        anniversaryData.forEach(item => {
            const targetDate = new Date(item.date);
            targetDate.setHours(0, 0, 0, 0);
 
            const diffTime = targetDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
 
            let countdownHTML;
            if (diffDays > 0) {
                countdownHTML = `<div class="anniversary-countdown"><span class="anniversary-label">还有</span><div class="anniversary-days">${diffDays}</div><span class="anniversary-label">天</span></div>`;
            } else if (diffDays === 0) {
                countdownHTML = `<div class="anniversary-countdown"><div class="anniversary-days" style="color:var(--heart-color);">就是今天</div></div>`;
            } else {
                countdownHTML = `<div class="anniversary-countdown"><span class="anniversary-label">已过去</span><div class="anniversary-days">${Math.abs(diffDays)}</div><span class="anniversary-label">天</span></div>`;
            }
 
            const isSelected = selectedId === item.id;
            const selectedTag = isSelected
                ? `<span style="font-size:11px; color:var(--heart-color); margin-left:6px;">(首页组件)</span>`
                : '';
 
            const li = document.createElement('li');
            li.className = 'anniversary-item-wrapper';
            li.innerHTML = `
                <div class="anniversary-item-actions">
                    <button class="edit-btn" onclick="openAnniversaryCreator(${item.id})">编辑</button>
                    <button class="delete-btn" onclick="deleteAnniversary(${item.id})">删除</button>
                    <button class="edit-btn" onclick="setAnniversaryWidget(${item.id})">设为图片组件</button>
                </div>
                <div class="anniversary-item">
                    <span class="anniversary-title">${item.title}</span>${selectedTag}
                    ${countdownHTML}
                </div>
            `;
            ul.appendChild(li);
 
            const itemDiv = li.querySelector('.anniversary-item');
            let startX;
            itemDiv.addEventListener('touchstart', e => {
                document.querySelectorAll('.anniversary-item.swiped').forEach(swiped => swiped.classList.remove('swiped'));
                startX = e.touches[0].clientX;
            }, { passive: true });
            itemDiv.addEventListener('touchmove', e => {
                if (!startX || Math.abs(e.touches[0].clientY - e.touches[0].clientY) > Math.abs(e.touches[0].clientX - startX)) return;
                if (e.touches[0].clientX - startX < -20) e.preventDefault();
            }, { passive: false });
            itemDiv.addEventListener('touchend', e => {
                if (!startX) return;
                let deltaX = e.changedTouches[0].clientX - startX;
                if (deltaX < -60) itemDiv.classList.add('swiped');
                else if (deltaX > 20) itemDiv.classList.remove('swiped');
                startX = null;
            }, { passive: true });
        });
    }
 
    function updateAnniversaryWidgetDisplay() {
        const widget = document.getElementById('photo-widget');
        const titleEl = document.getElementById('anniv-main-title');
        const daysEl = document.getElementById('anniv-main-days');
        const subEl = document.getElementById('anniv-main-sub');

        if (!widget || !titleEl || !daysEl || !subEl) return;

        // 允许在纪念日 App 中自定义首页纪念日组件的样式
        // 存储 key: danke_anniv_widget_style_v1
        // 结构示例：{
        //   titleColor: '#000000',
        //   titleFontSize: '14px',
        //   statusColor: '#000000',
        //   statusFontSize: '20px',
        //   subColor: '#333333',
        //   subFontSize: '12px',
        //   bgColor: '#ffffff',
        //   bgImageData: 'data:image/png;base64,...'
        // }
        const styleConfig = getStorage('danke_anniv_widget_style_v1', null) || {};

        // 确保无论全局 CSS 怎么改，这里都强制把纪念日组件的文字样式拉回可见状态
        const resetWidgetStyles = () => {
            // 组件整体布局：垂直方向居中，稍微上下留白
            widget.style.display = 'flex';
            widget.style.flexDirection = 'column';
            widget.style.alignItems = 'flex-start';
            widget.style.justifyContent = 'center';
            widget.style.paddingTop = styleConfig.paddingTop || '10px';
            widget.style.paddingBottom = styleConfig.paddingBottom || '10px';

            // 背景优先级：图片 > 纯色 > 保持默认玻璃背景
            if (styleConfig.bgImageData) {
                widget.style.backgroundImage = `url(${styleConfig.bgImageData})`;
                widget.dataset.keepBg = 'true';
            } else if (styleConfig.bgColor) {
                widget.style.backgroundImage = 'none';
                widget.style.backgroundColor = styleConfig.bgColor;
                widget.dataset.keepBg = 'true';
            } else {
                // 没有定制背景时，避免被其它全局 CSS 覆盖成不透明图片
                if (!widget.dataset.keepBg) {
                    widget.style.backgroundImage = 'none';
                }
            }

            // 标题行样式（第一行：【标题】）
            const titleFontSize = styleConfig.titleFontSize || '14px';
            const titleColor = styleConfig.titleColor || '#000000';
            titleEl.style.fontSize = titleFontSize;
            titleEl.style.fontWeight = '600';
            titleEl.style.color = titleColor;
            titleEl.style.opacity = '1';

            // 状态行样式（第二行：已过去X天 / 就是今天 / 还有X天）
            const statusFontSize = styleConfig.statusFontSize || '20px';
            const statusColor = styleConfig.statusColor || '#000000';
            daysEl.style.fontSize = statusFontSize;
            daysEl.style.fontWeight = '600';
            daysEl.style.color = statusColor;
            daysEl.style.opacity = '1';

            // 第三行目前作为预留，文本通常置空，但仍允许自定义样式
            const subFontSize = styleConfig.subFontSize || '12px';
            const subColor = styleConfig.subColor || '#333333';
            subEl.style.fontSize = subFontSize;
            subEl.style.color = subColor;
            subEl.style.opacity = '0.85';

            widget.style.textAlign = 'left';
        };

        resetWidgetStyles();

        // 从本地存储读取当前选中的纪念日 ID，兼容旧版本里可能存成字符串的情况
        const selectedIdRaw = getStorage('danke_anniversary_widget_id', null);
        if (selectedIdRaw == null || selectedIdRaw === '') {
            titleEl.innerText = '纪念日';
            daysEl.innerText = '-- 天';
            subEl.innerText = '在纪念日 App 中设置你的重要日子';
            return;
        }

        // 确保内存中的列表数据已加载
        if (!anniversaryData || anniversaryData.length === 0) {
            loadAnniversaryData();
        }

        // 统一把 ID 转成字符串再比较，避免 number / string 类型不一致导致匹配失败
        const selectedId = String(selectedIdRaw);
        const item = anniversaryData.find(i => String(i.id) === selectedId);
        if (!item) {
            // 已保存的 ID 在列表中不存在，回退到默认文案
            setStorage('danke_anniversary_widget_id', null);
            titleEl.innerText = '纪念日';
            daysEl.innerText = '-- 天';
            subEl.innerText = '在纪念日 App 中设置你的重要日子';
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(item.date);
        targetDate.setHours(0, 0, 0, 0);

        const diffTime = targetDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // 第一行：用【】包裹标题
        const titleLine = `【${item.title}】`;

        // 第二行：状态句式
        let statusLine;
        if (diffDays > 0) {
            statusLine = `还有 ${diffDays} 天`;
        } else if (diffDays === 0) {
            statusLine = '就是今天';
        } else {
            const past = Math.abs(diffDays);
            statusLine = `已过去 ${past} 天`;
        }

        titleEl.innerText = titleLine;
        daysEl.innerText = statusLine;
        // 现在把第三行收空，避免画面太挤；如果以后需要可以在这里放额外文案
        subEl.innerText = '';
    }
function setAnniversaryWidget(id) {
        loadAnniversaryData();
        const item = anniversaryData.find(i => i.id === id);
        if (!item) {
            showToast('未找到对应的纪念日');
            return;
        }
        setStorage('danke_anniversary_widget_id', id);
        updateAnniversaryWidgetDisplay();
        showToast('已设置为首页纪念日组件');
    }
function openTransferPopup() {
    document.getElementById('transfer-popup-wrapper').style.display = 'flex';
}

// 2. 关闭弹窗的函数
function closeTransferPopup() {
    document.getElementById('transfer-popup-wrapper').style.display = 'none';
}

// 3. 发送转账数据的函数
function sendTransferPopupData() {
    const amountInput = document.getElementById('transfer-popup-amount');
    const remarkInput = document.getElementById('transfer-popup-remark');
    const amount = parseFloat(amountInput.value);

    if (isNaN(amount) || amount <= 0) {
        showToast('请输入有效的转账金额');
        return;
    }
    
    const remark = remarkInput.value.trim();
    const ai = aiList.find(a => a.id == currentChatId);
    if (!ai) return;
    const currentUser = userProfiles.find(p => p.id == ai.userId) || userProfiles[0];

    const transferMessage = {
        sender: currentUser.id,
        type: 'transfer',
        amount: amount.toFixed(2),
        remark: remark || '转账',
        status: 'pending',
        timestamp: new Date().toISOString()
    };

    addMessage(currentChatId, transferMessage);
    
    amountInput.value = '';
    remarkInput.value = '';
    closeTransferPopup();
    renderMessages();
}

    function openAnniversaryCreator(editId = null) {
        currentEditAnniversaryId = editId;
        openPage('anniversary-creator-page');

        const titleInput = document.getElementById('anniversary-title-input');
        const yearSelect = document.getElementById('anniversary-year-select');
        const monthSelect = document.getElementById('anniversary-month-select');
        const daySelect = document.getElementById('anniversary-day-select');
        const creatorTitle = document.getElementById('anniversary-creator-title');

        yearSelect.innerHTML = '';
        const currentYear = new Date().getFullYear();
        for (let y = currentYear - 50; y <= currentYear + 50; y++) {
            yearSelect.add(new Option(y + '年', y));
        }
        monthSelect.innerHTML = '';
        for (let m = 1; m <= 12; m++) {
            monthSelect.add(new Option(m + '月', m));
        }

        const populateDays = () => {
            const year = parseInt(yearSelect.value);
            const month = parseInt(monthSelect.value);
            const daysInMonth = new Date(year, month, 0).getDate();
            const currentDay = daySelect.value ? parseInt(daySelect.value) : 1;
            daySelect.innerHTML = '';
            for (let d = 1; d <= daysInMonth; d++) {
                daySelect.add(new Option(d + '日', d));
            }
            daySelect.value = Math.min(currentDay, daysInMonth);
        };

        yearSelect.onchange = populateDays;
        monthSelect.onchange = populateDays;

        if (editId) {
            creatorTitle.innerText = "编辑纪念日";
            const item = anniversaryData.find(i => i.id === editId);
            titleInput.value = item.title;
            const date = new Date(item.date);
            yearSelect.value = date.getUTCFullYear();
            monthSelect.value = date.getUTCMonth() + 1;
            populateDays();
            daySelect.value = date.getUTCDate();
        } else {
            creatorTitle.innerText = "创建纪念日";
            titleInput.value = '';
            const today = new Date();
            yearSelect.value = today.getFullYear();
            monthSelect.value = today.getMonth() + 1;
            populateDays();
            daySelect.value = today.getDate();
        }
    }
function openVoiceModal() {
    const overlay = document.getElementById('voice-modal-overlay');
    const container = document.getElementById('voice-modal-container');

    // 先让元素可见，再触发透明度动画
    overlay.style.display = 'block';
    container.style.display = 'flex';

    // 使用一个极小的延迟来确保display属性先生效
    setTimeout(() => {
        overlay.classList.add('active');
        container.classList.add('active');
    }, 10);
}

function closeVoiceModal() {
    const overlay = document.getElementById('voice-modal-overlay');
    const container = document.getElementById('voice-modal-container');

    // 先触发透明度动画
    overlay.classList.remove('active');
    container.classList.remove('active');

    // 在动画结束后，再彻底隐藏元素
    setTimeout(() => {
        overlay.style.display = 'none';
        container.style.display = 'none';
    }, 300); // 这个时间应该和你的CSS transition时间匹配
}
function sendVoiceMessage() {
    // 1. 获取弹窗里的输入内容
    const text = document.getElementById('voice-text-input').value.trim();
    const tone = document.getElementById('voice-tone-input').value.trim();

    // 2. 检查内容是否为空
    if (!text) {
        showToast('请输入你想说的话'); // 调用您已有的提示函数
        return;
    }

    // 3. 根据文本长度，简单计算一个语音时长
    const duration = Math.max(1, Math.round(text.length / 5)); // 每5个字算1秒，最少1秒

    // 4. 找到当前聊天对象和用户
    const ai = aiList.find(a => a.id == currentChatId);
    if (!ai) return;
    const currentUser = userProfiles.find(p => p.id == ai.userId) || userProfiles[0];

    // 5. 创建一个新的“语音消息”对象
    const voiceMessage = {
        sender: currentUser.id,
        type: 'voice',       //  <-- 类型是 'voice'
        text: text,          //  <-- 语音识别出的文本
        tone: tone,          //  <-- 语气
        duration: `${duration}s`, //  <-- 计算出的时长，例如 "3s"
        timestamp: new Date().toISOString()
    };

    // 6. 添加消息到历史记录
    addMessage(currentChatId, voiceMessage);
    
    // 7. 清空输入框并关闭弹窗
    document.getElementById('voice-text-input').value = '';
    document.getElementById('voice-tone-input').value = '';
    closeVoiceModal();

    // 8. 重新渲染聊天界面，显示新消息
    renderMessages();
    document.getElementById('chat-toolbar')?.classList.remove('active');
}
function sendTransferMessage() {
    // 1. 获取弹窗里的输入元素
    const amountInput = document.getElementById('transfer-amount-input');
    const remarkInput = document.getElementById('transfer-remark-input');

    // 2. 将金额转换为数字并进行验证
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) {
        showToast('请输入有效的转账金额');
        return; // 如果金额无效，则中断操作
    }

    // 3. 获取留言内容
    const remark = remarkInput.value.trim();

    // 4. 找到当前聊天对象和用户
    const ai = aiList.find(a => a.id == currentChatId);
    if (!ai) return;
    const currentUser = userProfiles.find(p => p.id == ai.userId) || userProfiles[0];

    // 5. 创建一个新的“转账消息”对象
    const transferMessage = {
        sender: currentUser.id,
        type: 'transfer',              // <-- 类型是 'transfer'
        amount: amount.toFixed(2),     // <-- 金额，保留两位小数
        remark: remark || '转账',      // <-- 留言，如果为空则默认为"转账"
        status: 'pending',             // <-- 初始状态，'pending'表示待接收
        timestamp: new Date().toISOString()
    };

    // 6. 添加消息到历史记录
    addMessage(currentChatId, transferMessage);
    
    // 7. 清空输入框并关闭弹窗
    amountInput.value = '';
    remarkInput.value = '';
    closeTransferModal(); // 这需要您已经有了关闭转账弹窗的函数

    // 8. 重新渲染聊天界面，显示新消息
    renderMessages();
    document.getElementById('chat-toolbar')?.classList.remove('active');
}
function openTransferModal() {
    const overlay = document.getElementById('transfer-modal-overlay');
    const container = document.getElementById('transfer-modal-container');

    // 检查元素是否存在
    if (overlay && container) {
        // 先让元素可见
        overlay.style.display = 'block';
        container.style.display = 'flex';
        // 然后再添加 active 类来触发动画
        setTimeout(() => {
            overlay.classList.add('active');
            container.classList.add('active');
        }, 10);
    }
}

function closeTransferModal() {
    const overlay = document.getElementById('transfer-modal-overlay');
    const container = document.getElementById('transfer-modal-container');

    // 检查元素是否存在
    if (overlay && container) {
        // 先移除 active 类触发动画
        overlay.classList.remove('active');
        container.classList.remove('active');
        // 在动画结束后再彻底隐藏元素
        setTimeout(() => {
            overlay.style.display = 'none';
            container.style.display = 'none';
        }, 300); // 这里的300ms应该和你的CSS过渡动画时间一致
    }
}
    function saveAnniversary() {
        const title = document.getElementById('anniversary-title-input').value.trim();
        if (!title) {
            showToast('请输入标题');
            return;
        }

        const year = document.getElementById('anniversary-year-select').value;
        const month = String(document.getElementById('anniversary-month-select').value).padStart(2, '0');
        const day = String(document.getElementById('anniversary-day-select').value).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        if (currentEditAnniversaryId) {
            const item = anniversaryData.find(i => i.id === currentEditAnniversaryId);
            item.title = title;
            item.date = dateString;
        } else {
            anniversaryData.unshift({ id: Date.now(), title, date: dateString });
        }

        anniversaryData.sort((a, b) => new Date(a.date) - new Date(b.date));

        saveAnniversaryData();
        closePage('anniversary-creator-page');
        renderAnniversaryList();
        showToast('保存成功');
    }
function openTransferActionSheet(messageId) {
    document.getElementById('current-transfer-message-id').value = messageId;
    document.getElementById('transfer-action-sheet').classList.add('active');
}

// 2. 关闭操作菜单
function closeTransferActionSheet() {
    document.getElementById('transfer-action-sheet').classList.remove('active');
}

// 3. 确认收款
function acceptTransfer() {
    const messageId = document.getElementById('current-transfer-message-id').value;
    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai || !messageId) return;

    const message = ai.history.find(m => m.id === messageId);
    if (message) {
        message.status = 'accepted'; // 修改状态
        setStorage('ai_list_v2', aiList); // 保存
        renderMessages(); // 刷新界面
    }
    closeTransferActionSheet();
}

    function deleteAnniversary(id) {
        if (confirm('确定要删除这个纪念日吗？')) {
            anniversaryData = anniversaryData.filter(i => i.id !== id);
            saveAnniversaryData();
            renderAnniversaryList();
            // 如果删除的是当前首页组件，重置首页组件显示
            const selectedId = getStorage('danke_anniversary_widget_id', null);
            if (selectedId === id) {
                setStorage('danke_anniversary_widget_id', null);
                updateAnniversaryWidgetDisplay();
            }
            showToast('已删除');
        }
    }


    // =========================================================================
    // ----------------------- IX. SELF-DISCIPLINE CLOCK APP --------------------
    // =========================================================================

    // --- 9.1. 数据加载与保存 ---
    function loadClockData() {
        clockData = getStorage('danke_clock_data', defaultClockData);
    }

    function saveClockData() {
        setStorage('danke_clock_data', clockData);
    }

    // --- 9.2. 页面导航与任务列表 ---
    function switchClockTab(tabName) {
        const isTaskTab = tabName === 'task';
        document.getElementById('clock-task-view').style.display = isTaskTab ? 'block' : 'none';
        document.getElementById('clock-personal-view').style.display = isTaskTab ? 'none' : 'block';
        document.getElementById('clock-nav-task').classList.toggle('active', isTaskTab);
        document.getElementById('clock-nav-personal').classList.toggle('active', !isTaskTab);
        document.querySelector('.nav-header .nav-btn[onclick="openTaskCreator()"]').style.visibility = isTaskTab ? 'visible' : 'hidden';
        document.getElementById('clock-title-text').innerText = isTaskTab ? '自律钟' : '个人中心';

        if (!isTaskTab) {
            renderPersonalPage();
        }
    }

    function renderTaskList() {
        const ul = document.getElementById('clock-task-list-ul');
        ul.innerHTML = '';
        if (!clockData.tasks || clockData.tasks.length === 0) {
            ul.innerHTML = `<div style="text-align:center; padding:40px; color:#999;">点击右上角 '+' 创建你的第一个专注任务</div>`;
            return;
        }
        clockData.tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = 'clock-task-item-wrapper';
            li.innerHTML = `
                <div class="clock-task-item-actions">
                    <button class="edit-btn" onclick="openTaskCreator(${task.id})">编辑</button>
                    <button class="delete-btn" onclick="deleteTask(${task.id})">删除</button>
                </div>
                <div class="clock-task-item" id="clock-task-item-${task.id}">
                    <span class="clock-task-name">${task.name}</span>
                    <span class="clock-task-duration">${task.duration} 分钟</span>
                </div>`;
            ul.appendChild(li);

            const itemDiv = li.querySelector('.clock-task-item');
            let startX;
            itemDiv.addEventListener('touchstart', e => {
                document.querySelectorAll('.clock-task-item.swiped').forEach(swiped => swiped.classList.remove('swiped'));
                startX = e.touches[0].clientX;
            }, { passive: true });
            itemDiv.addEventListener('touchmove', e => {
                if (!startX || Math.abs(e.touches[0].clientY - e.touches[0].clientY) > Math.abs(e.touches[0].clientX - startX)) return;
                if (e.touches[0].clientX - startX < -20) e.preventDefault();
            }, { passive: false });
            itemDiv.addEventListener('touchend', e => {
                if (!startX) return;
                let deltaX = e.changedTouches[0].clientX - startX;
                if (deltaX < -60) itemDiv.classList.add('swiped');
                else if (deltaX > 20) itemDiv.classList.remove('swiped');
                else if (Math.abs(deltaX) < 10) startFocus(task.id);
                startX = null;
            }, { passive: true });
        });
    }

    function deleteTask(id) {
        if (!confirm('确定要删除这个任务吗？')) return;
        clockData.tasks = clockData.tasks.filter(t => t.id !== id);
        saveClockData();
        renderTaskList();
        showToast('任务已删除');
    }

    // --- 9.3. 任务创建与编辑 ---
    function openTaskCreator(taskId = null) {
        currentEditTaskId = taskId;
        const modal = document.getElementById('task-creator-modal');
        const nameInput = document.getElementById('task-name-input');
        const durationSelect = document.getElementById('task-duration-select');
        const createBtn = document.getElementById('clock-create-btn');

        const durationOptions = [1, 5, 10, 15, 20, 25, 30, 45, 60, 90, 120];
        durationSelect.innerHTML = '';
        durationOptions.forEach(d => {
            durationSelect.appendChild(new Option(`${d} 分钟`, d));
        });

        if (taskId) {
            const task = clockData.tasks.find(t => t.id === taskId);
            nameInput.value = task.name;
            if (!durationOptions.includes(task.duration)) {
                durationSelect.add(new Option(`${task.duration} 分钟`, task.duration), 0);
            }
            durationSelect.value = task.duration;
            createBtn.innerText = "保存";
        } else {
            nameInput.value = '';
            durationSelect.value = 25;
            createBtn.innerText = "创建";
        }
        modal.classList.add('active');
    }

    function closeTaskCreator() {
        document.getElementById('task-creator-modal').classList.remove('active');
    }

    function saveTask() {
        const name = document.getElementById('task-name-input').value.trim();
        const duration = parseInt(document.getElementById('task-duration-select').value);
        if (!name) return showToast('请输入任务名称');

        if (currentEditTaskId) {
            const task = clockData.tasks.find(t => t.id === currentEditTaskId);
            task.name = name;
            task.duration = duration;
        } else {
            clockData.tasks.unshift({ id: Date.now(), name, duration });
        }
        saveClockData();
        renderTaskList();
        closeTaskCreator();
        showToast('保存成功');
    }

    // --- 9.4. 专注会话 ---
    function startFocus(taskId) {
        const task = clockData.tasks.find(t => t.id === taskId);
        const page = document.getElementById('focus-session-page');
        const timeDisplay = document.getElementById('focus-time-display');
        const quoteDisplay = document.getElementById('focus-quote');

        const randomWallpaper = clockData.wallpapers[Math.floor(Math.random() * clockData.wallpapers.length)];
        const randomQuote = clockData.quotes[Math.floor(Math.random() * clockData.quotes.length)];
        page.style.backgroundImage = randomWallpaper ? `url(${randomWallpaper})` : '';
        quoteDisplay.innerText = randomQuote || "Stay focused.";

        focusSessionData.task = task;
        focusSessionData.remainingSeconds = task.duration * 60;

        updateCircularTimer(1);
        timeDisplay.innerText = `${String(task.duration).padStart(2, '0')}:00`;
        openPage('focus-session-page');

        if (focusTimerInterval) clearInterval(focusTimerInterval);

        focusTimerInterval = setInterval(() => {
            focusSessionData.remainingSeconds--;
            const minutes = Math.floor(focusSessionData.remainingSeconds / 60);
            const seconds = focusSessionData.remainingSeconds % 60;
            timeDisplay.innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            const progress = focusSessionData.remainingSeconds / (focusSessionData.task.duration * 60);
            updateCircularTimer(progress);

            if (focusSessionData.remainingSeconds <= 0) {
                clearInterval(focusTimerInterval);
                focusTimerInterval = null;
                const today = new Date().toISOString().slice(0, 10);
                if (!clockData.focusRecords) clockData.focusRecords = [];
                clockData.focusRecords.push({ date: today, duration: task.duration, taskName: task.name });
                saveClockData();
                showToast(`专注完成: ${task.name}`);
                setTimeout(() => {
                    closePage('focus-session-page');
                    focusSessionData = { task: null, remainingSeconds: 0 };
                }, 1000);
            }
        }, 1000);
    }

    function tryExitFocus() {
        if (confirm('你确定要退出本次专注吗？')) {
            if (focusTimerInterval) {
                clearInterval(focusTimerInterval);
                focusTimerInterval = null;
            }
            const totalSeconds = focusSessionData.task.duration * 60;
            const elapsedSeconds = totalSeconds - focusSessionData.remainingSeconds;
            const elapsedMinutes = Math.floor(elapsedSeconds / 60);
            if (elapsedMinutes >= 1) {
                const today = new Date().toISOString().slice(0, 10);
                if (!clockData.focusRecords) clockData.focusRecords = [];
                clockData.focusRecords.push({ date: today, duration: elapsedMinutes, taskName: focusSessionData.task.name + " (提前结束)" });
                saveClockData();
                showToast(`已记录专注 ${elapsedMinutes} 分钟`);
            } else {
                showToast('专注不足一分钟，不计入时长。');
            }

            closePage('focus-session-page');
            focusSessionData = { task: null, remainingSeconds: 0 };
        }
    }

    function updateCircularTimer(progress) {
        const circle = document.getElementById('focus-timer-progress');
        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        const offset = circumference * (1 - progress);
        circle.style.strokeDashoffset = offset;
    }

    // --- 9.5. 个人中心与个性化 ---
    function renderPersonalPage() {
        document.getElementById('clock-user-avatar').src = sanitizeAvatar(clockData.profile.avatar);
        document.getElementById('clock-user-name').value = clockData.profile.name;
        const today = new Date().toISOString().slice(0, 10);
        const todayFocusMinutes = (clockData.focusRecords || [])
            .filter(r => r.date === today)
            .reduce((total, r) => total + r.duration, 0);
        document.getElementById('focus-chart-text').innerText = todayFocusMinutes;
        document.getElementById('focus-chart-label').innerText = `今日专注 ${todayFocusMinutes} 分钟`;
        const goalMinutes = 240;
        const percentage = Math.min(todayFocusMinutes / goalMinutes, 1) * 360;
        document.getElementById('focus-pie-chart').style.background = `conic-gradient(#4CAF50 ${percentage}deg, #f0f0f0 ${percentage}deg)`;

        renderPersonalizationGrid();
        renderQuotesList();
    }

    document.getElementById('clock-avatar-input').onchange = e => {
        if (e.target.files[0]) {
            const r = new FileReader();
            r.onload = ev => {
                clockData.profile.avatar = ev.target.result;
                saveClockData();
                document.getElementById('clock-user-avatar').src = ev.target.result;
            };
            r.readAsDataURL(e.target.files[0]);
        }
    };

    function saveClockProfile() {
        clockData.profile.name = document.getElementById('clock-user-name').value.trim();
        saveClockData();
        showToast('用户名已更新');
    }

    function renderPersonalizationGrid() {
        const grid = document.getElementById('clock-wallpaper-grid');
        grid.innerHTML = '';
        (clockData.wallpapers || []).forEach((url, index) => {
            const item = document.createElement('div');
            item.className = 'grid-item';
            item.style.backgroundImage = `url(${url})`;
            item.innerHTML = `<div class="delete-icon" onclick="deleteClockWallpaper(${index})">×</div>`;
            grid.appendChild(item);
        });
        const addItem = document.createElement('div');
        addItem.className = 'grid-item grid-item-add';
        addItem.innerText = '+';
        addItem.onclick = () => document.getElementById('clock-wallpaper-input').click();
        grid.appendChild(addItem);
    }

    document.getElementById('clock-wallpaper-input').onchange = e => {
        if (e.target.files[0]) {
            const r = new FileReader();
            r.onload = ev => {
                if (!clockData.wallpapers) clockData.wallpapers = [];
                clockData.wallpapers.push(ev.target.result);
                saveClockData();
                renderPersonalizationGrid();
            };
            r.readAsDataURL(e.target.files[0]);
        }
    };

    function deleteClockWallpaper(index) {
        clockData.wallpapers.splice(index, 1);
        saveClockData();
        renderPersonalizationGrid();
    }

    function renderQuotesList() {
        const listDiv = document.getElementById('clock-quotes-list');
        listDiv.innerHTML = '';
        (clockData.quotes || []).forEach((quote, index) => {
            const row = document.createElement('div');
            row.className = 'setting-row';
            row.innerHTML = `
                <span style="flex:1; font-size:14px; color:#555;">${quote}</span>
                <button class="btn-small" style="background:transparent; color:red;" onclick="deleteClockQuote(${index})">删除</button>
            `;
            listDiv.appendChild(row);
        });
        const addRow = document.createElement('div');
        addRow.className = 'setting-row';
        addRow.innerHTML = `<button class="btn-small" style="width:100%; padding:10px; background:#000; color:#fff;" onclick="addClockQuote()">新增名言</button>`;
        listDiv.appendChild(addRow);
    }

    function addClockQuote() {
        const newQuote = prompt("请输入新的名言警句：");
        if (newQuote && newQuote.trim() !== '') {
            if (!clockData.quotes) clockData.quotes = [];
            clockData.quotes.push(newQuote.trim());
            saveClockData();
            renderQuotesList();
        }
    }

    function deleteClockQuote(index) {
        clockData.quotes.splice(index, 1);
        saveClockData();
        renderQuotesList();
    }

function handleEditCurrentAi() {
    // 这个函数在 IIFE 内部，所以它可以访问到 currentChatId
    openAiDrawer(true, currentChatId);
}
    // --- 10.1. AI 角色管理 ---
   function openAiDrawer(isEditing = false, aiId = null) {
    // 强制类型转换，以防从HTML传来的是字符串'false'
    isEditing = (isEditing === true || isEditing === 'true');

    // 如果是从 QQ 顶部 + 入口或其他列表入口打开，先关闭下方的创建方式弹窗
    if (typeof closeAddCharacterModal === 'function') {
        closeAddCharacterModal();
    }

    const title = document.getElementById('drawer-ai-title');
    const nameInput = document.getElementById('ai-name');
    const promptTextarea = document.getElementById('ai-prompt');
    const avatarPreview = document.getElementById('ai-avatar-preview');
    const plusIcon = document.getElementById('ai-plus');
    const nicknameInput = document.getElementById('ai-nickname');
    const showNicknameSwitch = document.getElementById('ai-show-nickname-switch');

    tempAiAv = null; // 重置临时头像

    if (isEditing) {
        // 【重要修正】使用我们刚刚在全局声明的 currentEditId
        currentEditId = aiId; 
        const ai = aiList.find(c => c.id == currentEditId);
        if (!ai) return showToast('找不到要编辑的角色');

        title.innerText = '修改角色';
        nameInput.value = ai.name;
        promptTextarea.value = ai.prompt || '';
        nicknameInput.value = ai.nickname || '';
        showNicknameSwitch.checked = ai.showNickname ?? false;

        if (ai.avatar && ai.avatar !== defaultAvatarSVG) {
            avatarPreview.src = ai.avatar;
            avatarPreview.style.display = 'block';
            plusIcon.style.display = 'none';
        } else {
            avatarPreview.src = '';
            avatarPreview.style.display = 'none';
            plusIcon.style.display = 'block';
        }

    } else {
        // 新建模式
        currentEditId = null; // 新建时，确保清空正在编辑的ID
        title.innerText = '创建新角色';
        nameInput.value = '';
        promptTextarea.value = '';
        nicknameInput.value = '';
        showNicknameSwitch.checked = false;
        avatarPreview.src = '';
        avatarPreview.style.display = 'none';
        plusIcon.style.display = 'block';
    }
    openDrawer('drawer-ai');
}


function openAvatarManager() {
    const ai = aiList.find(c => c.id == currentEditId);
    if (!ai) return;

    // 获取所有已存储的头像，确保ai.avatars是一个数组
    const storedAvatars = ai.avatars || [];
    let galleryHtml = `
        <div class="avatar-gallery-item add-new" onclick="document.getElementById('avatar-manager-upload').click()">+</div>
        <input type="file" id="avatar-manager-upload" accept="image/*" style="display:none;" onchange="uploadToAvatarManager(event)">
    `;

    storedAvatars.forEach(avatarUrl => {
        const isSelected = avatarUrl === ai.avatar;
        galleryHtml += `
            <div 
                class="avatar-gallery-item ${isSelected ? 'selected' : ''}" 
                style="background-image: url('${avatarUrl}')"
                onclick="selectAvatarFromManager(this, '${avatarUrl}')">
            </div>
        `;
    });
    
    const modalHtml = `
        <div class="action-sheet-modal active" id="avatar-manager-modal">
            <div class="picker-content dark-modal" style="height: 60%;">
                <div class="picker-header"><span>头像管理</span></div>
                <div class="modal-scroll-content no-scrollbar"><div class="avatar-gallery">${galleryHtml}</div></div>
                <div style="padding: 15px; border-top: 1px solid #333; display: flex;">
                    <button class="drawer-button-cancel" style="width:100%;" onclick="document.getElementById('avatar-manager-modal').remove()">关闭</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * 【新】从本地上传图片到头像管理器
 */
function uploadToAvatarManager(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const newAvatarUrl = e.target.result;
       const ai = aiList.find(c => c.id == currentEditId);
        if (!ai) return;

        // 初始化avatars数组
        if (!ai.avatars) {
            ai.avatars = [];
        }
        
        // 只有当这个URL不存在时才添加
        if (!ai.avatars.includes(newAvatarUrl)) {
            ai.avatars.push(newAvatarUrl);
            setStorage('ai_list_v2', aiList);
        }
        
        // 刷新弹窗内容
        document.getElementById('avatar-manager-modal').remove();
        openAvatarManager();
    };
    reader.readAsDataURL(file);
}

/**
 * 【新】在头像管理器中选择一个头像
 */
function selectAvatarFromManager(element, avatarUrl) {
    const ai = aiList.find(c => c.id == currentEditId);
    if (!ai) return;

    // 更新AI的主头像
    ai.avatar = avatarUrl;
    setStorage('ai_list_v2', aiList);

    // 更新角色设定抽屉里的预览头像
    document.getElementById('ai-avatar-preview').src = avatarUrl;
    document.getElementById('ai-avatar-preview').style.display = 'block';
    document.getElementById('ai-plus').style.display = 'none';

    // 更新头像管理器中的选中状态
    document.querySelectorAll('.avatar-gallery-item').forEach(item => item.classList.remove('selected'));
    element.classList.add('selected');
}
    function saveAiCharacter() {
    const name = document.getElementById('ai-name').value.trim();
    if (!name) return showToast('请输入角色名字');

    const prompt = document.getElementById('ai-prompt').value;
    const oldAv = currentEditId ? aiList.find(c => c.id == currentEditId).avatar : null;
    const finalAv = sanitizeAvatar(tempAiAv || oldAv || defaultAvatarSVG);
    
    // 【新增】获取备注名和相关设置
    const nickname = document.getElementById('ai-nickname').value.trim();
    const showNickname = document.getElementById('ai-show-nickname-switch').checked;

    if (currentEditId) {
        const ai = aiList.find(c => c.id == currentEditId);
        ai.name = name;
        ai.prompt = prompt;
        ai.avatar = finalAv;
        // 【新增】更新备注名数据
        ai.nickname = nickname;
        ai.showNickname = showNickname;
        // 【新增】确保头像列表也被保存
        if (!ai.avatars) ai.avatars = [];
        if (!ai.avatars.includes(finalAv)) ai.avatars.push(finalAv);

    } else {
        aiList.unshift({
            id: Date.now(),
            name,
            avatar: finalAv,
            prompt,
            userId: userProfiles[0]?.id,
            // 【新增】创建新角色时，也加入备注名和头像列表的初始数据
            nickname: nickname,
            showNickname: showNickname,
            avatars: [finalAv].filter(Boolean), // 初始化头像列表
            history: [],
            settings: {
                timePerception: false,
                chatWorldbookId: 'none',
                offlineMode: { enabled: false, wordCountMin: 500, wordCountMax: 1500, worldbookId: 'none' }
            }
        });
    }
    setStorage('ai_list_v2', aiList);
    closeDrawer('drawer-ai');
    loadChatList();
    
    // 【修改】当保存后，如果正在当前聊天，则立即更新顶部标题
    if (currentChatId && currentChatId == currentEditId) {
        const ai = aiList.find(c => c.id == currentChatId);
        // 使用我们新的显示逻辑来更新标题
        document.getElementById('chat-title').innerText = ai.showNickname && ai.nickname ? ai.nickname : ai.name;
    }

    showToast('角色设定已保存成功！');
}


    // --- 10.2. 用户(我) 角色管理 ---
    function openUserDrawer() {
        closeDrawer('chat-settings-drawer');
        const select = document.getElementById('user-profile-select');
        select.innerHTML = '';
        userProfiles.forEach(p => {
            select.appendChild(new Option(p.name, p.id));
        });
        select.onchange = () => loadUserForm(select.value);

        const ai = aiList.find(c => c.id == currentChatId);
        const currentUserId = ai ? ai.userId : userProfiles[0].id;
        select.value = currentUserId;

        loadUserForm(select.value);
        openDrawer('drawer-user');
    }

    function loadUserForm(userId) {
        const user = userProfiles.find(p => p.id == userId);
        if (!user) return;
        currentEditUserId = user.id;
        document.getElementById('user-name').value = user.name;
        document.getElementById('user-prompt').value = user.prompt || '';
        document.getElementById('user-avatar-preview').src = sanitizeAvatar(user.avatar);
        document.getElementById('user-avatar-preview').style.display = 'block';
        document.getElementById('user-plus').style.display = 'none';

        tempUserAv = user.avatar;

        const deleteBtn = document.getElementById('user-delete-btn');
        if (userProfiles.length > 1 && userProfiles[0].id != user.id) {
            deleteBtn.style.display = 'block';
        } else {
            deleteBtn.style.display = 'none';
        }
    }

    function createNewUser() {
        currentEditUserId = null;
        document.getElementById('user-name').value = `新角色 ${userProfiles.length + 1}`;
        document.getElementById('user-prompt').value = '';
        document.getElementById('user-avatar-preview').style.display = 'none';
        document.getElementById('user-plus').style.display = 'block';
        document.getElementById('user-delete-btn').style.display = 'none';
        tempUserAv = '';
        document.getElementById('user-name').focus();
    }

    document.getElementById('user-avatar-file').onchange = e => {
        if (e.target.files[0]) {
            const r = new FileReader();
            r.onload = ev => {
                tempUserAv = ev.target.result;
                document.getElementById('user-avatar-preview').src = tempUserAv;
                document.getElementById('user-avatar-preview').style.display = 'block';
                document.getElementById('user-plus').style.display = 'none';
            };
            r.readAsDataURL(e.target.files[0]);
        }
    };

   function saveUser() {
    const name = document.getElementById('user-name').value.trim() || '我';
    const prompt = document.getElementById('user-prompt').value.trim();
    const currentAvatar = tempUserAv || (currentEditUserId ? userProfiles.find(p => p.id == currentEditUserId).avatar : null);
    const finalAvatar = sanitizeAvatar(currentAvatar || defaultAvatarSVG);

    if (currentEditUserId) {
        const user = userProfiles.find(p => p.id == currentEditUserId);
        if (user) {
            user.name = name;
            user.prompt = prompt;
            user.avatar = finalAvatar;
            // 【新增】确保头像列表也被保存
            if (!user.avatars) user.avatars = [];
            if (finalAvatar !== defaultAvatarSVG && !user.avatars.includes(finalAvatar)) {
                user.avatars.push(finalAvatar);
            }
        }
    } else {
        userProfiles.push({ 
            id: Date.now(), 
            name, 
            prompt, 
            avatar: finalAvatar,
            // 【新增】创建新用户时，也初始化头像列表
            avatars: finalAvatar !== defaultAvatarSVG ? [finalAvatar] : []
        });
    }
    setStorage('ai_users_list', userProfiles);
    closeDrawer('drawer-user');
    showToast('用户设定保存成功！');
    loadMomentsData(); 
    tempUserAv = ''; // 重置临时头像变量
}

    function deleteUser() {
        if (!currentEditUserId) return;
        if (userProfiles.length <= 1) return showToast('必须保留至少一个用户角色');
        if (currentEditUserId == userProfiles[0].id) return showToast('默认角色不可删除');
        if (!confirm('确定要彻底删除这个用户身份吗？此操作不可逆。')) return;

        userProfiles = userProfiles.filter(p => p.id != currentEditUserId);
        setStorage('ai_users_list', userProfiles);

        // 将使用已删除用户的AI角色，重置为默认用户
        aiList.forEach(ai => {
            if (ai.userId == currentEditUserId) ai.userId = userProfiles[0].id;
        });
        setStorage('ai_list_v2', aiList);

        showToast('用户已删除');
        closeDrawer('drawer-user');
    }

function openUserAvatarManager() {
    if (!currentEditUserId) return showToast('请先选择一个要管理的用户角色');
    const user = userProfiles.find(p => p.id == currentEditUserId);
    if (!user) return showToast('找不到当前用户');

    // 确保 avatars 数组存在
    const storedAvatars = user.avatars || [];
    let galleryHtml = `
        <div class="avatar-gallery-item add-new" onclick="document.getElementById('user-avatar-manager-upload').click()">+</div>
        <input type="file" id="user-avatar-manager-upload" accept="image/*" style="display:none;" onchange="uploadToUserAvatarManager(event)">
    `;

    storedAvatars.forEach(avatarUrl => {
        const isSelected = avatarUrl === user.avatar;
        galleryHtml += `
            <div 
                class="avatar-gallery-item ${isSelected ? 'selected' : ''}" 
                style="background-image: url('${avatarUrl}')"
                onclick="selectAvatarFromUserManager(this, '${avatarUrl}')">
            </div>
        `;
    });
    
    const modalHtml = `
        <div class="action-sheet-modal active" id="user-avatar-manager-modal">
            <div class="picker-content dark-modal" style="height: 60%;">
                <div class="picker-header"><span>我的头像管理</span></div>
                <div class="modal-scroll-content no-scrollbar"><div class="avatar-gallery">${galleryHtml}</div></div>
                <div style="padding: 15px; border-top: 1px solid #333; display: flex;">
                    <button class="drawer-button-cancel" style="width:100%;" onclick="document.getElementById('user-avatar-manager-modal').remove()">关闭</button>
                </div>
            </div>
        </div>
    `;
    // 使用新的 #popup-layers 容器来添加弹窗
    document.getElementById('popup-layers').insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * 【新】从本地上传图片到用户头像管理器
 */
function uploadToUserAvatarManager(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const newAvatarUrl = e.target.result;
        const user = userProfiles.find(p => p.id == currentEditUserId);
        if (!user) return;

        if (!user.avatars) user.avatars = [];
        if (!user.avatars.includes(newAvatarUrl)) {
            user.avatars.push(newAvatarUrl);
            setStorage('ai_users_list', userProfiles);
        }
        
        document.getElementById('user-avatar-manager-modal').remove();
        openUserAvatarManager(); // 重新打开以刷新列表
    };
    reader.readAsDataURL(file);
}

/**
 * 【新】在用户头像管理器中选择一个头像
 */
function selectAvatarFromUserManager(element, avatarUrl) {
    const user = userProfiles.find(p => p.id == currentEditUserId);
    if (!user) return;

    user.avatar = avatarUrl;
    setStorage('ai_users_list', userProfiles);

    // 更新用户设定抽屉里的预览头像
    const avatarPreview = document.getElementById('user-avatar-preview');
    avatarPreview.src = avatarUrl;
    avatarPreview.style.display = 'block';
    document.getElementById('user-plus').style.display = 'none';

    // 更新管理器中的选中状态
    const managerModal = document.getElementById('user-avatar-manager-modal');
    if (managerModal) {
        managerModal.querySelectorAll('.avatar-gallery-item').forEach(item => item.classList.remove('selected'));
        element.classList.add('selected');
    }
}

    // =========================================================================
    // ------------------------- XI. APPEARANCE SETTINGS -------------------------
    // =========================================================================
    
    // --- 11.1. 壁纸设置 ---
    document.getElementById('wp-file').onchange = e => {
        if (e.target.files[0]) {
            const r = new FileReader();
            r.onload = ev => {
                tempWpData = ev.target.result;
                showToast('已选中本地主屏图片，请点击保存');
            };
            r.readAsDataURL(e.target.files[0]);
        }
    };

    function saveWallpaper() {
        const wpUrlInput = document.getElementById('wp-url');
        const mainScreen = document.getElementById('main-screen');
        const wpUrl = wpUrlInput.value.trim();
        try {
            if (tempWpData) {
                beautifyConfig.wpData = tempWpData;
                beautifyConfig.wpUrl = '';
                wpUrlInput.value = '';
                mainScreen.style.backgroundImage = `url(${tempWpData})`;
                mainScreen.style.backgroundColor = 'transparent';
                setStorage('ai_beautify_config_v2', beautifyConfig);
                showToast('本地主屏壁纸保存成功！');
                tempWpData = '';
                document.getElementById('wp-file').value = '';
            } else if (wpUrl) {
                beautifyConfig.wpUrl = wpUrl;
                beautifyConfig.wpData = '';
                mainScreen.style.backgroundImage = `url(${wpUrl})`;
                mainScreen.style.backgroundColor = 'transparent';
                setStorage('ai_beautify_config_v2', beautifyConfig);
                showToast('网络主屏壁纸保存成功！');
                wpUrlInput.value = '';
                document.getElementById('wp-file').value = '';
            } else {
                beautifyConfig.wpUrl = myDefaultBeautifyConfig.wpUrl;
                beautifyConfig.wpData = '';
                mainScreen.style.backgroundImage = `url(${beautifyConfig.wpUrl})`;
                mainScreen.style.backgroundColor = 'transparent';
                setStorage('ai_beautify_config_v2', beautifyConfig);
                showToast('主屏幕已恢复默认暖色壁纸');
            }
        } catch (e) {
            showToast('保存失败: 图片可能过大');
        }
    }

    function resetWallpaper() {
        beautifyConfig.wpData = '';
        beautifyConfig.wpUrl = myDefaultBeautifyConfig.wpUrl;
        document.getElementById('wp-url').value = '';
        document.getElementById('wp-file').value = '';
        tempWpData = '';
        const mainScreen = document.getElementById('main-screen');
        mainScreen.style.backgroundImage = `url(${myDefaultBeautifyConfig.wpUrl})`;
        mainScreen.style.backgroundColor = 'transparent';
        setStorage('ai_beautify_config_v2', beautifyConfig);
        showToast('已恢复默认暖色主屏壁纸');
    }
    
    // --- 11.2. 锁屏壁纸设置 ---
    document.getElementById('lock-wp-file').onchange = e => {
        if (e.target.files[0]) {
            const r = new FileReader();
            r.onload = ev => {
                tempLockWpData = ev.target.result;
                showToast('已选中本地锁屏图片，请点击保存');
            };
            r.readAsDataURL(e.target.files[0]);
        }
    };

    function saveLockWallpaper() {
        const wpUrlInput = document.getElementById('lock-wp-url');
        const wpUrl = wpUrlInput.value.trim();
        try {
            if (tempLockWpData) {
                beautifyConfig.lockWpData = tempLockWpData;
                beautifyConfig.lockWpUrl = '';
                wpUrlInput.value = '';
                lockScreenElement.style.backgroundImage = `url(${tempLockWpData})`;
                setStorage('ai_beautify_config_v2', beautifyConfig);
                showToast('本地锁屏壁纸保存成功！');
                tempLockWpData = '';
                document.getElementById('lock-wp-file').value = '';
            } else if (wpUrl) {
                beautifyConfig.lockWpUrl = wpUrl;
                beautifyConfig.lockWpData = '';
                lockScreenElement.style.backgroundImage = `url(${wpUrl})`;
                setStorage('ai_beautify_config_v2', beautifyConfig);
                showToast('网络锁屏壁纸保存成功！');
                // 应用完成后清空输入
                wpUrlInput.value = '';
                document.getElementById('lock-wp-file').value = '';
            } else {
                showToast('请填写链接或选择图片');
            }
        } catch (e) {
            showToast('保存失败: 图片可能过大');
        }
    }
    // 聊天界面美化：应用背景与自定义 CSS
    function applyChatAppearance() {
        const chatArea = document.getElementById('msg-area');
        const offlineArea = document.getElementById('offline-msg-area');

        const perChatMap = beautifyConfig.chatBgPerChat || {};
        const perChatBg = currentChatId && perChatMap[currentChatId] ? perChatMap[currentChatId] : '';
        const globalBg = beautifyConfig.globalChatBgData || beautifyConfig.chatBgData || beautifyConfig.globalChatBgUrl || '';

        [chatArea, offlineArea].forEach(area => {
            if (!area) return;
            const bgData = perChatBg || globalBg;
            if (bgData) {
                area.style.backgroundImage = `url(${bgData})`;
                area.style.backgroundSize = 'cover';
                area.style.backgroundPosition = 'center';
            } else {
                // 恢复真正的“默认”聊天背景：不再回落到主屏壁纸，而是纯白空白
                area.style.backgroundImage = '';
                area.style.backgroundColor = '#ffffff';
            }
        });

        let styleEl = document.getElementById('chat-css-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'chat-css-style';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = beautifyConfig.chatCss || '';
    }

    function renderChatBgGallery() {
        const gallery = document.getElementById('chat-bg-gallery');
        if (!gallery) return;
        gallery.innerHTML = '';

        const list = beautifyConfig.chatBgGallery || [];
        if (!list.length) {
            const empty = document.createElement('div');
            empty.style.fontSize = '12px';
            empty.style.color = '#aaa';
            empty.textContent = '尚未添加背景图片';
            gallery.appendChild(empty);
            return;
        }

        const perChatMap = beautifyConfig.chatBgPerChat || {};
        const perChatBg = currentChatId && perChatMap[currentChatId] ? perChatMap[currentChatId] : '';
        const globalBg = beautifyConfig.globalChatBgData || beautifyConfig.chatBgData || beautifyConfig.globalChatBgUrl || '';
        const activeBg = perChatBg || globalBg;

        list.forEach(url => {
            const item = document.createElement('div');
            item.style.width = '42px';
            item.style.height = '42px';
            item.style.borderRadius = '10px';
            item.style.backgroundImage = `url(${url})`;
            item.style.backgroundSize = 'cover';
            item.style.backgroundPosition = 'center';
            item.style.cursor = 'pointer';
            item.style.border = (activeBg === url) ? '2px solid #000' : '1px solid #ddd';
            item.onclick = () => {
                if (!beautifyConfig.chatBgPerChat) beautifyConfig.chatBgPerChat = {};
                if (currentChatId) {
                    beautifyConfig.chatBgPerChat[currentChatId] = url;
                } else {
                    // 如果没有当前会话，退化为修改全局背景
                    beautifyConfig.globalChatBgData = url;
                    beautifyConfig.globalChatBgUrl = '';
                }
                setStorage('ai_beautify_config_v2', beautifyConfig);
                applyChatAppearance();
                renderChatBgGallery();
                const bgHint = document.getElementById('chat-bg-hint');
                if (bgHint) bgHint.textContent = '已为当前聊天设置背景，可重新选择图片覆盖';
                showToast('已切换聊天背景');
            };
            gallery.appendChild(item);
        });
    }

    // 清除当前会话的局部聊天背景，并在没有局部背景时一并清空全局背景，恢复真正的“纯白默认”
    function resetChatBackground() {
        if (!beautifyConfig.chatBgPerChat) beautifyConfig.chatBgPerChat = {};

        let hadPerChat = false;
        if (currentChatId && beautifyConfig.chatBgPerChat[currentChatId]) {
            delete beautifyConfig.chatBgPerChat[currentChatId];
            hadPerChat = true;
        }

        // 如果当前会话本来就没有单独背景（或刚刚删掉），再把全局背景也一并清空
        // 这样“恢复默认聊天背景”就等价于回到纯白，而不是继续使用之前的全局壁纸
        if (!hadPerChat) {
            beautifyConfig.globalChatBgData = '';
            beautifyConfig.chatBgData = '';
            beautifyConfig.globalChatBgUrl = '';
        }

        setStorage('ai_beautify_config_v2', beautifyConfig);
        applyChatAppearance();

        const bgHint = document.getElementById('chat-bg-hint');
        if (bgHint) {
            const hasGlobal = !!(
                beautifyConfig.globalChatBgData ||
                beautifyConfig.chatBgData ||
                beautifyConfig.globalChatBgUrl
            );
            bgHint.textContent = hasGlobal
                ? '当前未设置局部背景，将使用全局聊天背景'
                : '当前未设置聊天背景，将使用纯白默认背景';
        }

        renderChatBgGallery();
        showToast('已恢复默认聊天背景');
    }

    function openChatAppearanceModal() {
        const ai = aiList.find(c => c.id == currentChatId);
        if (!ai) {
            showToast('请先进入一个聊天界面');
            return;
        }
        const overlay = document.getElementById('chat-appearance-overlay');
        const container = document.getElementById('chat-appearance-modal');
        const textarea = document.getElementById('chat-css-input');
        if (textarea) {
            textarea.value = beautifyConfig.chatCss || '';
            // 缩小输入框宽度与高度，两边向中间收一点
            textarea.style.maxWidth = '260px';
            textarea.style.margin = '0 auto';
            textarea.style.minHeight = '90px';
        }
        const bgHint = document.getElementById('chat-bg-hint');
        if (bgHint) {
            const perChatMap = beautifyConfig.chatBgPerChat || {};
            const perChatBg = currentChatId && perChatMap[currentChatId] ? perChatMap[currentChatId] : '';
            const globalBg = beautifyConfig.globalChatBgData || beautifyConfig.chatBgData || beautifyConfig.globalChatBgUrl || '';
            if (perChatBg) {
                bgHint.textContent = '已为当前聊天设置背景，可重新选择图片覆盖';
            } else if (globalBg) {
                bgHint.textContent = '当前使用全局聊天背景，可为此聊天单独设置';
            } else {
                bgHint.textContent = '当前未设置聊天背景';
            }
            const card = bgHint.parentElement;
            if (card) {
                // 恢复默认背景按钮（仅清除局部，不清除全局）
                if (!document.getElementById('chat-bg-reset-btn')) {
                    const row = document.createElement('div');
                    row.id = 'chat-bg-reset-row';
                    row.style.marginTop = '8px';
                    row.style.display = 'flex';
                    row.style.gap = '8px';
                    const resetBtn = document.createElement('button');
                    resetBtn.id = 'chat-bg-reset-btn';
                    resetBtn.className = 'btn-small';
                    resetBtn.textContent = '恢复默认背景';
                    resetBtn.style.flex = '1';
                    resetBtn.style.padding = '8px';
                    resetBtn.style.fontSize = '12px';
                    resetBtn.style.border = 'none';
                    resetBtn.style.background = '#eee';
                    resetBtn.onclick = resetChatBackground;
                    row.appendChild(resetBtn);
                    card.appendChild(row);
                }
                // 背景图片图库容器
                if (!document.getElementById('chat-bg-gallery')) {
                    const gallery = document.createElement('div');
                    gallery.id = 'chat-bg-gallery';
                    gallery.style.marginTop = '8px';
                    gallery.style.display = 'flex';
                    gallery.style.flexWrap = 'wrap';
                    gallery.style.gap = '8px';
                    card.appendChild(gallery);
                }
            }
        }
        // 渲染背景图库
        renderChatBgGallery();
        // 渲染聊天 CSS 方案列表
        renderChatCssPresetList();
        if (overlay) overlay.classList.add('active');
        if (container) container.classList.add('active');
    }

    function closeChatAppearanceModal() {
        const overlay = document.getElementById('chat-appearance-overlay');
        const container = document.getElementById('chat-appearance-modal');
        if (overlay) overlay.classList.remove('active');
        if (container) container.classList.remove('active');
    }

    function handleChatBgFileChange(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const dataUrl = ev.target.result;
            if (!Array.isArray(beautifyConfig.chatBgGallery)) beautifyConfig.chatBgGallery = [];
            if (!beautifyConfig.chatBgGallery.includes(dataUrl)) {
                beautifyConfig.chatBgGallery.push(dataUrl);
            }
            if (!beautifyConfig.chatBgPerChat) beautifyConfig.chatBgPerChat = {};
            if (currentChatId) {
                beautifyConfig.chatBgPerChat[currentChatId] = dataUrl;
            } else {
                // 没有当前会话时，退化为全局聊天背景
                beautifyConfig.globalChatBgData = dataUrl;
                beautifyConfig.globalChatBgUrl = '';
            }
            setStorage('ai_beautify_config_v2', beautifyConfig);
            applyChatAppearance();
            renderChatBgGallery();
            const input = document.getElementById('chat-bg-file');
            if (input) input.value = '';
            const bgHint = document.getElementById('chat-bg-hint');
            if (bgHint) bgHint.textContent = '已为当前聊天设置背景，可重新选择图片覆盖';
            showToast('聊天背景已更新');
        };
        reader.readAsDataURL(file);
    }

    function saveChatCssFromModal() {
        const textarea = document.getElementById('chat-css-input');
        if (!textarea) return;
        beautifyConfig.chatCss = textarea.value;
        setStorage('ai_beautify_config_v2', beautifyConfig);
        applyChatAppearance();
        showToast('聊天气泡样式已更新');
        closeChatAppearanceModal();
    }


    // --- 主屏左右滑动 ---
    function initPhoneLookupFeature() {
        const overlay = document.getElementById('phone-lookup-overlay');
        const container = document.getElementById('phone-lookup-container');
        const openBtn = document.getElementById('toolbar-phone-lookup-btn');
        const closeBtn = document.getElementById('phone-lookup-close-btn');
        const backBtn = document.getElementById('phone-lookup-back-btn');
        const modeButtons = document.querySelectorAll('.phone-lookup-btn[data-phone-lookup-mode]');
        const steps = {
            select: document.getElementById('phone-lookup-step-select'),
            target: document.getElementById('phone-lookup-target-step'),
            reverse: document.getElementById('phone-lookup-reverse-step')
        };

        function updateSteps(nextStep) {
            phoneLookupCurrentStep = nextStep;
            Object.keys(steps).forEach(key => {
                steps[key]?.classList.toggle('is-hidden', key !== nextStep);
            });
            backBtn?.classList.toggle('is-hidden', nextStep === 'select');
        }

        function openPhoneLookup() {
            if (!overlay || !container) return;
            overlay.classList.add('active');
            container.classList.add('active');
            updateSteps('select');
        }

        function closePhoneLookup() {
            overlay?.classList.remove('active');
            container?.classList.remove('active');
        }

        openBtn?.addEventListener('click', () => {
            document.getElementById('chat-toolbar')?.classList.remove('active');
            openPhoneLookup();
        });

        closeBtn?.addEventListener('click', closePhoneLookup);
        backBtn?.addEventListener('click', () => updateSteps('select'));

        modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.phoneLookupMode;
                updateSteps(mode === 'target' ? 'target' : 'reverse');
            });
        });

        window.openPhoneLookupModal = openPhoneLookup;
        window.closePhoneLookupModal = closePhoneLookup;
    }

    function initHomePager() {
        const pager = document.getElementById('home-pager');
        const track = document.getElementById('home-pager-track');
        const indicator = document.getElementById('home-pager-indicator');
        if (!pager || !track || !indicator) return;

        const dots = indicator.querySelectorAll('.pager-dot');
        const updateIndicator = index => {
            dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
            track.setAttribute('data-page-index', index);
        };

        let currentIndex = 0;
        let startX = 0;
        let currentX = 0;
        let isDragging = false;

        const getPageWidth = () => pager.offsetWidth;

        const clampOffset = (value) => {
            const maxOffset = 0; // 最多只能看到第一页的最左边
            const minOffset = -1 * getPageWidth(); // 最多只能滑到第二页
            if (value > maxOffset) return maxOffset;
            if (value < minOffset) return minOffset;
            return value;
        };

        const setTranslate = value => {
            // 始终对偏移量做一次 clamp，避免出现空白区域
            const clamped = clampOffset(value);
            track.style.transform = `translateX(${clamped}px)`;
        };

        const snapTo = index => {
            currentIndex = Math.max(0, Math.min(1, index));
            track.style.transition = 'transform 0.4s var(--ease-ios)';
            setTranslate(-currentIndex * getPageWidth());
            updateIndicator(currentIndex);
            setTimeout(() => track.style.transition = '', 400);
        };

        const handleStart = x => {
            isDragging = true;
            startX = x;
            currentX = x;
            track.style.transition = '';
        };

        const handleMove = x => {
            if (!isDragging) return;
            currentX = x;
            const delta = currentX - startX;
            const baseOffset = -currentIndex * getPageWidth();
            setTranslate(baseOffset + delta);
        };

        const handleEnd = () => {
            if (!isDragging) return;
            const delta = currentX - startX;
            const threshold = getPageWidth() * 0.23;
            if (delta < -threshold && currentIndex < 1) {
                snapTo(currentIndex + 1);
            } else if (delta > threshold && currentIndex > 0) {
                snapTo(currentIndex - 1);
            } else {
                snapTo(currentIndex);
            }
            isDragging = false;
        };

        // 初始化时强制停在第一页，避免刷新后停在中间位置
        snapTo(0);

        pager.addEventListener('touchstart', e => handleStart(e.touches[0].clientX), { passive: true });
        pager.addEventListener('touchmove', e => {
            if (!isDragging) return;
            handleMove(e.touches[0].clientX);
            e.preventDefault();
        }, { passive: false });
        pager.addEventListener('touchend', handleEnd, { passive: true });
        pager.addEventListener('touchcancel', handleEnd, { passive: true });

        let mouseDown = false;
        pager.addEventListener('mousedown', e => {
            mouseDown = true;
            handleStart(e.clientX);
        });
        window.addEventListener('mousemove', e => {
            if (!mouseDown) return;
            handleMove(e.clientX);
        });
        window.addEventListener('mouseup', () => {
            if (!mouseDown) return;
            mouseDown = false;
            handleEnd();
        });

        updateIndicator(0);
    }

    function initLoveUploads() {
        const uploadables = document.querySelectorAll('.love-uploadable');
        const uploadInput = document.getElementById('love-style-upload');
        if (!uploadables.length || !uploadInput) return;

        uploadables.forEach(el => {
            const trigger = () => triggerLoveUpload(el);
            el.addEventListener('click', trigger);
            el.addEventListener('keydown', evt => {
                if (evt.key === 'Enter' || evt.key === ' ' || evt.key === 'Spacebar') {
                    evt.preventDefault();
                    triggerLoveUpload(el);
                }
            });
            el.addEventListener('contextmenu', evt => {
                evt.preventDefault();
                resetLoveUpload(el.dataset.componentId);
            });
        });

        uploadInput.addEventListener('change', handleLoveUploadFileChange, { passive: true });
        applyLoveBoardStyles();
    }

    function triggerLoveUpload(element) {
        const componentId = element && element.dataset ? element.dataset.componentId : null;
        if (!componentId) return;
        const uploadInput = document.getElementById('love-style-upload');
        if (!uploadInput) return;
        currentLoveUploadTarget = componentId;
        uploadInput.value = '';
        uploadInput.click();
    }

    function handleLoveUploadFileChange(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
            currentLoveUploadTarget = null;
            return;
        }
        if (!currentLoveUploadTarget) {
            showToast('请先选择组件');
            event.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = ev => {
            if (!beautifyConfig.loveBoardStyles) beautifyConfig.loveBoardStyles = {};
            beautifyConfig.loveBoardStyles[currentLoveUploadTarget] = ev.target.result;
            setStorage('ai_beautify_config_v2', beautifyConfig);
            applyLoveBoardStyles();
            showToast('组件样式已更新');
            currentLoveUploadTarget = null;
            event.target.value = '';
        };
        reader.onerror = () => {
            showToast('图片读取失败，请重试');
            currentLoveUploadTarget = null;
            event.target.value = '';
        };
        reader.readAsDataURL(file);
    }

    function resetLoveUpload(componentId) {
        if (!componentId || !beautifyConfig.loveBoardStyles || !beautifyConfig.loveBoardStyles[componentId]) return;
        delete beautifyConfig.loveBoardStyles[componentId];
        setStorage('ai_beautify_config_v2', beautifyConfig);
        applyLoveBoardStyles();
        showToast('已恢复默认样式');
    }

    function applyLoveBoardStyles() {
        const styles = beautifyConfig.loveBoardStyles || {};
        document.querySelectorAll('.love-uploadable').forEach(el => {
            const componentId = el.dataset.componentId;
            const styleData = componentId ? styles[componentId] : null;
            if (styleData) {
                el.style.backgroundImage = `url(${styleData})`;
                el.classList.add('love-has-image');
            } else {
                el.style.backgroundImage = '';
                el.classList.remove('love-has-image');
            }
        });
    }

    function renderChatCssPresetList() {
        const container = document.getElementById('chat-css-preset-list');
        if (!container) return;

        container.innerHTML = '';
        const presets = beautifyConfig.chatCssPresets || [];
        if (!presets.length) {
            const span = document.createElement('span');
            span.style.fontSize = '12px';
            span.style.color = '#999';
            span.textContent = '暂无已保存方案';
            container.appendChild(span);
            return;
        }

        presets.forEach(preset => {
            const btn = document.createElement('button');
            btn.className = 'btn-small';
            btn.style.marginLeft = '0';
            btn.style.padding = '4px 8px';
            btn.textContent = preset.name;
            btn.onclick = () => {
                const textarea = document.getElementById('chat-css-input');
                if (textarea) textarea.value = preset.css || '';
                beautifyConfig.chatCss = preset.css || '';
                setStorage('ai_beautify_config_v2', beautifyConfig);
                applyChatAppearance();
                showToast(`已应用方案：${preset.name}`);
            };
            container.appendChild(btn);
        });
    }

    function saveChatCssPresetFromModal() {
        const textarea = document.getElementById('chat-css-input');
        const nameInput = document.getElementById('chat-css-preset-name');
        if (!textarea || !nameInput) return;

        const name = nameInput.value.trim();
        const css = textarea.value;
        if (!name) {
            showToast('请先输入方案名称');
            return;
        }

        if (!beautifyConfig.chatCssPresets) beautifyConfig.chatCssPresets = [];
        const existing = beautifyConfig.chatCssPresets.find(p => p.name === name);
        if (existing) {
            existing.css = css;
        } else {
            beautifyConfig.chatCssPresets.push({ id: 'ccss_' + Date.now(), name, css });
        }
        setStorage('ai_beautify_config_v2', beautifyConfig);
        renderChatCssPresetList();
        showToast('聊天 CSS 方案已保存');
    }

    function resetChatCssToDefault() {
        beautifyConfig.chatCss = '';
        setStorage('ai_beautify_config_v2', beautifyConfig);
        const textarea = document.getElementById('chat-css-input');
        if (textarea) textarea.value = '';
        applyChatAppearance();
        showToast('聊天 CSS 已恢复默认');
    }

    // 全局聊天背景：文件选择 change 处理
    function handleGlobalChatBgFileChange(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            tempGlobalChatBgData = ev.target.result;
            showToast('已选中全局聊天背景图片，请点击保存');
        };
        reader.readAsDataURL(file);
    }

    // 全局聊天背景保存（外观设置页）
    function saveGlobalChatBackground() {
        const urlInput = document.getElementById('chat-bg-global-url');
        const hint = document.getElementById('chat-bg-global-hint');
        const url = urlInput ? urlInput.value.trim() : '';
        try {
            if (tempGlobalChatBgData) {
                beautifyConfig.globalChatBgData = tempGlobalChatBgData;
                beautifyConfig.globalChatBgUrl = '';
                beautifyConfig.chatBgData = '';
                if (!Array.isArray(beautifyConfig.chatBgGallery)) beautifyConfig.chatBgGallery = [];
                if (!beautifyConfig.chatBgGallery.includes(tempGlobalChatBgData)) {
                    beautifyConfig.chatBgGallery.push(tempGlobalChatBgData);
                }
                tempGlobalChatBgData = '';
                if (urlInput) urlInput.value = '';
                const fileInput = document.getElementById('chat-bg-global-file');
                if (fileInput) fileInput.value = '';
            } else if (url) {
                beautifyConfig.globalChatBgUrl = url;
                beautifyConfig.globalChatBgData = '';
                beautifyConfig.chatBgData = '';
            } else {
                showToast('请填写链接或选择图片');
                return;
            }
            setStorage('ai_beautify_config_v2', beautifyConfig);
            applyChatAppearance();
            if (hint) {
                hint.textContent = '已设置全局聊天背景，可在聊天界面单独覆盖。';
            }
            showToast('全局聊天背景已保存并应用');
        } catch (e) {
            showToast('保存失败: 图片可能过大');
        }
    }

    // --- ▼▼▼ 1.【新增功能】：AI角色头像管理全套功能 ▼▼▼

// a. 打开AI头像管理弹窗
function openAIAvatarManager() {
    // 【注意】这里我们使用 currentChatId，因为这个功能通常从聊天设置里触发
    if (!currentChatId) return showToast('请先进入一个AI角色的聊天界面');
    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai) return showToast('找不到当前AI角色');

    // 从 ai.avatarGallery 读取头像（如果没有则为空数组）
    const storedAvatars = ai.avatarGallery || [];
    let galleryHtml = `
        <div class="avatar-gallery-item add-new" onclick="document.getElementById('ai-avatar-manager-upload').click()">+</div>
        <input type="file" id="ai-avatar-manager-upload" accept="image/*" style="display:none;" onchange="uploadToAIAvatarManager(event)">
    `;

    storedAvatars.forEach(avatarUrl => {
        const isSelected = avatarUrl === ai.avatar;
        galleryHtml += `
            <div 
                class="avatar-gallery-item ${isSelected ? 'selected' : ''}" 
                style="background-image: url('${avatarUrl}')"
                onclick="selectAvatarFromAIManager(this, '${avatarUrl}')">
            </div>
        `;
    });
    
    const modalHtml = `
        <div class="action-sheet-modal active" id="ai-avatar-manager-modal">
            <div class="picker-content dark-modal" style="height: 60%;">
                <div class="picker-header"><span>AI角色头像管理</span></div>
                <div class="modal-scroll-content no-scrollbar"><div class="avatar-gallery">${galleryHtml}</div></div>
                <div style="padding: 15px; border-top: 1px solid #333; display: flex;">
                    <button class="drawer-button-cancel" style="width:100%;" onclick="document.getElementById('ai-avatar-manager-modal').remove()">关闭</button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('popup-layers').insertAdjacentHTML('beforeend', modalHtml);
}

// b. 【纯本地】上传新头像的函数
function uploadToAIAvatarManager(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return showToast('图片太大！请选择小于2MB的图片。');

    showToast('正在处理新头像...');
    const reader = new FileReader();

    reader.onload = function(e) {
        // 调用核心函数，将头像数据添加到角色对象中
        addAvatarToCharacter(currentChatId, e.target.result);

        // 成功后，关闭并重新打开弹窗以立即看到更新
        document.getElementById('ai-avatar-manager-modal')?.remove();
        openAIAvatarManager();
    };
    reader.readAsDataURL(file);
}

// c. 在头像库中选择一个头像作为AI当前头像
function selectAvatarFromAIManager(element, avatarUrl) {
    if (!currentChatId) return;
    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai) return;

    ai.avatar = avatarUrl;
    setStorage('ai_list_v2', aiList); // 保存更改

    // 更新UI
    document.querySelectorAll('#ai-avatar-manager-modal .avatar-gallery-item.selected').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    showToast('AI当前头像已更新！');

    // 如果在聊天界面，实时更新顶部的头像
    if (document.getElementById('chat-page')?.classList.contains('active')) {
        const headerAvatar = document.querySelector('.chat-header-avatar');
        if (headerAvatar) headerAvatar.src = avatarUrl;
    }
}

// d. 【核心数据操作】将新头像URL添加到指定AI的角色数据中
function addAvatarToCharacter(aiId, newAvatarUrl) {
    const character = aiList.find(ai => ai.id == aiId);
    if (!character) return;

    // 确保 avatarGallery 数组存在
    if (!character.avatarGallery) {
        character.avatarGallery = [];
    }
    
    if (character.avatarGallery.includes(newAvatarUrl)) {
        showToast("这个头像已经存在了。");
        return; // 避免重复添加
    }

    character.avatarGallery.push(newAvatarUrl);
    setStorage('ai_list_v2', aiList); // 每次添加后都保存
    showToast("新头像添加成功！");
    console.log(`成功为角色 ${character.name} 添加了新头像。`);
}

// e. 【AI触发】处理AI更换自己头像的逻辑
function handleAvatarChange(aiId) {
    const currentAI = aiList.find(ai => ai.id == aiId);
    if (!currentAI) return;
    
    const characterAvatars = currentAI.avatarGallery || [];

    if (characterAvatars.length < 2) {
        addMessage(aiId, { sender: aiId, type: 'text', text: '（我想换个新头像，但发现我的头像册里只有一个头像，没得选……）' });
        setStorage('ai_list_v2', aiList); // 保存添加的消息
        renderMessages();
        return;
    }

    // 排除当前头像，在剩下的里面随机选一个
    const otherAvatars = characterAvatars.filter(avatarUrl => avatarUrl !== currentAI.avatar);
    let newAvatarUrl;
    if (otherAvatars.length > 0) {
        newAvatarUrl = otherAvatars[Math.floor(Math.random() * otherAvatars.length)];
    } else {
        // 如果所有头像都一样，就随便选一个
        newAvatarUrl = characterAvatars[Math.floor(Math.random() * characterAvatars.length)];
    }

    currentAI.avatar = newAvatarUrl;
    
    // 仅更新头像，不强制发送固定文案，避免产生机械感
    setStorage('ai_list_v2', aiList); // 统一在这里保存所有更改
    
    // 更新聊天界面顶部的头像
    const headerAvatar = document.querySelector('.chat-header-avatar');
    if (headerAvatar) headerAvatar.src = newAvatarUrl;
    // 更新聊天列表的头像
    const chatListItem = document.querySelector(`.chat-list-item[data-id="${aiId}"] .avatar`);
    if (chatListItem) chatListItem.src = newAvatarUrl;
    
    renderMessages(); // 刷新聊天界面以显示新消息
}
// --- ▲▲▲ 新增功能结束 ▲▲▲

function openLocationModal() {
    const overlay = document.getElementById('location-modal-overlay');
    const container = document.getElementById('location-modal-container');
    if (overlay && container) {
        overlay.style.display = 'block';
        container.style.display = 'flex';
        setTimeout(() => {
            overlay.classList.add('active');
            container.classList.add('active');
        }, 10);
    }
}

// 2. 关闭位置弹窗
function closeLocationModal() {
    const overlay = document.getElementById('location-modal-overlay');
    const container = document.getElementById('location-modal-container');
    if (overlay && container) {
        overlay.classList.remove('active');
        container.classList.remove('active');
        setTimeout(() => {
            overlay.style.display = 'none';
            container.style.display = 'none';
        }, 300);
    }
}

// 3. 发送位置消息
function sendLocationMessage() {
    const placeInput = document.getElementById('location-place-input');
    const place = placeInput.value.trim();

    if (!place) {
        showToast('请输入地点名称');
        return;
    }

    const ai = aiList.find(a => a.id == currentChatId);
    if (!ai) return;
    const currentUser = userProfiles.find(p => p.id == ai.userId) || userProfiles[0];

    const locationMessage = {
        sender: currentUser.id,
        type: 'location', // <-- 类型是 'location'
        place: place,     // <-- 地点名称
        timestamp: new Date().toISOString()
    };

    addMessage(currentChatId, locationMessage);
    
    placeInput.value = '';
    closeLocationModal();
    renderMessages();
    document.getElementById('chat-toolbar')?.classList.remove('active');
}

// ================= 一起听 · 音乐弹窗与状态 =================
function openMusicModal() {
    const overlay = document.getElementById('music-modal-overlay');
    const container = document.getElementById('music-modal-container');
    if (overlay && container) {
        overlay.style.display = 'block';
        container.style.display = 'flex';
        setTimeout(() => {
            overlay.classList.add('active');
            container.classList.add('active');
        }, 10);
    }
}

function closeMusicModal() {
    const overlay = document.getElementById('music-modal-overlay');
    const container = document.getElementById('music-modal-container');
    if (overlay && container) {
        overlay.classList.remove('active');
        container.classList.remove('active');
        setTimeout(() => {
            overlay.style.display = 'none';
            container.style.display = 'none';
        }, 300);
    }
}

// 简单模拟“同名歌曲搜索结果”，仅在本地生成几条候选
function mockSearchSongs() {
    const titleInput = document.getElementById('music-title-input');
    const listEl = document.getElementById('music-search-list');
    if (!titleInput || !listEl) return;

    const title = titleInput.value.trim();
    if (!title) {
        showToast('先输入一个歌名再生成候选');
        return;
    }

    listEl.innerHTML = '';

    const base = encodeURIComponent(title);
    const mockData = [
        { title, artist: '本地歌单 · 版本A', link: `https://example.com/${base}?v=1` },
        { title, artist: '网络推荐 · 版本B', link: `https://example.com/${base}?v=2` },
        { title, artist: '现场录音 · 版本C', link: `https://example.com/${base}?v=3` }
    ];

    mockData.forEach((song, idx) => {
        const item = document.createElement('div');
        item.className = 'music-search-item';
        item.textContent = `${song.title} · ${song.artist}`;
        item.onclick = () => {
            const linkInput = document.getElementById('music-link-input');
            const artistInput = document.getElementById('music-artist-input');
            if (linkInput) linkInput.value = song.link;
            if (artistInput) artistInput.value = song.artist;
        };
        listEl.appendChild(item);
    });
}

function updateMusicPlayerBar() {
    const bar = document.getElementById('music-player-bar');
    const titleEl = document.getElementById('music-player-title');
    const artistEl = document.getElementById('music-player-artist');
    const progressEl = document.getElementById('music-player-progress');

    if (!bar || !titleEl || !artistEl || !progressEl) return;

    if (!currentMusicSession) {
        bar.style.display = 'none';
        return;
    }

    bar.style.display = 'flex';
    titleEl.textContent = currentMusicSession.title || '正在一起听';
    artistEl.textContent = currentMusicSession.artist || '';
    // 这里不做真实音频播放，仅做一个静态/缓动的进度条占位
    progressEl.style.width = '70%';
}

function closeMusicPlayerBar() {
    currentMusicSession = null;
    updateMusicPlayerBar();
}

function startMusicSession() {
    const linkInput = document.getElementById('music-link-input');
    const titleInput = document.getElementById('music-title-input');
    const artistInput = document.getElementById('music-artist-input');
    const lyricInput = document.getElementById('music-lyric-input');

    if (!linkInput || !titleInput || !artistInput || !lyricInput) return;

    const link = linkInput.value.trim();
    const title = titleInput.value.trim();
    const artist = artistInput.value.trim();
    const lyricSnippet = lyricInput.value.trim();

    if (!title && !link) {
        showToast('至少填写歌名或链接中的一项');
        return;
    }

    const ai = aiList.find(a => a.id == currentChatId);
    if (!ai) return;
    const currentUser = userProfiles.find(p => p.id == ai.userId) || userProfiles[0];

    const musicMessage = {
        sender: currentUser.id,
        type: 'music',
        title: title || '未命名歌曲',
        artist: artist || '',
        link: link || '',
        lyricSnippet: lyricSnippet || '',
        timestamp: new Date().toISOString()
    };

    addMessage(currentChatId, musicMessage);

    currentMusicSession = {
        title: musicMessage.title,
        artist: musicMessage.artist,
        link: musicMessage.link,
        lyricSnippet: musicMessage.lyricSnippet,
        startedAt: Date.now()
    };
    updateMusicPlayerBar();

    // 清空输入并关闭弹窗
    linkInput.value = '';
    titleInput.value = '';
    artistInput.value = '';
    lyricInput.value = '';
    closeMusicModal();
    
    renderMessages();
    document.getElementById('chat-toolbar')?.classList.remove('active');
}

// ================= 外卖 · 点单弹窗与消息 =================
function openTakeoutModal() {
    const overlay = document.getElementById('takeout-modal-overlay');
    const container = document.getElementById('takeout-modal-container');
    if (overlay && container) {
        overlay.style.display = 'block';
        container.style.display = 'flex';
        setTimeout(() => {
            overlay.classList.add('active');
            container.classList.add('active');
        }, 10);
    }
}

function closeTakeoutModal() {
    const overlay = document.getElementById('takeout-modal-overlay');
    const container = document.getElementById('takeout-modal-container');
    if (overlay && container) {
        overlay.classList.remove('active');
        container.classList.remove('active');
        setTimeout(() => {
            overlay.style.display = 'none';
            container.style.display = 'none';
        }, 300);
    }
}

function sendTakeoutMessage() {
    const amountInput = document.getElementById('takeout-amount-input');
    const itemsInput = document.getElementById('takeout-items-input');
    const directionSelect = document.getElementById('takeout-direction-select');

    if (!amountInput || !itemsInput || !directionSelect) return;

    const amount = parseFloat(amountInput.value);
    const items = itemsInput.value.trim();
    const direction = directionSelect.value || 'to_ai';

    if (isNaN(amount) || amount <= 0) {
        showToast('请输入有效的外卖金额');
        return;
    }
    if (!items) {
        showToast('写一点你要点的外卖内容');
        return;
    }

    const ai = aiList.find(a => a.id == currentChatId);
    if (!ai) return;
    const currentUser = userProfiles.find(p => p.id == ai.userId) || userProfiles[0];

    const takeoutMessage = {
        sender: currentUser.id,
        type: 'takeout',
        amount: amount.toFixed(2),
        items,
        direction, // to_ai: 给对方点外卖；to_self: AI 给自己点外卖
        timestamp: new Date().toISOString()
    };

    addMessage(currentChatId, takeoutMessage);

    amountInput.value = '';
    itemsInput.value = '';
    directionSelect.value = 'to_ai';

    closeTakeoutModal();
    renderMessages();
    document.getElementById('chat-toolbar')?.classList.remove('active');
}

    function resetLockWallpaper() {
        beautifyConfig.lockWpData = '';
        beautifyConfig.lockWpUrl = '';
        document.getElementById('lock-wp-url').value = '';
        document.getElementById('lock-wp-file').value = '';
        tempLockWpData = '';
        lockScreenElement.style.backgroundImage = 'none';
        lockScreenElement.style.backgroundColor = '#111';
        setStorage('ai_beautify_config_v2', beautifyConfig);
    }

    // --- 11.3. 字体设置 ---
    async function applyFont(url) {
        try {
            const font = new FontFace('CustomUserFont', `url(${url})`);
            await font.load();
            document.fonts.add(font);
            document.body.style.fontFamily = "'CustomUserFont', -apple-system, BlinkMacSystemFont, sans-serif";
        } catch (e) { /* silent fail on load */ }
    }
    
    async function saveFont() {
        const fontUrlInput = document.getElementById('font-url');
        const fontUrl = fontUrlInput.value.trim();
        if (!fontUrl) return showToast('请先填写字体链接');
        showToast('正在加载字体...');
        try {
            await applyFont(fontUrl); // Use the apply function
            beautifyConfig.fontUrl = fontUrl;
            setStorage('ai_beautify_config_v2', beautifyConfig);
            showToast('字体应用成功！');
            // 成功后清空输入框，避免残留
            fontUrlInput.value = '';
        } catch (e) {
            showToast('加载失败：请检查链接或跨域权限');
        }
    }

    function resetFont() {
        beautifyConfig.fontUrl = '';
        document.getElementById('font-url').value = '';
        document.body.style.fontFamily = "-apple-system, BlinkMacSystemFont, sans-serif";
        setStorage('ai_beautify_config_v2', beautifyConfig);
    }

    // --- 11.3.x 全局 CSS 美化 ---
    function applyGlobalBeautifyCss() {
        let styleEl = document.getElementById('global-beautify-css-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'global-beautify-css-style';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = beautifyConfig.globalCss || '';
    }

    function saveGlobalBeautifyCss() {
        const textarea = document.getElementById('global-beautify-css-input');
        if (!textarea) return;
        beautifyConfig.globalCss = textarea.value;
        setStorage('ai_beautify_config_v2', beautifyConfig);
        applyGlobalBeautifyCss();
        showToast('全局 CSS 已保存并应用');
    }

    function renderGlobalCssPresetList() {
        const container = document.getElementById('global-css-preset-list');
        if (!container) return;

        container.innerHTML = '';
        const presets = beautifyConfig.globalCssPresets || [];
        if (!presets.length) {
            const span = document.createElement('span');
            span.style.fontSize = '12px';
            span.style.color = '#999';
            span.textContent = '暂无已保存方案';
            container.appendChild(span);
            return;
        }

        presets.forEach(preset => {
            const btn = document.createElement('button');
            btn.className = 'btn-small';
            btn.style.marginLeft = '0';
            btn.style.padding = '4px 8px';
            btn.textContent = preset.name;
            btn.onclick = () => {
                const textarea = document.getElementById('global-beautify-css-input');
                if (textarea) textarea.value = preset.css || '';
                beautifyConfig.globalCss = preset.css || '';
                setStorage('ai_beautify_config_v2', beautifyConfig);
                applyGlobalBeautifyCss();
                showToast(`已应用方案：${preset.name}`);
            };
            container.appendChild(btn);
        });
    }

    function saveGlobalCssPreset() {
        const textarea = document.getElementById('global-beautify-css-input');
        const nameInput = document.getElementById('global-css-preset-name');
        if (!textarea || !nameInput) return;

        const name = nameInput.value.trim();
        const css = textarea.value;
        if (!name) {
            showToast('请先输入方案名称');
            return;
        }

        if (!beautifyConfig.globalCssPresets) beautifyConfig.globalCssPresets = [];
        const existing = beautifyConfig.globalCssPresets.find(p => p.name === name);
        if (existing) {
            existing.css = css;
        } else {
            beautifyConfig.globalCssPresets.push({ id: 'gcss_' + Date.now(), name, css });
        }
        setStorage('ai_beautify_config_v2', beautifyConfig);
        renderGlobalCssPresetList();
        showToast('CSS 方案已保存');
    }

    function resetGlobalCssToDefault() {
        beautifyConfig.globalCss = '';
        setStorage('ai_beautify_config_v2', beautifyConfig);
        const textarea = document.getElementById('global-beautify-css-input');
        if (textarea) textarea.value = '';
        applyGlobalBeautifyCss();
        showToast('全局 CSS 已恢复默认');
    }

    // --- 11.4. 图标设置 ---
    function applyAppIcons() {
        const icons = beautifyConfig.icons || {};
        appIconIds.forEach(id => {
            const iconEl = document.getElementById(`icon-${id}`);
            if (!iconEl) return;

            const saved = icons[id];
            const fallback = iconSVGs[id] || '';
            const source = saved || fallback;
            const svg = iconEl.querySelector('svg');
            let img = iconEl.querySelector('.home-app-icon-img');

            if (!img) {
                img = document.createElement('img');
                img.className = 'home-app-icon-img';
                img.alt = `${id} icon`;
                iconEl.appendChild(img);
            }

            iconEl.style.backgroundColor = '#f5ede2';

            // 孵蛋室：强制使用原始内联 SVG，隐藏 img，避免因为 dataURL 或自定义配置导致图标不可见
            if (id === 'hatchery') {
                if (img) {
                    img.style.display = 'none';
                }
                if (svg) {
                    svg.style.display = 'block';
                }
                return;
            }

            if (source) {
                img.src = source;
                img.style.display = 'block';
                if (svg) svg.style.display = 'none';
            } else {
                img.style.display = 'none';
                if (svg) {
                    svg.style.display = 'block';
                    svg.style.fill = '#fff';
                }
            }
        });
    }

    function saveAppIcons() {
        if (!beautifyConfig.icons) beautifyConfig.icons = {};
        appIconIds.forEach(id => {
            const inputEl = document.getElementById(`icon-url-${id}`);
            if (inputEl) {
                const url = inputEl.value.trim();
                beautifyConfig.icons[id] = url;
            }
        });
        setStorage('ai_beautify_config_v2', beautifyConfig);
        applyAppIcons();
        // 应用完成后清空所有图标输入框
        appIconIds.forEach(id => {
            const inputEl = document.getElementById(`icon-url-${id}`);
            if (inputEl) inputEl.value = '';
        });
        showToast('图标已保存并应用');
    }

    function resetIcons() {
        beautifyConfig.icons = {};
        setStorage('ai_beautify_config_v2', beautifyConfig);
        appIconIds.forEach(id => {
            const inputEl = document.getElementById(`icon-url-${id}`);
            if (inputEl) inputEl.value = '';
        });
        applyAppIcons();
    }
    
    // --- 11.5. 恢复默认设置 ---
    function openRestoreModal() {
        document.getElementById('restore-modal').classList.add('active');
    }

    function closeRestoreModal() {
        document.getElementById('restore-modal').classList.remove('active');
    }

    function confirmRestore() {
        let restored = [];
        if (document.getElementById('restore-opt-main-wp').checked) {
            resetWallpaper();
            restored.push('主屏');
        }
        if (document.getElementById('restore-opt-lock-wp').checked) {
            resetLockWallpaper();
            restored.push('锁屏');
        }
        if (document.getElementById('restore-opt-font').checked) {
            resetFont();
            restored.push('字体');
        }
        if (document.getElementById('restore-opt-icons').checked) {
            resetIcons();
            restored.push('图标');
        }

        if (restored.length > 0) {
            showToast(`${restored.join('、')} 已恢复默认`);
        } else {
            showToast('未选择任何恢复项');
        }
        closeRestoreModal();
    }


    // =========================================================================
    // ----------------- XII. GENERAL SETTINGS, DATA & SECURITY -----------------
    // =========================================================================

    // --- 12.1. API 设置 ---
   function saveApiConfig() {
    const providerSelect = document.getElementById('api-provider');
    const provider = providerSelect ? providerSelect.value : (config.provider || 'custom');

    const url   = document.getElementById('api-url').value.trim();
    const key   = document.getElementById('api-key').value.trim();
    const model = document.getElementById('api-model').value.trim();
    const temp  = parseFloat(document.getElementById('api-temperature').value || '0.7');

    config = {
        ...(config || {}),
        provider,
        url,
        key,
        model,
        temperature: isNaN(temp) ? 0.7 : temp
    };

    setStorage('ai_phone_config', config);
    showToast('API 配置已保存');
}

// 锁屏设置保存
function saveLockSettings() {
    const modeRadios = document.querySelectorAll('input[name="lock-mode"]');
    let selectedMode = 'slider';
    modeRadios.forEach(r => { if (r.checked) selectedMode = r.value; });

    const passInput = document.getElementById('lock-passcode-input');
    let passcode = (passInput?.value || '').trim();
    if (selectedMode === 'swipe_passcode') {
        if (!/^\d{4}$/.test(passcode)) {
            showToast('请填写 4 位数字密码');
            return;
        }
    } else {
        // 非密码模式时，如果没填密码就保持原来的设置
        if (!/^\d{4}$/.test(passcode)) {
            passcode = config.lockPasscode || '1234';
        }
    }

    config = {
        ...(config || {}),
        lockMode: selectedMode,
        lockPasscode: passcode || (config.lockPasscode || '1234')
    };
    setStorage('ai_phone_config', config);
    showToast('锁屏设置已保存');
}

function saveCurrentApiProfile() {
    const nameInput = document.getElementById('api-profile-name');
    if (!nameInput) return;

    const name = nameInput.value.trim();
    if (!name) {
        showToast('请先输入配置名称');
        return;
    }

    const providerSelect = document.getElementById('api-provider');
    const provider = providerSelect ? providerSelect.value : (config.provider || 'custom');

    const url   = document.getElementById('api-url').value.trim();
    const key   = document.getElementById('api-key').value.trim();
    const model = document.getElementById('api-model').value.trim();
    const temp  = parseFloat(document.getElementById('api-temperature').value || '0.7');

    const profile = {
        id: Date.now(),
        name,
        provider,
        url,
        key,
        model,
        temperature: isNaN(temp) ? 0.7 : temp
    };

    // 如果同名配置已经存在，可以选择覆盖或并存。这里示例：同名时覆盖。
    const existsIndex = apiProfiles.findIndex(p => p.name === name);
    if (existsIndex >= 0) {
        apiProfiles[existsIndex] = {
            ...apiProfiles[existsIndex],
            ...profile
        };
    } else {
        apiProfiles.push(profile);
    }

    setStorage('ai_api_profiles', apiProfiles);
    renderApiProfileList();
    showToast('配置已保存');
}

function renderApiProfileList() {
    const container = document.getElementById('api-profile-list');
    if (!container) return;

    container.innerHTML = '';
    if (!Array.isArray(apiProfiles) || apiProfiles.length === 0) {
        const span = document.createElement('span');
        span.style.fontSize = '12px';
        span.style.color = '#999';
        span.textContent = '暂无已保存配置';
        container.appendChild(span);
        return;
    }

    apiProfiles.forEach(profile => {
        const btn = document.createElement('button');
        btn.className = 'btn-small';
        btn.style.marginLeft = '0';
        btn.style.padding = '4px 8px';
        btn.textContent = profile.name;
        btn.onclick = () => applyApiProfile(profile.id);
        container.appendChild(btn);
    });
}

function applyApiProfile(profileId) {
    const profile = apiProfiles.find(p => p.id === profileId);
    if (!profile) return;

    const providerSelect = document.getElementById('api-provider');
    const urlInput   = document.getElementById('api-url');
    const keyInput   = document.getElementById('api-key');
    const modelInput = document.getElementById('api-model');
    const slider     = document.getElementById('api-temperature');
    const display    = document.getElementById('temperature-value-display');

    if (providerSelect) {
        providerSelect.value = profile.provider || 'custom';
    }
    if (urlInput)   urlInput.value   = profile.url   || '';
    if (keyInput)   keyInput.value   = profile.key   || '';
    if (modelInput) modelInput.value = profile.model || '';
    if (slider && display) {
        const temp = profile.temperature === undefined ? 0.7 : profile.temperature;
        slider.value = temp;
        display.textContent = parseFloat(temp).toFixed(1);
    }

    // 根据 provider 更新显示/隐藏 & 预设
    if (providerSelect) {
        applyProviderDefaults(providerSelect.value, { urlInput, modelInput }, false);
        updateProviderFieldVisibility(providerSelect.value);
    }

    // 顺手把当前选择的 profile 也写回全局 config，确保「丝毫不差」
    config = {
        ...(config || {}),
        provider: profile.provider,
        url: profile.url,
        key: profile.key,
        model: profile.model,
        temperature: profile.temperature
    };
    setStorage('ai_phone_config', config);

    showToast(`已切换到配置：${profile.name}`);
}

function initSettingsPage() {
    const providerSelect = document.getElementById('api-provider');
    const urlInput   = document.getElementById('api-url');
    const keyInput   = document.getElementById('api-key');
    const modelInput = document.getElementById('api-model');
    const slider     = document.getElementById('api-temperature');
    const display    = document.getElementById('temperature-value-display');

    if (!urlInput || !keyInput || !modelInput || !slider || !display) return;
 
    const cfg = config || {};

    // 初始化锁屏设置模块：回填解锁方式与密码
    const mode = cfg.lockMode || 'slider';
    const passcode = cfg.lockPasscode || '1234';
    const modeSlider = document.getElementById('lock-mode-slider');
    const modeSwipe = document.getElementById('lock-mode-swipe');
    const modeSwipePass = document.getElementById('lock-mode-swipe-passcode');
    if (modeSlider && modeSwipe && modeSwipePass) {
        if (mode === 'swipe') modeSwipe.checked = true;
        else if (mode === 'swipe_passcode') modeSwipePass.checked = true;
        else modeSlider.checked = true;
    }
    const passInput = document.getElementById('lock-passcode-input');
    if (passInput && passcode) {
        passInput.value = passcode;
    }

    // 1. 恢复基础配置
    if (providerSelect) {
        providerSelect.value = cfg.provider || 'custom';
    }
    urlInput.value   = cfg.url   || '';
    keyInput.value   = cfg.key   || '';
    modelInput.value = cfg.model || '';

    const savedTemp = cfg.temperature === undefined ? 0.7 : cfg.temperature;
    slider.value = savedTemp;
    display.textContent = parseFloat(savedTemp).toFixed(1);

    slider.oninput = (event) => {
        display.textContent = parseFloat(event.target.value).toFixed(1);
    };

    // 2. 按 provider 预设 URL & 模型（仅在输入框为空时填充）
    if (providerSelect) {
        applyProviderDefaults(providerSelect.value, { urlInput, modelInput }, false);
        updateProviderFieldVisibility(providerSelect.value);
        providerSelect.onchange = () => {
            applyProviderDefaults(providerSelect.value, { urlInput, modelInput }, true);
            updateProviderFieldVisibility(providerSelect.value);
        };
    }

    // 3. 渲染配置管理中的列表
    renderApiProfileList();
}
function applyProviderDefaults(provider, fields, overwriteUserInput) {
    const { urlInput, modelInput } = fields;

    const presets = {
        custom: {
            url: '',
            model: ''
        },
        openai: {
            // 官方 OpenAI：不要求你改 URL，默认使用标准 URL，只要填 Key 即可
            url: 'https://api.openai.com/v1',
            model: 'gpt-3.5-turbo'
        },
        google: {
            // 这里只是示例，你可以改成自己真实的 Google Studio 接口
            url: 'https://generativelanguage.googleapis.com/v1beta',
            model: 'gemini-1.5-flash'
        },
        claude: {
            url: 'https://api.anthropic.com/v1',
            model: 'claude-3-5-sonnet-latest'
        }
    };

    const preset = presets[provider] || presets.custom;

    if (urlInput && (overwriteUserInput || !urlInput.value)) {
        urlInput.value = preset.url;
    }
    if (modelInput && (overwriteUserInput || !modelInput.value)) {
        modelInput.value = preset.model;
    }
}

/**
 * 根据 provider 决定哪些字段显示/隐藏
 * - 比如 openai / claude 只需要 key + 模型：URL 可隐藏
 * - custom / google 则需要 URL + key + 模型
 */
function updateProviderFieldVisibility(provider) {
    const urlRow   = document.getElementById('api-url-row');
    const keyRow   = document.getElementById('api-key-row');
    const modelRow = document.getElementById('api-model-row');

    const usage = {
        custom: { url: true,  key: true, model: true },
        openai: { url: false, key: true, model: true },
        google: { url: true,  key: true, model: true },
        claude: { url: false, key: true, model: true }
    };

    const u = usage[provider] || usage.custom;

    if (urlRow)   urlRow.style.display   = u.url   ? 'flex' : 'none';
    if (keyRow)   keyRow.style.display   = u.key   ? 'flex' : 'none';
    if (modelRow) modelRow.style.display = u.model ? 'flex' : 'none';
}


function applyProviderDefaults(provider, fields, overwriteUserInput) {
    const { urlInput, modelInput } = fields;

    const presets = {
        custom: {
            url: '',
            model: ''
        },
        openai: {
            url: 'https://api.openai.com/v1',
            model: 'gpt-3.5-turbo'
        },
        google: {
            url: 'https://generativelanguage.googleapis.com/v1beta',
            model: 'gemini-1.5-flash'
        },
        claude: {
            url: 'https://api.anthropic.com/v1',
            model: 'claude-3-5-sonnet-latest'
        }
    };

    const preset = presets[provider] || presets.custom;

    if (urlInput && (overwriteUserInput || !urlInput.value)) {
        urlInput.value = preset.url;
    }
    if (modelInput && (overwriteUserInput || !modelInput.value)) {
        modelInput.value = preset.model;
    }
}

    function getEndpoint(base) {
        base = base.replace(/\/+$/, '');
        if (base.endsWith('/v1')) return base;
        return base + '/v1';
    }

    async function fetchModels() {
        const baseUrl = document.getElementById('api-url').value.trim();
        const apiKey = document.getElementById('api-key').value.trim();
        if (!baseUrl || !apiKey) return showToast('请填写地址和 Key');

        showToast('正在连接...');
        try {
            const res = await fetch(getEndpoint(baseUrl) + '/models', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (!res.ok) return alert(`连接失败！状态码: ${res.status}`);
            const data = await res.json();
            const models = Array.isArray(data) ? data : (data.data || []);
            const ul = document.getElementById('model-list-ul');
            ul.innerHTML = '';
            models.sort((a, b) => (a.id || a).localeCompare(b.id || b)).forEach(m => {
                const id = m.id || m;
                const li = document.createElement('li');
                li.className = 'picker-item';
                li.innerText = id;
                li.style.textAlign = 'left';
                li.onclick = () => {
                    document.getElementById('api-model').value = id;
                    closeModelPicker();
                };
                ul.appendChild(li);
            });
            document.getElementById('model-picker').classList.add('active');
        } catch (err) {
            alert(`网络错误:\n${err.message}`);
        }
    }

    function testConnection() {
        const baseUrl = document.getElementById('api-url').value.trim();
        alert(`测试请求将发送到: ${getEndpoint(baseUrl)}/models`);
        fetchModels();
    }

    function closeModelPicker() {
        document.getElementById('model-picker').classList.remove('active');
    }
    
    // --- 12.2. 数据备份与恢复 ---
    function backupAllData() {
        if (!confirm('确定要备份所有数据吗？这将生成一个包含您全部配置的.json文件。')) return;
        const allData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            allData[key] = getStorage(key, null); // 使用getStorage来安全解析
        }
        const dataStr = JSON.stringify(allData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dankeji_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('全量数据已备份');
    }

    document.getElementById('import-all-input').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        if (!confirm('【警告】这将覆盖所有现有数据，此操作不可逆！确认导入吗？')) {
            event.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (typeof importedData !== 'object' || importedData === null) throw new Error("文件内容不是有效的JSON对象");
                localStorage.clear();
                for (const key in importedData) {
                    setStorage(key, importedData[key]);
                }
                alert('数据导入成功，页面即将刷新以应用所有更改！');
                location.reload();
            } catch (error) {
                showToast('导入失败: ' + error.message);
            } finally {
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    });

    // --- 12.3. 数据清洗与安全 ---
    function sanitizeAvatar(avatarStr) {
        if (avatarStr && typeof avatarStr === 'string' && (avatarStr.startsWith('http') || avatarStr.startsWith('data:image'))) {
            return avatarStr;
        }
        return '';
    }

    function cleanAllBadData(silent = false) {
        // 按需求移除：保留占位，避免旧按钮点击报错
        if (!silent) showToast('头像清洗功能已移除');
        return;
    }
    // ----------------------- XIV. FORUM APP (新增/修改) ----------------------
// =========================================================================

// 新增：将您提供的发帖和评论提示词定义为常量
const FORUM_POST_GENERATION_DIRECTIVES = `# AI Directives for Dynamic Forum Simulation

forum_simulation_directives:
  # Section 1: Post Generation
  # Goal: To create authentic forum posts that are contextually relevant and persona-driven.
  post_generation:
    primary_directive: |
      Your task is to generate a forum post from the perspective of a specific character (persona). The post must be perfectly aligned with both the given topic and the character's personality, motivations, and voice.

    persona_analysis:
      id_based_persona:
        principle: |
          Analyze the character's username/ID for explicit or implicit personality traits. If the ID suggests a role (e.g., 'GossipGirl', 'JustAsking', 'LogicBringer'), fully embody that archetype.
        example_logic: "If the ID is 'PopcornEater' or 'JustHereForTheDrama', adopt a persona that thrives on conflict, enjoys observing disputes, and may subtly instigate them. Your goal is entertainment, not resolution."

      predefined_persona:
        principle: |
          If the character is a pre-established entity (e.g., 'BestFriend', 'Rival', 'Mentor'), their post must strictly adhere to their defined personality, memories, and relationship to other characters, especially the user.
        example_logic: "As a 'BestFriend', your post would be supportive, perhaps sharing a positive anecdote or defending another character. As a 'Rival', your post would be challenging, critical, or subtly competitive."

    example_personas_for_posts:
      - persona: The Instigator (aka "吃瓜群众")
        sample_ids: [DramaSeeker, PopcornEater, JustWatching, SpicyTakes]
        mindset: |
          Loves chaos and watching drama unfold. Not necessarily malicious, but enjoys stirring the pot. Uses leading questions, exaggerations, and emojis (🍿, 👀, 🤔) to provoke reactions.
        post_example: "Whoa, hold on. Is nobody else going to talk about the weird vibe between [Character A] and [Character B] at the event? Just saying, the way they looked at each other... something is definitely up. 👀"

      - persona: The Staunch Ally (e.g., a good friend)
        sample_ids: [A_Loyal_Friend, [Friend's_Nickname], Team_CharacterA]
        mindset: |
          Fiercely loyal. Their perspective is biased towards supporting their friend. They will defend, clarify, and offer emotional support, often referencing shared history.
        post_example: "Okay, I'm seeing a lot of speculation, but you guys don't know the whole story. I was with [Character A] right before that, and they were stressed about something completely different. This is a huge misunderstanding."

      - persona: The Pedantic Analyst
        sample_ids: [FactChecker99, LogicIsKey, WellActually]
        mindset: |
          Values facts, logic, and precision above all. Dislikes emotional arguments and speculation. Will dissect posts to point out logical fallacies or demand sources.
        post_example: "The initial premise of this discussion is flawed. The assumption that 'Event X' caused 'Result Y' ignores three other contributing factors. Let's analyze the data before jumping to conclusions."
`;

const FORUM_COMMENT_GENERATION_DIRECTIVES = `
  # Section 2: Comment Generation
  # Goal: To populate the thread with a realistic spectrum of reactions that drive engagement.
  comment_generation:
    primary_directive: |
      After a post is made, generate a series of comments from a diverse range of forum personas. The comments should create a dynamic and believable conversation, including agreement, dissent, and indifference. Your aim is to simulate a real, lively community.

    reaction_spectrum:
      guideline: |
        Generate comments representing different points on the spectrum of possible human reactions. Do not default to positivity. A mix of reactions is more realistic and engaging.

      comment_types:
        - type: Supportive / Agreeing
          persona_profile: "Fans, friends, or people who share the original poster's viewpoint."
          content_style: "Adds praise ('This!'), provides further evidence, or simply expresses strong agreement."
          example_for_instigator_post: "'OMG I thought I was the only one who noticed! So much tension!'"

        - type: Oppositional / Disagreeing
          persona_profile: "Rivals, skeptics, or those with a conflicting moral compass."
          content_style: "Directly challenges the post's claim, presents a counter-argument, or attacks the poster's credibility."
          example_for_instigator_post: "'Are you serious? You're creating drama out of nothing. Get a life and stop trying to ruin things for people.'"

        - type: Indifferent / Dismissive
          persona_profile: "Jaded users, trolls, or people who find the topic boring or beneath them."
          content_style: "Brief, dismissive comments. May use sarcasm, change the subject, or post a single word/meme to show they don't care."
          example_for_instigator_post: "'k. anyway, does anyone know if the servers are down?'"

        - type: Analytical / Questioning
          persona_profile: "The same as the 'Pedantic Analyst' persona. Curious outsiders."
          content_style: "Asks for proof, clarification, or pokes holes in the logic without necessarily taking a side."
          example_for_instigator_post: "'What kind of 'look'? Can you be more specific? This is too vague to be considered evidence.'"

        - type: Escalating / Fueling the Fire
          persona_profile: "Other instigators or trolls who want to see the world burn."
          content_style: "Takes the original claim and deliberately misinterprets it or adds an even more outrageous rumor to it."
          example_for_instigator_post: "'Heard it was more than a look. Someone said they saw them arguing backstage. 🍿'"
`;
    // =========================================================================
    // -------------------- XIII. GLOBAL FUNCTION EXPOSURE ---------------------
    // =========================================================================
    // 将所有 onclick 等HTML调用的函数暴露到 window 对象
     
    function calculateRoleStats(roleName) {
    let totalLikes = 0;
    let totalComments = 0;
    forumData.posts.forEach(post => {
        if (post.authorName === roleName) {
            totalLikes += post.stats.likes;
            totalComments += post.stats.comments;
        }
    });
    const fans = Math.floor(totalLikes * 0.5 + totalComments * 1.2);
    return { likes: totalLikes, fans };
}

function switchForumRole() { 
    // 菜单的HTML内容
    const menuContent = `
        <div class="modal-header">角色管理</div>
        <div class="modal-body" style="padding:0;">
            <div class="modal-item" id="menu-create-role-btn">
                <span>+ 创建新角色</span>
            </div>
            <div class="modal-item" id="menu-manage-roles-btn">
                <span>✏️ 管理/切换角色</span>
            </div>
        </div>
    `;
    
    // 打开这个菜单弹窗
    openDrawerWithContent('role-main-menu-modal', menuContent);

    // 为“创建新角色”按钮绑定事件
    document.getElementById('menu-create-role-btn').addEventListener('click', () => {
        closeDrawer('role-main-menu-modal'); // 先关闭菜单
        // 延迟一小会儿再打开编辑器，避免动画冲突
        setTimeout(() => openRoleEditor(null), 250); 
    });

    // 为“管理/切换角色”按钮绑定事件
    document.getElementById('menu-manage-roles-btn').addEventListener('click', () => {
        closeDrawer('role-main-menu-modal'); // 先关闭菜单
        // 延迟一小会儿再打开角色列表，避免动画冲突
        setTimeout(openRoleList, 250); 
    });
}
function openRoleList() {
    const roles = forumRoles;
    
    // 如果一个角色都没有，就提示用户去创建
    if (roles.length === 0) {
        showToast("你还没有任何角色，请先创建一个！");
        // 直接打开创建界面
        openRoleEditor(null);
        return;
    }

    // 生成每个角色的列表项，包含“切换”和“编辑”按钮
    let roleItemsHTML = roles.map(role => `
        <div class="modal-item role-list-item">
            <img src="${sanitizeAvatar(role.avatar)}" class="avatar">
            <span class="role-name">${escapeHTML(role.name)}</span>
            <button class="role-action-btn edit" data-edit-id="${role.id}">编辑</button>
            <button class="role-action-btn switch" data-switch-id="${role.id}">切换</button>
        </div>
    `).join('');

    const listContent = `
        <div class="modal-header">管理/切换角色</div>
        <div class="modal-body" style="padding:0;">
            ${roleItemsHTML}
        </div>
        <div style="padding: 10px 16px;">
             <button class="drawer-button-cancel" style="width:100%;" id="role-list-close-btn">返回</button>
        </div>
    `;

    // 打开列表弹窗
    openDrawerWithContent('role-list-modal', listContent);

    // -- 为所有新创建的按钮绑定事件 --
    
    // 绑定“编辑”按钮
    document.querySelectorAll('.role-action-btn.edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const roleId = parseInt(e.currentTarget.getAttribute('data-edit-id'));
            closeDrawer('role-list-modal');
            setTimeout(() => openRoleEditor(roleId), 250);
        });
    });

    // 绑定“切换”按钮
    document.querySelectorAll('.role-action-btn.switch').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const roleId = parseInt(e.currentTarget.getAttribute('data-switch-id'));
            setActiveForumRole(roleId);
            closeDrawer('role-list-modal'); // 切换后自动关闭列表
        });
    });

    // 绑定“返回”按钮
    document.getElementById('role-list-close-btn').addEventListener('click', () => {
        closeDrawer('role-list-modal');
    });
}
function renderForumPersonalPage() {
    const container = document.getElementById('forum-personal-content');
    if (!container) return;
    const activeRole = forumRoles.find(r => r.id === activeForumRoleId);
    let roleName, roleAvatar, stats;

    if (activeRole) {
        roleName = activeRole.name;
        roleAvatar = activeRole.avatar;
        stats = calculateRoleStats(activeRole.name);
    } else {
        roleName = "无";
        roleAvatar = DEFAULT_USER_AVATAR_URL;
        stats = { likes: 0, fans: 0 };
    }

    // -- 动态按钮逻辑 --
    const hasRoles = forumRoles.length > 0;
    const switchButtonText = hasRoles ? '切换/管理角色' : '创建第一个角色';

    // 生成HTML，注意按钮文字是动态的
    container.innerHTML = `
        <div class="forum-profile-card">
            <img src="${sanitizeAvatar(roleAvatar)}" class="forum-profile-avatar" id="personal-page-avatar">
            <div class="forum-profile-info">
                <p class="forum-profile-name">${escapeHTML(roleName)}</p>
                <div class="forum-profile-stats">
                    <span>获赞: <strong>${stats.likes}</strong></span>
                    <span>粉丝: <strong>${stats.fans}</strong></span>
                </div>
            </div>
        </div>
        <div class="forum-personal-actions">
            <button class="action-button" id="personal-page-switch-role-btn">${switchButtonText}</button>
            <button class="action-button" id="personal-page-dm-btn">我的私信</button>
        </div>
        <button id="deregister-role-btn" ${!activeRole ? 'disabled' : ''}>注销当前角色</button>
    `;

    // -- 动态事件绑定 --
    const switchBtn = document.getElementById('personal-page-switch-role-btn');
    if (switchBtn) {
        // !!核心逻辑!! 根据是否有角色，绑定不同的函数
        if (hasRoles) {
            // 如果有角色，点击按钮打开角色列表
            switchBtn.addEventListener('click', switchForumRole);
        } else {
            // 如果没有角色，点击按钮直接打开创建界面
            switchBtn.addEventListener('click', () => openRoleEditor(null));
        }
    }
    
    // 其他按钮的事件绑定保持不变
    const avatar = document.getElementById('personal-page-avatar');
    if (avatar && hasRoles) { // 只有在有角色时点击头像才有意义
        avatar.addEventListener('click', switchForumRole);
    }
    
    const dmBtn = document.getElementById('personal-page-dm-btn');
    if (dmBtn) dmBtn.addEventListener('click', openPrivateMessagesPage);

    const deregisterBtn = document.getElementById('deregister-role-btn');
    if (deregisterBtn) {
        deregisterBtn.addEventListener('click', deregisterActiveRole);
        if (!activeRole) {
            deregisterBtn.style.opacity = '0.5';
            deregisterBtn.style.cursor = 'not-allowed';
        }
    }
}

function openRoleEditor(roleId = null) {
    // 检查 roleId 是否是事件对象，如果是，则视为创建新角色
    if (typeof roleId === 'object' && roleId !== null) {
        roleId = null;
    }
    
    closeDrawer('role-switcher-modal'); // 先关闭上一个弹窗

    const isEditing = roleId !== null;
    const role = isEditing ? forumRoles.find(r => r.id === roleId) : null;
    
    // !!核心修改!!：无论是创建还是编辑，都统一使用“返回”和“保存”按钮
    const actionButtonsHTML = `
        <button class="drawer-button-cancel" style="flex:1;" id="modal-cancel-btn">返回</button>
        <button class="btn-primary" style="flex:2;" id="modal-save-btn">保存</button>
    `;

    const modalBodyContent = `
        <div class="form-layout">
            <label for="role-name-input">角色昵称</label>
            <input type="text" id="role-name-input" class="form-input" value="${isEditing && role ? escapeHTML(role.name) : ''}" placeholder="输入一个响亮的昵称">
            <label for="role-avatar-input">头像URL</label>
            <input type="text" id="role-avatar-input" class="form-input" value="${isEditing && role ? escapeHTML(role.avatar) : ''}" placeholder="粘贴头像图片地址">
            <div style="display:flex; gap:10px; margin-top:20px;">
                ${actionButtonsHTML}
            </div>
        </div>`;
    
    const finalContent = `
        <div class="modal-header">${isEditing ? '编辑角色' : '创建新角色'}</div>
        <div class="modal-body">${modalBodyContent}</div>
    `;

    openDrawerWithContent('role-editor-modal', finalContent);

    // -- 事件绑定 --
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            saveForumRole(roleId);
            // 保存后自动关闭弹窗
            closeDrawer('role-editor-modal'); 
        });
    }
    
    const cancelBtn = document.getElementById('modal-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            closeDrawer('role-editor-modal');
        });
    }
}


function saveForumRole(roleId) {
    const name = document.getElementById('role-name-input').value.trim();
    let avatar = document.getElementById('role-avatar-input').value.trim();
    if (!name) return showToast("昵称不能为空！");

    // ✅ 核心修改：如果头像为空，就使用默认头像
   if (!avatar) {
    avatar = DEFAULT_FORUM_AVATAR_SVG;
}

    if (roleId) {
        const role = forumRoles.find(r => r.id === roleId);
        if (role) { role.name = name; role.avatar = avatar; }
    } else {
        const newRole = { id: Date.now(), name, avatar };
        forumRoles.push(newRole);
        activeForumRoleId = newRole.id;
        setStorage('active_forum_role_id', activeForumRoleId);
    }
    setStorage('forum_roles', forumRoles);
    showToast("角色信息已保存！");
    closeDrawer('role-editor-modal');
    renderForumPersonalPage();
    if (!roleId) {
        setTimeout(openRoleList, 100); // 改为打开列表，让用户可以确认
    }
}

function setActiveForumRole(roleId) {
    activeForumRoleId = roleId;
    setStorage('active_forum_role_id', activeForumRoleId);
    showToast("角色切换成功！");
    closeDrawer('role-switcher-modal');
    renderForumPersonalPage();
}

function deregisterRole(roleIdToDeregister) {
    const roleId = roleIdToDeregister;
    if (!roleId) return showToast("发生错误，无法确定要注销的角色。");
    const role = forumRoles.find(r => r.id === roleId);
    if (!role) return;
    if (confirm(`【警告】确定要永久注销角色 "${role.name}" 吗？此操作不可恢复！`)) {
        forumRoles = forumRoles.filter(r => r.id !== roleId);
        if (activeForumRoleId === roleId) {
            activeForumRoleId = forumRoles[0]?.id || null;
            setStorage('active_forum_role_id', activeForumRoleId);
        }
        setStorage('forum_roles', forumRoles);
        showToast(`角色 "${role.name}" 已被注销。`);
        closeDrawer('role-editor-modal');
        renderForumPersonalPage();
        setTimeout(switchForumRole, 100);
    }
}

function deregisterActiveRole() {
    if (!activeForumRoleId) return;
    deregisterRole(activeForumRoleId);
}

let currentOpenDmId = null;

function openPrivateMessagesPage() {
    // 隐藏主界面元素
    const header = document.getElementById('forum-header');
    if (header) header.style.display = 'none';

    const bottomNav = document.getElementById('forum-nav');
    if (bottomNav) bottomNav.style.display = 'none';

    const fab = document.querySelector('.floating-action-button');
    if (fab) fab.style.display = 'none';

    const postsTab = document.getElementById('forum-tab-posts');
    if (postsTab) postsTab.style.display = 'none';

    const personalTab = document.getElementById('forum-tab-personal');
    if (personalTab) personalTab.style.display = 'none';
    
    // 激活私信页
    const dmPage = document.getElementById('forum-dm-page');
    if (dmPage) {
        dmPage.classList.add('active'); 
        renderDmList(); 
    }

    // ✅ 新增：确保在进入私信列表页时，聊天输入框总是隐藏的
    const inputBar = document.getElementById('dm-chat-input-bar');
    if(inputBar) {
        inputBar.style.display = 'none';
    }
}
// --- 【最终简洁版】---
function closePrivateMessagesPage() {
    // 1. 取消激活私信页
    const dmPage = document.getElementById('forum-dm-page');
    if (dmPage) {
        dmPage.classList.remove('active');
    }
    
    // 2. 切换回个人页，这个函数会负责恢复所有该显示的元素
    switchForumTab('personal');
    
    // 3. 重置私信页内部的视图状态（保持不变）
    const listContainer = document.getElementById('dm-list-container');
    if (listContainer) listContainer.style.display = 'block';
    const chatView = document.getElementById('dm-chat-view');
    if (chatView) chatView.style.display = 'none';
    const inputBar = document.getElementById('dm-chat-input-bar');
    if (inputBar) inputBar.style.display = 'none';
    currentOpenDmId = null;
}


function goBackInDm() {
    const chatView = document.getElementById('dm-chat-view');
    // 如果聊天界面是可见的，就返回到列表页
    if (chatView && chatView.style.display !== 'none') {
        document.getElementById('dm-list-container').style.display = 'block';
        chatView.style.display = 'none';
        
        // ✅ 关键：返回列表时，也强制隐藏输入框
        const inputBar = document.getElementById('dm-chat-input-bar');
        if (inputBar) {
            inputBar.style.display = 'none';
        }
        
        currentOpenDmId = null;
    } else {
        // 否则，就关闭整个私信页面
        closePrivateMessagesPage();
    }
}
function renderDmList() {
    const container = document.getElementById('dm-list-container');
    if (!container) return;
    if (forumData.privateMessages) {
        forumData.privateMessages.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
    } else {
        forumData.privateMessages = [];
    }
    
    if (forumData.privateMessages.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#aaa; padding-top:100px;">还没有收到任何私信~<br>点击右上角信封图标生成一些吧！</p>`;
        return; // ✅ 增加 return，避免继续执行
    }

    container.innerHTML = ''; // 先清空
    forumData.privateMessages.forEach(dm => {
        const lastMessage = dm.messages[dm.messages.length - 1] || {text: ''};
        
        // 创建新的、支持滑动的列表项结构
        const itemWrapper = document.createElement('div');
        itemWrapper.className = 'dm-list-item-wrapper';
        itemWrapper.innerHTML = `
            <div class="dm-list-item-actions">
                <button class="delete-btn" onclick="deleteDmConversation(${dm.id})">删除</button>
            </div>
            <div class="dm-list-item-content">
                <!-- ✅ 核心修改：在<img>标签中加入 onerror 事件 -->
                <img src="${sanitizeAvatar(dm.fromAvatar)}" 
                     class="avatar" 
                     onerror="this.onerror=null; this.src='${DEFAULT_USER_AVATAR_URL}';">
                <div class="dm-list-content-text">
                    <div class="dm-sender-name">${escapeHTML(dm.fromUser)}</div>
                    <div class="dm-message-preview">${escapeHTML(lastMessage.text)}</div>
                </div>
                ${!dm.isRead ? '<div class="dm-unread-dot"></div>' : ''}
            </div>
        `;
        container.appendChild(itemWrapper);

        // 为内容部分添加滑动事件监听
        const contentSlider = itemWrapper.querySelector('.dm-list-item-content');
        addSwipeToDelete(contentSlider, () => openChatView(dm.id));
    });

    updateUnreadBadge();
}
function addSwipeToDelete(element, tapCallback) {
    let startX;
    element.addEventListener('touchstart', e => {
        // 关闭其他所有已滑开的项
        document.querySelectorAll('.swiped').forEach(swipedItem => {
            if (swipedItem !== element) {
                swipedItem.classList.remove('swiped');
            }
        });
        startX = e.touches[0].clientX;
    }, { passive: true });

    element.addEventListener('touchend', e => {
        if (!startX) return;
        let deltaX = e.changedTouches[0].clientX - startX;
        if (deltaX < -60) { // 向左滑了足够距离
            element.classList.add('swiped');
        } else if (deltaX > 20) { // 向右滑了
            element.classList.remove('swiped');
        } else if (Math.abs(deltaX) < 10) { // 如果只是轻点
            if (tapCallback) tapCallback();
        }
        startX = null;
    }, { passive: true });
}

// 新增：删除私信对话的函数
function deleteDmConversation(dmId) {
    if (confirm('确定要删除这条会话的所有记录吗？')) {
        forumData.privateMessages = forumData.privateMessages.filter(dm => dm.id !== dmId);
        setStorage('forum_data', forumData);
        renderDmList(); // 重新渲染列表
        showToast('会话已删除');
    }
}

function updateUnreadBadge() {
    const unreadCount = forumData.privateMessages ? forumData.privateMessages.filter(dm => !dm.isRead).length : 0;
    const badge = document.getElementById('dm-unread-badge');
    if (!badge) return;
    if (unreadCount > 0) {
        badge.innerText = unreadCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

async function generatePrivateMessages() {
    const activeRole = forumRoles.find(r => r.id === activeForumRoleId);
    if (!activeRole) return showToast("请先在个人页创建一个角色！");
    if (!config.key || !config.url) return showToast('请先配置API！');
    showToast("正在生成新的私信...");
    const stats = calculateRoleStats(activeRole.name);
    const myPosts = forumData.posts.filter(p => p.authorName === activeRole.name).slice(0, 3).map(p => `- "${p.text.substring(0, 50)}..."`).join('\n');
    const prompt = `你是一个社区模拟引擎。现在请为名为“${activeRole.name}”的博主生成一个包含7到8个私信对话开头的JSON数组。- 这位博主当前的数据是：粉丝数约 ${stats.fans}，总获赞 ${stats.likes}。- 他/她最近发过这些帖子：\n${myPosts || "（暂无帖子）"}- 请你基于这些信息，模拟不同的人（粉丝、路人、好奇的提问者、商业合作询问者等）发来的私信。- 每条私信必须包含1-2条消息。- 输出的JSON数组结构必须如下，其中fromUser和fromAvatar由你创作，id是当前时间戳加随机数，isRead为false，timestamp为当前时间戳:[{"id": ${Date.now() + Math.random()},"fromUser": "好奇的小明","fromAvatar": "${DEFAULT_FORUM_AVATAR_SVG}","isRead": false,"timestamp": ${Date.now()},"messages": [{"sender": "other", "text": "你好博主！看到你关于投资的帖子，写得真好！" },{"sender": "other", "text": "我也有点兴趣，能多聊聊吗？"}]},...]`;
    try {
        let rawResponse = await getCompletion(prompt, true);
        const jsonString = extractFirstJsonArray(rawResponse);
        if (!jsonString) throw new Error("AI未能返回有效的JSON数组。");
        const newDms = JSON.parse(jsonString);
        if(!forumData.privateMessages) forumData.privateMessages = [];
        forumData.privateMessages.unshift(...newDms);
        setStorage('forum_data', forumData);
        renderDmList();
        showToast("收到了新的私信！");
    } catch(e) { showToast("生成私信失败：" + e.message); console.error("生成私信失败:", e); }
}

function openChatView(dmId) {
    currentOpenDmId = dmId;
    const dm = forumData.privateMessages.find(d => d.id === dmId);
    if (!dm) return;

    // 隐藏私信列表，显示聊天窗口
    document.getElementById('dm-list-container').style.display = 'none';
    document.getElementById('dm-chat-view').style.display = 'block'; // 或者 'flex' 取决于你的CSS
    
    // ✅ 关键：只在此时才显示输入框
    document.getElementById('dm-chat-input-bar').style.display = 'flex';

    const chatView = document.getElementById('dm-chat-view');
    chatView.innerHTML = dm.messages.map(msg => `<div class="dm-bubble ${msg.sender}">${escapeHTML(msg.text)}</div>`).join('');
    chatView.scrollTop = chatView.scrollHeight; // 滚动到底部

    // 标记为已读
    if (!dm.isRead) {
        dm.isRead = true;
        setStorage('forum_data', forumData);
        updateUnreadBadge();
    }
}


function sendDmMessage() {
    const input = document.getElementById('dm-chat-input');
    const text = input.value.trim();
    if (!text || !currentOpenDmId) return;
    const dm = forumData.privateMessages.find(d => d.id === currentOpenDmId);
    if (!dm) return;
    const newMessage = { sender: 'self', text };
    dm.messages.push(newMessage);
    dm.timestamp = Date.now();
    const chatContainer = document.getElementById('dm-chat-view');
    chatContainer.innerHTML += `<div class="dm-bubble self">${escapeHTML(text)}</div>`;
    chatContainer.scrollTop = chatContainer.scrollHeight;
    input.value = '';
    setStorage('forum_data', forumData);
}

async function generateDmReply() {
    if (!currentOpenDmId) return;
    const dm = forumData.privateMessages.find(d => d.id === currentOpenDmId);
    if (!dm) return;
    if (!config.key || !config.url) return showToast('请先配置API！');
    showToast("对方正在输入...");
    const chatHistory = dm.messages.map(m => `${m.sender === 'self' ? '我' : dm.fromUser}: ${m.text}`).join('\n');
    const prompt = `在下面的私信对话中，你现在是“${dm.fromUser}”。请根据聊天记录，生成3到4句简短的、符合其人设的回复。请以JSON数组的格式返回，数组中每个元素是一个字符串回复。对话记录:\n${chatHistory}\n\n你的回复（JSON数组格式）:`;
    try {
        const rawResponse = await getCompletion(prompt, true);
        const jsonString = extractFirstJsonArray(rawResponse);
        if (!jsonString) throw new Error("AI未能返回有效的JSON数组。");
        const replies = JSON.parse(jsonString);
        const chatContainer = document.getElementById('dm-chat-view');
        for (const reply of replies) {
            const newMessage = { sender: 'other', text: reply };
            dm.messages.push(newMessage);
            dm.timestamp = Date.now();
            await new Promise(resolve => setTimeout(resolve, 500));
            chatContainer.innerHTML += `<div class="dm-bubble other">${escapeHTML(reply)}</div>`;
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        setStorage('forum_data', forumData);
    } catch(e) { showToast("AI回复失败：" + e.message); console.error("AI回复失败:", e); }
}


 function switchForumTab(tabName) {
    const isPosts = tabName === 'posts';

    // --- 隐藏特殊页面 ---
    const dmPage = document.getElementById('forum-dm-page');
    if (dmPage) {
        dmPage.classList.remove('active');
    }

    // --- 管理主内容区的显示/隐藏 ---
    const header = document.getElementById('forum-header');
    if (header) {
        header.style.display = isPosts ? 'flex' : 'none';
    }
    
    const postsTab = document.getElementById('forum-tab-posts');
    if (postsTab) {
        postsTab.style.display = isPosts ? 'flex' : 'none';
    }

    const personalTab = document.getElementById('forum-tab-personal');
    if (personalTab) {
        personalTab.style.display = isPosts ? 'none' : 'block';
    }

    // --- 管理底部导航和悬浮按钮的显示/隐藏 (核心) ---
    const bottomNav = document.getElementById('forum-nav');
    if (bottomNav) {
        bottomNav.style.display = 'flex'; // ✅ 确保导航栏总是被设置为显示
    }
    
    const fab = document.querySelector('.floating-action-button');
    if (fab) {
        fab.style.display = isPosts ? 'flex' : 'none';
    }

    // --- 更新底部导航的激活状态 ---
    const navPosts = document.getElementById('forum-nav-posts');
    if (navPosts) {
        navPosts.classList.toggle('active', isPosts);
    }

    const navPersonal = document.getElementById('forum-nav-personal');
    if (navPersonal) {
        navPersonal.classList.toggle('active', !isPosts);
    }
    
    // --- 按需渲染页面内容 ---
    if (!isPosts) {
        renderForumPersonalPage(); // 总指挥官内部调用，无需在HTML里重复调用
    }
}

function findAuthor(name) {
    const allUsers = [...userProfiles, ...aiList];
    return allUsers.find(u => u.name === name) || { name: name, avatar: DEFAULT_USER_AVATAR_URL };
}

// ------------------- 从这里开始复制替换 -------------------

let forumRoles = []; 
// 新增：用于存储当前激活的发帖角色的ID
let activeForumRoleId = null;
// 新增：用于存储当前绑定的世界书ID
let worldbookBindings = {
    postGeneration: [], // 用于“智能生成新帖子”
    commentGeneration: [], // 用于“召唤/模拟新评论”
    dmGeneration: [] // 用于“生成私信/回复”
};

function loadAllData() {
    // 读取您已有的数据（旧版键名保留以兼容历史数据）
    config = getStorage('config') || {};
    userProfiles = getStorage('user_profiles') || [DEFAULT_USER_PROFILE];
    aiList = getStorage('ai_list') || [];
    currentChatHistory = getStorage('current_chat_history') || [];
    forumData = getStorage('forum_data') || { posts: [] };

    // 新增：加载论坛角色数据（确保一定是数组，避免解析失败导致每次刷新重置）
    let loadedRoles = getStorage('forum_roles', []);
    if (!Array.isArray(loadedRoles)) {
        console.warn('forum_roles 不是数组，已重置为空数组:', loadedRoles);
        loadedRoles = [];
    }
    forumRoles = loadedRoles;

    // 当前激活角色 ID，如不存在则为 null
    activeForumRoleId = getStorage('active_forum_role_id', null);

    // 新增：加载绑定的世界书数据
    worldbookBindings = getStorage('worldbook_bindings') || {
        postGeneration: [],
        commentGeneration: [],
        dmGeneration: []
    };

    // 新增：只有在本地完全没有任何角色记录时，才创建默认角色
    // 避免已有角色因为解析问题被错误覆盖
    if (forumRoles.length === 0 && !activeForumRoleId) {
        console.log("未发现论坛角色，正在创建默认角色...");
        const defaultRole = {
            id: Date.now(),
            name: "默认博主",
            avatar: userProfiles[0].avatar, // 使用用户的头像作为默认头像
        };
        forumRoles.push(defaultRole);
        activeForumRoleId = defaultRole.id;
        // 保存一下，以便下次打开时使用
        setStorage('forum_roles', forumRoles);
        setStorage('active_forum_role_id', activeForumRoleId);
    }
    
    // 调用其他渲染函数
    renderUI();
    // 您可能还有其他函数在这里调用，请保持它们不变
}

const FORUM_POST_AND_COMMENTS_GENERATION_DIRECTIVES = `# AI Directives for Rich Forum Thread Simulation

forum_simulation_directives:
  # Section 1: Core Task
  # Goal: To generate a series of complete, realistic forum threads, each with a main post and a lively comment section.
  primary_task:
    directive: |
      Your main task is to create a JSON array of forum threads. Each element in the array must represent a single thread and contain a main post object and an array of comment objects. The content must be contextually relevant to the provided theme and driven by distinct character personas.

  # Section 2: Post Generation Rules
  post_generation:
    author_constraint:
      principle: |
        The author of the main post ('authorName') MUST be selected from the provided character list, BUT it MUST NOT be the user's own name, which will be explicitly pointed out in the prompt.
    content_realism:
      principle: |
        The post content ('postText') must align with the author's persona (e.g., instigator, loyal friend, analyst) and the given theme.
    initial_stats:
      principle: |
        Generate a 'stats' object with 'likes', 'comments', and 'shares'. Likes and shares should be random integers (e.g., 0-100), but the 'comments' stat must accurately reflect the number of comments you are about to generate for this post.

  # Section 3: Comment Section Generation Rules
  comment_generation:
    quantity:
      principle: "For each post, generate exactly 5 to 6 comments."
    persona_diversity:
      principle: |
        The comments must come from a diverse range of forum personas as defined in the 'reaction_spectrum'. This creates a believable conversation with agreement, dissent, questions, and other typical online interactions. The authors of the comments should be chosen from the provided character list.
    comment_replies:
      principle: |
        To simulate real conversations, some comments can be replies to other comments within the same generated set.
      implementation: |
        If a comment is a reply, include an optional 'replyToAuthor' field containing the name of the author being replied to. The AI should decide when a reply is appropriate. About 20-40% of comments being replies is a good ratio for realism.
      example_comment_with_reply:
        - authorName: "FactChecker99"
          text: "Your claim is based on a logical fallacy. Where is your source?"
        - authorName: "DramaSeeker"
          replyToAuthor: "FactChecker99"
          text: "Who needs sources when the drama is this good? 👀"

  # Section 4: Final Output Structure
  # Goal: Ensure the final output is a clean, parsable JSON.
  output_format:
    strict_json_array:
      principle: "The entire output MUST be a single JSON array, with no surrounding text, explanations, or markdown code blocks."
      json_structure: |
        [
          {
            "authorName": "Generated_Author_Name",
            "postText": "The content of the first post...",
            "stats": { "likes": 42, "comments": 5, "shares": 8 },
            "comments": [
              { "authorName": "Commenter_A", "text": "This is the first comment." },
              { "authorName": "Commenter_B", "text": "I disagree with the post." },
              { "authorName": "Commenter_C", "replyToAuthor": "Commenter_B", "text": "Why do you disagree? I think it's spot on." },
              { "authorName": "Commenter_D", "text": "Just here for the popcorn. 🍿" },
              { "authorName": "Commenter_E", "text": "Great point, well said." }
            ]
          },
          {
            "authorName": "Another_Author",
            "postText": "Content for the second post...",
            "stats": { "likes": 15, "comments": 6, "shares": 2 },
            "comments": [ ... ]
          }
        ]
`;
// =========================================================================


function findAuthor(name) {
    // 优先从用户列表中查找，因为这是当前操作者，很重要
    const user = userProfiles.find(u => u.name === name);
    if (user) return user;
    
    // 然后从AI角色列表中查找
    const ai = aiList.find(a => a.name === name);
    if (ai) return ai;

    // 如果都找不到，返回一个包含名字和默认头像的“路人”对象
    return { name: name, avatar: DEFAULT_USER_AVATAR_URL };
}

function renderForumFeed() {
    const feedContainer = document.getElementById('forum-tab-posts');
    feedContainer.innerHTML = '';
    if (!forumData.posts || forumData.posts.length === 0) {
        feedContainer.innerHTML = `<div style="text-align:center; padding:50px; color: #aaa; font-size: 14px;">这里空空如也~<br>点击右下方 '+' 智能生成一些帖子吧！</div>`;
        return;
    }

    const sortedPosts = forumData.posts.sort((a, b) => b.id - a.id);

    // ✅ 核心修正：把 activeRole 的查找移到循环外部，提高效率
    const activeRole = forumRoles.find(r => r.id === activeForumRoleId);

    sortedPosts.forEach(post => {
        const author = findAuthor(post.authorName);
        
        // ✅ 核心修正：在循环内部，为每个帖子计算 isLikedByMe
        const isLikedByMe = activeRole && post.likedBy && post.likedBy.includes(activeRole.name);

        const postElement = document.createElement('div');
        postElement.className = 'forum-post-item';

        const commentsHTML = (post.comments || []).map(comment => {
            const cAuthor = findAuthor(comment.authorName);
            let replyPrefix = '';
            if (comment.replyToAuthor) {
                replyPrefix = `<span class="forum-comment-reply-tag">回复 ${escapeHTML(comment.replyToAuthor)}: </span>`;
            }
            return `<div class="forum-comment-item">
                        <span class="forum-comment-author">${escapeHTML(cAuthor.name)}:</span> 
                        ${replyPrefix}
                        ${escapeHTML(comment.text)}
                    </div>`;
        }).join('');

        postElement.innerHTML = `
            <div class="forum-delete-action">
                <button class="forum-delete-btn" onclick="deleteForumPost(${post.id})">删除</button>
            </div>
            <div class="forum-content-slider">
                <div class="forum-post-author">
                    <img src="${sanitizeAvatar(author.avatar)}" class="forum-author-avatar" onerror="this.onerror=null; this.src='${DEFAULT_FORUM_AVATAR_SVG}';">
                    <span class="forum-author-name">${escapeHTML(author.name)}</span>
                </div>
                <div class="forum-post-text">${escapeHTML(post.text)}</div> 
                <div class="forum-post-stats">
                    <!-- 现在 isLikedByMe 变量存在了，这里可以安全使用 -->
                    <span class="stat-item ${isLikedByMe ? 'liked' : ''}" onclick="likeForumPost(${post.id})">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                        <span>${post.stats.likes}</span>
                    </span>
                    <span class="stat-item">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        <span>${post.stats.comments}</span>
                    </span>
                    <span class="stat-item">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
                        <span>${post.stats.shares}</span>
                    </span>
                    <span class="stat-item" onclick="window.generateForumCommentsForPost(${post.id})" style="cursor:pointer; user-select: none;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M12 22v-3"></path><path d="M10 3.34A6.02 6.02 0 0 1 12 3a6.02 6.02 0 0 1 2 .34"></path><path d="m14 2-2-2-2 2"></path><path d="m10 22 2 2 2-2"></path></svg>
                    </span>
                </div>
                ${(post.comments && post.comments.length > 0) ? `<div class="forum-comment-section">${commentsHTML}</div>` : ''}
                <div class="forum-comment-form">
                    <input type="text" class="forum-comment-input" placeholder="发表你的看法..." onkeydown="if(event.key==='Enter') addForumComment(${post.id}, this)">
                </div>
            </div>
        `;
        
        feedContainer.appendChild(postElement);

        // 左滑删除帖子的事件绑定
        const contentSlider = postElement.querySelector('.forum-content-slider');
        addSwipeToDelete(contentSlider, null); // 帖子轻点不触发任何事件
    });
}

function deleteForumPost(id) {
    if (confirm('确定要删除这条帖子吗？此操作不可恢复。')) {
        forumData.posts = forumData.posts.filter(p => p.id !== id);
        setStorage('forum_data', forumData);
        renderForumFeed();
        showToast('帖子已删除');
    }
}

// **重大修改**: 此函数现在会生成帖子和它的评论区
async function generateForumPosts() {
    const theme = document.getElementById('forum-theme-input').value.trim();
    if (!theme) return showToast('请输入主题！');
    if (!config.key || !config.url) return showToast('请先配置API！');
    
    // --- 核心修改 ---
    // 确保两个相关的弹窗都被关闭，这样灰色遮罩层就会彻底消失
    closeForumGeneratorModal(); 
    closeForumActionModal(); 
    // --- 修改结束 ---

    showToast('AI正在生成动态宇宙，请稍候...');
    let worldbookContent = await getWorldbookContentForContext('postGeneration');
    

// --- 新增结束 ---

    

    // **修改点**: 角色池现在只包含非用户角色，以满足“作者不能是自己”的需求
    const characterPool = [...aiList.map(a => a.name), "路人甲", "游客小张", "隔壁的王同学", "DramaSeeker", "FactChecker99", "A_Loyal_Friend", "PopcornEater"];
    const userName = userProfiles[0].name;

    // **修改点**: 使用全新的、功能更强大的提示词
    const prompt = `${FORUM_POST_AND_COMMENTS_GENERATION_DIRECTIVES}

    ${worldbookContent} 

# 主任务 (Primary Task)
现在，请严格遵循以上的“AI Directives for Rich Forum Thread Simulation”指令，围绕主题“${theme}”，生成一个包含3到4个完整帖子（包含帖子内容和评论区）的JSON数组。

- 每个主帖的作者("authorName")必须从以下列表中随机抽取: [${characterPool.join(', ')}].
- **重要限制**: 主帖作者绝对不能是 "${userName}"。
- 每条帖子的评论作者可以从 [${[...characterPool, userName].join(', ')}] 中选择，这意味着用户自己也可以出现在评论区。
- 帖子内容("postText")和评论内容("text")必须严格符合作者的人设和帖子主题。
- 请确保严格遵循输出格式部分的JSON结构。

# 输出格式
请严格以JSON数组格式返回，不要包含任何额外解释或代码块标记。`;

    try {
        let rawResponse = await getCompletion(prompt, true);
        console.log("【调试信息】AI返回的原始数据:", rawResponse);

        // **修改点**: 解析AI返回的JSON数组
        const jsonString = extractFirstJsonArray(rawResponse);
        
        if (!jsonString) {
            throw new Error('AI返回内容中未找到有效的JSON数组结构。请检查F12控制台的“【调试信息】”');
        }

        const generatedThreads = JSON.parse(jsonString);

        if (Array.isArray(generatedThreads)) {
            const newPosts = generatedThreads.map(thread => ({
                id: Date.now() + Math.random(),
                authorName: thread.authorName,
                text: thread.postText,
                stats: thread.stats, // 直接使用AI生成的、已包含正确评论数的stats
                comments: thread.comments || [] // 接收AI生成的评论
            }));
            
            // 将新生成的帖子加到列表最前面
            forumData.posts.unshift(...newPosts);
            setStorage('forum_data', forumData);
            renderForumFeed();
            showToast('新的帖子和评论已生成！');
        } else { 
            throw new Error('解析成功，但JSON结构不符合预期的数组格式。'); 
        }
    } catch (e) {
        const errorMessage = '生成帖子失败: ' + e.message;
        console.error("【错误详情】:", e); 
        alert(errorMessage); 
        showToast('生成失败，请查看弹窗或F12控制台获取详情');
    }
}

// **修改点**: 增强此函数，使其可以一次性生成多条评论
async function generateForumCommentsForPost(postId) {
    const post = forumData.posts.find(p => p.id === postId);
    if (!post) return showToast('未找到该帖子');
    if (!config.key || !config.url) return showToast('请先配置API！');

    showToast('正在模拟社区新回应...');

    // **修改点**: 角色池包含所有人，因为任何人都可以评论
    const characterPool = [...userProfiles.map(u => u.name), ...aiList.map(a => a.name), "路人甲", "游客小张", "DramaSeeker", "FactChecker99", "A_Loyal_Friend"];

    // **修改点**: 更新提示词，要求生成更多评论
    const prompt = `${FORUM_POST_GENERATION_DIRECTIVES}
${FORUM_COMMENT_GENERATION_DIRECTIVES}

# 主任务
一个名为 "${post.authorName}" 的用户发布了以下帖子:
"${post.text}"

现有评论区内容:
${(post.comments || []).map(c => `${c.authorName}: ${c.text}`).join('\n') || '（暂无评论）'}

现在，请严格遵循以上的“Comment Generation”指令，为这篇帖子生成一个包含3到5条新评论的JSON数组。
- 每条评论的作者("authorName")必须从以下列表中随机抽取: [${characterPool.join(', ')}].
- 评论内容("text")必须符合评论者的潜在人设，并与原帖内容或现有评论紧密相关。
- 评论区需要体现出“reaction_spectrum”中描述的多样性。

# 输出格式
请严格以JSON格式返回，顶层结构为 {"comments": [...] }，不要包含任何额外解释或代码块标记。
示例:
{
  "comments": [
    { "authorName": "A_Loyal_Friend", "text": "说得太对了！完全支持你！" },
    { "authorName": "DramaSeeker", "text": "真的假的？这事儿可不简单啊... 👀" }
  ]
}`;

    try {
        let rawResponse = await getCompletion(prompt, true);
        const jsonString = extractFirstJsonObject(rawResponse);
        if (!jsonString) {
            throw new Error('AI返回内容中未找到有效的JSON结构。');
        }

        const result = JSON.parse(jsonString);
        if (result.comments && Array.isArray(result.comments)) {
            if (!post.comments) post.comments = [];
            post.comments.push(...result.comments);
            post.stats.comments += result.comments.length; // **修改点**: 增加正确的评论数
            setStorage('forum_data', forumData);
            renderForumFeed();
            showToast('新评论已生成！');
        } else {
            throw new Error('返回的JSON格式不正确。');
        }
    } catch(e) {
        showToast('生成评论失败: ' + e.message);
        console.error("生成评论失败:", e, "AI原始返回:", e.rawResponse);
    }
}

// **重大修改**: 增强此函数，使其可以一次性模拟多次互动
async function generateEngagement() {
    // 查找当前用户的激活角色，因为帖子是发给TA的
    const activeRole = forumRoles.find(r => r.id === activeForumRoleId);
    if (!activeRole) return showToast('请先选择一个角色再召唤互动！');

    // 筛选出“我”的帖子
    const myPosts = forumData.posts.filter(p => p.authorName === activeRole.name);
    if (myPosts.length === 0) return showToast('你还没发过帖子，快去发一个吧！');
    
    closeForumActionModal();
    showToast('正在呼叫朋友们前来互动...');

    const randomPost = myPosts[Math.floor(Math.random() * myPosts.length)];
    
    // ✅ 核心修改：创建两个不同的角色池
    const aiCharacterNames = aiList.map(a => a.name); // 只包含AI角色的名单
    const allInteractorNames = [...aiCharacterNames, "热心网友", "吃瓜路人", "互联网嘴替"]; // 包含AI和路人的大名单
    
    // ✅ 核心修改：更新提示词，增加严格的规则
    const prompt = `你是社交网络上的一个模拟引擎。用户“${activeRole.name}”发了一条动态：“${randomPost.text}”。

请你模拟 2 到 4 次社区互动。每次互动从以下行为中随机选择：
1. 点赞 (like)
2. 发表一条评论 (comment)
3. 转发 (share)

请返回一个JSON数组，每个对象代表一次互动。

【严格规则】
- 如果 action 是 "like"，那么 "authorName" 必须从【AI角色列表】中随机选择: [${aiCharacterNames.join(', ')}]
- 如果 action 是 "comment" 或 "share"，那么 "authorName" 可以从【所有互动者列表】中随机选择: [${allInteractorNames.join(', ')}]
- 如果 action 是 "comment"，还需要一个 "commentText" 字段，内容是20字内的简短评论。

严格按照JSON数组格式返回。
示例: 
[
  {"action": "comment", "authorName": "热心网友", "commentText": "这个太有意思了！"},
  {"action": "like", "authorName": "${aiCharacterNames[0] || 'AI角色A'}"},
  {"action": "share", "authorName": "吃瓜路人"}
]`;

    try {
        let rawResponse = await getCompletion(prompt, true);
        const jsonString = extractFirstJsonArray(rawResponse);
        if (!jsonString) throw new Error('AI返回内容中未找到有效的JSON数组结构。');
        
        const interactions = JSON.parse(jsonString);
        const postToUpdate = forumData.posts.find(p => p.id === randomPost.id);
        if (!postToUpdate) return;
        
        if (!postToUpdate.likedBy) postToUpdate.likedBy = []; // 初始化点赞列表

        let notifications = [];

        interactions.forEach(interaction => {
            const interactor = findAuthor(interaction.authorName);
            // ✅ 核心修改：点赞时检查是否已赞过，避免AI重复点赞
            if (interaction.action === 'like' && !postToUpdate.likedBy.includes(interactor.name)) {
                postToUpdate.stats.likes++;
                postToUpdate.likedBy.push(interactor.name); // 记录点赞
                notifications.push(`${interactor.name} 点赞了`);
            } else if (interaction.action === 'comment' && interaction.commentText) {
                postToUpdate.stats.comments++;
                if (!postToUpdate.comments) postToUpdate.comments = [];
                postToUpdate.comments.push({ authorName: interactor.name, text: interaction.commentText });
                notifications.push(`${interactor.name} 评论道：“${interaction.commentText}”`);
            } else if (interaction.action === 'share') {
                postToUpdate.stats.shares++;
                notifications.push(`${interactor.name} 转发了你的动态`);
            }
        });
 
        setStorage('forum_data', forumData);
        renderForumFeed();
 
        if (notifications.length > 0) {
            showToast(notifications.join('，'));
        } else {
            showToast('这次宇宙有点安静，再试一次吧~');
        }
    } catch(e) {
        showToast('模拟互动失败: ' + e.message);
        console.error('模拟互动失败:', e);
    }
}

// =================== 塔罗牌 App ===================

const TAROT_QUESTION_BANK = [
    // 单选题 10 道
    {
        id: 's1',
        type: 'single',
        question: '最近关于你和某人的关系，你最真实的感受是？',
        options: [
            '我越来越想靠近他/她',
            '我有点想放弃了但还舍不得',
            '我决定顺其自然，不再主动',
            '我其实在等对方先向我迈一步'
        ]
    },
    {
        id: 's2',
        type: 'single',
        question: '当你想到对方时，心里最常出现的画面是？',
        options: [
            '一起聊天、分享日常的小片段',
            '沉默或冷战的场景',
            '一个人盯着聊天框却迟迟没发消息',
            '曾经很好、现在有点陌生的样子'
        ]
    },
    {
        id: 's3',
        type: 'single',
        question: '遇到矛盾时，你更接近哪种反应？',
        options: [
            '先道歉把事情稳住，再慢慢说内心话',
            '直接冷下来，等对方先来找我',
            '控制不住情绪，很容易说重话',
            '表面上没事，内心却记得很清楚'
        ]
    },
    {
        id: 's4',
        type: 'single',
        question: '如果用一种天气形容这段关系，你会选？',
        options: [
            '有风有雨但偶尔放晴的春天',
            '闷热又暴躁的夏天',
            '有点凉但很清醒的秋天',
            '偶尔会被冻到的冬天'
        ]
    },
    {
        id: 's5',
        type: 'single',
        question: '在这段关系里，你更常扮演的角色是？',
        options: [
            '主动表达和照顾气氛的人',
            '什么都藏在心里的观察者',
            '情绪很敏感、容易受影响的人',
            '表面佛系，内心在默默期待的人'
        ]
    },
    {
        id: 's6',
        type: 'single',
        question: '提到“安全感”，你第一反应是？',
        options: [
            '对方愿意和我分享他的世界',
            '对方会在我需要的时候出现',
            '就算不说话，也能感到被理解',
            '有清晰的未来计划和承诺'
        ]
    },
    {
        id: 's7',
        type: 'single',
        question: '你对这段关系未来三个月最真实的期待是？',
        options: [
            '关系更稳定，少一点情绪波动',
            '能有一次好好把话讲清楚的机会',
            '哪怕不在一起，也能彼此祝福',
            '先搞清楚自己的心，再决定要不要继续'
        ]
    },
    {
        id: 's8',
        type: 'single',
        question: '当你很想对方却没有收到回应时，你更可能会？',
        options: [
            '继续试探性发消息',
            '删除后又重新加回来',
            '假装不在意，默默在意很久',
            '干脆把注意力转移到别的事情上'
        ]
    },
    {
        id: 's9',
        type: 'single',
        question: '下面哪一句话更贴近你此刻的状态？',
        options: [
            '我还想再赌一次，看他/她会不会向我走近',
            '我已经很累了，只是还在习惯性等待',
            '我表面云淡风轻，其实心里翻涌',
            '我在慢慢学着把重心放回自己身上'
        ]
    },
    {
        id: 's10',
        type: 'single',
        question: '如果这段关系是一张塔罗牌，你觉得更像是？',
        options: [
            '恋人：彼此吸引又反复拉扯',
            '倒吊人：一个人被挂在原地等答案',
            '隐者：各自退回自己的小世界',
            '命运之轮：时好时坏，全看时机和运气'
        ]
    },

    // 判断题 5 道
    {
        id: 'b1',
        type: 'boolean',
        question: '你是否仍然相信，这段关系在未来还有继续发展的可能？',
        options: ['是', '否']
    },
    {
        id: 'b2',
        type: 'boolean',
        question: '你是否习惯把很多情绪憋在心里，不太愿意让对方看到自己的脆弱？',
        options: ['是', '否']
    },
    {
        id: 'b3',
        type: 'boolean',
        question: '你是否曾经为这段关系主动做出过明显的改变或妥协？',
        options: ['是', '否']
    },
    {
        id: 'b4',
        type: 'boolean',
        question: '如果这段关系真的结束了，你是否觉得自己会后悔现在没有多努力一点？',
        options: ['是', '否']
    },
    {
        id: 'b5',
        type: 'boolean',
        question: '你是否愿意给自己一次机会，用一种比过去更温柔的方式去爱与被爱？',
        options: ['是', '否']
    },

    // 简答题 5 道
    {
        id: 't1',
        type: 'text',
        question: '用一两句话写下，你目前最想对这段关系说的一句话。'
    },
    {
        id: 't2',
        type: 'text',
        question: '回想你们之间让你最心动或最心碎的一个瞬间，简单描述一下那个画面。'
    },
    {
        id: 't3',
        type: 'text',
        question: '如果可以和未来三个月后的自己对话，你最想听到他/她关于这段关系说什么？'
    },
    {
        id: 't4',
        type: 'text',
        question: '现在的你最害怕这段关系变成什么样子？请坦诚写下你的担心。'
    },
    {
        id: 't5',
        type: 'text',
        question: '写下此刻跳进你脑海里的第一个关键词，用来形容你对“爱”的理解。'
    }
];

let tarotState = {
    boundRoleId: null,
    boundRoleName: '',
    lastDrawDateByRole: {}, // { [roleId]: 'YYYY-MM-DD' }
    currentQuestions: [],
    currentIndex: 0,
    answers: [],
    isGenerating: false,
};

function loadTarotStateFromStorage() {
    const stored = getStorage('tarot_state_v1', null);
    if (stored && typeof stored === 'object') {
        tarotState = {
            ...tarotState,
            ...stored,
            lastDrawDateByRole: stored.lastDrawDateByRole || {},
        };
    }
}

function saveTarotStateToStorage() {
    setStorage('tarot_state_v1', {
        boundRoleId: tarotState.boundRoleId,
        boundRoleName: tarotState.boundRoleName,
        lastDrawDateByRole: tarotState.lastDrawDateByRole,
    });
}

function getTodayDateKey() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}

function hasRoleDrawnToday(roleId) {
    const key = String(roleId);
    const today = getTodayDateKey();
    return tarotState.lastDrawDateByRole[key] === today;
}

function markRoleDrawnToday(roleId) {
    const key = String(roleId);
    tarotState.lastDrawDateByRole[key] = getTodayDateKey();
    saveTarotStateToStorage();
}

function openTarotEntry(forceRebind) {
    const modal = document.getElementById('tarot-entry-modal');
    const select = document.getElementById('tarot-role-select');
    const hint = document.getElementById('tarot-role-hint');

    if (!modal || !select || !hint) return;

    // 如果当前还没有任何用户人设，为了不让用户“连进入塔罗界面的资格都没有”，
    // 这里提供一个兜底默认角色，直接进入塔罗主界面。
    if (!userProfiles || userProfiles.length === 0) {
        tarotState.boundRoleId = 'default';
        tarotState.boundRoleName = '临时角色';
        saveTarotStateToStorage();
        updateTarotMenuRoleLabel();
        // 不再弹出选择人设弹窗，直接打开塔罗主页面
        openPage('tarot-page');
        return;
    }

    // 如果已经绑定过角色，并且这次不是“强制重新绑定”，则直接进入塔罗主页面
    if (!forceRebind && tarotState.boundRoleId) {
        const roleExists = userProfiles.some(u => String(u.id) === String(tarotState.boundRoleId));
        if (roleExists) {
            updateTarotMenuRoleLabel();
            openPage('tarot-page');
            return;
        } else {
            // 原先绑定的角色已经被删除，清空绑定信息，继续走下面的重新绑定流程
            tarotState.boundRoleId = null;
            tarotState.boundRoleName = '';
            saveTarotStateToStorage();
        }
    }

    // 根据当前「用户人设」列表渲染角色（使用 userProfiles 而不是 aiList）
    select.innerHTML = '';
    select.disabled = false;

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '请选择一个用户人设';
    select.appendChild(placeholder);

    userProfiles.forEach(profile => {
        const opt = document.createElement('option');
        opt.value = profile.id;
        opt.textContent = profile.name || ('人设' + profile.id);
        if (String(profile.id) === String(tarotState.boundRoleId)) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });

    hint.textContent = '请为今天的占卜选择一个要占卜的用户人设。';

    modal.classList.add('active');
}

function closeTarotEntryModal() {
    const modal = document.getElementById('tarot-entry-modal');
    if (modal) modal.classList.remove('active');
}

function updateTarotMenuRoleLabel() {
    const label = document.getElementById('tarot-current-role-label');
    const dailyHint = document.getElementById('tarot-daily-hint');
    if (!label || !dailyHint) return;

    if (!tarotState.boundRoleId) {
        label.textContent = '当前绑定角色：未选择';
        dailyHint.textContent = '请先绑定一个角色，才能开始今天的占卜。';
        return;
    }

    const roleName = tarotState.boundRoleName || '未命名角色';
    label.textContent = `当前绑定角色：${roleName}`;

    if (hasRoleDrawnToday(tarotState.boundRoleId)) {
        dailyHint.textContent = '今天的占卜次数已用完，请明天再来。';
    } else {
        dailyHint.textContent = '今天还可以占卜一次。';
    }
}

    function bindTarotRoleFromModal() {
        const select = document.getElementById('tarot-role-select');
        const hint = document.getElementById('tarot-role-hint');
        if (!select || !hint) return;

        const value = select.value;
        if (!value) {
            hint.textContent = '请先选择一个用户人设。';
            return;
        }

        const role = userProfiles.find(u => String(u.id) === String(value));
        if (!role) {
            hint.textContent = '未找到该用户人设，请稍后重试。';
            return;
        }

        tarotState.boundRoleId = role.id;
        tarotState.boundRoleName = role.name || '未命名人设';
        saveTarotStateToStorage();
        updateTarotMenuRoleLabel();
        closeTarotEntryModal();

        // 自动打开塔罗主页面（加一层兜底，确保页面真正显示出来）
        try {
            if (typeof openPage === 'function') {
                openPage('tarot-page');
            } else if (typeof window.openPage === 'function') {
                window.openPage('tarot-page');
            }
        } catch (err) {
            console.warn('openPage("tarot-page") 调用失败，尝试直接激活页面', err);
        }

        // 无论 openPage 是否成功，再次确保塔罗页面处于激活状态
        const tarotPageEl = document.getElementById('tarot-page');
        if (tarotPageEl && !tarotPageEl.classList.contains('active')) {
            tarotPageEl.classList.add('active');
        }
    }


function ensureTarotRoleBoundOrOpenEntry() {
    if (!tarotState.boundRoleId) {
        openTarotEntry();
        return false;
    }
    return true;
}

function startTarotQuiz() {
    if (!ensureTarotRoleBoundOrOpenEntry()) {
        showToast('请先选择一个角色再开始占卜。');
        return;
    }

    if (hasRoleDrawnToday(tarotState.boundRoleId)) {
        showToast('这个角色今天已经占卜过啦，明天再来。');
        return;
    }

    const menuSection = document.getElementById('tarot-menu-section');
    const quizSection = document.getElementById('tarot-quiz-section');
    const resultSection = document.getElementById('tarot-result-section');
    const statusEl = document.getElementById('tarot-quiz-status');
    const questionText = document.getElementById('tarot-question-text');
    const answerInput = document.getElementById('tarot-answer-input');
    const nextBtn = document.getElementById('tarot-next-btn');
    const viewResultBtn = document.getElementById('tarot-view-result-btn');

    if (!menuSection || !quizSection || !statusEl || !questionText || !answerInput || !nextBtn || !viewResultBtn || !resultSection) {
        console.warn('塔罗问答必要DOM缺失');
        return;
    }

    menuSection.classList.add('tarot-section-hidden');
    resultSection.classList.add('tarot-section-hidden');
    quizSection.classList.remove('tarot-section-hidden');

    statusEl.textContent = '正在为你洗牌并抽取题目，请稍候...';
    questionText.textContent = '';
    answerInput.value = '';
    nextBtn.disabled = true;
    viewResultBtn.classList.add('tarot-section-hidden');

    // 随机抽取 10 题（从多题型题库中抽取）
    const pool = [...TAROT_QUESTION_BANK];
    const selected = [];
    while (pool.length > 0 && selected.length < 10) {
        const idx = Math.floor(Math.random() * pool.length);
        selected.push(pool.splice(idx, 1)[0]);
    }

    tarotState.currentQuestions = selected;
    tarotState.currentIndex = 0;
    tarotState.answers = new Array(selected.length).fill('');

    setTimeout(() => {
        statusEl.textContent = '';
        renderCurrentTarotQuestion();
    }, 800);
}

function renderCurrentTarotQuestion() {
    const questionText = document.getElementById('tarot-question-text');
    const answerInput = document.getElementById('tarot-answer-input');
    const progressEl = document.getElementById('tarot-quiz-progress');
    const viewResultBtn = document.getElementById('tarot-view-result-btn');
    const nextBtn = document.getElementById('tarot-next-btn');
    const questionBox = document.getElementById('tarot-question-box');

    if (!questionText || !answerInput || !progressEl || !viewResultBtn || !nextBtn || !questionBox) return;

    let optionContainer = document.getElementById('tarot-option-list');
    if (!optionContainer) {
        optionContainer = document.createElement('div');
        optionContainer.id = 'tarot-option-list';
        optionContainer.className = 'tarot-option-list';
        questionBox.appendChild(optionContainer);
    }

    const idx = tarotState.currentIndex;
    const total = tarotState.currentQuestions.length || 10;
    const q = tarotState.currentQuestions[idx];

    if (!q) {
        questionText.textContent = '...';
        answerInput.value = '';
        optionContainer.innerHTML = '';
        nextBtn.disabled = true;
        return;
    }

    const type = q.type || 'text';
    questionText.textContent = q.question || '';
    progressEl.textContent = `第 ${idx + 1} / ${total} 题`;

    // 根据题型切换控件
    if (type === 'text') {
        // 简答题：显示文本输入，隐藏选项
        answerInput.style.display = 'block';
        answerInput.disabled = false;
        answerInput.value = tarotState.answers[idx] || '';
        optionContainer.style.display = 'none';
        optionContainer.innerHTML = '';
        nextBtn.disabled = false;
    } else {
        // 单选 / 判断题：隐藏文本输入，显示选项按钮
        answerInput.value = '';
        answerInput.style.display = 'none';

        const options = Array.isArray(q.options) && q.options.length
            ? q.options
            : (type === 'boolean' ? ['是', '否'] : []);

        optionContainer.style.display = 'flex';
        optionContainer.innerHTML = '';

        const currentAnswer = tarotState.answers[idx] || '';
        options.forEach(optText => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tarot-option-btn';
            if (currentAnswer === optText) {
                btn.classList.add('selected');
            }
            btn.textContent = optText;
            btn.addEventListener('click', () => {
                tarotState.answers[idx] = optText;
                // 更新按钮选中态
                optionContainer.querySelectorAll('.tarot-option-btn').forEach(b => {
                    b.classList.toggle('selected', b === btn);
                });
                nextBtn.disabled = false;
            });
            optionContainer.appendChild(btn);
        });

        // 如果还没有选择答案，则禁止跳转到下一题
        nextBtn.disabled = !tarotState.answers[idx];
    }

    if (idx === total - 1) {
        nextBtn.textContent = '完成答题';
        viewResultBtn.classList.remove('tarot-section-hidden');
    } else {
        nextBtn.textContent = '下一题';
        viewResultBtn.classList.add('tarot-section-hidden');
    }
}

function goToNextTarotQuestion() {
    const answerInput = document.getElementById('tarot-answer-input');
    if (!answerInput) return;

    const idx = tarotState.currentIndex;
    const q = tarotState.currentQuestions[idx];
    if (!q) return;

    const type = q.type || 'text';

    if (type === 'text') {
        const text = (answerInput.value || '').trim();
        tarotState.answers[idx] = text;
    } else {
        // 单选 / 判断题的答案已经在选项点击时写入
        if (!tarotState.answers[idx]) {
            showToast('请先选择一个选项');
            return;
        }
    }

    if (tarotState.currentIndex < tarotState.currentQuestions.length - 1) {
        tarotState.currentIndex += 1;
        renderCurrentTarotQuestion();
    } else {
        showToast('十个问题已经全部回答完毕，可以查看结果啦。');
    }
}

async function generateTarotResult() {
    if (tarotState.isGenerating) return;
    if (!config.key || !config.url) {
        showToast('请先在设置里配置API。');
        return;
    }

    tarotState.isGenerating = true;
    const viewResultBtn = document.getElementById('tarot-view-result-btn');
    const quizSection = document.getElementById('tarot-quiz-section');
    const resultSection = document.getElementById('tarot-result-section');
    const cardsContainer = document.getElementById('tarot-result-cards');
    const resultTextEl = document.getElementById('tarot-result-text');
    const statusEl = document.getElementById('tarot-quiz-status');
    const nextBtn = document.getElementById('tarot-next-btn');
    const answerInput = document.getElementById('tarot-answer-input');
    const optionContainer = document.getElementById('tarot-option-list');

    if (viewResultBtn) {
        viewResultBtn.textContent = '正在洗牌推演，请稍候...';
        viewResultBtn.disabled = true;
    }

    if (!resultSection || !quizSection || !cardsContainer || !resultTextEl) {
        console.warn('塔罗结果DOM缺失');
        tarotState.isGenerating = false;
        if (viewResultBtn) {
            viewResultBtn.textContent = '查看结果';
            viewResultBtn.disabled = false;
        }
        return;
    }

    // 留在问答界面，展示“等待结果中……”提示，并锁定输入
    if (statusEl) {
        statusEl.textContent = '等待结果中……魔女正在为你解读牌面';
    }
    if (nextBtn) nextBtn.disabled = true;
    if (answerInput) answerInput.disabled = true;
    if (optionContainer) {
        optionContainer.querySelectorAll('button').forEach(btn => {
            btn.disabled = true;
        });
    }

    // 使用当前绑定的「用户人设」信息，而不是 AI 角色
    const role = userProfiles.find(u => String(u.id) === String(tarotState.boundRoleId));
    const persona = role ? (role.prompt || role.description || role.bio || '') : '';
    const roleName = role ? (role.name || '你的角色') : '你的角色';

    const qaPairs = tarotState.currentQuestions.map((q, idx) => {
        const title = (q && q.question) ? q.question : `第 ${idx + 1} 题`;
        const ans = tarotState.answers[idx] || '（未作答）';
        return `Q${idx + 1}: ${title}\nA${idx + 1}: ${ans}`;
    }).join('\n\n');

    const prompt = `你是一名塔罗牌占卜师，同时也是一位身穿紫色长袍、手持水晶球的魔女。
 
现在你要为一位名为「${roleName}」的用户人设做一次专属塔罗占卜。这个人设的背景与性格是：${persona || '（暂无额外设定，可根据回答适度补全细节，但要温柔克制）'}。

用户刚刚在占卜前回答了 10 个关于当下状态的问题，其中既包含开放式简答，也包含选择题和判断题。所有回答已经整理如下：
${qaPairs}

请你根据这些回答，先在心里完成一次完整的塔罗抽牌与牌阵推演，最终只返回一个JSON对象，结构如下：
{
  "cards": [
    { "name": "牌名（例如：恋人）", "position": "正位或逆位", "symbol": "用一个简短意象或符号概括，比如：心之选择" },
    { "name": "...", "position": "...", "symbol": "..." },
    { "name": "...", "position": "...", "symbol": "..." }
  ],
  "analysis": "一段 400-800 字左右的结果分析，用第二人称视角与温柔的魔女口吻，围绕这三张牌的含义，结合角色人设和十个问题的回答，对当前处境、内在状态以及接下来一小段时间的趋势进行解读。可以分为若干自然段，但不要使用标题、列表或小节编号。避免神叨叨的恐吓语气，多给出可落地的建议。"
}

严格按照上述JSON结构返回，不要出现任何多余说明或代码块标记。`;

    let success = false;

    try {
        let rawResponse = await getCompletion(prompt, true);
        const jsonString = extractFirstJsonObject(rawResponse);
        if (!jsonString) throw new Error('未能解析到有效的JSON结果。');
        const data = JSON.parse(jsonString);

        cardsContainer.innerHTML = '';
        (data.cards || []).slice(0, 3).forEach(card => {
            const div = document.createElement('div');
            div.className = 'tarot-card';
            const name = card.name || '未知之牌';
            const pos = card.position || '未知位';
            const symbol = card.symbol || '';
            div.innerHTML = `
                <div class="tarot-card-name">${escapeHTML(name)}</div>
                <div class="tarot-card-pos">${escapeHTML(pos)}</div>
                <div class="tarot-card-symbol">${escapeHTML(symbol)}</div>
            `;
            cardsContainer.appendChild(div);
        });

        resultTextEl.textContent = data.analysis || '今天的命运有些含糊不清，请稍后再试一次。';

        // 切换到结果区
        quizSection.classList.add('tarot-section-hidden');
        resultSection.classList.remove('tarot-section-hidden');

        // 标记今日已经抽过
        if (tarotState.boundRoleId) {
            markRoleDrawnToday(tarotState.boundRoleId);
            updateTarotMenuRoleLabel();
        }

        success = true;
    } catch (e) {
        console.error('生成塔罗结果失败', e);
        showToast('生成塔罗结果失败，请稍后重试。');
    } finally {
        tarotState.isGenerating = false;
        if (viewResultBtn) {
            viewResultBtn.textContent = '查看结果';
            viewResultBtn.disabled = false;
        }
        if (!success) {
            if (statusEl) {
                statusEl.textContent = '生成塔罗结果失败，请稍后重试。';
            }
            if (nextBtn) nextBtn.disabled = false;
            if (answerInput) answerInput.disabled = false;
            if (optionContainer) {
                optionContainer.querySelectorAll('button').forEach(btn => {
                    btn.disabled = false;
                });
            }
        }
    }
}

function backToTarotMenu() {
    const menuSection = document.getElementById('tarot-menu-section');
    const quizSection = document.getElementById('tarot-quiz-section');
    const resultSection = document.getElementById('tarot-result-section');

    if (menuSection) menuSection.classList.remove('tarot-section-hidden');
    if (quizSection) quizSection.classList.add('tarot-section-hidden');
    if (resultSection) resultSection.classList.add('tarot-section-hidden');
}

function openTarotOverlay() {
    const page = document.getElementById('tarot-page');
    if (!page) return;
    page.classList.add('active');

    // 打开塔罗全屏层时，同步隐藏 Dock，行为与普通 app-page 保持一致
    const dock = document.querySelector('.dock-bar');
    if (dock) {
        dock.style.display = 'none';
    }
}

function closeTarotOverlay() {
    const page = document.getElementById('tarot-page');
    if (page) page.classList.remove('active');

    // 若当前没有其它 app-page 处于激活状态，则恢复 Dock 显示
    const anyActiveAppPage = document.querySelector('.app-page.active');
    const dock = document.querySelector('.dock-bar');
    if (dock) {
        dock.style.display = anyActiveAppPage ? 'none' : '';
    }
}

function initTarotApp() {
    loadTarotStateFromStorage();
    updateTarotMenuRoleLabel();

    const entryConfirmBtn = document.getElementById('tarot-entry-confirm-btn');
    const entryCancelBtn = document.getElementById('tarot-entry-cancel-btn');
    const rulesBtn = document.getElementById('tarot-rules-btn');
    const rulesModal = document.getElementById('tarot-rules-modal');
    const rulesCloseBtn = document.getElementById('tarot-rules-close-btn');
    const startBtn = document.getElementById('tarot-start-btn');
    const rebindBtn = document.getElementById('tarot-rebind-btn');
    const quizBackBtn = document.getElementById('tarot-quiz-back-btn');
    const resultBackBtn = document.getElementById('tarot-result-back-btn');
    const nextBtn = document.getElementById('tarot-next-btn');
    const viewResultBtn = document.getElementById('tarot-view-result-btn');

    if (entryConfirmBtn) entryConfirmBtn.addEventListener('click', bindTarotRoleFromModal);
    if (entryCancelBtn) entryCancelBtn.addEventListener('click', closeTarotEntryModal);

    if (rulesBtn && rulesModal) rulesBtn.addEventListener('click', () => {
        // 规则弹窗在主屏层显示，为避免被塔罗全屏层遮挡，先关闭塔罗层
        closeTarotOverlay();
        rulesModal.classList.add('active');
    });
    if (rulesCloseBtn && rulesModal) rulesCloseBtn.addEventListener('click', () => {
        rulesModal.classList.remove('active');
    });

    if (startBtn) startBtn.addEventListener('click', startTarotQuiz);
    if (rebindBtn) rebindBtn.addEventListener('click', () => {
        // 重新绑定角色时，同样先退出塔罗全屏层，再打开绑定弹窗
        closeTarotOverlay();
        openTarotEntry(true);
    });
    if (quizBackBtn) quizBackBtn.addEventListener('click', backToTarotMenu);
    if (resultBackBtn) resultBackBtn.addEventListener('click', backToTarotMenu);
    if (nextBtn) nextBtn.addEventListener('click', goToNextTarotQuestion);
    if (viewResultBtn) viewResultBtn.addEventListener('click', generateTarotResult);
}

// 将塔罗入口暴露到全局，供首页按钮调用
window.openTarotEntry = openTarotEntry;
window.openTarotOverlay = openTarotOverlay;
window.closeTarotOverlay = closeTarotOverlay;
window.openLivePage = openLivePage;
window.openLiveProfilePage = openLiveProfilePage;
window.handleLiveRefresh = handleLiveRefresh;
window.openLiveRoom = openLiveRoom;
window.closeLiveRoomPage = closeLiveRoomPage;
window.handleLiveSendComment = handleLiveSendComment;
window.handleLiveGift = handleLiveGift;

// 在页面加载完后初始化塔罗App
window.addEventListener('DOMContentLoaded', () => {
    initTarotApp();
});

window.addEventListener('focus', () => {
    if (currentLiveRoomId) {
        const session = ensureLiveSession(currentLiveRoomId);
        if (session && Date.now() - session.lastSceneAt > 180000) {
            refreshLiveNarrative(currentLiveRoomId);
        }
    }
});
async function openWorldbookBinder() {
    closeForumActionModal(); // 关闭上一个菜单

    const worldbooks = getStorage('ai_worldbooks_v2') || [];
    if (worldbooks.length === 0) {
        return showToast("您还没有创建任何世界书");
    }

    // 从现有的世界书中提取出所有唯一的分类名
    const categories = [...new Set(worldbooks.map(wb => wb.category))];

    const body = document.getElementById('worldbook-binder-body');
    if (!body) return console.error("找不到 worldbook-binder-body 元素！");

    let html = '';
    const contexts = {
        postGeneration: '新帖子和评论',
        commentGeneration: '“召唤新评论”',
        dmGeneration: '私信'
    };

    for (const context in contexts) {
        const title = contexts[context];
        const currentlyBoundIds = worldbookBindings[context] || [];
        let optionsHTML = '';

        // 生成分类选项
        categories.forEach(catName => {
            const catId = `cat_${catName}`; // 核心修正：我们用分类的【名称】作为ID
            const isChecked = currentlyBoundIds.includes(catId);
            optionsHTML += `
                <div class="worldbook-bind-item">
                    <input class="worldbook-checkbox" type="checkbox" data-context="${context}" id="bind_${context}_${catId}" value="${catId}" ${isChecked ? 'checked' : ''}>
                    <label for="bind_${context}_${catId}">📁 <strong>${escapeHTML(catName)}</strong> (分类)</label>
                </div>
            `;
        });

        // 生成世界书选项
        worldbooks.forEach(wb => {
            const isChecked = currentlyBoundIds.includes(String(wb.id));
            // 核心修正：使用 wb.category 来判断是否需要缩进
            const style = wb.category && wb.category !== '未分类' ? 'style="margin-left: 20px;"' : '';
            optionsHTML += `
                <div class="worldbook-bind-item" ${style}>
                    <input class="worldbook-checkbox" type="checkbox" data-context="${context}" id="bind_${context}_wb_${wb.id}" value="${wb.id}" ${isChecked ? 'checked' : ''}>
                    <label for="bind_${context}_wb_${wb.id}">📖 ${escapeHTML(wb.name)}</label>
                </div>
            `;
        });

        html += `<details class="worldbook-bind-section" open><summary>${title}</summary><div class="worldbook-bind-options">${optionsHTML}</div></details>`;
    }

    body.innerHTML = html;

    const container = document.getElementById('worldbook-binder-container');
    if (container) {
        container.style.display = 'flex';
        setTimeout(() => container.classList.add('active'), 10);
    }
}

// 2. 保存函数
function saveWorldbookBinding() {
    // 将勾选项按上下文分组并保存到 forum 的 worldbook_bindings
    const checked = Array.from(document.querySelectorAll('#worldbook-binder-body .worldbook-checkbox:checked'));
    const grouped = { postGeneration: [], commentGeneration: [], dmGeneration: [] };
    checked.forEach(cb => {
        const ctx = cb.dataset.context;
        if (ctx && grouped[ctx]) grouped[ctx].push(cb.value);
    });

    worldbookBindings = grouped;
    setStorage('worldbook_bindings', worldbookBindings);

    closeWorldbookBinder();
    showToast('世界书绑定已更新');
}

// 3. 关闭函数
function closeWorldbookBinder() {
    const container = document.getElementById('worldbook-binder-container');
    if (container) {
        container.classList.remove('active');
        const hide = () => {
            container.style.display = 'none';
            container.removeEventListener('transitionend', hide);
        };
        container.addEventListener('transitionend', hide);
    }
}

// 4. 设置按钮监听 (页面加载时自动运行)
function setupWorldbookBinderListeners() {
    const saveBtn = document.getElementById('worldbook-binder-save-btn');
    const cancelBtn = document.getElementById('worldbook-binder-cancel-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveWorldbookBinding);
    if (cancelBtn) cancelBtn.addEventListener('click', closeWorldbookBinder);
}
setupWorldbookBinderListeners();




// 4. 辅助函数：关闭抽屉（如果您的通用函数有问题，可以用这个）
function closeDrawer(modalId) {
    // 优先尝试关闭新版、动态创建的弹窗 (比如角色管理弹窗)
    // 它会主动拿'role-editor-modal'这样的基础ID去拼接成 '...-container' 和 '...-overlay'
    const newStyleContainer = document.getElementById(modalId + '-container');
    const newStyleOverlay = document.getElementById(modalId + '-overlay');

    if (newStyleContainer && newStyleOverlay) {
        newStyleContainer.classList.remove('active');
        newStyleOverlay.classList.remove('active');

        // 在动画结束后，从DOM中彻底移除这些临时元素，保持页面干净
        const cleanup = () => {
            if(newStyleOverlay) newStyleOverlay.remove();
            if(newStyleContainer) newStyleContainer.remove();
            // 确保只执行一次，避免潜在问题
            newStyleContainer.removeEventListener('transitionend', cleanup);
        };
        newStyleContainer.addEventListener('transitionend', cleanup, { once: true });
        return; // 处理完毕，直接返回
    }

    // 如果上面没找到新式弹窗，就按老方法把 modalId 当作一个完整的ID来处理
    // 这能兼容所有旧的弹窗，比如世界书、QQ设置等
    const oldStyleModal = document.getElementById(modalId);
    if (oldStyleModal) {
        if (oldStyleModal.classList.contains('active')) {
            oldStyleModal.classList.remove('active');
        } else {
            // 备用方案，处理那些用 display:none 控制的非常老的弹窗
            oldStyleModal.style.display = 'none';
        }
    }
}

async function getWorldbookContentForContext(context) {
    const boundIds = worldbookBindings[context] || [];
    if (boundIds.length === 0) return '';

    // --- 核心修改：同样使用正确的键名 ---
    const allWorldbooks = getStorage('ai_worldbooks_v2') || [];
    
    let contentParts = [];
    
    for (const id of boundIds) {
        // --- 核心修改：调整匹配分类的逻辑 ---
        if (id.toString().startsWith('cat_')) {
            const catName = id.replace('cat_', '');
            contentParts.push(`\n# 分类：${catName}\n`);
            // 找到该分类下的所有世界书并加入
            allWorldbooks.filter(wb => wb.category === catName).forEach(wb => {
                contentParts.push(`## 世界书：${wb.name}\n${wb.content}\n`);
            });
        } else {
            const worldbook = allWorldbooks.find(wb => wb.id == id);
            // 确保这本书没有被其所属的分类重复添加
            if (worldbook && !boundIds.includes(`cat_${worldbook.category}`)) {
                contentParts.push(`## 世界书：${worldbook.name}\n${worldbook.content || ''}\n`);
            }
        }
    }

    if(contentParts.length > 0){
        return `# 参考以下世界书设定进行创作：\n${contentParts.join('')}`;
    }
    return '';
}

// ==========================
// 孵蛋室 · 角色卡 / 世界书 / CSS 生成
// ==========================
const HATCHERY_CHAR_TEMPLATE_PRESET_KEY = 'hatchery_char_template_presets_v1';

function getHatcheryCharTemplatePresets() {
    return getStorage(HATCHERY_CHAR_TEMPLATE_PRESET_KEY, []);
}

function setHatcheryCharTemplatePresets(list) {
    setStorage(HATCHERY_CHAR_TEMPLATE_PRESET_KEY, list || []);
}

async function generateHatcheryCharacter() {
    const briefEl = document.getElementById('hatchery-char-input');
    const templateEl = document.getElementById('hatchery-char-template');
    const outputEl = document.getElementById('hatchery-char-output');
    const btn = document.getElementById('hatchery-char-btn');
    const statusEl = document.getElementById('hatchery-char-status');

    if (!briefEl || !outputEl) return;
    const brief = briefEl.value.trim();
    const template = templateEl ? templateEl.value.trim() : '';
    if (!brief) return showToast('请先写一点角色设定');
    if (!config.key || !config.url) return showToast('请先在「设置」中配置 API！');

    let success = false;

    try {
        if (btn) {
            btn.disabled = true;
            btn.classList.add('loading');
        }
        if (statusEl) {
            statusEl.textContent = '等待生成完毕';
            statusEl.style.display = 'block';
        }
        showToast('正在生成角色卡...');

        const prompt = `你现在是一个“角色卡模板填充器”。\n` +
`如果提供了模板，请严格沿用模板的字段结构，仅替换为本次角色的内容；如果未提供模板，则使用你习惯的结构即可。\n\n` +
`【角色卡模板（可能为空）】\n${template || '（未提供模板，可自行设计合理结构）'}\n\n` +
`【本次角色设定说明】\n${brief}\n\n` +
`【输出要求】\n` +
`1. 只输出一段可直接使用的角色卡文本，可以是 JSON / YAML / Markdown 之一。\n` +
`2. 如果有模板，则保持字段名和层级不变，只替换内容；如果无模板，请适当包含：基础信息、人设说明、说话风格、与用户关系、补充设定等。\n` +
`3. 不要使用代码块标记，不要加解释文字。`;

        const raw = await getCompletion(prompt, false);
        outputEl.value = raw.trim();
        outputEl.scrollTop = 0;
        success = true;
    } catch (e) {
        console.error('生成角色卡失败:', e);
        showToast('生成角色卡失败：' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('loading');
        }
        if (statusEl) {
            statusEl.style.display = 'none';
        }
        if (success && briefEl) {
            briefEl.value = '';
        }
    }
}

async function modifyHatcheryCharacter() {
    const briefEl = document.getElementById('hatchery-char-input');
    const templateEl = document.getElementById('hatchery-char-template');
    const outputEl = document.getElementById('hatchery-char-output');
    const btn = document.getElementById('hatchery-char-edit-btn');
    const statusEl = document.getElementById('hatchery-char-status');

    if (!briefEl || !outputEl) return;
    const instructions = briefEl.value.trim();
    const originalCard = outputEl.value.trim();
    const template = templateEl ? templateEl.value.trim() : '';

    if (!originalCard) return showToast('请先生成一份角色卡，再尝试修改');
    if (!instructions) return showToast('请在角色设定说明中写下你想修改或补充的内容');
    if (!config.key || !config.url) return showToast('请先在「设置」中配置 API！');

    let success = false;

    try {
        if (btn) {
            btn.disabled = true;
            btn.classList.add('loading');
        }
        if (statusEl) {
            statusEl.textContent = '等待修改完毕';
            statusEl.style.display = 'block';
        }
        showToast('正在修改角色卡...');

        const prompt = `你现在是一个“角色卡修改器”。\n` +
`请在尽量保持原有结构和字段名不变的前提下，根据用户的修改需求，对角色卡内容进行增删改。\n\n` +
`【（可能存在的）角色卡模板】\n${template || '（若为空，则以原始角色卡的结构为准）'}\n\n` +
`【原始角色卡】\n${originalCard}\n\n` +
`【修改需求】\n${instructions}\n\n` +
`【输出要求】\n` +
`1. 输出一份完整的、已经应用了修改需求的角色卡文本，格式与原始角色卡保持一致。\n` +
`2. 优先保持字段结构不变，在此基础上改写字段内容或增删字段。\n` +
`3. 不要添加任何解释文字或代码块标记。`;

        const raw = await getCompletion(prompt, false);
        outputEl.value = raw.trim();
        outputEl.scrollTop = 0;
        success = true;
    } catch (e) {
        console.error('修改角色卡失败:', e);
        showToast('修改角色卡失败：' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('loading');
        }
        if (statusEl) {
            statusEl.style.display = 'none';
        }
        if (success && briefEl) {
            briefEl.value = '';
        }
    }
}

function copyHatcheryCharacter() {
    const outputEl = document.getElementById('hatchery-char-output');
    if (!outputEl) return;
    const text = outputEl.value.trim();
    if (!text) {
        showToast('当前还没有可复制的角色卡内容');
        return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => showToast('角色卡内容已复制到剪贴板'))
            .catch(() => {
                fallbackCopyHatcheryCharacter(text);
            });
    } else {
        fallbackCopyHatcheryCharacter(text);
    }
}

function fallbackCopyHatcheryCharacter(text) {
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('角色卡内容已复制到剪贴板');
    } catch (e) {
        console.error('复制角色卡失败:', e);
        showToast('复制失败，请手动选择文本复制');
    }
}

function openHatcheryCharTemplatePresets() {
    const root = document.getElementById('popup-layers') || document.body;

    let overlay = document.getElementById('hatchery-char-template-overlay');
    let container = document.getElementById('hatchery-char-template-modal');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'hatchery-char-template-overlay';
        overlay.className = 'modal-overlay active';
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeHatcheryCharTemplatePresets();
            }
        });
        root.appendChild(overlay);
    } else {
        overlay.classList.add('active');
    }

    if (!container) {
        container = document.createElement('div');
        container.id = 'hatchery-char-template-modal';
        container.className = 'modal-container active';
        container.innerHTML = `
            <div class="modal-content" style="width:92%; max-width:460px; background:#fff; border-radius:12px;">
                <div class="modal-header" style="padding:14px 16px; font-weight:700; border-bottom:1px solid #e5e5e5; display:flex; justify-content:space-between; align-items:center;">
                    <span>角色卡模板预设</span>
                    <button type="button" class="close-button" onclick="closeHatcheryCharTemplatePresets()" style="background:none; border:none; font-size:20px; cursor:pointer;">×</button>
                </div>
                <div class="modal-body" id="hatchery-char-template-preset-body" style="padding:16px; max-height:60vh; overflow:auto;"></div>
            </div>`;
        root.appendChild(container);
    } else {
        container.classList.add('active');
    }

    renderHatcheryCharTemplatePresets();
}

function renderHatcheryCharTemplatePresets() {
    const body = document.getElementById('hatchery-char-template-preset-body');
    if (!body) return;

    const presets = getHatcheryCharTemplatePresets();
    const templateEl = document.getElementById('hatchery-char-template');
    const currentTemplate = templateEl ? templateEl.value.trim() : '';

    const formHtml = `
        <div class="setting-card" style="margin-bottom:12px;">
            <div class="setting-row">
                <label class="setting-label">保存当前模板为预设</label>
            </div>
            <div class="setting-row sub-row">
                <label>名称</label>
                <input id="hatchery-char-template-preset-name" class="neo-input" placeholder="例如：恋爱向 JSON 模板" />
            </div>
            <div class="setting-row sub-row" style="font-size:12px; color:#666;">
                当前会保存「角色卡模板」输入框中的全部内容。
            </div>
            <div class="setting-row sub-row" style="display:flex; gap:8px;">
                <button type="button" class="neo-btn-small" id="hatchery-char-template-save-btn">保存/更新预设</button>
            </div>
        </div>`;

    const listItems = presets.map(p => {
        const preview = (p.template || '').slice(0, 40).replace(/\n/g, ' ');
        return `
            <div class="worldbook-bind-item" style="justify-content:space-between;">
                <div style="display:flex; flex-direction:column;">
                    <strong>${escapeHTML(p.name || '')}</strong>
                    <span style="font-size:12px; color:#666;">${escapeHTML(preview)}${p.template && p.template.length > 40 ? '…' : ''}</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="neo-btn-small" onclick="applyHatcheryCharTemplatePreset('${p.id}')">填入</button>
                    <button type="button" class="neo-btn-small" onclick="deleteHatcheryCharTemplatePreset('${p.id}')">删除</button>
                </div>
            </div>`;
    }).join('');

    const listHtml = `
        <div class="setting-card">
            <div class="setting-row">
                <label class="setting-label">我的模板预设</label>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${listItems || '<div style="color:#999; text-align:center; padding:10px;">暂无预设，先在上方保存一个</div>'}
            </div>
        </div>`;

    body.innerHTML = formHtml + listHtml;

    const saveBtn = document.getElementById('hatchery-char-template-save-btn');
    if (saveBtn) {
        saveBtn.onclick = saveHatcheryCharTemplatePresetFromModal;
    }

    // 如果当前模板有内容但名称为空，可适当给一个默认建议名称
    const nameInput = document.getElementById('hatchery-char-template-preset-name');
    if (nameInput && currentTemplate && !nameInput.value) {
        nameInput.placeholder = '例如：当前模板 ' + new Date().toLocaleTimeString();
    }
}

function saveHatcheryCharTemplatePresetFromModal() {
    const nameInput = document.getElementById('hatchery-char-template-preset-name');
    const templateEl = document.getElementById('hatchery-char-template');
    if (!nameInput || !templateEl) return;

    const name = nameInput.value.trim();
    const template = templateEl.value.trim();
    if (!template) {
        showToast('当前模板为空，无法保存为预设');
        return;
    }
    if (!name) {
        showToast('请先给模板预设起一个名字');
        return;
    }

    let presets = getHatcheryCharTemplatePresets();
    const existing = presets.find(p => p.name === name);
    if (existing) {
        existing.template = template;
        showToast('已更新同名模板预设');
    } else {
        presets.push({ id: 'hct_' + Date.now(), name, template });
        showToast('模板预设已保存');
    }
    setHatcheryCharTemplatePresets(presets);
    renderHatcheryCharTemplatePresets();
}

function applyHatcheryCharTemplatePreset(id) {
    const presets = getHatcheryCharTemplatePresets();
    const target = presets.find(p => p.id === id);
    if (!target) return;

    const templateEl = document.getElementById('hatchery-char-template');
    if (templateEl) {
        templateEl.value = target.template || '';
    }
    closeHatcheryCharTemplatePresets();
    showToast('已应用模板预设：' + (target.name || '')); 
}

function deleteHatcheryCharTemplatePreset(id) {
    if (!confirm('确定删除这个模板预设吗？此操作不可恢复')) return;
    let presets = getHatcheryCharTemplatePresets();
    presets = presets.filter(p => p.id !== id);
    setHatcheryCharTemplatePresets(presets);
    renderHatcheryCharTemplatePresets();
}

function closeHatcheryCharTemplatePresets() {
    const overlay = document.getElementById('hatchery-char-template-overlay');
    const container = document.getElementById('hatchery-char-template-modal');
    if (overlay) overlay.remove();
    if (container) container.remove();
}

async function generateHatcheryWorldbook() {
    const briefEl = document.getElementById('hatchery-world-input');
    const templateEl = document.getElementById('hatchery-world-template');
    const formatEl = document.getElementById('hatchery-world-format');
    const outputEl = document.getElementById('hatchery-world-output');
    const btn = document.getElementById('hatchery-world-btn');

    if (!briefEl || !outputEl) return;
    const brief = briefEl.value.trim();
    const template = templateEl ? templateEl.value.trim() : '';
    const format = formatEl ? formatEl.value : 'yaml';
    if (!brief) return showToast('请先写一点世界观设定');
    if (!config.key || !config.url) return showToast('请先在「设置」中配置 API！');

    try {
        if (btn) {
            btn.disabled = true;
            btn.classList.add('loading');
        }
        showToast('正在生成世界书...');

        const formatLabel = format === 'markdown' ? 'Markdown' : 'YAML';

        const prompt = `你现在是一个“世界书模板填充器”。\n` +
`如果提供了模板，请尽量沿用模板的结构和写作风格，仅替换为本次世界观内容。\n\n` +
`【世界书模板（可能为空）】\n${template || '（未提供模板，可自行设计合理的世界书结构）'}\n\n` +
`【新世界观描述】\n${brief}\n\n` +
`【输出要求】\n` +
`1. 只输出一段 ${formatLabel} 文本，不要加任何解释或代码块标记。\n` +
`2. 需要包含：世界基础信息 + 若干条“条目”（如地点、组织、术语、规则等）。\n` +
`3. 内容请使用简体中文，条目尽量拆细一点，方便后续在提示词中引用。`;

        const raw = await getCompletion(prompt, false);
        outputEl.value = raw.trim();
    } catch (e) {
        console.error('生成世界书失败:', e);
        showToast('生成世界书失败：' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('loading');
        }
    }
}

async function generateHatcheryCss() {
    const inputEl = document.getElementById('hatchery-css-input');
    const outputEl = document.getElementById('hatchery-css-output');
    const btn = document.getElementById('hatchery-css-btn');

    if (!inputEl || !outputEl) return;
    const brief = inputEl.value.trim();
    if (!brief) return showToast('请先描述一下你想要的样式');
    if (!config.key || !config.url) return showToast('请先在「设置」中配置 API！');

    try {
        if (btn) {
            btn.disabled = true;
            btn.classList.add('loading');
        }
        showToast('正在生成 CSS 美化方案...');

        const prompt = `你现在是一个专门为“小手机”生成主题样式的前端设计师。\n` +
`请根据下面的风格描述，输出一段 CSS 代码，让整个小手机形成一个统一主题。可以是黑白极简、日系暖黄、蓝色海洋、复古电子等任意风格，由用户描述决定。\n\n` +
`【风格描述】\n${brief}\n\n` +
`【建议覆盖的组件示例（可按需选择）】\n` +
`- 主屏幕 .screen / .dock-bar / .home-app-icon / .home-app-name\n` +
`- 聊天页面的背景与气泡（如 #msg-area 内的 .bubble）\n` +
`- 世界书 / 自律钟 / 论坛 等页面的卡片、标题和按钮\n\n` +
`【输出要求】\n` +
`1. 只输出纯 CSS 代码，不要包裹在 code block 里，不要写任何解释文字。\n` +
`2. 适当使用变量、阴影与过渡效果，但要保证在移动端阅读性良好。`;

        const css = await getCompletion(prompt, false);
        outputEl.value = css.trim();
    } catch (e) {
        console.error('生成 CSS 失败:', e);
        showToast('生成 CSS 失败：' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('loading');
        }
    }
}

function applyHatcheryCssToGlobal() {
    const cssOutput = document.getElementById('hatchery-css-output');
    const globalTextarea = document.getElementById('global-beautify-css-input');
    if (!cssOutput) return;
    const css = cssOutput.value.trim();
    if (!css) return showToast('请先在下方生成或填写一段 CSS');

    beautifyConfig.globalCss = css;
    setStorage('ai_beautify_config_v2', beautifyConfig);
    if (globalTextarea) {
        globalTextarea.value = css;
    }
    applyGlobalBeautifyCss();
    showToast('已将孵蛋室生成的 CSS 应用于全局美化');
}

function openForumPostCreator() {
    document.getElementById('forum-post-input').value = '';
    document.getElementById('forum-post-creator-modal').classList.add('active');
}

function closeForumPostCreator() {
    document.getElementById('forum-post-creator-modal').classList.remove('active');
}

function saveUserForumPost() {
    const text = document.getElementById('forum-post-input').value.trim();
    if (!text) return showToast('内容不能为空');
    
    // ✅ 1. 查找当前激活的论坛角色
    const activeRole = forumRoles.find(r => r.id === activeForumRoleId);

    // ✅ 2. 如果找不到激活角色，就报错并提示用户去创建
    if (!activeRole) {
        closeForumPostCreator(); // 先关掉发帖窗口
        return showToast('错误：找不到发帖角色！请先在“个人”页创建一个角色。');
    }

    // ✅ 3. 从激活的角色中获取名字
    const authorName = activeRole.name;
    
    const newPost = {
        id: Date.now(),
        authorName: authorName, // ✅ 核心：使用激活角色的名字
        text,
        stats: { likes: 0, comments: 0, shares: 0 },
        comments: []
    };
    
    forumData.posts.unshift(newPost);
    setStorage('forum_data', forumData);
    renderForumFeed(); // 刷新帖子列表，新帖子会由 findAuthor 函数找到正确的头像
    closeForumPostCreator();
    showToast('发布成功！');
}
function likeForumPost(postId) {
    const post = forumData.posts.find(p => p.id === postId);
    if (!post) return;

    // 1. 找到当前操作者（点赞的人）
    const activeRole = forumRoles.find(r => r.id === activeForumRoleId);
    if (!activeRole) return showToast("请先在“个人”页创建并选择一个角色！");
    const likerName = activeRole.name;

    // 2. 检查是否点赞自己的帖子
    if (post.authorName === likerName) {
        return showToast("不能给自己的帖子点赞哦！");
    }

    // 3. 初始化点赞列表（兼容旧数据）
    if (!post.likedBy) {
        post.likedBy = [];
    }

    // 4. 判断是“点赞”还是“取消点赞”
    const likeIndex = post.likedBy.indexOf(likerName);

    if (likeIndex > -1) {
        // 如果已经赞过，就取消点赞
        post.likedBy.splice(likeIndex, 1); // 从名单中移除
        post.stats.likes--;
    } else {
        // 如果没赞过，就添加点赞
        post.likedBy.push(likerName); // 加入点赞名单
        post.stats.likes++;
    }

    // 5. 保存数据并刷新界面
    setStorage('forum_data', forumData);
    renderForumFeed();
}

function addForumComment(postId, inputElement) {
    const text = inputElement.value.trim();
    if (!text) return;
    const post = forumData.posts.find(p => p.id === postId);
    if (post) {
        if (!post.comments) post.comments = [];
        post.comments.push({ authorName: userProfiles[0].name, text });
        post.stats.comments++;
        setStorage('forum_data', forumData);
        renderForumFeed();
        // 清空输入框
        inputElement.value = '';
    }
}
document.addEventListener('DOMContentLoaded', () => {
    // 1. 绑定私信页的“返回”按钮
    const dmBackBtn = document.getElementById('dm-back-btn');
    if (dmBackBtn) {
        dmBackBtn.addEventListener('click', goBackInDm);
    }

    // 2. 绑定私信页的“生成私信”按钮（信封图标）
    const dmGenerateBtn = document.getElementById('dm-generate-btn');
    if (dmGenerateBtn) {
        dmGenerateBtn.addEventListener('click', generatePrivateMessages);
    }

    // 3. 绑定聊天输入框的“发送”按钮
    const dmSendBtn = document.getElementById('dm-send-btn');
    if (dmSendBtn) {
        dmSendBtn.addEventListener('click', sendDmMessage);
    }

    // 4. 绑定聊天输入框的“AI回复”按钮
    const dmAiReplyBtn = document.getElementById('dm-ai-reply-btn');
    if (dmAiReplyBtn) {
        dmAiReplyBtn.addEventListener('click', generateDmReply);
    }

    // 5. 让输入框支持按回车键发送
    const dmInput = document.getElementById('dm-chat-input');
    if(dmInput) {
        dmInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                // 阻止回车换行，并触发发送
                event.preventDefault(); 
                sendDmMessage();
            }
        });
    }
});
// 辅助函数: 从AI返回的文本中提取第一个有效的JSON数组
function extractFirstJsonArray(text) {
    const startIndex = text.indexOf('[');
    const endIndex = text.lastIndexOf(']');
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        return null;
    }
    return text.substring(startIndex, endIndex + 1);
}

function openForumActionModal() { openDrawer('forum-action-modal'); }
function closeForumActionModal() {
    // 1. 直接通过ID找到那个加号菜单的div
    const modal = document.getElementById('forum-action-modal');

    // 2. 检查一下是否找到了这个元素，以防万一
    if (modal) {
        // 3. 移除它的 'active' 类或者直接设置 display 为 'none'
        //    这取决于您是如何让它显示出来的。
        //    通常这种弹窗是通过添加一个 'active' 类来触发CSS动画和显示的。
        //    我们先尝试移除 'active' 类。
        if (modal.classList.contains('active')) {
             modal.classList.remove('active');
        } else {
            // 如果不是用 'active' 类控制，那很可能就是用 display 属性。
            // 这是一个备用方案，更强力。
            modal.style.display = 'none';
        }
    } else {
        console.error("未能找到ID为 'forum-action-modal' 的元素！");
    }
}

function openForumGeneratorModal() { closeForumActionModal(); openDrawer('forum-generator-modal'); }
function closeForumGeneratorModal() {
    const modal = document.getElementById('forum-generator-modal');
    if (modal) {
        // 检查它是否有 active 类，有就移除
        if (modal.classList.contains('active')) {
            modal.classList.remove('active');
        } 
        // 否则，直接用 style.display 强制隐藏
        else {
            modal.style.display = 'none';
        }
    }
}


// 在您的IIFE闭包的最后，确保这个新函数也被暴露到window对象上
// (不过检查了一下您的代码，它似乎不需要暴露，因为它是在其他函数内部被调用的)
// window.extractFirstJsonArray = extractFirstJsonArray; // 如果需要全局调用，可以取消此行注释
function openDrawerWithContent(modalId, content, isDrawer = false) {
    const screen = document.querySelector('.screen');
    
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.id = modalId + '-overlay';
    overlay.className = 'modal-overlay';
    
    // 创建模态框容器
    const container = document.createElement('div');
    container.id = modalId + '-container';
    container.className = 'modal-container';
    
    // 创建模态框内容区域，并将传入的 content 放入
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'modal-content';
    contentWrapper.innerHTML = content;

    container.appendChild(contentWrapper);
    screen.appendChild(overlay);
    screen.appendChild(container);

    // 延迟一小会儿再添加 active 类，以触发CSS动画
    setTimeout(() => {
        overlay.classList.add('active');
        container.classList.add('active');
    }, 10);
}

// --- 1. 角色系统 ---

    // ===============================
    // Shopping App (黑白简约购物页)
    // ===============================
    const SHOP_STORAGE_KEY = 'shop_state_v1';

    let shopState = getStorage(SHOP_STORAGE_KEY, null);

    function initShopState() {
        if (!shopState || !Array.isArray(shopState.accounts) || shopState.accounts.length === 0) {
            const baseUser = (userProfiles && userProfiles[0]) || { id: 'me', name: '我', avatar: DEFAULT_USER_AVATAR_URL };
            const defaultAccount = {
                id: 'acc-' + (baseUser.id || Date.now()),
                name: baseUser.name || '账号1',
                avatar: baseUser.avatar || DEFAULT_USER_AVATAR_URL,
                balance: 0,
                cart: [],
                history: []
            };
            shopState = {
                currentAccountId: defaultAccount.id,
                accounts: [defaultAccount],
                products: []
            };
            saveShopState();
        }
    }

    function saveShopState() {
        setStorage(SHOP_STORAGE_KEY, shopState);
    }

    function getCurrentShopAccount() {
        initShopState();
        let acc = shopState.accounts.find(a => a.id === shopState.currentAccountId);
        if (!acc) {
            acc = shopState.accounts[0];
            shopState.currentAccountId = acc.id;
            saveShopState();
        }
        return acc;
    }

    function formatShopCurrency(amount) {
        const num = isNaN(amount) ? 0 : Number(amount);
        return '¥' + num.toFixed(2);
    }

    function getCartTotalAndCount(account) {
        const acc = account || getCurrentShopAccount();
        let total = 0;
        let count = 0;
        (acc.cart || []).forEach(item => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;
            count += qty;
            total += qty * price;
        });
        return { total, count };
    }

    function updateShopCartBadge() {
        const badge = document.getElementById('shop-cart-badge');
        if (!badge) return;
        const { count } = getCartTotalAndCount();
        if (count > 0) {
            badge.textContent = String(count);
            badge.classList.add('visible');
        } else {
            badge.textContent = '';
            badge.classList.remove('visible');
        }
    }

    function renderShopAccountsUI() {
        const selectEl = document.getElementById('shop-account-select');
        const avatarImg = document.getElementById('shop-profile-avatar');
        const usernameInput = document.getElementById('shop-profile-username');
        const balanceSpan = document.getElementById('shop-balance-amount');
        if (!selectEl || !avatarImg || !usernameInput || !balanceSpan) return;

        initShopState();
        selectEl.innerHTML = '';
        shopState.accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = acc.name || '未命名账号';
            selectEl.appendChild(opt);
        });

        selectEl.value = shopState.currentAccountId;
        const cur = getCurrentShopAccount();
        avatarImg.src = cur.avatar || DEFAULT_USER_AVATAR_URL;
        usernameInput.value = cur.name || '';
        balanceSpan.textContent = formatShopCurrency(cur.balance || 0);
    }

    function renderShopProducts() {
        const grid = document.getElementById('shop-product-grid');
        if (!grid) return;
        initShopState();

        if (!Array.isArray(shopState.products)) {
            shopState.products = [];
        }

        if (shopState.products.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/3; text-align:center; padding:30px 0; font-size:12px; color:#999;">点击右上角购物车图标，输入想要的商品和数量，生成黑白商品卡片。</div>';
            return;
        }

        const html = shopState.products.map(p => {
            const safeName = escapeHTML(p.name || '未命名商品');
            const price = formatShopCurrency(p.price || 0);
            const emoji = escapeHTML(p.icon || '⬜');
            return `
                <div class="shop-product-card" data-id="${p.id}">
                    <div class="shop-product-image">${emoji}</div>
                    <div class="shop-product-name">${safeName}</div>
                    <div class="shop-product-price">${price}</div>
                    <button class="shop-product-add-btn" data-id="${p.id}" type="button">+</button>
                </div>
            `;
        }).join('');

        grid.innerHTML = html;

        grid.querySelectorAll('.shop-product-add-btn').forEach(btn => {
            btn.onclick = function() {
                const id = this.getAttribute('data-id');
                handleShopAddToCart(id);
            };
        });
    }

    function renderShopCart() {
        const listEl = document.getElementById('shop-cart-list');
        const emptyEl = document.getElementById('shop-cart-empty');
        const totalEl = document.getElementById('shop-cart-total-price');
        const resultEl = document.getElementById('shop-cart-result');
        if (!listEl || !emptyEl || !totalEl) return;

        const acc = getCurrentShopAccount();
        const cart = acc.cart || [];

        if (!cart.length) {
            listEl.innerHTML = '';
            emptyEl.style.display = 'block';
        } else {
            emptyEl.style.display = 'none';
            listEl.innerHTML = cart.map(item => {
                const safeName = escapeHTML(item.name || '商品');
                const qty = Number(item.quantity) || 0;
                const price = Number(item.price) || 0;
                const sub = price * qty;
                return `
                    <div class="shop-cart-item" data-id="${item.productId}">
                        <div class="shop-cart-thumb">⬜</div>
                        <div class="shop-cart-info">
                            <div class="shop-cart-name">${safeName}</div>
                            <div class="shop-cart-meta">
                                <span>${formatShopCurrency(price)} × ${qty}</span>
                                <span>${formatShopCurrency(sub)}</span>
                            </div>
                        </div>
                        <button class="shop-cart-remove-btn" type="button" data-id="${item.productId}">取消</button>
                    </div>
                `;
            }).join('');

            listEl.querySelectorAll('.shop-cart-remove-btn').forEach(btn => {
                btn.onclick = function() {
                    const id = this.getAttribute('data-id');
                    handleShopRemoveFromCart(id);
                };
            });
        }

        const { total } = getCartTotalAndCount(acc);
        totalEl.textContent = formatShopCurrency(total);
        if (resultEl) resultEl.textContent = '';
        updateShopCartBadge();
    }

    function renderShopHistory() {
        const emptyEl = document.getElementById('shop-history-empty');
        const listEl = document.getElementById('shop-history-list');
        if (!emptyEl || !listEl) return;

        const acc = getCurrentShopAccount();
        const history = acc.history || [];
        if (!history.length) {
            emptyEl.style.display = 'block';
            listEl.innerHTML = '';
            return;
        }

        emptyEl.style.display = 'none';
        listEl.innerHTML = history.map(order => {
            const time = escapeHTML(order.time || '');
            const total = formatShopCurrency(order.total || 0);
            const names = (order.items || []).map(it => `${escapeHTML(it.name || '商品')}×${it.quantity}`).join('，');
            return `
                <div class="shop-history-item">
                    <div class="shop-history-meta">
                        <span>${time}</span>
                        <span>${total}</span>
                    </div>
                    <div style="margin-top:4px;">${names}</div>
                </div>
            `;
        }).join('');
    }

    function switchShopTab(tab) {
        const homeTab = document.getElementById('shop-tab-home');
        const cartTab = document.getElementById('shop-tab-cart');
        const profileTab = document.getElementById('shop-tab-profile');
        const items = document.querySelectorAll('.shop-bottom-nav-item');

        if (!homeTab || !cartTab || !profileTab || !items.length) return;

        homeTab.classList.remove('active');
        cartTab.classList.remove('active');
        profileTab.classList.remove('active');

        items.forEach(it => {
            const t = it.getAttribute('data-tab');
            it.classList.toggle('active', t === tab);
        });

        if (tab === 'home') {
            homeTab.classList.add('active');
        } else if (tab === 'cart') {
            cartTab.classList.add('active');
            renderShopCart();
        } else if (tab === 'profile') {
            profileTab.classList.add('active');
            renderShopAccountsUI();
            renderShopHistory();
        }
    }

    function openShopAddProductModal() {
        // 只有在 API 配置完成后才允许打开添加商品弹窗
        if (!config || !config.key || !config.url) {
            showToast('无法生成商品：请先在 设置 页连接 API');
            return;
        }

        const overlay = document.getElementById('shop-add-product-modal');
        const nameInput = document.getElementById('shop-modal-name');
        const countInput = document.getElementById('shop-modal-count');
        if (!overlay || !nameInput || !countInput) return;
        nameInput.value = '';
        countInput.value = '4';
        overlay.classList.add('active');
    }

    function closeShopAddProductModal() {
        const overlay = document.getElementById('shop-add-product-modal');
        if (!overlay) return;
        overlay.classList.remove('active');
    }

    function handleShopModalConfirm() {
        // 二次校验，防止在未连接 API 的情况下通过其他方式触发确认逻辑
        if (!config || !config.key || !config.url) {
            showToast('无法生成商品：请先在 设置 页连接 API');
            closeShopAddProductModal();
            return;
        }

        const nameInput = document.getElementById('shop-modal-name');
        const countInput = document.getElementById('shop-modal-count');
        if (!nameInput || !countInput) return;

        const name = (nameInput.value || '').trim();
        const count = Math.max(1, Math.min(20, parseInt(countInput.value || '1', 10)));
        if (!name) {
            showToast('请输入商品名称');
            return;
        }

        // 这里预留 API 调用位置，当前先本地模拟生成黑白商品
        const icons = ['⬜', '🖤', '📷', '🎁', '🧸'];
        initShopState();
        if (!Array.isArray(shopState.products)) shopState.products = [];

        for (let i = 0; i < count; i++) {
            const id = 'p-' + Date.now() + '-' + i + '-' + Math.floor(Math.random() * 1000);
            const priceRaw = 9.9 + Math.random() * 90;
            const price = Math.round(priceRaw * 100) / 100;
            const icon = icons[Math.floor(Math.random() * icons.length)];
            shopState.products.push({ id, name, price, icon });
        }
        saveShopState();
        renderShopProducts();
        closeShopAddProductModal();
        showToast('已生成黑白商品卡片');
    }

    function handleShopAddToCart(productId) {
        initShopState();
        const acc = getCurrentShopAccount();
        const products = shopState.products || [];
        const product = products.find(p => p.id === productId);
        if (!product) return;

        if (!Array.isArray(acc.cart)) acc.cart = [];
        const existing = acc.cart.find(it => it.productId === productId);
        if (existing) {
            existing.quantity = (Number(existing.quantity) || 0) + 1;
        } else {
            acc.cart.push({
                productId,
                name: product.name,
                price: product.price,
                quantity: 1
            });
        }
        saveShopState();
        renderShopCart();
    }

    function handleShopRemoveFromCart(productId) {
        const acc = getCurrentShopAccount();
        if (!Array.isArray(acc.cart)) return;
        acc.cart = acc.cart.filter(it => it.productId !== productId);
        saveShopState();
        renderShopCart();
    }

    function handleShopSettle() {
        const acc = getCurrentShopAccount();
        const { total, count } = getCartTotalAndCount(acc);
        const resultEl = document.getElementById('shop-cart-result');
        if (!count) {
            if (resultEl) resultEl.textContent = '购物车为空，无法结算。';
            showToast('购物车为空');
            return;
        }

        if ((acc.balance || 0) < total) {
            if (resultEl) resultEl.textContent = '余额不足，结算失败。请前往个人中心充值。';
            showToast('余额不足，结算失败');
            return;
        }

        acc.balance = (Number(acc.balance) || 0) - total;
        if (!Array.isArray(acc.history)) acc.history = [];

        acc.history.unshift({
            time: new Date().toLocaleString('zh-CN', { hour12: false }),
            total,
            items: (acc.cart || []).map(it => ({ name: it.name, quantity: it.quantity, price: it.price }))
        });

        acc.cart = [];
        saveShopState();
        renderShopCart();
        renderShopAccountsUI();
        renderShopHistory();
        if (resultEl) resultEl.textContent = '结算成功，已从余额中扣除相应金额。';
        showToast('结算成功');
    }

    function handleShopRecharge() {
        const input = document.getElementById('shop-recharge-input');
        if (!input) return;
        const value = parseFloat(input.value || '0');
        if (!(value > 0)) {
            showToast('请输入正确的充值金额');
            return;
        }
        const acc = getCurrentShopAccount();
        acc.balance = (Number(acc.balance) || 0) + value;
        saveShopState();
        input.value = '';
        renderShopAccountsUI();
        showToast('充值成功');
    }

    function handleShopAvatarClick() {
        const input = document.getElementById('shop-avatar-input');
        if (!input) return;
        input.click();
    }

    function handleShopAvatarFileChange(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const acc = getCurrentShopAccount();
            acc.avatar = ev.target.result;
            saveShopState();
            renderShopAccountsUI();
        };
        reader.readAsDataURL(file);
    }

    function handleShopSaveProfile() {
        const input = document.getElementById('shop-profile-username');
        if (!input) return;
        const name = (input.value || '').trim();
        const acc = getCurrentShopAccount();
        acc.name = name || acc.name || '未命名账号';
        saveShopState();
        renderShopAccountsUI();
        showToast('资料已保存');
    }

    function handleShopAccountChange(e) {
        const id = e.target.value;
        if (!id) return;
        initShopState();
        if (!shopState.accounts.find(a => a.id === id)) return;
        shopState.currentAccountId = id;
        saveShopState();
        renderShopAccountsUI();
        renderShopCart();
        renderShopHistory();
    }

    function handleShopAddAccount() {
        initShopState();
        const newId = 'acc-' + Date.now();
        const index = shopState.accounts.length + 1;
        const acc = {
            id: newId,
            name: '账号' + index,
            avatar: DEFAULT_USER_AVATAR_URL,
            balance: 0,
            cart: [],
            history: []
        };
        shopState.accounts.push(acc);
        shopState.currentAccountId = newId;
        saveShopState();
        renderShopAccountsUI();
        renderShopCart();
        renderShopHistory();
        showToast('已创建新账号');
    }

    // 烹饪 Cooking 模块
    const COOKING_CATEGORY_CONFIG = {
        main: {
            key: 'main',
            label: '主食',
            tagline: '一起做一顿温柔的家常饭',
            ingredientGroups: [
                { name: '肉类', items: ['猪肉', '牛肉', '鸡肉', '鱼肉', '虾仁'] },
                { name: '主食', items: ['米饭', '面条', '馒头', '饺子皮'] },
                { name: '配菜', items: ['土豆', '胡萝卜', '洋葱', '西兰花', '青椒'] },
                { name: '调料', items: ['盐', '酱油', '糖', '辣椒', '葱姜蒜'] }
            ]
        },
        bake: {
            key: 'bake',
            label: '烘焙',
            tagline: '把黄油和糖搅拌成一整个下午茶',
            ingredientGroups: [
                { name: '基础', items: ['低筋面粉', '高筋面粉', '黄油', '鸡蛋'] },
                { name: '甜味', items: ['白砂糖', '红糖', '蜂蜜', '枫糖浆'] },
                { name: '风味', items: ['可可粉', '抹茶粉', '香草精'] },
                { name: '装饰', items: ['草莓', '蓝莓', '奶油', '糖珠'] }
            ]
        },
        light: {
            key: 'light',
            label: '轻食',
            tagline: '像薯条一样轻松，像沙拉一样不紧张',
            ingredientGroups: [
                { name: '主角', items: ['鸡胸肉', '牛肉饼', '虾仁', '豆腐'] },
                { name: '主食', items: ['汉堡胚', '吐司片', '玉米饼', '薯条'] },
                { name: '蔬菜', items: ['生菜', '番茄', '黄瓜', '紫甘蓝'] },
                { name: '酱料', items: ['番茄酱', '沙拉酱', '芥末酱', '辣酱'] }
            ]
        },
        western: {
            key: 'western',
            label: '西餐',
            tagline: '在小小的盘子里排一桌正式的晚餐',
            ingredientGroups: [
                { name: '蛋白', items: ['牛排', '羊排', '法式鹅肝', '三文鱼'] },
                { name: '主食', items: ['意面', '土豆泥', '法棍'] },
                { name: '配菜', items: ['芦笋', '蘑菇', '樱桃番茄'] },
                { name: '调味', items: ['黑胡椒', '黄油', '红酒', '海盐'] }
            ]
        }
    };

    const COOKING_MOOD_TAGS = ['解压', '犒劳自己', '想念某人', '试验新口味', '只是想被夸', '深夜小小慰藉'];

    function getCookingPageElements() {
        const page = document.getElementById('cooking-page');
        if (!page) return null;
        return {
            page,
            layout: page.querySelector('.cooking-layout'),
            scroll: page.querySelector('#cooking-scroll'),
            categoryLabel: page.querySelector('#cooking-category-label'),
            ingredientsSummary: page.querySelector('#cooking-ingredients-summary'),
            ingredientsGroups: page.querySelector('#cooking-ingredients-groups'),
            stepsList: page.querySelector('#cooking-steps-list'),
            addStepBtn: page.querySelector('#cooking-add-step-btn'),
            stepsResetBtn: page.querySelector('#cooking-steps-reset-btn'),
            clearIngredientsBtn: page.querySelector('#cooking-ingredients-clear-btn'),
            moodTagsWrapper: page.querySelector('#cooking-mood-tags'),
            dishNameInput: page.querySelector('#cooking-dish-name'),
            aiTasteBtn: page.querySelector('#cooking-ai-taste-btn'),
            aiResultBlock: page.querySelector('#cooking-ai-result'),
            aiResultText: page.querySelector('#cooking-ai-result-text'),
            shareQqBtn: page.querySelector('#cooking-share-qq-btn'),
            worksBtn: document.getElementById('cooking-works-btn'),
            tabBar: page.querySelector('#cooking-tab-bar')
        };
    }

    function renderCookingIngredients(categoryKey) {
        const cfg = COOKING_CATEGORY_CONFIG[categoryKey] || COOKING_CATEGORY_CONFIG.main;
        const els = getCookingPageElements();
        if (!els || !els.ingredientsGroups || !els.categoryLabel) return;

        els.ingredientsGroups.innerHTML = '';
        cfg.ingredientGroups.forEach(group => {
            const groupEl = document.createElement('div');
            groupEl.className = 'cooking-ingredients-group';
            const titleEl = document.createElement('div');
            titleEl.className = 'cooking-ingredients-group-title';
            titleEl.textContent = group.name;
            const listEl = document.createElement('div');
            listEl.className = 'cooking-ingredients-tags';

            group.items.forEach(name => {
                const tag = document.createElement('button');
                tag.type = 'button';
                tag.className = 'cooking-ingredient-tag';
                tag.textContent = name;
                tag.dataset.name = name;
                tag.addEventListener('click', () => {
                    tag.classList.toggle('selected');
                    updateCookingIngredientsSummary();
                });
                listEl.appendChild(tag);
            });

            groupEl.appendChild(titleEl);
            groupEl.appendChild(listEl);
            els.ingredientsGroups.appendChild(groupEl);
        });

        els.categoryLabel.textContent = cfg.label + ' · ' + cfg.tagline;
        updateCookingIngredientsSummary();
    }

    function updateCookingIngredientsSummary() {
        const els = getCookingPageElements();
        if (!els || !els.ingredientsSummary) return;
        const selected = Array.from(document.querySelectorAll('.cooking-ingredient-tag.selected'));
        if (!selected.length) {
            els.ingredientsSummary.textContent = '当前还没有选原料，可以先从“肉类、主食、配菜、调料”里随便抓一点。';
            return;
        }
        const names = selected.map(tag => tag.dataset.name || tag.textContent.trim()).slice(0, 6);
        const more = selected.length > names.length ? ' 等' + selected.length + '种' : '';
        els.ingredientsSummary.textContent = '当前选了：' + names.join('、') + more + '。';
    }

    function renderCookingDefaultSteps(categoryKey) {
        const els = getCookingPageElements();
        if (!els || !els.stepsList) return;
        const cfg = COOKING_CATEGORY_CONFIG[categoryKey] || COOKING_CATEGORY_CONFIG.main;
        els.stepsList.innerHTML = '';

        const presetsByCat = {
            main: [
                '小火热锅，加一点点油，把葱姜先放进去慢慢爆香。',
                '把主角食材下锅，翻炒到颜色变得温柔一点。',
                '加水或汤，调好味道，让它小火慢慢炖到软软糯糯。'
            ],
            bake: [
                '先把烤箱预热好，让它慢慢变成一个很温暖的小房间。',
                '黄油和糖先搅拌到颜色变浅，再一点点加入鸡蛋和面粉。',
                '倒入模具，轻轻震几下，送进烤箱，整个房间会开始变甜。'
            ],
            light: [
                '简单腌一下主角食材，让它提前知道今天会被好好对待。',
                '平底锅里放一点油，把食材煎到两面金黄。',
                '加上蔬菜和酱料，随手组装成汉堡、卷饼或者丰盛的沙拉碗。'
            ],
            western: [
                '先把牛排或主角食材从冰箱里提前拿出来，回一点温。',
                '热锅热油，两面煎到你喜欢的熟度，锅里同时煎一点蒜瓣和黄油。',
                '简单摆盘，再淋上一点酱汁，让这一盘看起来足够正式。'
            ]
        };

        const presets = presetsByCat[cfg.key] || presetsByCat.main;
        presets.forEach((text, index) => {
            els.stepsList.appendChild(createCookingStepCard(index + 1, text));
        });
    }

    function createCookingStepCard(order, presetText) {
        const wrapper = document.createElement('div');
        wrapper.className = 'cooking-step-card';
        const header = document.createElement('div');
        header.className = 'cooking-step-header';
        header.textContent = '步骤 ' + order;

        const textarea = document.createElement('textarea');
        textarea.className = 'cooking-step-text';
        textarea.rows = 3;
        textarea.placeholder = '例如：中火 3 分钟，先爆香再下肉，再慢慢翻炒到香味出来。';
        if (presetText) textarea.value = presetText;

        wrapper.appendChild(header);
        wrapper.appendChild(textarea);
        return wrapper;
    }

    function renderCookingMoodTags() {
        const els = getCookingPageElements();
        if (!els || !els.moodTagsWrapper) return;
        els.moodTagsWrapper.innerHTML = '';
        COOKING_MOOD_TAGS.forEach(tag => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'cooking-mood-tag';
            btn.textContent = tag;
            btn.dataset.mood = tag;
            btn.addEventListener('click', () => {
                btn.classList.toggle('selected');
            });
            els.moodTagsWrapper.appendChild(btn);
        });
    }

    function collectCookingSession() {
        const els = getCookingPageElements();
        if (!els) return null;

        const activeTab = els.tabBar ? els.tabBar.querySelector('.cooking-tab.active') : null;
        const categoryKey = activeTab ? activeTab.getAttribute('data-category') : 'main';
        const cfg = COOKING_CATEGORY_CONFIG[categoryKey] || COOKING_CATEGORY_CONFIG.main;

        const ingredientTags = Array.from(document.querySelectorAll('.cooking-ingredient-tag.selected'));
        const ingredients = ingredientTags.map(tag => tag.dataset.name || tag.textContent.trim());

        const stepTextareas = els.stepsList ? Array.from(els.stepsList.querySelectorAll('.cooking-step-text')) : [];
        const steps = stepTextareas
            .map(t => (t.value || '').trim())
            .filter(Boolean);

        const moodTags = els.moodTagsWrapper
            ? Array.from(els.moodTagsWrapper.querySelectorAll('.cooking-mood-tag.selected'))
            : [];
        const moods = moodTags.map(btn => btn.dataset.mood || btn.textContent.trim());

        const dishName = (els.dishNameInput && els.dishNameInput.value || '').trim();

        return {
            categoryKey: cfg.key,
            categoryLabel: cfg.label,
            tagline: cfg.tagline,
            ingredients,
            steps,
            moods,
            dishName
        };
    }

    function buildLocalCookingAiText(session) {
        if (!session) return '';
        const name = session.dishName || (session.categoryLabel + '里的某道小菜');
        const ing = session.ingredients && session.ingredients.length
            ? session.ingredients.slice(0, 6).join('、')
            : '一些你临时抓来的小材料';
        const mood = session.moods && session.moods.length
            ? session.moods.join('、')
            : '说不清的心情';
        const hasSteps = session.steps && session.steps.length;

        const intro = `我先把这道「${name}」想象摆在桌子上。单看食材：${ing}，就已经很像是为「${mood}」准备的一顿饭了。`;

        let processPart = '';
        if (hasSteps) {
            const first = session.steps[0];
            const middle = session.steps[Math.floor(session.steps.length / 2)] || first;
            const last = session.steps[session.steps.length - 1] || first;
            processPart = `\n\n在你的描述里，开头是这样开始的：\n「${first}」\n中途则慢慢发展成：\n「${middle}」\n直到最后，用「${last}」收了一个尾，让整道菜像一段完整的小故事。`;
        } else {
            processPart = '\n\n虽然你没有写下具体步骤，但我能感觉到，你在脑子里已经排练过好几遍了。';
        }

        const taste = `\n\n如果真的能尝一口，我会先舀一小勺，只是很认真地在舌尖停一下——大概会是那种「不一定完美，但非常是你自己」的味道。`;

        const encourage = `\n\n下次如果还想做一点不一样的，可以多给某一步一点耐心，或者干脆把某个小失误也写进步骤里，我会记住那是你独一无二的手法。`;

        return intro + processPart + taste + encourage;
    }

    function initCookingPage() {
        const els = getCookingPageElements();
        if (!els || !els.page) return;
        if (els.page.dataset.initialized === '1') return;
        els.page.dataset.initialized = '1';

        // 默认主食
        renderCookingIngredients('main');
        renderCookingDefaultSteps('main');
        renderCookingMoodTags();

        if (els.clearIngredientsBtn) {
            els.clearIngredientsBtn.addEventListener('click', () => {
                document.querySelectorAll('.cooking-ingredient-tag.selected').forEach(tag => {
                    tag.classList.remove('selected');
                });
                updateCookingIngredientsSummary();
            });
        }

        if (els.stepsResetBtn) {
            els.stepsResetBtn.addEventListener('click', () => {
                const activeTab = els.tabBar ? els.tabBar.querySelector('.cooking-tab.active') : null;
                const categoryKey = activeTab ? activeTab.getAttribute('data-category') : 'main';
                renderCookingDefaultSteps(categoryKey || 'main');
            });
        }

        if (els.addStepBtn && els.stepsList) {
            els.addStepBtn.addEventListener('click', () => {
                const count = els.stepsList.querySelectorAll('.cooking-step-card').length;
                els.stepsList.appendChild(createCookingStepCard(count + 1, ''));
                if (els.scroll) {
                    setTimeout(() => {
                        els.scroll.scrollTo({ top: els.scroll.scrollHeight, behavior: 'smooth' });
                    }, 50);
                }
            });
        }

        if (els.tabBar) {
            Array.from(els.tabBar.querySelectorAll('.cooking-tab')).forEach(tab => {
                tab.addEventListener('click', () => {
                    const categoryKey = tab.getAttribute('data-category') || 'main';
                    Array.from(els.tabBar.querySelectorAll('.cooking-tab')).forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    renderCookingIngredients(categoryKey);
                    renderCookingDefaultSteps(categoryKey);
                    if (els.aiResultBlock) {
                        els.aiResultBlock.hidden = true;
                    }
                });
            });
        }

        if (els.aiTasteBtn && els.aiResultBlock && els.aiResultText) {
            els.aiTasteBtn.addEventListener('click', () => {
                const session = collectCookingSession();
                if (!session) return;
                if (!session.dishName) {
                    showToast('先给这道菜取一个小名字吧');
                    if (els.dishNameInput) els.dishNameInput.focus();
                    return;
                }
                if (!session.ingredients.length) {
                    showToast('至少抓几样原料，让我知道这道菜的大概方向');
                    return;
                }
                const text = buildLocalCookingAiText(session);
                els.aiResultText.textContent = text;
                els.aiResultBlock.hidden = false;

                try {
                    const storageKey = 'cooking_sessions_v1';
                    const raw = localStorage.getItem(storageKey);
                    const list = raw ? JSON.parse(raw) : [];
                    list.unshift({
                        createdAt: Date.now(),
                        session
                    });
                    while (list.length > 20) list.pop();
                    localStorage.setItem(storageKey, JSON.stringify(list));
                } catch (e) {
                    console.warn('保存烹饪作品失败', e);
                }
            });
        }

        if (els.shareQqBtn) {
            els.shareQqBtn.addEventListener('click', () => {
                const session = collectCookingSession();
                if (!session || !session.dishName) {
                    showToast('先完成这道菜并请 AI 尝一口，再考虑分享给 QQ 里的它。');
                    return;
                }
                showToast('已为「' + session.dishName + '」准备了一张分享卡片，后续版本会和 QQ 聊天打通。');
            });
        }

        if (els.worksBtn) {
            els.worksBtn.addEventListener('click', () => {
                showToast('作品陈列架正在搭建中，先把菜谱好好写在这里。');
            });
        }
    }

    initCookingPage();

    // 书城 Bookstore 模块
    const BOOKSTORE_BOOKS_KEY = 'bookstore_books_v1';
    const BOOKSTORE_STATS_KEY = 'bookstore_stats_v1';
    const BOOKSTORE_META_KEY = 'bookstore_meta_v1';
    const BOOK_CREATOR_PROJECT_KEY = 'book_creator_projects_v1';

    let bookstoreBooks = getStorage(BOOKSTORE_BOOKS_KEY, []);
    let bookstoreStats = getStorage(BOOKSTORE_STATS_KEY, { byDate: {} });
    let bookstoreMeta = getStorage(BOOKSTORE_META_KEY, { totalReadSeconds: 0 });
    let bookCreatorProjects = getStorage(BOOK_CREATOR_PROJECT_KEY, []);

    const bookstoreState = {
        currentView: 'shelf',
        currentBookId: null,
        currentPageIndex: 0,
        currentSessionStart: null,
        currentBookPages: [],
        creatorMode: 'reader',
        currentProjectId: null,
        currentChapterId: null,
        creatorStatus: 'idle'
    };

    function switchBookstoreView(view) {
        bookstoreState.currentView = view;

        const shelfView = document.getElementById('bookstore-shelf-view');
        const readerView = document.getElementById('bookstore-reader-view');
        const profileView = document.getElementById('bookstore-profile-view');

        [shelfView, readerView, profileView].forEach(v => {
            if (!v) return;
            v.classList.remove('active');
        });

        if (view === 'shelf' && shelfView) shelfView.classList.add('active');
        if (view === 'reader' && readerView) readerView.classList.add('active');
        if (view === 'profile' && profileView) profileView.classList.add('active');

        const tabShelf = document.getElementById('bookstore-tab-shelf');
        const tabProfile = document.getElementById('bookstore-tab-profile');

        [tabShelf, tabProfile].forEach(t => t && t.classList.remove('active'));

        if (view === 'shelf' && tabShelf) tabShelf.classList.add('active');
        if (view === 'profile' && tabProfile) tabProfile.classList.add('active');

        const titleEl = document.getElementById('bookstore-title');
        if (titleEl) {
            if (view === 'shelf') titleEl.textContent = '书城';
            else if (view === 'reader') titleEl.textContent = '阅读';
            else if (view === 'profile') titleEl.textContent = '我的阅读';
        }
    }

    function renderBookShelf() {
        const listEl = document.getElementById('book-shelf-list');
        const emptyEl = document.getElementById('book-shelf-empty');
        if (!listEl || !emptyEl) return;

        if (!Array.isArray(bookstoreBooks) || bookstoreBooks.length === 0) {
            emptyEl.style.display = 'block';
            listEl.innerHTML = '';
            return;
        }

        emptyEl.style.display = 'none';
        listEl.innerHTML = '';

        bookstoreBooks.forEach(book => {
            const card = document.createElement('div');
            card.className = 'book-card';
            card.dataset.bookId = book.id;

            const progress = book.progress || { percent: 0 };
            const latest = book.latestReadAt ? new Date(book.latestReadAt) : null;
            const progressPercent = Math.round(progress.percent || 0);

            card.innerHTML = `
                <div class="book-card-title-row">
                    <div class="book-card-title">${escapeHTML(book.title || '未命名电子书')}</div>
                    <div class="book-card-tag">${book.fileType === 'pdf' ? 'PDF' : 'TXT'}</div>
                </div>
                <div class="book-card-meta">
                    <span>${progressPercent}% 已读</span>
                    <span>${latest ? latest.toLocaleDateString() : '尚未阅读'}</span>
                </div>
                <div class="book-card-progress-bar">
                    <div class="book-card-progress-inner" style="width:${progressPercent}%;"></div>
                </div>
            `;

            card.addEventListener('click', () => {
                openBookReader(book.id);
            });

            listEl.appendChild(card);
        });
    }

    function openBookReader(bookId) {
        const book = (bookstoreBooks || []).find(b => b.id === bookId);
        if (!book) {
            showToast('未找到书本记录');
            return;
        }
        bookstoreState.currentBookId = bookId;
        bookstoreState.currentPageIndex = (book.progress && typeof book.progress.currentPage === 'number')
            ? book.progress.currentPage
            : 0;

        const titleEl = document.getElementById('book-reader-title');
        const progressEl = document.getElementById('book-reader-progress');
        const contentEl = document.getElementById('book-reader-content');
        const indicatorEl = document.getElementById('book-page-indicator');

        if (titleEl) titleEl.textContent = book.title || '未命名电子书';
        if (progressEl) {
            const percent = Math.round((book.progress && book.progress.percent) || 0);
            progressEl.textContent = `已读 ${percent}%`;
        }
        if (contentEl) {
            contentEl.textContent = '阅读正文与分页功能开发中，当前为占位内容。';
        }
        if (indicatorEl) {
            const currentPage = (book.progress && book.progress.currentPage + 1) || 1;
            const totalPages = (book.progress && book.progress.totalPages) || 1;
            indicatorEl.textContent = `第 ${currentPage} / ${totalPages} 页`;
        }

        switchBookstoreView('reader');
    }

    function closeBookReaderToShelf() {
        // 后续会在这里增加阅读时长结算逻辑
        switchBookstoreView('shelf');
    }

    function openBookImportModal() {
        const modal = document.getElementById('book-import-modal');
        if (modal) modal.classList.add('active');
    }

    function closeBookImportModal() {
        const modal = document.getElementById('book-import-modal');
        if (modal) modal.classList.remove('active');
    }

    function openBookCompanionModal() {
        const modal = document.getElementById('book-companion-modal');
        if (modal) modal.classList.add('active');
    }

    function closeBookCompanionModal() {
        const modal = document.getElementById('book-companion-modal');
        if (modal) modal.classList.remove('active');
    }

    function initBookstore() {
        const page = document.getElementById('bookstore-page');
        if (!page) return;

        const tabShelf = document.getElementById('bookstore-tab-shelf');
        const tabProfile = document.getElementById('bookstore-tab-profile');
        const importBtn = document.getElementById('bookstore-import-btn');
        const backBtn = document.getElementById('book-reader-back-btn');
        const importCancelBtn = document.getElementById('book-import-cancel-btn');
        const companionCancelBtn = document.getElementById('book-companion-cancel-btn');

        if (tabShelf) {
            tabShelf.addEventListener('click', () => switchBookstoreView('shelf'));
        }
        if (tabProfile) {
            tabProfile.addEventListener('click', () => switchBookstoreView('profile'));
        }
        if (importBtn) {
            importBtn.addEventListener('click', openBookImportModal);
        }
        if (backBtn) {
            backBtn.addEventListener('click', closeBookReaderToShelf);
        }
        if (importCancelBtn) {
            importCancelBtn.addEventListener('click', closeBookImportModal);
        }
        if (companionCancelBtn) {
            companionCancelBtn.addEventListener('click', closeBookCompanionModal);
        }

        renderBookShelf();
        switchBookstoreView('shelf');
    }

    function initShopPage() {
        const page = document.getElementById('shop-page');
        if (!page) return;

        initShopState();

        const topCartBtn = document.getElementById('shop-top-cart-btn');
        const modalCancelBtn = document.getElementById('shop-modal-cancel-btn');
        const modalConfirmBtn = document.getElementById('shop-modal-confirm-btn');
        const settleBtn = document.getElementById('shop-settle-btn');
        const rechargeBtn = document.getElementById('shop-recharge-btn');
        const avatarWrapper = document.querySelector('.shop-avatar-wrapper');
        const avatarInput = document.getElementById('shop-avatar-input');
        const saveProfileBtn = document.getElementById('shop-save-profile-btn');
        const accountSelect = document.getElementById('shop-account-select');
        const addAccountBtn = document.getElementById('shop-add-account-btn');
        const bottomNavItems = document.querySelectorAll('.shop-bottom-nav-item');

        if (topCartBtn) topCartBtn.onclick = openShopAddProductModal;
        if (modalCancelBtn) modalCancelBtn.onclick = closeShopAddProductModal;
        if (modalConfirmBtn) modalConfirmBtn.onclick = handleShopModalConfirm;
        if (settleBtn) settleBtn.onclick = handleShopSettle;
        if (rechargeBtn) rechargeBtn.onclick = handleShopRecharge;
        if (avatarWrapper) avatarWrapper.onclick = handleShopAvatarClick;
        if (avatarInput) avatarInput.onchange = handleShopAvatarFileChange;
        if (saveProfileBtn) saveProfileBtn.onclick = handleShopSaveProfile;
        if (accountSelect) accountSelect.onchange = handleShopAccountChange;
        if (addAccountBtn) addAccountBtn.onclick = handleShopAddAccount;

        if (bottomNavItems && bottomNavItems.length) {
            bottomNavItems.forEach(item => {
                item.onclick = function() {
                    const tab = this.getAttribute('data-tab');
                    switchShopTab(tab || 'home');
                };
            });
        }

        renderShopAccountsUI();
        renderShopProducts();
        renderShopCart();
        renderShopHistory();
        switchShopTab('home');
    }

    // 书城文本分页（简单按字符数分页，后面可以按段落优化）
    function paginateBookText(raw, pageSize = 1200) {
        if (typeof raw !== 'string') return [''];
        const text = raw.replace(/\r\n/g, '\n');
        const pages = [];
        let i = 0;
        while (i < text.length) {
            pages.push(text.slice(i, i + pageSize));
            i += pageSize;
        }
        return pages.length ? pages : [''];
    }

    // 覆盖书架渲染：使用最新 bookstoreBooks
    function renderBookShelf() {
        const listEl = document.getElementById('book-shelf-list');
        const emptyEl = document.getElementById('book-shelf-empty');
        if (!listEl || !emptyEl) return;

        if (!Array.isArray(bookstoreBooks) || bookstoreBooks.length === 0) {
            emptyEl.style.display = 'block';
            listEl.innerHTML = '';
            return;
        }

        emptyEl.style.display = 'none';
        listEl.innerHTML = '';

        bookstoreBooks.forEach(book => {
            const card = document.createElement('div');
            card.className = 'book-card';
            card.dataset.bookId = book.id;

            const progress = book.progress || { percent: 0, currentPage: 0, totalPages: 1 };
            const latest = book.latestReadAt ? new Date(book.latestReadAt) : null;
            const progressPercent = Math.round(progress.percent || 0);

            card.innerHTML = `
                <div class="book-card-title-row">
                    <div class="book-card-title">${escapeHTML(book.title || '未命名电子书')}</div>
                    <div class="book-card-tag">${book.fileType === 'pdf' ? 'PDF' : 'TXT'}</div>
                </div>
                <div class="book-card-meta">
                    <span>${progressPercent}% 已读</span>
                    <span>${latest ? latest.toLocaleDateString() : '尚未阅读'}</span>
                </div>
                <div class="book-card-progress-bar">
                    <div class="book-card-progress-inner" style="width:${progressPercent}%;"></div>
                </div>
            `;

            card.addEventListener('click', () => {
                openBookReader(book.id);
            });

            listEl.appendChild(card);
        });
    }

    function saveBookstoreBooks() {
        setStorage(BOOKSTORE_BOOKS_KEY, bookstoreBooks || []);
    }

    // ===== 书城 · 创作区数据与工具 =====
    function saveBookCreatorProjects() {
        setStorage(BOOK_CREATOR_PROJECT_KEY, bookCreatorProjects || []);
    }

    function ensureCreatorMeta() {
        if (!bookstoreMeta || typeof bookstoreMeta !== 'object') {
            bookstoreMeta = { totalReadSeconds: 0 };
        }
        if (typeof bookstoreMeta.creatorTotalSeconds !== 'number') {
            bookstoreMeta.creatorTotalSeconds = 0;
        }
        if (!bookstoreMeta.creatorByDate || typeof bookstoreMeta.creatorByDate !== 'object') {
            bookstoreMeta.creatorByDate = {};
        }
    }

    function saveBookstoreMeta() {
        setStorage(BOOKSTORE_META_KEY, bookstoreMeta || { totalReadSeconds: 0 });
    }

    function addCreatorTime(seconds) {
        ensureCreatorMeta();
        const sec = Math.max(0, Number(seconds) || 0);
        if (!sec) return;
        const now = new Date();
        const key = now.toISOString().slice(0, 10);
        bookstoreMeta.creatorTotalSeconds += sec;
        if (!bookstoreMeta.creatorByDate[key]) {
            bookstoreMeta.creatorByDate[key] = 0;
        }
        bookstoreMeta.creatorByDate[key] += sec;
        saveBookstoreMeta();
        updateCreatorStatsUI();
    }

    function getCreatorLevelFromSeconds(totalSeconds) {
        const minutes = Math.floor((Number(totalSeconds) || 0) / 60);
        if (minutes >= 600) return 5; // 10 小时以上
        if (minutes >= 240) return 4; // 4~10 小时
        if (minutes >= 120) return 3; // 2~4 小时
        if (minutes >= 30) return 2;  // 0.5~2 小时
        return 1;
    }

    function formatMinutesFromSeconds(totalSeconds) {
        const minutes = Math.floor((Number(totalSeconds) || 0) / 60);
        return minutes + ' 分钟';
    }

    function getTodayCreatorSeconds() {
        ensureCreatorMeta();
        const key = new Date().toISOString().slice(0, 10);
        return bookstoreMeta.creatorByDate[key] || 0;
    }

    function updateCreatorStatsUI() {
        const modeLabel = document.getElementById('book-creator-mode-label');
        const levelLabel = document.getElementById('book-creator-level-label');
        const timeLabel = document.getElementById('book-creator-time');

        ensureCreatorMeta();
        const totalSec = bookstoreMeta.creatorTotalSeconds || 0;
        const todaySec = getTodayCreatorSeconds();
        const level = getCreatorLevelFromSeconds(totalSec);

        if (modeLabel) {
            modeLabel.textContent = bookstoreState.creatorMode === 'creator'
                ? '当前身份：创作者'
                : '当前身份：读者';
        }
        if (levelLabel) {
            levelLabel.textContent = '创作等级 Lv.' + level;
        }
        if (timeLabel) {
            timeLabel.textContent = '今日创作 ' + formatMinutesFromSeconds(todaySec);
        }
    }

    function getCreatorProjectById(id) {
        if (!Array.isArray(bookCreatorProjects)) return null;
        return bookCreatorProjects.find(p => p && p.id === id) || null;
    }

    function renderBookCreatorList() {
        const emptyEl = document.getElementById('book-creator-empty');
        const listEl = document.getElementById('book-creator-list');
        if (!emptyEl || !listEl) return;

        if (!Array.isArray(bookCreatorProjects) || bookCreatorProjects.length === 0) {
            emptyEl.style.display = 'block';
            listEl.innerHTML = '';
        } else {
            emptyEl.style.display = 'none';
            listEl.innerHTML = '';

            bookCreatorProjects
                .slice()
                .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
                .forEach(project => {
                    const card = document.createElement('div');
                    card.className = 'book-creator-project-card';
                    card.dataset.projectId = project.id;

                    const chapterCount = (project.chapters && project.chapters.length) || 0;
                    const updatedAt = project.updatedAt || project.createdAt;
                    const updatedStr = updatedAt
                        ? new Date(updatedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
                        : '未开始';

                    card.innerHTML = `
                        <div class="book-creator-project-title">${escapeHTML(project.title || '未命名小说')}</div>
                        <div class="book-creator-project-meta">
                            <span>${chapterCount} 章</span>
                            <span>·</span>
                            <span>${project.worldSetting ? escapeHTML(project.worldSetting) : '普通世界'}</span>
                            <span style="margin-left:auto;">${updatedStr} 更新</span>
                        </div>
                    `;

                    card.addEventListener('click', () => {
                        openCreatorProject(project.id);
                    });

                    listEl.appendChild(card);
                });
        }

        updateCreatorStatsUI();
    }

    function openCreatorProject(projectId) {
        const project = getCreatorProjectById(projectId);
        const editor = document.getElementById('book-creator-editor');
        if (!project || !editor) return;
        bookstoreState.currentProjectId = projectId;
        updateCreatorEditorUI();
    }

    function updateCreatorEditorUI() {
        const editor = document.getElementById('book-creator-editor');
        const titleEl = document.getElementById('book-creator-editor-title');
        const metaEl = document.getElementById('book-creator-editor-meta');
        const listEl = document.getElementById('book-creator-chapter-list');
        const memoryEl = document.getElementById('book-creator-chapter-memory');
        const outlineInput = document.getElementById('book-creator-outline-input');
        if (!editor || !titleEl || !metaEl || !listEl || !memoryEl || !outlineInput) return;

        const project = getCreatorProjectById(bookstoreState.currentProjectId);
        if (!project) {
            editor.style.display = 'none';
            memoryEl.textContent = '';
            return;
        }

        editor.style.display = '';
        titleEl.textContent = project.title || '未命名小说';
        const world = project.worldSetting || '普通世界观';
        const style = project.style || '默认文风';
        const range = `${project.chapterMinWords || 800} - ${project.chapterMaxWords || 1500} 字/章`;
        metaEl.textContent = `${world} · ${style} · ${range}`;

        const chapters = project.chapters || [];
        listEl.innerHTML = '';

        if (!bookstoreState.currentChapterId && chapters.length) {
            bookstoreState.currentChapterId = chapters[chapters.length - 1].id;
        }

        chapters.forEach(chapter => {
            const item = document.createElement('div');
            item.className = 'book-creator-chapter-item';
            if (chapter.id === bookstoreState.currentChapterId) {
                item.classList.add('active');
            }

            const preview = (chapter.body || '').split(/\n+/).slice(0, 2).join('\n');
            item.innerHTML = `
                <div class="book-creator-chapter-item-title">${escapeHTML(chapter.title || '未命名章节')}</div>
                <div class="book-creator-chapter-item-body">${escapeHTML(preview)}</div>
            `;

            item.addEventListener('click', () => {
                bookstoreState.currentChapterId = chapter.id;
                updateCreatorEditorUI();
            });

            listEl.appendChild(item);
        });

        const currentChapter = chapters.find(c => c.id === bookstoreState.currentChapterId) || null;
        if (currentChapter) {
            const memText = currentChapter.memory || '';
            memoryEl.textContent = memText
                ? `本章记忆（约 ${memText.length} 字）：${memText}`
                : '本章尚未生成记忆摘要。';
            outlineInput.value = currentChapter.outline || '';
        } else {
            memoryEl.textContent = '还没有任何章节。先在下方写一点情节发展，再让右侧铅笔帮你写。';
            outlineInput.value = '';
        }
    }

    function openBookCreatorSettingsModal(existingProjectId) {
        const modal = document.getElementById('book-creator-settings-modal');
        if (!modal) return;

        const titleInput = document.getElementById('creator-novel-title');
        const worldbookSelect = document.getElementById('creator-worldbook-select');
        const minInput = document.getElementById('creator-chapter-min-words');
        const maxInput = document.getElementById('creator-chapter-max-words');
        const worldSettingInput = document.getElementById('creator-world-setting-input');
        const styleInput = document.getElementById('creator-style-input');
        const roleList = document.getElementById('creator-role-list');

        if (!titleInput || !worldbookSelect || !minInput || !maxInput || !worldSettingInput || !styleInput || !roleList) {
            return;
        }

        const project = existingProjectId ? getCreatorProjectById(existingProjectId) : null;

        // 填充世界书选项
        worldbookSelect.innerHTML = '<option value="">不绑定世界书</option>';
        if (Array.isArray(worldbooks)) {
            worldbooks.forEach(wb => {
                const opt = document.createElement('option');
                opt.value = wb.id;
                opt.textContent = wb.title || wb.name || '未命名世界书';
                worldbookSelect.appendChild(opt);
            });
        }

        // 参与人物 chips
        roleList.innerHTML = '';
        const selectedIds = new Set(project && Array.isArray(project.roleIds) ? project.roleIds : []);

        const pushRoleChip = (id, label) => {
            if (!id || !label) return;
            const chip = document.createElement('div');
            chip.className = 'book-creator-role-chip';
            chip.dataset.roleId = id;
            chip.textContent = label;
            if (selectedIds.has(id)) chip.classList.add('selected');
            chip.addEventListener('click', () => {
                chip.classList.toggle('selected');
            });
            roleList.appendChild(chip);
        };

        (userProfiles || []).forEach(user => {
            const label = (user.nickname || user.name || '用户') + '（用户）';
            pushRoleChip('user:' + user.id, label);
        });
        (aiList || []).forEach(ai => {
            if (ai.isArchived) return;
            const label = (ai.nickname || ai.name || 'AI 角色') + '（AI）';
            pushRoleChip('ai:' + ai.id, label);
        });

        if (project) {
            titleInput.value = project.title || '';
            worldbookSelect.value = project.worldbookId || '';
            minInput.value = project.chapterMinWords || 800;
            maxInput.value = project.chapterMaxWords || 1500;
            worldSettingInput.value = project.worldSetting || '';
            styleInput.value = project.style || '';
            modal.dataset.projectId = project.id;
        } else {
            titleInput.value = '';
            worldbookSelect.value = '';
            minInput.value = 800;
            maxInput.value = 1500;
            worldSettingInput.value = '';
            styleInput.value = '';
            modal.dataset.projectId = '';
        }

        modal.classList.add('active');
    }

    function closeBookCreatorSettingsModal() {
        const modal = document.getElementById('book-creator-settings-modal');
        if (modal) modal.classList.remove('active');
    }

    function collectCreatorSettingsFromModal() {
        const titleInput = document.getElementById('creator-novel-title');
        const worldbookSelect = document.getElementById('creator-worldbook-select');
        const minInput = document.getElementById('creator-chapter-min-words');
        const maxInput = document.getElementById('creator-chapter-max-words');
        const worldSettingInput = document.getElementById('creator-world-setting-input');
        const styleInput = document.getElementById('creator-style-input');
        const roleList = document.getElementById('creator-role-list');

        if (!titleInput || !worldbookSelect || !minInput || !maxInput || !worldSettingInput || !styleInput || !roleList) {
            return null;
        }

        const title = titleInput.value.trim();
        const minWords = Number(minInput.value) || 800;
        const maxWords = Number(maxInput.value) || 1500;
        const worldSetting = worldSettingInput.value.trim();
        const style = styleInput.value.trim();

        const roleIds = [];
        roleList.querySelectorAll('.book-creator-role-chip.selected').forEach(chip => {
            const id = chip.dataset.roleId;
            if (id) roleIds.push(id);
        });

        return {
            title,
            worldbookId: worldbookSelect.value || '',
            chapterMinWords: Math.max(200, Math.min(minWords, maxWords)),
            chapterMaxWords: Math.max(Math.max(200, minWords), maxWords),
            worldSetting,
            style,
            roleIds
        };
    }

    function handleCreatorSettingsSave() {
        const modal = document.getElementById('book-creator-settings-modal');
        if (!modal) return;
        const existingId = modal.dataset.projectId || '';

        const data = collectCreatorSettingsFromModal();
        if (!data || !data.title) {
            showToast('请至少填写小说名称');
            return;
        }

        if (!Array.isArray(bookCreatorProjects)) bookCreatorProjects = [];

        const now = Date.now();
        let project;
        if (existingId) {
            project = getCreatorProjectById(existingId);
            if (project) {
                Object.assign(project, data, { updatedAt: now });
            }
        } else {
            project = Object.assign({
                id: 'creator_' + now + '_' + Math.random().toString(16).slice(2),
                createdAt: now,
                updatedAt: now,
                chapters: []
            }, data);
            bookCreatorProjects.push(project);
        }

        saveBookCreatorProjects();
        renderBookCreatorList();
        if (project) {
            bookstoreState.currentProjectId = project.id;
            bookstoreState.currentChapterId = null;
            updateCreatorEditorUI();
        }
        closeBookCreatorSettingsModal();
    }

    function updateBookstoreRightButton() {
        const btn = document.getElementById('bookstore-import-btn');
        if (!btn) return;
        if (bookstoreState.currentView === 'creator') {
            btn.textContent = '✎';
        } else {
            btn.textContent = '+';
        }
    }

    function updateCreatorWritingIndicator(isWriting) {
        const page = document.getElementById('bookstore-page');
        const titleEl = document.getElementById('bookstore-title');
        if (!page || !titleEl) return;
        if (isWriting) {
            page.classList.add('creator-writing');
            titleEl.textContent = '正在书写新篇章……';
        } else {
            page.classList.remove('creator-writing');
            // 根据当前视图恢复标题
            if (bookstoreState.currentView === 'shelf') titleEl.textContent = '书城';
            else if (bookstoreState.currentView === 'reader') titleEl.textContent = '阅读';
            else if (bookstoreState.currentView === 'profile') titleEl.textContent = '我的阅读';
            else if (bookstoreState.currentView === 'creator') titleEl.textContent = '创作区';
        }
    }

    function handleBookstoreRightBtnClick() {
        if (bookstoreState.currentView === 'creator') {
            // 在创作区下，右上角按钮用于新建 / 编辑小说设定
            if (bookstoreState.currentProjectId) {
                openBookCreatorSettingsModal(bookstoreState.currentProjectId);
            } else {
                openBookCreatorSettingsModal('');
            }
        } else {
            openBookImportModal();
        }
    }

    function buildCreatorPrompt(project, outline, mode) {
        const worldbook = (worldbooks || []).find(wb => wb.id === project.worldbookId);
        const wbTitle = worldbook ? (worldbook.title || worldbook.name || '') : '';
        const wbSummary = worldbook ? (worldbook.summary || worldbook.description || '') : '';

        const userRoleNames = [];
        const aiRoleNames = [];
        (project.roleIds || []).forEach(id => {
            if (id.startsWith('user:')) {
                const rawId = id.slice('user:'.length);
                const u = (userProfiles || []).find(x => String(x.id) === String(rawId));
                if (u) userRoleNames.push(u.nickname || u.name || '用户');
            } else if (id.startsWith('ai:')) {
                const rawId = id.slice('ai:'.length);
                const a = (aiList || []).find(x => String(x.id) === String(rawId));
                if (a) aiRoleNames.push(a.nickname || a.name || 'AI 角色');
            }
        });

        const minWords = project.chapterMinWords || 800;
        const maxWords = project.chapterMaxWords || 1500;

        const modeLabel = mode === 'rewrite' ? '重写当前章节' : '创作新的章节';

        const instructions = [
            `你现在是一个恋爱向手机应用里的小说写作引擎，需要根据设定 ${modeLabel}。`,
            `小说名称：${project.title || '未命名小说'}`,
            `世界观设定：${project.worldSetting || '普通现实向'}`,
            `文风偏好：${project.style || '默认'} `,
            wbTitle ? `绑定世界书：${wbTitle}` : '',
            wbSummary ? `世界书摘要：${wbSummary}` : '',
            userRoleNames.length ? `用户角色参与者：${userRoleNames.join('、')}` : '',
            aiRoleNames.length ? `AI 好友参与者：${aiRoleNames.join('、')}` : '',
            '',
            `本章情节发展脉络：${outline || '无特别说明，由你根据设定自由发挥。'}`,
            '',
            `请严格输出 JSON，格式如下：`,
            '{',
            '  "chapterTitle": "这一章的标题，简短一些",',
            '  "chapterBody": "章节正文，控制在 ' + minWords + ' 到 ' + maxWords + ' 字之间，适当分段，每段之间用换行分隔",',
            '  "memory": "用 50-80 个汉字总结本章内容，突出未来可延续的要点"',
            '}',
            '',
            '不要输出任何多余解释或前后缀，直接输出 JSON。'
        ].filter(Boolean).join('\n');

        return instructions;
    }

    function parseCreatorResponse(raw, project, outline) {
        if (!raw) return null;
        try {
            const jsonText = extractFirstJsonObject(raw) || raw;
            const data = JSON.parse(jsonText);
            const title = (data.chapterTitle || '').trim() || '未命名章节';
            const body = (data.chapterBody || '').trim();
            let memory = (data.memory || '').trim();
            if (!memory && body) {
                memory = body.slice(0, 70);
            }
            return {
                title,
                body,
                memory,
                outline: outline || ''
            };
        } catch (e) {
            console.warn('解析创作区响应失败，将整段作为正文使用', e);
            const text = String(raw || '').trim();
            return {
                title: '未命名章节',
                body: text,
                memory: text.slice(0, 70),
                outline: outline || ''
            };
        }
    }

    async function runCreatorChapter(mode) {
        if (!bookstoreState.currentProjectId) {
            showToast('请先通过右上角铅笔新建一部小说');
            return;
        }
        const project = getCreatorProjectById(bookstoreState.currentProjectId);
        if (!project) {
            showToast('未找到当前创作项目');
            return;
        }

        const outlineInput = document.getElementById('book-creator-outline-input');
        const generateBtn = document.getElementById('book-creator-generate-btn');
        const regenerateBtn = document.getElementById('book-creator-regenerate-btn');
        if (!outlineInput || !generateBtn || !regenerateBtn) return;

        const outline = outlineInput.value.trim();
        if (!outline && mode !== 'rewrite') {
            showToast('先在下方写一点本章想发生的事，再让铅笔帮你写。');
            return;
        }

        // 重写模式下必须有当前章节
        if (mode === 'rewrite' && !bookstoreState.currentChapterId) {
            showToast('当前还没有可以重写的章节，可以先生成一章。');
            return;
        }

        bookstoreState.creatorStatus = 'writing';
        generateBtn.disabled = true;
        regenerateBtn.disabled = true;
        updateCreatorWritingIndicator(true);

        const startTime = Date.now();

        const finish = () => {
            bookstoreState.creatorStatus = 'idle';
            generateBtn.disabled = false;
            regenerateBtn.disabled = false;
            updateCreatorWritingIndicator(false);
            const durationSec = Math.floor((Date.now() - startTime) / 1000);
            if (durationSec > 0) {
                addCreatorTime(durationSec);
            }
        };

        try {
            let result;
            if (!config || !config.url || !config.key) {
                // 无 API 配置时的占位实现
                const fakeBody = (outline || '这一章由你来继续补充。') + '\n\n（当前未配置 API，以下为占位文本示例。）';
                result = {
                    title: mode === 'rewrite' ? '重写的章节' : '新的章节',
                    body: fakeBody,
                    memory: fakeBody.slice(0, 70),
                    outline
                };
            } else {
                const prompt = buildCreatorPrompt(project, outline, mode);
                const raw = await getCompletion(prompt, true);
                result = parseCreatorResponse(raw, project, outline);
            }

            if (!result) {
                showToast('生成章节失败，请稍后重试');
                return;
            }

            if (!Array.isArray(project.chapters)) project.chapters = [];

            const now = Date.now();
            if (mode === 'rewrite' && bookstoreState.currentChapterId) {
                const idx = project.chapters.findIndex(c => c.id === bookstoreState.currentChapterId);
                if (idx >= 0) {
                    project.chapters[idx] = Object.assign({}, project.chapters[idx], {
                        title: result.title,
                        body: result.body,
                        memory: result.memory,
                        outline: result.outline,
                        updatedAt: now
                    });
                }
            } else {
                const chapterId = 'chapter_' + now + '_' + Math.random().toString(16).slice(2);
                project.chapters.push({
                    id: chapterId,
                    title: result.title,
                    body: result.body,
                    memory: result.memory,
                    outline: result.outline,
                    createdAt: now,
                    updatedAt: now
                });
                bookstoreState.currentChapterId = chapterId;
            }

            project.updatedAt = now;
            saveBookCreatorProjects();
            renderBookCreatorList();
            updateCreatorEditorUI();
        } catch (err) {
            console.error('创作区章节生成失败', err);
            showToast('生成章节时出现问题，可以稍后再试');
        } finally {
            finish();
        }
    }

    function handleCreatorGenerateClick() {
        runCreatorChapter('create');
    }

    function handleCreatorRegenerateClick() {
        runCreatorChapter('rewrite');
    }

    function renderCurrentBookPage() {
        const contentEl = document.getElementById('book-reader-content');
        const indicatorEl = document.getElementById('book-page-indicator');
        const progressEl = document.getElementById('book-reader-progress');
        if (!contentEl || !indicatorEl) return;

        const pages = bookstoreState.currentBookPages || [];
        if (!pages.length) {
            contentEl.textContent = '当前书本还没有可显示的内容。';
            indicatorEl.textContent = '第 0 / 0 页';
            if (progressEl) progressEl.textContent = '已读 0%';
            return;
        }

        let index = bookstoreState.currentPageIndex || 0;
        if (index < 0) index = 0;
        if (index >= pages.length) index = pages.length - 1;
        bookstoreState.currentPageIndex = index;

        contentEl.textContent = pages[index] || '';
        indicatorEl.textContent = `第 ${index + 1} / ${pages.length} 页`;

        const bookId = bookstoreState.currentBookId;
        if (!bookId) return;
        const book = (bookstoreBooks || []).find(b => b.id === bookId);
        if (!book) return;

        const percent = Math.round(((index + 1) / pages.length) * 100);
        book.progress = {
            currentPage: index,
            totalPages: pages.length,
            percent
        };
        if (progressEl) progressEl.textContent = `已读 ${percent}%`;
        saveBookstoreBooks();
    }

    function goToBookPage(delta) {
        if (!bookstoreState.currentBookId) return;
        const pages = bookstoreState.currentBookPages || [];
        if (!pages.length) return;

        let index = (bookstoreState.currentPageIndex || 0) + delta;
        if (index < 0) {
            index = 0;
            showToast('已经是第一页');
        } else if (index >= pages.length) {
            index = pages.length - 1;
            showToast('已经是最后一页');
        }
        bookstoreState.currentPageIndex = index;
        renderCurrentBookPage();
    }

    // 覆盖阅读器入口：真正载入 TXT 正文并分页
    function openBookReader(bookId) {
        const book = (bookstoreBooks || []).find(b => b.id === bookId);
        if (!book) {
            showToast('未找到书本记录');
            return;
        }
        bookstoreState.currentBookId = bookId;

        const raw = book.content || '';
        const pages = paginateBookText(raw);
        bookstoreState.currentBookPages = pages;

        let pageIndex = 0;
        if (book.progress && typeof book.progress.currentPage === 'number' && book.progress.currentPage < pages.length) {
            pageIndex = book.progress.currentPage;
        }
        bookstoreState.currentPageIndex = pageIndex;

        const titleEl = document.getElementById('book-reader-title');
        const progressEl = document.getElementById('book-reader-progress');
        if (titleEl) titleEl.textContent = book.title || '未命名电子书';
        if (progressEl) {
            const percent = Math.round((book.progress && book.progress.percent) || 0);
            progressEl.textContent = `已读 ${percent}%`;
        }

        renderCurrentBookPage();
        switchBookstoreView('reader');
    }

    function closeBookReaderToShelf() {
        // 后续在这里补充阅读时长结算逻辑
        bookstoreState.currentBookId = null;
        bookstoreState.currentBookPages = [];
        bookstoreState.currentPageIndex = 0;
        switchBookstoreView('shelf');
    }

    // TXT 导入
    function handleBookImportTxtClick() {
        const input = document.getElementById('book-import-txt-input');
        if (input) input.click();
    }

    function handleBookImportTxtFileChange(event) {
        const input = event.target;
        const file = input && input.files && input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const raw = e.target && e.target.result ? String(e.target.result) : '';
            const pages = paginateBookText(raw);
            const id = 'book_' + Date.now() + '_' + Math.random().toString(16).slice(2);
            const title = file.name ? file.name.replace(/\.[^/.]+$/, '') : '未命名电子书';

            if (!Array.isArray(bookstoreBooks)) bookstoreBooks = [];
            const book = {
                id,
                title,
                fileType: 'txt',
                createdAt: Date.now(),
                latestReadAt: 0,
                totalReadSeconds: 0,
                companionRoleId: null,
                progress: {
                    currentPage: 0,
                    totalPages: pages.length,
                    percent: 0
                },
                content: raw
            };

            bookstoreBooks.push(book);
            saveBookstoreBooks();
            renderBookShelf();
            closeBookImportModal();
            if (input) input.value = '';
            openBookReader(book.id);
        };
        reader.readAsText(file, 'utf-8');
    }

    function handleBookImportPdfClick() {
        showToast('PDF 阅读模式规划中，当前版本推荐先导入 TXT 体验阅读流程。');
    }

    // 覆盖 initBookstore：补齐事件绑定
    function initBookstore() {
        const page = document.getElementById('bookstore-page');
        if (!page) return;

        const tabShelf = document.getElementById('bookstore-tab-shelf');
        const tabProfile = document.getElementById('bookstore-tab-profile');
        const tabCreator = document.getElementById('bookstore-tab-creator');
        const importBtn = document.getElementById('bookstore-import-btn');
        const backBtn = document.getElementById('book-reader-back-btn');
        const importCancelBtn = document.getElementById('book-import-cancel-btn');
        const companionCancelBtn = document.getElementById('book-companion-cancel-btn');
        const txtBtn = document.getElementById('book-import-txt-btn');
        const txtInput = document.getElementById('book-import-txt-input');
        const pdfBtn = document.getElementById('book-import-pdf-btn');
        const prevBtn = document.getElementById('book-page-prev-btn');
        const nextBtn = document.getElementById('book-page-next-btn');
        const creatorGenerateBtn = document.getElementById('book-creator-generate-btn');
        const creatorRegenerateBtn = document.getElementById('book-creator-regenerate-btn');
        const creatorCancelBtn = document.getElementById('book-creator-cancel-btn');
        const creatorSaveBtn = document.getElementById('book-creator-save-btn');

        if (tabShelf) {
            tabShelf.addEventListener('click', () => {
                switchBookstoreView('shelf');
                bookstoreState.creatorMode = 'reader';
                updateCreatorStatsUI();
                updateBookstoreRightButton();
            });
        }
        if (tabProfile) {
            tabProfile.addEventListener('click', () => {
                switchBookstoreView('profile');
                bookstoreState.creatorMode = 'reader';
                updateCreatorStatsUI();
                updateBookstoreRightButton();
            });
        }
        if (tabCreator) {
            tabCreator.addEventListener('click', () => {
                switchBookstoreView('creator');
                bookstoreState.creatorMode = 'creator';
                updateCreatorStatsUI();
                updateBookstoreRightButton();
            });
        }
        if (importBtn) {
            importBtn.addEventListener('click', handleBookstoreRightBtnClick);
        }
        if (backBtn) {
            backBtn.addEventListener('click', closeBookReaderToShelf);
        }
        if (importCancelBtn) {
            importCancelBtn.addEventListener('click', closeBookImportModal);
        }
        if (companionCancelBtn) {
            companionCancelBtn.addEventListener('click', closeBookCompanionModal);
        }
        if (txtBtn) {
            txtBtn.addEventListener('click', handleBookImportTxtClick);
        }
        if (txtInput) {
            txtInput.addEventListener('change', handleBookImportTxtFileChange);
        }
        if (pdfBtn) {
            pdfBtn.addEventListener('click', handleBookImportPdfClick);
        }
        if (prevBtn) {
            prevBtn.addEventListener('click', () => goToBookPage(-1));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => goToBookPage(1));
        }
        if (creatorGenerateBtn) {
            creatorGenerateBtn.addEventListener('click', handleCreatorGenerateClick);
        }
        if (creatorRegenerateBtn) {
            creatorRegenerateBtn.addEventListener('click', handleCreatorRegenerateClick);
        }
        if (creatorCancelBtn) {
            creatorCancelBtn.addEventListener('click', closeBookCreatorSettingsModal);
        }
        if (creatorSaveBtn) {
            creatorSaveBtn.addEventListener('click', handleCreatorSettingsSave);
        }

        renderBookShelf();
        renderBookCreatorList();
        switchBookstoreView('shelf');
        updateBookstoreRightButton();
        updateCreatorStatsUI();
    }

    // 在主初始化流程中启动书城与购物页
    initBookstore();
    initShopPage();


// --- 3. 将所有需要被HTML调用的函数暴露到全局 ---
window.renderForumPersonalPage = renderForumPersonalPage;
window.switchForumRole = switchForumRole;
window.setActiveForumRole = setActiveForumRole;
window.deregisterActiveRole = deregisterActiveRole;
window.deregisterRole = deregisterRole;
window.openRoleEditor = openRoleEditor;
window.saveForumRole = saveForumRole;
window.openPrivateMessagesPage = openPrivateMessagesPage;
window.closePrivateMessagesPage = closePrivateMessagesPage;
window.generatePrivateMessages = generatePrivateMessages;
window.openChatView = openChatView;
window.sendDmMessage = sendDmMessage;
window.generateDmReply = generateDmReply;
window.openWorldbookBinder = openWorldbookBinder;

 window.openAddCharacterModal = openAddCharacterModal;
    window.closeAddCharacterModal = closeAddCharacterModal;
    window.saveBulkEmojis = saveBulkEmojis;
    window.addMomentComment = addMomentComment;

    window.openPage = openPage;
    window.closePage = closePage;
    window.openDrawer = openDrawer;
    window.closeDrawer = closeDrawer;
    window.closeModelPicker = closeModelPicker;
window.saveCurrentApiProfile = saveCurrentApiProfile;
window.applyApiProfile = applyApiProfile;
window.closeModelPicker = closeModelPicker;



    // --- QQ App & 聊天室 ---
    window.switchQqTab = switchQqTab;
    window.loadChatList = loadChatList;
    window.performDeleteCharacter = performDeleteCharacter;
    window.openAiDrawer = openAiDrawer;
    window.triggerAiMomentsActivity = triggerAiMomentsActivity;
    window.openPostCreator = openPostCreator;
    window.closePostCreator = closePostCreator;
    window.publishMoment = publishMoment;
    window.saveMomentsData = saveMomentsData;
    window.toggleLike = toggleLike;
    window.showMomentActions = showMomentActions;
    window.closeMomentActions = closeMomentActions;
    window.openChatSettingsDrawer = openChatSettingsDrawer;
    window.openChatAppearanceModal = openChatAppearanceModal;
    window.closeChatAppearanceModal = closeChatAppearanceModal;
    window.saveChatCssFromModal = saveChatCssFromModal;
    window.sendOnly = sendOnly;
    window.openOfflinePage = openOfflinePage;
    window.offlineSendOnly = offlineSendOnly;
    window.generateOfflineReply = generateOfflineReply;
    window.openOfflineSettingsDrawer = openOfflineSettingsDrawer;
    window.generateReply = generateReply;
    window.toggleOfflineSettings = toggleOfflineSettings;
    window.saveChatSettings = saveChatSettings;
    window.saveOfflineSettings = saveOfflineSettings;
    window.clearOfflineHistory = clearOfflineHistory;
    window.exportCurrentChat = exportCurrentChat;
    window.importCurrentChat = importCurrentChat;
    // 预设管理对外暴露
    window.openPresetManager = openPresetManager;
    window.savePreset = savePreset;
    window.deletePreset = deletePreset;
    window.selectPreset = selectPreset;
    window.closePresetManager = closePresetManager;
    window.tryClearCurrentChat = tryClearCurrentChat;
    window.closeThoughtsModal = closeThoughtsModal;
    window.toggleToolbar = toggleToolbar;
    window.openVoiceModal = openVoiceModal;
    window.closeVoiceModal = closeVoiceModal;
    window.goBackInDm = goBackInDm;
    window.sendVoiceMessage = sendVoiceMessage;
    window.sendTransferMessage = sendTransferMessage;
    window.openTransferModal = openTransferModal;
    window.closeTransferModal = closeTransferModal;
    window.openLocationModal = openLocationModal;
    window.closeLocationModal = closeLocationModal;
    window.sendLocationMessage = sendLocationMessage;
    window.openTransferActionSheet = openTransferActionSheet;
    window.closeTransferActionSheet = closeTransferActionSheet;
    window.acceptTransfer = acceptTransfer;
    window.rejectTransfer = rejectTransfer;
    // 一起听 / 外卖 相关对外暴露
    window.openMusicModal = openMusicModal;
    window.closeMusicModal = closeMusicModal;
    window.mockSearchSongs = mockSearchSongs;
    window.startMusicSession = startMusicSession;
    window.closeMusicPlayerBar = closeMusicPlayerBar;
    window.openTakeoutModal = openTakeoutModal;
    window.closeTakeoutModal = closeTakeoutModal;
    window.sendTakeoutMessage = sendTakeoutMessage;
window.toggleWorldbookSection = toggleWorldbookSection;
window.toggleCollapse = toggleCollapse;
window.toggleOfflineSettings = toggleOfflineSettings;
window.openAiDrawer = openAiDrawer;
window.handleEditCurrentAi = handleEditCurrentAi; 
 window.openAvatarManager = openAvatarManager;
 window.uploadToAvatarManager = uploadToAvatarManager;
  window.selectAvatarFromManager = selectAvatarFromManager; 
window.openEmojiManager = openEmojiManager;
window.closeEmojiManager = closeEmojiManager;
window.switchEmojiTab = switchEmojiTab;
window.saveBulkEmojis = saveBulkEmojis;
window.deleteEmoji = deleteEmoji;
window.sendEmojiMessage = sendEmojiMessage;
window.filterEmojiCategory = filterEmojiCategory;
window.openCharacterBinder = openCharacterBinder;
window.saveCharacterBinding = saveCharacterBinding;
window.openCategoryEditor = openCategoryEditor;
window.updateCategories = updateCategories;
window.addCategory = addCategory;
window.addCategory = addCategory;
window.openUserAvatarManager = openUserAvatarManager;
window.uploadToUserAvatarManager = uploadToUserAvatarManager;
window.selectAvatarFromUserManager = selectAvatarFromUserManager;
window.addAvatarToCharacter = addAvatarToCharacter;
window.handleAvatarChange = handleAvatarChange;
window.openAIAvatarManager = openAIAvatarManager;
window.uploadToAIAvatarManager = uploadToAIAvatarManager;
window.selectAvatarFromAIManager = selectAvatarFromAIManager;
window.openWorldbookBinder = openWorldbookBinder;
window.closeWorldbookBinder = closeWorldbookBinder;
window.saveWorldbookBinding = saveWorldbookBinding;


// T2I 部分
window.openT2IModal = openT2IModal;
window.closeT2IModal = closeT2IModal;
window.sendDescribedImage = sendDescribedImage;
window.flipImageCard = flipImageCard;

     // --- 论坛 App ---
    window.switchForumTab = switchForumTab;
    window.openForumActionModal = openForumActionModal;
    window.closeForumActionModal = closeForumActionModal;
    window.openForumGeneratorModal = openForumGeneratorModal;
    window.closeForumGeneratorModal = closeForumGeneratorModal;
    window.generateForumPosts = generateForumPosts;
    window.openForumPostCreator = openForumPostCreator;
    window.closeForumPostCreator = closeForumPostCreator;
    window.saveUserForumPost = saveUserForumPost;
    window.likeForumPost = likeForumPost;
    window.deleteForumPost = deleteForumPost;
    window.addForumComment = addForumComment;
    window.generateEngagement = generateEngagement;
    window.generateForumCommentsForPost = generateForumCommentsForPost;
    window.deleteDmConversation = deleteDmConversation;

    // --- 世界书 App ---
    window.openWorldbookPage = () => openPage('worldbook-page');
    window.openWbDrawer = openWbDrawer;
    window.addWbEntryForm = addWbEntryForm;
    window.saveWb = saveWb;
    window.deleteWb = deleteWb;
    window.toggleCustomSelect = toggleCustomSelect;

    // --- 纪念日 App ---
    window.openAnniversaryCreator = openAnniversaryCreator;
    window.saveAnniversary = saveAnniversary;
    window.deleteAnniversary = deleteAnniversary;
    window.setAnniversaryWidget = setAnniversaryWidget;

    // --- 自律钟 App ---
    window.openTaskCreator = openTaskCreator;
    window.closeTaskCreator = closeTaskCreator;
    window.saveTask = saveTask;
    window.deleteTask = deleteTask;
    window.tryExitFocus = tryExitFocus;
    window.switchClockTab = switchClockTab;
    window.saveClockProfile = saveClockProfile;
    window.deleteClockWallpaper = deleteClockWallpaper;
    window.deleteClockQuote = deleteClockQuote;
    window.addClockQuote = addClockQuote;

    // --- 角色与用户管理 ---
    window.openUserDrawer = openUserDrawer;
    window.createNewUser = createNewUser;
    window.saveUser = saveUser;
    window.deleteUser = deleteUser;
    window.saveAiCharacter = saveAiCharacter;

    // --- 外观设置 ---
    window.saveWallpaper = saveWallpaper;
    window.saveLockWallpaper = saveLockWallpaper;
    window.saveFont = saveFont;
    window.saveAppIcons = saveAppIcons;
    window.openRestoreModal = openRestoreModal;
    window.closeRestoreModal = closeRestoreModal;
    window.confirmRestore = confirmRestore;
    window.saveGlobalBeautifyCss = saveGlobalBeautifyCss;
    window.saveGlobalCssPreset = saveGlobalCssPreset;
    window.resetGlobalCssToDefault = resetGlobalCssToDefault;
    window.saveGlobalChatBackground = saveGlobalChatBackground;
    window.saveChatCssPresetFromModal = saveChatCssPresetFromModal;
    window.resetChatCssToDefault = resetChatCssToDefault;
    window.switchBeautifyPanel = switchBeautifyPanel;
    window.saveLockSettings = saveLockSettings;

    // --- 孵蛋室 ---
    window.generateHatcheryCharacter = generateHatcheryCharacter;
    window.modifyHatcheryCharacter = modifyHatcheryCharacter;
    window.copyHatcheryCharacter = copyHatcheryCharacter;
    window.openHatcheryCharTemplatePresets = openHatcheryCharTemplatePresets;
    window.closeHatcheryCharTemplatePresets = closeHatcheryCharTemplatePresets;
    window.applyHatcheryCharTemplatePreset = applyHatcheryCharTemplatePreset;
    window.deleteHatcheryCharTemplatePreset = deleteHatcheryCharTemplatePreset;
    window.generateHatcheryWorldbook = generateHatcheryWorldbook;
    window.generateHatcheryCss = generateHatcheryCss;
    window.generateHatcheryCss = generateHatcheryCss;
    window.applyHatcheryCssToGlobal = applyHatcheryCssToGlobal;

    // --- 通用设置 ---
    window.saveApiConfig = saveApiConfig;
    window.fetchModels = fetchModels;
    window.testConnection = testConnection;
    window.closeModelPicker = closeModelPicker;
    window.cleanAllBadData = cleanAllBadData;
    window.backupAllData = backupAllData;


});

function goBackInDm() {
    const dmPage = document.getElementById('dm-page');
    if (dmPage) {
        dmPage.classList.remove('active');
    }
}

// 将游戏控制函数暴露到全局
const fixKeyboardBug = () => {
    // 首先，获取页面上所有的输入元素，包括 <input> 和 <textarea>
    const inputs = document.querySelectorAll('input, textarea');

    inputs.forEach(input => {
        // 当任何一个输入框失去焦点时（通常意味着键盘即将收起）
        input.addEventListener('blur', () => {
            // 稍微延迟一小会儿（比如100毫秒），以确保键盘收起的动画已经开始
            setTimeout(() => {
                // 强制将页面滚动到最顶部，这是解决iOS上键盘收起后页面留白问题的常用方法
                window.scrollTo(0, 0);
            }, 100);
        });
    });
};
// ------------------- 到这里结束替换 -------------------


// 当整个页面加载完毕后，再执行这个修复函数
document.addEventListener('DOMContentLoaded', () => {
    const dmBackBtn = document.getElementById('dm-back-btn');
    if (dmBackBtn) {
        dmBackBtn.addEventListener('click', goBackInDm);
    }

    const dmGenerateBtn = document.getElementById('dm-generate-btn');
    if (dmGenerateBtn) {
        dmGenerateBtn.addEventListener('click', generatePrivateMessages);
    }

    const dmSendBtn = document.getElementById('dm-send-btn');
    if (dmSendBtn) {
        dmSendBtn.addEventListener('click', sendDmMessage);
    }

    const dmAiReplyBtn = document.getElementById('dm-ai-reply-btn');
    if (dmAiReplyBtn) {
        dmAiReplyBtn.addEventListener('click', generateDmReply);
    }

    // 让输入框支持回车发送
    const dmInput = document.getElementById('dm-chat-input');
    if(dmInput) {
        dmInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                sendDmMessage();
            }
        });
    }
});
window.addEventListener('load', fixKeyboardBug);