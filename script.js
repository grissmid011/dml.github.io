// 使用 IIFE 包裹所有JS代码，避免全局污染
(function() {

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
    function openPage(id) {
        const page = document.getElementById(id);
        if (!page) return;
        page.classList.add('active');
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
    }
         function closePage(id) {
        const page = document.getElementById(id);
        if (page) page.classList.remove('active');
    }

    function openDrawer(id) {
        const drawer = document.getElementById(id);
        if (drawer) drawer.classList.add('active');
    }

    function closeDrawer(id) {
        const drawer = document.getElementById(id);
        if (drawer) drawer.classList.remove('active');
    }

    // --- 1.3. 全局状态变量 (从localStorage加载) ---
const myDefaultBeautifyConfig = {
    wpUrl: 'https://i.postimg.cc/ZnWvmq3B/IMG-3905.jpg', // 您的主屏幕背景图
    icons: {
        qq: 'https://i.postimg.cc/J03VGNjx/IMG-3893.png',
        worldbook: 'https://i.postimg.cc/vHzwyvY8/IMG-3896.png',
        settings: 'https://i.postimg.cc/66MhN2sq/IMG-3903.png',
        appearance: 'https://i.postimg.cc/90Qt7V9f/IMG-3902.png',
        anniversary: 'https://i.postimg.cc/L8QdY6Z4/IMG-3895.png',
        clock: 'https://i.postimg.cc/fyN1nV1v/IMG-3894.png',
        'game-center': 'https://i.postimg.cc/tC98BVhM/IMG-3899.png',
        forum: 'https://i.postimg.cc/26pKhqj8/IMG-3901.png'
    }
};

// getStorage现在会使用您的新默认值
let beautifyConfig = getStorage('ai_beautify_config_v2', myDefaultBeautifyConfig); 

let config = getStorage('ai_phone_config', {});
let userProfiles = getStorage('ai_users_list', []);
let aiList = getStorage('ai_list_v2', []);
let momentsData = getStorage('qq_moments_data', {});
let worldbooks = getStorage('ai_worldbooks_v2', []);
let clockData = {}; // 由 loadClockData 初始化
let anniversaryData = []; // 由 loadAnniversaryData 初始化
let forumData = getStorage('forum_data', { posts: [] });

// --- 1.4. 全局临时变量 ---
let tempWpData = '';
let tempLockWpData = '';
let tempUserAv = '';
let currentEditUserId = null;
let currentEditId = null;
let tempAiAv = '';
let tempMomentImage = '';
let currentChatId = null;
let currentWbCat = '全部';
let currentEditWbId = null;
let currentEditTaskId = null;
let focusTimerInterval = null;
let focusSessionData = { task: null, remainingSeconds: 0 };
let currentEditAnniversaryId = null;

// --- 1.5. 全局常量与默认值 ---
const appIconIds = ['qq', 'worldbook', 'anniversary', 'clock', 'game-center', 'forum', 'appearance', 'settings'];
const DEFAULT_USER_AVATAR_URL = 'https://i.postimg.cc/nzm1Jg3S/IMG-3886.jpg';
const DEFAULT_AI_AVATAR_URL = 'https://i.postimg.cc/nzm1Jg3S/IMG-3886.jpg';
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
        const lockScreenElement = document.getElementById('lock-screen');
        const wpUrlInput = document.getElementById('wp-url');
        const lockWpUrlInput = document.getElementById('lock-wp-url');
        const fontUrlInput = document.getElementById('font-url');
        
        document.getElementById('api-url').value = config.url || '';
        document.getElementById('api-key').value = config.key || '';
        document.getElementById('api-model').value = config.model || '';

        wpUrlInput.value = beautifyConfig.wpUrl || '';
        lockWpUrlInput.value = beautifyConfig.lockWpUrl || '';
        if (beautifyConfig.wpData) mainScreen.style.backgroundImage = `url(${beautifyConfig.wpData})`;
        else if (beautifyConfig.wpUrl) mainScreen.style.backgroundImage = `url(${beautifyConfig.wpUrl})`;

        if (beautifyConfig.lockWpData) lockScreenElement.style.backgroundImage = `url(${beautifyConfig.lockWpData})`;
        else if (beautifyConfig.lockWpUrl) lockScreenElement.style.backgroundImage = `url(${beautifyConfig.lockWpUrl})`;

        fontUrlInput.value = beautifyConfig.fontUrl || '';
        if (beautifyConfig.fontUrl) applyFont(beautifyConfig.fontUrl);

        applyAppIcons();
        appIconIds.forEach(id => {
            const inputEl = document.getElementById(`icon-url-${id}`);
            if (inputEl) {
                inputEl.value = beautifyConfig.icons?.[id] || '';
            }
        });
        
        document.getElementById('import-char-input').addEventListener('change', handleCharacterImport);
        cleanAllBadData(true);
    });

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
        let startYpos = 0;
        const swipeThreshold = 80;
        lockScreenElement.addEventListener('transitionend', () => {
            if (lockScreenElement.classList.contains('unlocked')) lockScreenElement.style.display = 'none';
        });
        const onSwipeStart = (y) => { startYpos = y; };
        const onSwipeEnd = (y) => { if (startYpos - y > swipeThreshold) lockScreenElement.classList.add('unlocked'); };
        lockScreenElement.addEventListener('touchstart', (e) => onSwipeStart(e.touches[0].clientY), { passive: true });
        lockScreenElement.addEventListener('touchend', (e) => onSwipeEnd(e.changedTouches[0].clientY), { passive: true });
        let isDragging = false;
        lockScreenElement.addEventListener('mousedown', (e) => { isDragging = true; onSwipeStart(e.clientY); });
        lockScreenElement.addEventListener('mouseup', (e) => { if (isDragging) { isDragging = false; onSwipeEnd(e.clientY); } });
        lockScreenElement.addEventListener('mouseleave', (e) => { if (isDragging) { isDragging = false; onSwipeEnd(e.clientY); } });
    }

    setInterval(() => {
        const now = new Date();
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        document.getElementById('date-display').innerText = `${now.getMonth() + 1}月${now.getDate()}日 ${days[now.getDay()]}`;
        document.getElementById('time-display').innerText = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
        const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59).getTime();
        const yearPct = ((now.getTime() - startOfYear) / (endOfYear - startOfYear)) * 100;
        document.getElementById('year-fill').style.height = `${yearPct}%`;
        document.getElementById('year-text').innerText = `${yearPct.toFixed(1)}%`;
        const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const dayPct = ((now.getTime() - startDay) / 86400000) * 100;
        document.getElementById('day-fill').style.height = `${dayPct}%`;
        document.getElementById('day-text').innerText = `${(100 - dayPct).toFixed(1)}%`;
    }, 1000);

    navigator.getBattery?.().then(b => {
        const update = () => document.getElementById('battery-bar').style.width = (b.level * 100) + '%';
        update();
        b.addEventListener('levelchange', update);
    });

    document.getElementById('bg-upload').onchange = e => {
        if (e.target.files[0]) {
            const r = new FileReader();
            r.onload = ev => document.getElementById('photo-widget').style.backgroundImage = `url(${ev.target.result})`;
            r.readAsDataURL(e.target.files[0]);
        }
    };
    
    // =========================================================================
    // ------------------------ IV. QQ APP (MESSAGES & MOMENTS) --------------------
    // =========================================================================

    function loadChatList() {
        const list = document.getElementById('chat-list');
        list.innerHTML = '';
        if (aiList.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:50px; color:#999; font-weight:bold; line-height: 1.6;">空空如也~<br>点击右上角 \'+\' 来创建<br>你的第一个AI伙伴吧！</div>';
            return;
        }

        aiList.forEach(ai => {
            const li = document.createElement('li');
            li.className = 'chat-item-wrapper';
            const lastMsgObj = ai.history && ai.history.length > 0 ? ai.history[ai.history.length - 1] : null;
            let lastMsg = '开始聊天吧...';
            if (lastMsgObj) {
                const senderIsUser = userProfiles.some(p => p.id === lastMsgObj.sender);
                const prefix = senderIsUser ? '我: ' : '';
                switch(lastMsgObj.type) {
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
                <div class="chat-item" id="chat-item-${ai.id}">
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
                let deltaX = e.changedTouches[0].clientX - startX;
                if (deltaX < -60) chatItemDiv.classList.add('swiped');
                else if (deltaX > 20) chatItemDiv.classList.remove('swiped');
                else if (Math.abs(deltaX) < 10) openChat(ai.id);
                startX = null;
            }, { passive: true });
        });
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
        document.getElementById('qq-tab-msg').style.display = isMsgTab ? 'flex' : 'none';
        document.getElementById('qq-tab-moments').style.display = isMsgTab ? 'none' : 'flex';
        document.getElementById('qq-header-msg').style.display = isMsgTab ? 'flex' : 'none';
        document.getElementById('qq-header-moments').style.display = isMsgTab ? 'none' : 'flex';
        document.getElementById('nav-btn-msg').classList.toggle('active', isMsgTab);
        document.getElementById('nav-btn-moments').classList.toggle('active', !isMsgTab);
        if (!isMsgTab) loadMomentsData();
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
        if (aiList.length === 0) return showToast('还没有 AI 角色哦，快去创建一个吧');
        showToast('AI 正在思考中...');
        const randomAi = aiList[Math.floor(Math.random() * aiList.length)];
        const prompt = `你是一个名为 "${randomAi.name}" 的AI角色, 你的人设是: "${randomAi.prompt}". 现在请你模仿人类在社交媒体上发动态。请生成一条简短的、符合你人设的动态文本内容。规则：1. 内容要口语化、生活化。2. 字数控制在50字以内。3. 直接返回动态文本即可，不要包含任何额外解释、引号或标签。`;
        try {
            const momentText = await getCompletion(prompt);
            if (momentText) {
                if (!momentsData.posts) momentsData.posts = [];
                momentsData.posts.unshift({
                    id: Date.now(), authorId: randomAi.id, text: momentText, image: null, location: null, likedBy: [], comments: []
                });
                setStorage('qq_moments_data', momentsData);
                renderMomentsFeed();
                showToast(`${randomAi.name} 发布了新动态！`);
            }
        } catch (e) {
            showToast('AI 思考失败了...');
            console.error('AI moments error:', e);
        }
    }


    // =========================================================================
    // ------------------- V. CHAT ROOM & AI INTERACTION ------------------------
    // =========================================================================

    const INTERNAL_SYSTEM_PROMPT = `...`; // 省略，保持不变
    
    function openChat(id) {
        currentChatId = id;
        const ai = aiList.find(c => c.id == id);
        if (!ai) return;
        document.getElementById('chat-title').innerText = ai.name;
        const headerAvatar = document.getElementById('chat-header-avatar');
        headerAvatar.src = sanitizeAvatar(ai.avatar);
        headerAvatar.onclick = showCharacterThoughts;
        openPage('chat-page');
        renderMessages();
    }

    function addMessage(chatId, messageObject) {
        const ai = aiList.find(c => c.id == chatId);
        if (!ai) return;
        if (!ai.history) ai.history = [];
        ai.history.push(messageObject);
        setStorage('ai_list_v2', aiList);
    }
    
    function renderMessages() {
        const area = document.getElementById('msg-area');
        const ai = aiList.find(c => c.id == currentChatId);
        if (!ai) return;
        area.innerHTML = '';
        if (ai.prompt) area.innerHTML += `<div class="bubble system">AI设定已生效</div>`;
        if (!ai.history || ai.history.length === 0) {
            area.scrollTop = area.scrollHeight;
            return;
        }
        ai.history.forEach(message => {
            const row = document.createElement('div');
            const isMe = userProfiles.some(p => p.id === message.sender);
            row.className = `message-row ${isMe ? 'me' : 'ai'}`;
            let senderProfile = isMe ? (userProfiles.find(p => p.id === message.sender) || userProfiles[0]) : (aiList.find(a => a.id === message.sender) || ai);
            let finalAvatar = sanitizeAvatar(senderProfile.avatar) || (isMe ? DEFAULT_USER_AVATAR_URL : DEFAULT_AI_AVATAR_URL);
            const bubble = document.createElement('div');
            switch(message.type) {
                case 'emoji':
                    bubble.className = 'bubble emoji';
                    bubble.innerHTML = `<img src="${message.url}" alt="表情">`;
                    break;
                case 'image_card':
                    bubble.className = 'bubble image-card';
                    bubble.innerHTML = `<div class="image-card-face image-card-front">🎨</div><div class="image-card-face image-card-back">${escapeHTML(message.description)}</div>`;
                    bubble.onclick = () => bubble.classList.toggle('flipped');
                    break;
                case 'text':
                default:
                    bubble.className = `bubble ${isMe ? 'me' : 'ai'}`;
                    bubble.textContent = message.text;
                    break;
            }
            row.innerHTML = `<img src="${finalAvatar}" alt="avatar" class="msg-avatar">`;
            row.appendChild(bubble);
            area.appendChild(row);
        });
        area.scrollTop = area.scrollHeight;
    }

    function sendOnly() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;
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
  
    async function generateReply() {
        const btn = document.getElementById('generate-btn');
        if (!config.key || !config.url) return showToast('请先在设置中配置 API！');
        const ai = aiList.find(c => c.id == currentChatId);
        if (!ai || !ai.history || ai.history.length === 0) return showToast('请先发条消息！');
        const currentUser = userProfiles.find(p => p.id == ai.userId) || userProfiles[0];
        const lastUserMessage = [...ai.history].reverse().find(m => userProfiles.some(p => p.id === m.sender));
        btn.disabled = true;
        btn.innerText = '⏳';

        const emojis = getStorage('emojis', []);
        const aiCanUseEmojis = emojis.filter(e => e.charId === 'all' || e.charId === String(ai.id));
        const shouldSendEmoji = aiCanUseEmojis.length > 0 && Math.random() < 0.2;
        const shouldSendImage = Math.random() < 0.1;

        if (shouldSendEmoji) {
            const randomEmoji = aiCanUseEmojis[Math.floor(Math.random() * aiCanUseEmojis.length)];
            addMessage(currentChatId, { sender: ai.id, type: 'emoji', url: randomEmoji.url, timestamp: new Date().toISOString() });
        } else if (shouldSendImage && lastUserMessage?.text) {
            const imageDescription = `我想到了一幅画：关于"${lastUserMessage.text}"的场景。`;
            addMessage(currentChatId, { sender: ai.id, type: 'image_card', description: imageDescription, timestamp: new Date().toISOString() });
        } else {
            let finalSystemPrompt = INTERNAL_SYSTEM_PROMPT;
            const recentHistoryForPrompt = ai.history.slice(-10).map(m => ({
                role: userProfiles.some(p => p.id === m.sender) ? 'user' : 'assistant',
                content: m.text || (m.type === 'emoji' ? `[发来表情]` : `[发来图片]`)
            }));
            finalSystemPrompt += `\n\n对话中你的身份设定是：${ai.prompt || '无'}`;
            finalSystemPrompt += `\n\n与你对话的用户名为“${currentUser.name}”，他的身份设定是：${currentUser.prompt || '无'}`;
            let payload = [{ role: 'system', content: finalSystemPrompt }, ...recentHistoryForPrompt];
            try {
                const endpoint = getEndpoint(config.url) + '/chat/completions';
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.key}` },
                    body: JSON.stringify({ model: config.model || 'gpt-3.5-turbo', messages: payload })
                });
                if (!res.ok) throw new Error(`API Error: ${res.status} ${await res.text()}`);
                const data = await res.json();
                let rawReply = data.choices[0].message.content;
                let thoughts = { heartVoice: null, badThoughts: null };
                const thoughtsMatch = rawReply.match(/THOUGHTS_JSON:({.*})/s);
                if (thoughtsMatch && thoughtsMatch[1]) {
                    try {
                        const parsedThoughts = JSON.parse(thoughtsMatch[1]);
                        thoughts.heartVoice = parsedThoughts.heartVoice || null;
                        thoughts.badThoughts = parsedThoughts.badThoughts || null;
                    } catch (e) { console.error("Failed to parse thoughts JSON:", e); }
                    rawReply = rawReply.replace(/THOUGHTS_JSON:({.*})/s, '').trim();
                }
                const splitReplies = rawReply.split('|||').map(s => s.trim()).filter(s => s.length > 0);
                for (let i = 0; i < splitReplies.length; i++) {
                    addMessage(currentChatId, {
                        sender: ai.id, text: splitReplies[i], type: 'text', timestamp: new Date().toISOString(),
                        heartVoice: (i === splitReplies.length - 1) ? thoughts.heartVoice : null,
                        badThoughts: (i === splitReplies.length - 1) ? thoughts.badThoughts : null,
                    });
                    if (splitReplies.length > 1 && i < splitReplies.length -1) {
                         renderMessages();
                         await new Promise(resolve => setTimeout(resolve, 800));
                    }
                }
            } catch (e) {
                alert('获取回复失败:\n' + e.message);
            }
        }
        renderMessages();
        btn.disabled = false;
        btn.innerText = '🌀';
    }
    
    function showCharacterThoughts() {
        const ai = aiList.find(c => c.id == currentChatId);
        if (!ai || !ai.history) return;
        const lastThoughtfulMessage = [...ai.history].reverse().find(
            msg => msg.sender === ai.id && (msg.heartVoice || msg.badThoughts)
        );
        document.getElementById('heart-voice-p').textContent = lastThoughtfulMessage?.heartVoice || '角色藏起了自己的心声...';
        document.getElementById('bad-thoughts-p').textContent = lastThoughtfulMessage?.badThoughts || '角色藏起了自己的坏心思...';
        document.getElementById('thoughts-modal').classList.add('active');
    }

    function closeThoughtsModal() {
        document.getElementById('thoughts-modal').classList.remove('active');
    }
    
    function openChatSettingsDrawer() {
        const ai = aiList.find(c => c.id == currentChatId);
        if (!ai) return;
        const userSelect = document.getElementById('chat-user-persona-select');
        userSelect.innerHTML = '';
        userProfiles.forEach(p => userSelect.appendChild(new Option(p.name, p.id)));
        userSelect.value = ai.userId;
        const chatWbSelect = document.getElementById('chat-wb-select');
        const offlineWbSelect = document.getElementById('offline-wb-select');
        chatWbSelect.innerHTML = '<option value="none">无</option>';
        offlineWbSelect.innerHTML = '<option value="none">无</option>';
        worldbooks.forEach(wb => {
            const optionText = `[${wb.category}] ${wb.name}`;
            chatWbSelect.appendChild(new Option(optionText, wb.id));
            offlineWbSelect.appendChild(new Option(optionText, wb.id));
        });
        chatWbSelect.value = ai.settings.chatWorldbookId || 'none';
        offlineWbSelect.value = ai.settings.offlineMode?.worldbookId || 'none';
        document.getElementById('time-perception-switch').checked = ai.settings.timePerception || false;
        const offlineEnabled = ai.settings.offlineMode?.enabled || false;
        document.getElementById('offline-mode-switch').checked = offlineEnabled;
        document.getElementById('offline-word-min').value = ai.settings.offlineMode?.wordCountMin || 500;
        document.getElementById('offline-word-max').value = ai.settings.offlineMode?.wordCountMax || 1500;
        toggleOfflineSettings(offlineEnabled);
        openDrawer('chat-settings-drawer');
    }
    
    function toggleOfflineSettings(isON) {
        document.getElementById('offline-settings-container').classList.toggle('visible', isON);
    }

    function saveChatSettings() {
        const ai = aiList.find(c => c.id == currentChatId);
        if (!ai) return;
        ai.userId = parseInt(document.getElementById('chat-user-persona-select').value);
        ai.settings.chatWorldbookId = document.getElementById('chat-wb-select').value;
        ai.settings.timePerception = document.getElementById('time-perception-switch').checked;
        if (!ai.settings.offlineMode) ai.settings.offlineMode = {};
        ai.settings.offlineMode.enabled = document.getElementById('offline-mode-switch').checked;
        ai.settings.offlineMode.wordCountMin = parseInt(document.getElementById('offline-word-min').value) || 500;
        ai.settings.offlineMode.wordCountMax = parseInt(document.getElementById('offline-word-max').value) || 1500;
        ai.settings.offlineMode.worldbookId = document.getElementById('offline-wb-select').value;
        setStorage('ai_list_v2', aiList);
        closeDrawer('chat-settings-drawer');
        showToast('聊天设置已保存');
        renderMessages();
    }
    
    function tryClearCurrentChat() {
        if (!currentChatId || !confirm('确定清空当前对话的所有记录吗？此操作不可撤销。')) return;
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
        const ai = aiList.find(c => c.id == currentChatId);
        const dataStr = JSON.stringify(ai.history, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_${ai.name}_${new Date().toISOString().slice(0, 10)}.json`;
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
                const ai = aiList.find(c => c.id == currentChatId);
                ai.history = newHistory;
                setStorage('ai_list_v2', aiList);
                renderMessages();
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
        const modal = document.getElementById('emoji-manager-modal');
        const charSelect = document.getElementById('emoji-char-select');
        charSelect.innerHTML = '<option value="all">所有角色通用</option>';
        aiList.forEach(char => {
            charSelect.add(new Option(char.name, char.id));
        });
        renderMyEmojis();
        switchEmojiTab('view');
        modal.classList.add('active');
    }

    function closeEmojiManager() {
        document.getElementById('emoji-manager-modal').classList.remove('active');
    }

    function switchEmojiTab(tabName) {
        ['view', 'add', 'bulk'].forEach(tab => {
            document.getElementById(`emoji-tab-${tab}`).classList.toggle('active', tab === tabName);
            document.getElementById(`emoji-${tab}-content`).style.display = tab === tabName ? 'block' : 'none';
        });
    }

    function saveEmoji() {
        const url = document.getElementById('emoji-url-input').value.trim();
        const category = document.getElementById('emoji-category-input').value.trim();
        const charId = document.getElementById('emoji-char-select').value;
        if (!url) return showToast('请输入表情链接！');
        const emojis = getStorage('emojis', []);
        emojis.push({ id: 'emoji_' + Date.now(), url, category: category || '默认', charId });
        setStorage('emojis', emojis);
        showToast('表情添加成功！');
        document.getElementById('emoji-url-input').value = '';
        document.getElementById('emoji-category-input').value = '';
        renderMyEmojis();
        switchEmojiTab('view');
    }

    function saveBulkEmojis() {
        const urls = document.getElementById('emoji-bulk-input').value.trim().split('\n');
        const emojis = getStorage('emojis', []);
        let count = 0;
        urls.forEach(url => {
            const trimmedUrl = url.trim();
            if (trimmedUrl) {
                emojis.push({ id: 'emoji_' + Date.now() + count, url: trimmedUrl, category: '批量导入', charId: 'all' });
                count++;
            }
        });
        if (count > 0) {
            setStorage('emojis', emojis);
            showToast(`成功批量导入 ${count} 个表情！`);
            document.getElementById('emoji-bulk-input').value = '';
            renderMyEmojis();
            switchEmojiTab('view');
        } else {
            showToast('未输入有效链接。');
        }
    }

    function renderMyEmojis() {
        const emojis = getStorage('emojis', []);
        const displayArea = document.getElementById('emoji-display-area');
        displayArea.innerHTML = emojis.length === 0 ? '<p>还没有添加任何表情包哦~</p>' : '';
        emojis.forEach(emoji => {
            const item = document.createElement('div');
            item.className = 'emoji-preview-item';
            item.innerHTML = `<img src="${emoji.url}" alt="表情" class="emoji-preview-img"><button class="emoji-delete-btn" onclick="window.deleteEmoji('${emoji.id}')">×</button>`;
            displayArea.appendChild(item);
        });
    }

    function deleteEmoji(emojiId) {
        let emojis = getStorage('emojis', []);
        emojis = emojis.filter(e => e.id !== emojiId);
        setStorage('emojis', emojis);
        renderMyEmojis();
    }

    function openT2IModal() {
        document.getElementById('text-to-image-modal').classList.add('active');
    }

    function closeT2IModal() {
        document.getElementById('text-to-image-modal').classList.remove('active');
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
        setTimeout(generateReply, 1000);
    }
    
    // 省略7, 8, 9, 10, 11, 12, 13大章节，因为它们在上面已经写过了，这里只是为了展示插入位置
    // ... (VII. WORLDBOOK, VIII. ANNIVERSARY, IX. CLOCK, X. CHAR MGMT, XI. APPEARANCE, XII. SETTINGS)
    // 这里的省略是为了代码简洁，实际替换时，上面那些章节都包含在内
    
    // =========================================================================
    // ---------------------- X. CHARACTER & USER MANAGEMENT -----------------------
    // =========================================================================

    function openAddCharacterModal() {
        document.getElementById('add-character-modal').classList.add('active');
    }
    
    function closeAddCharacterModal() {
        document.getElementById('add-character-modal').classList.remove('active');
    }

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
                    
                    const newChar = {
                        id: Date.now(),
                        name: charData.name || '导入的角色',
                        avatar: e.target.result, // Use the PNG itself as avatar
                        prompt: charData.description || '',
                        history: [],
                        userId: userProfiles[0]?.id,
                        settings: {
                            timePerception: false,
                            chatWorldbookId: 'none',
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
            <input type="text" class="neo-input entry-keyword" placeholder="条目名称 (关键词)" value="${escapeHTML(keyword)}">
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

            const li = document.createElement('li');
            li.className = 'anniversary-item-wrapper';
            li.innerHTML = `
                <div class="anniversary-item-actions">
                    <button class="edit-btn" onclick="openAnniversaryCreator(${item.id})">编辑</button>
                    <button class="delete-btn" onclick="deleteAnniversary(${item.id})">删除</button>
                </div>
                <div class="anniversary-item">
                    <span class="anniversary-title">${item.title}</span>
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

    function deleteAnniversary(id) {
        if (confirm('确定要删除这个纪念日吗？')) {
            anniversaryData = anniversaryData.filter(i => i.id !== id);
            saveAnniversaryData();
            renderAnniversaryList();
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


    // =========================================================================
    // ---------------------- X. CHARACTER & USER MANAGEMENT -----------------------
    // =========================================================================

    // --- 10.1. AI 角色管理 ---
    function openAiDrawer(isEdit = false) {
        tempAiAv = '';

        if (isEdit && currentChatId) {
            const ai = aiList.find(c => c.id == currentChatId);
            if (!ai) return;
            currentEditId = ai.id;
            document.getElementById('drawer-ai-title').innerText = '修改角色';
            document.getElementById('ai-name').value = ai.name;
            document.getElementById('ai-prompt').value = ai.prompt || '';
            document.getElementById('ai-avatar-preview').src = sanitizeAvatar(ai.avatar);
            document.getElementById('ai-avatar-preview').style.display = 'block';
            document.getElementById('ai-plus').style.display = 'none';
        } else {
            currentEditId = null;
            document.getElementById('drawer-ai-title').innerText = '新建角色';
            document.getElementById('ai-name').value = '';
            document.getElementById('ai-prompt').value = '';
            document.getElementById('ai-avatar-preview').style.display = 'none';
            document.getElementById('ai-plus').style.display = 'block';
        }
        closeDrawer('chat-settings-drawer');
        openDrawer('drawer-ai');
    }

    document.getElementById('ai-avatar-file').onchange = e => {
        if (e.target.files[0]) {
            const r = new FileReader();
            r.onload = ev => {
                tempAiAv = ev.target.result;
                document.getElementById('ai-avatar-preview').src = tempAiAv;
                document.getElementById('ai-avatar-preview').style.display = 'block';
                document.getElementById('ai-plus').style.display = 'none';
            };
            r.readAsDataURL(e.target.files[0]);
        }
    };

    function saveAiCharacter() {
        const name = document.getElementById('ai-name').value.trim();
        if (!name) return showToast('请输入角色名字');

        const prompt = document.getElementById('ai-prompt').value;
        const oldAv = currentEditId ? aiList.find(c => c.id == currentEditId).avatar : null;
        const finalAv = sanitizeAvatar(tempAiAv || oldAv || defaultAvatarSVG);

        if (currentEditId) {
            const ai = aiList.find(c => c.id == currentEditId);
            ai.name = name;
            ai.prompt = prompt;
            ai.avatar = finalAv;
        } else {
            aiList.unshift({
                id: Date.now(),
                name,
                avatar: finalAv,
                prompt,
                userId: userProfiles[0]?.id,
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
        if (currentChatId && currentChatId == currentEditId) document.getElementById('chat-title').innerText = name;
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
        const avatar = sanitizeAvatar(tempUserAv || (currentEditUserId ? userProfiles.find(p => p.id == currentEditUserId).avatar : defaultAvatarSVG));

        if (currentEditUserId) {
            const user = userProfiles.find(p => p.id == currentEditUserId);
            if (user) {
                user.name = name;
                user.prompt = prompt;
                user.avatar = avatar;
            }
        } else {
            userProfiles.push({ id: Date.now(), name, prompt, avatar });
        }
        setStorage('ai_users_list', userProfiles);
        closeDrawer('drawer-user');
        showToast('用户设定保存成功！');
        loadMomentsData(); // 刷新朋友圈自己的头像和信息
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
                setStorage('ai_beautify_config_v2', beautifyConfig);
                showToast('本地主屏壁纸保存成功！');
                tempWpData = '';
                document.getElementById('wp-file').value = '';
            } else if (wpUrl) {
                beautifyConfig.wpUrl = wpUrl;
                beautifyConfig.wpData = '';
                mainScreen.style.backgroundImage = `url(${wpUrl})`;
                setStorage('ai_beautify_config_v2', beautifyConfig);
                showToast('网络主屏壁纸保存成功！');
            } else {
                showToast('请填写链接或选择图片');
            }
        } catch (e) {
            showToast('保存失败: 图片可能过大');
        }
    }

    function resetWallpaper() {
        beautifyConfig.wpData = '';
        beautifyConfig.wpUrl = '';
        document.getElementById('wp-url').value = '';
        document.getElementById('wp-file').value = '';
        tempWpData = '';
        document.getElementById('main-screen').style.backgroundImage = 'linear-gradient(135deg, #2b1055, #7597de)';
        setStorage('ai_beautify_config_v2', beautifyConfig);
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
            } else {
                showToast('请填写链接或选择图片');
            }
        } catch (e) {
            showToast('保存失败: 图片可能过大');
        }
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

    // --- 11.4. 图标设置 ---
    function applyAppIcons() {
        const icons = beautifyConfig.icons || {};
        appIconIds.forEach(id => {
            const iconEl = document.getElementById(`icon-${id}`);
            const url = icons[id];
            if (iconEl) {
                const svg = iconEl.querySelector('svg');
                if (url) {
                    iconEl.style.backgroundImage = `url(${url})`;
                    if (svg) svg.style.display = 'none';
                } else {
                    iconEl.style.backgroundImage = '';
                    if (svg) svg.style.display = 'block';
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
        config = {
            url: document.getElementById('api-url').value.trim(),
            key: document.getElementById('api-key').value.trim(),
            model: document.getElementById('api-model').value.trim()
        };
        setStorage('ai_phone_config', config);
        showToast('API 已保存');
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
        let userList = getStorage('ai_users_list', []);
        let currentAiList = getStorage('ai_list_v2', []); // 使用局部变量
        let hasChanges = false;

        userList.forEach(u => {
            const newAv = sanitizeAvatar(u.avatar);
            if (newAv !== u.avatar) {
                u.avatar = newAv;
                hasChanges = true;
            }
        });

        currentAiList.forEach(ai => {
            const newAv = sanitizeAvatar(ai.avatar);
            if (newAv !== ai.avatar) {
                ai.avatar = newAv;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            setStorage('ai_users_list', userList);
            setStorage('ai_list_v2', currentAiList);
            if (!silent) showToast('已成功修复所有损坏的头像数据');
            else console.log('Auto-cleaned invalid avatar data.');
        } else {
            if (!silent) showToast('未发现异常数据，无需修复');
        }
    }
    
    // =========================================================================
    // -------------------- XIII. GLOBAL FUNCTION EXPOSURE ---------------------
    // =========================================================================
    // 将所有 onclick 等HTML调用的函数暴露到 window 对象
      window.openAddCharacterModal = openAddCharacterModal;
    window.closeAddCharacterModal = closeAddCharacterModal;
    window.saveBulkEmojis = saveBulkEmojis;
    window.addMomentComment = addMomentComment;

    window.openPage = openPage;
    window.closePage = closePage;
    window.openDrawer = openDrawer;
    window.closeDrawer = closeDrawer;
    window.showToast = showToast;

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
    window.sendOnly = sendOnly;
    window.generateReply = generateReply;
    window.toggleOfflineSettings = toggleOfflineSettings;
    window.saveChatSettings = saveChatSettings;
    window.exportCurrentChat = exportCurrentChat;
    window.importCurrentChat = importCurrentChat;
    window.tryClearCurrentChat = tryClearCurrentChat;
    window.closeThoughtsModal = closeThoughtsModal;
    window.toggleToolbar = toggleToolbar;

    // --- 新功能：表情包 & T2I ---
    window.openEmojiManager = openEmojiManager;
    window.closeEmojiManager = closeEmojiManager;
    window.switchEmojiTab = switchEmojiTab;
    window.saveEmoji = saveEmoji;
    window.deleteEmoji = deleteEmoji;
    window.openT2IModal = openT2IModal;
    window.closeT2IModal = closeT2IModal;
    window.sendDescribedImage = sendDescribedImage;

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
    window.addForumComment = addForumComment;
    window.generateEngagement = generateEngagement;

    // --- 世界书 App ---
    window.openWorldbookPage = () => openPage('worldbook-page');
    window.openWbDrawer = openWbDrawer;
    window.addWbEntryForm = addWbEntryForm;
    window.saveWb = saveWb;
    window.deleteWb = deleteWb;

    // --- 纪念日 App ---
    window.openAnniversaryCreator = openAnniversaryCreator;
    window.saveAnniversary = saveAnniversary;
    window.deleteAnniversary = deleteAnniversary;

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

    // --- 通用设置 ---
    window.saveApiConfig = saveApiConfig;
    window.fetchModels = fetchModels;
    window.testConnection = testConnection;
    window.closeModelPicker = closeModelPicker;
    window.cleanAllBadData = cleanAllBadData;
    window.backupAllData = backupAllData;
    function switchForumTab(tabName) {
    const isPosts = tabName === 'posts';
    document.getElementById('forum-tab-posts').style.display = isPosts ? 'flex' : 'none';
    document.getElementById('forum-tab-personal').style.display = isPosts ? 'none' : 'flex';
    document.getElementById('forum-nav-posts').classList.toggle('active', isPosts);
    document.getElementById('forum-nav-personal').classList.toggle('active', !isPosts);
    document.getElementById('forum-title').innerText = isPosts ? '帖子' : '个人';
    document.querySelector('.floating-action-button').style.display = isPosts ? 'flex' : 'none';
}

function findAuthor(name) {
    const allUsers = [...userProfiles, ...aiList];
    return allUsers.find(u => u.name === name) || { name: name, avatar: DEFAULT_USER_AVATAR_URL };
}

function renderForumFeed() {
    const feedContainer = document.getElementById('forum-tab-posts');
    feedContainer.innerHTML = '';
    if (forumData.posts.length === 0) {
        feedContainer.innerHTML = `<div style="text-align:center; padding:50px; color: #aaa; font-size: 14px;">这里空空如也~<br>点击右上方 '+' 智能生成一些帖子吧！</div>`;
        return;
    }

    forumData.posts.forEach(post => {
        const author = findAuthor(post.authorName);
        const postElement = document.createElement('div');
        postElement.className = 'forum-post-item';

        const commentsHTML = (post.comments || []).map(comment => {
            const cAuthor = findAuthor(comment.authorName);
            return `<div class="forum-comment-item"><span class="forum-comment-author">${escapeHTML(cAuthor.name)}:</span> ${escapeHTML(comment.text)}</div>`;
        }).join('');

        postElement.innerHTML = `
            <div class="forum-post-author">
                <img src="${sanitizeAvatar(author.avatar)}" class="forum-author-avatar">
                <span class="forum-author-name">${escapeHTML(author.name)}</span>
            </div>
            <div class="forum-post-text">${escapeHTML(post.text)}</div>
            <div class="forum-post-stats">
                <span class="stat-item" onclick="likeForumPost(${post.id})">👍 ${post.stats.likes}</span>
                <span class="stat-item">💬 ${post.stats.comments}</span>
                <span class="stat-item">🔁 ${post.stats.shares}</span>
            </div>
            ${(post.comments && post.comments.length > 0) ? `<div class="forum-comment-section">${commentsHTML}</div>` : ''}
            <div class="forum-comment-form">
                <input type="text" class="forum-comment-input" placeholder="发表你的看法..." onkeydown="if(event.key==='Enter') addForumComment(${post.id}, this)">
            </div>
        `;
        feedContainer.appendChild(postElement);
    });
}

async function generateForumPosts() {
    const theme = document.getElementById('forum-theme-input').value.trim();
    if (!theme) return showToast('请输入主题！');
    if (!config.key || !config.url) return showToast('请先配置API！');
    
    closeForumGeneratorModal();
    showToast('正在生成帖子，请稍候...');

    const friendNames = [...userProfiles.map(u => u.name), ...aiList.map(a => a.name)];
    const prompt = `请你模拟一个社交论坛。围绕主题“${theme}”，生成一个包含3到4个帖子的JSON数组。
    每个帖子对象必须包含以下字段:
    - "authorName": 从以下列表中随机选择一个名字: [${friendNames.join(', ')}, "路人甲", "游客小张", "隔壁的王同学"].
    - "postText": 符合作者身份和主题的帖子内容，50-100字。
    - "stats": 一个包含 "likes", "comments", "shares" 字段的对象，数值为0到100的随机整数。
    
    严格按照JSON格式返回，不要包含任何额外解释。示例:
    {
      "posts": [
        { "authorName": "派蒙", "postText": "今天天气好好，想去摘落落莓！", "stats": { "likes": 23, "comments": 5, "shares": 2 } }
      ]
    }`;

    try {
        let rawResponse = await getCompletion(prompt, true);
        
        // --- 新增的健壮性处理 ---
        // 寻找第一个 '{' 和最后一个 '}' 来提取核心JSON字符串
        const startIndex = rawResponse.indexOf('{');
        const endIndex = rawResponse.lastIndexOf('}');
        
        if (startIndex === -1 || endIndex === -1) {
            console.error("AI返回内容中未找到有效的JSON结构:", rawResponse);
            throw new Error('AI返回内容中未找到有效的JSON结构。');
        }
        
        const jsonString = rawResponse.substring(startIndex, endIndex + 1);
        // --- 健壮性处理结束 ---

        const result = JSON.parse(jsonString); // 解析净化后的字符串
        if (result.posts && Array.isArray(result.posts)) {
            const newPosts = result.posts.map(p => ({
                id: Date.now() + Math.random(),
                comments: [], // 初始化评论区
                ...p
            }));
            forumData.posts.unshift(...newPosts);
            setStorage('forum_data', forumData);
            renderForumFeed();
            showToast('新帖子已生成！');
        } else { throw new Error('返回的JSON格式不正确。'); }
    } catch (e) {
          }
}

async function generateEngagement() {
    const myPosts = forumData.posts.filter(p => p.authorName === userProfiles[0].name);
    if (myPosts.length === 0) return showToast('你还没发过帖子，快去发一个吧！');
    
    closeForumActionModal();
    showToast('正在模拟社区互动...');

    const randomPost = myPosts[Math.floor(Math.random() * myPosts.length)];
    const friendNames = aiList.map(a => a.name);
    
    const prompt = `你是社交网络上的一个活跃用户。用户“${userProfiles[0].name}”发了一条动态：“${randomPost.text}”。
    请你模拟一次互动，随机选择以下一种行为：
    1. 点赞。
    2. 发表一条评论。
    
    请返回一个JSON对象，包含 "action" 和 "authorName" 字段。
    - "action": 值为 "like" 或 "comment"。
    - "authorName": 从朋友列表 [${friendNames.join(', ')}] 中随机选一个作为互动发起者。
    如果 action 是 "comment"，还需要一个 "commentText" 字段，内容是15字内的简短评论。
    
    严格按照JSON格式返回。示例: {"action": "comment", "authorName": "派蒙", "commentText": "这个太有意思了！"} 或 {"action": "like", "authorName": "钟离"}`;

    try {
        let rawResponse = await getCompletion(prompt, true);

        // --- 新增的健壮性处理 ---
        const startIndex = rawResponse.indexOf('{');
        const endIndex = rawResponse.lastIndexOf('}');
        
        if (startIndex === -1 || endIndex === -1) {
            console.error("AI返回内容中未找到有效的JSON结构:", rawResponse);
            throw new Error('AI返回内容中未找到有效的JSON结构。');
        }
        
        const jsonString = rawResponse.substring(startIndex, endIndex + 1);
        // --- 健壮性处理结束 ---

        const interaction = JSON.parse(jsonString);
        const postToUpdate = forumData.posts.find(p => p.id === randomPost.id);
        if (!postToUpdate) return;
        
        const interactor = findAuthor(interaction.authorName);

        if (interaction.action === 'like') {
            postToUpdate.stats.likes++;
            showToast(`${interactor.name} 点赞了你的帖子！`);
        } else if (interaction.action === 'comment' && interaction.commentText) {
            if(!postToUpdate.comments) postToUpdate.comments = [];
            postToUpdate.comments.push({ authorName: interactor.name, text: interaction.commentText });
            postToUpdate.stats.comments++;
            showToast(`${interactor.name} 评论了你的帖子！`);
        }
        setStorage('forum_data', forumData);
        renderForumFeed();
    } catch(e) {
        showToast('模拟互动失败: ' + e.message);
    }
}  showToast('生成失败: ' + e.message);
        console.error(e);


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
    
    const newPost = {
        id: Date.now(),
        authorName: userProfiles[0].name,
        text,
        stats: { likes: 0, comments: 0, shares: 0 },
        comments: []
    };
    
    forumData.posts.unshift(newPost);
    setStorage('forum_data', forumData);
    renderForumFeed();
    closeForumPostCreator();
    showToast('发布成功！');
}

function likeForumPost(postId) {
    const post = forumData.posts.find(p => p.id === postId);
    if (post) {
        post.stats.likes++;
        setStorage('forum_data', forumData);
        renderForumFeed();
    }
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
    }
}

function openForumActionModal() { openDrawer('forum-action-modal'); }
function closeForumActionModal() { closeDrawer('forum-action-modal'); }
function openForumGeneratorModal() { closeForumActionModal(); openDrawer('forum-generator-modal'); }
function closeForumGeneratorModal() { closeDrawer('forum-generator-modal'); }

})();
const tetris = (function() {
    const canvas = document.getElementById('tetris-canvas');
    const context = canvas.getContext('2d');
    const nextCanvas = document.getElementById('tetris-next-canvas');
    const nextContext = nextCanvas.getContext('2d');
    const scoreElement = document.getElementById('tetris-score');

    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE = 20;

    context.scale(BLOCK_SIZE, BLOCK_SIZE);
    nextContext.scale(BLOCK_SIZE, BLOCK_SIZE);

    let board = createBoard(ROWS, COLS);
    let player;
    let score = 0;
    let gameOver = false;
    let animationFrameId;

    const SHAPES = [
        [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]], // I
        [[2,2], [2,2]], // O
        [[0,3,0], [3,3,3], [0,0,0]], // T
        [[0,4,4], [4,4,0], [0,0,0]], // S
        [[5,5,0], [0,5,5], [0,0,0]], // Z
        [[6,0,0], [6,6,6], [0,0,0]], // L
        [[0,0,7], [7,7,7], [0,0,0]]  // J
    ];
    const COLORS = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'];

    function createBoard(rows, cols) {
        return Array.from({ length: rows }, () => Array(cols).fill(0));
    }

    function createPiece(type) {
        if (type === 'T') return [[0,3,0],[3,3,3],[0,0,0]];
        if (type === 'O') return [[2,2],[2,2]];
        if (type === 'L') return [[6,0,0],[6,6,6],[0,0,0]];
        if (type === 'J') return [[0,0,7],[7,7,7],[0,0,0]];
        if (type === 'I') return [[0,0,0,0],[1,1,1,1],[0,0,0,0]];
        if (type === 'S') return [[0,4,4],[4,4,0],[0,0,0]];
        if (type === 'Z') return [[5,5,0],[0,5,5],[0,0,0]];
    }

    function playerReset() {
        const pieces = 'IOTSZLJ';
        const randPiece = pieces[Math.floor(Math.random() * pieces.length)];
        if (!player || !player.nextMatrix) {
            player = {
                pos: { x: 0, y: 0 },
                matrix: createPiece(randPiece),
                nextMatrix: createPiece(pieces[Math.floor(Math.random() * pieces.length)])
            };
        } else {
            player.matrix = player.nextMatrix;
            player.nextMatrix = createPiece(randPiece);
        }
        player.pos.y = 0;
        player.pos.x = (Math.floor(COLS / 2)) - (Math.floor(player.matrix[0].length / 2));
        if (collide(board, player)) {
            gameOver = true;
        }
    }
    
    function drawMatrix(matrix, offset, ctx) {
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    ctx.fillStyle = COLORS[value];
                    ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
                }
            });
        });
    }

    function draw() {
        context.fillStyle = '#222';
        context.fillRect(0, 0, canvas.width, canvas.height);
        drawMatrix(board, {x: 0, y: 0}, context);
        drawMatrix(player.matrix, player.pos, context);
        
        nextContext.fillStyle = '#222';
        nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
        drawMatrix(player.nextMatrix, {x:1, y:1}, nextContext);
    }
    
    function collide(board, player) {
        const [m, o] = [player.matrix, player.pos];
        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < m[y].length; ++x) {
                if (m[y][x] !== 0 && (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
                    return true;
                }
            }
        }
        return false;
    }
    
    function merge(board, player) {
        player.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    board[y + player.pos.y][x + player.pos.x] = value;
                }
            });
        });
    }
    
    function rotate(matrix, dir) {
        for (let y = 0; y < matrix.length; ++y) {
            for (let x = 0; x < y; ++x) {
                [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
            }
        }
        if (dir > 0) {
            matrix.forEach(row => row.reverse());
        } else {
            matrix.reverse();
        }
    }

    function playerRotate(dir) {
        const pos = player.pos.x;
        let offset = 1;
        rotate(player.matrix, dir);
        while (collide(board, player)) {
            player.pos.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (offset > player.matrix[0].length) {
                rotate(player.matrix, -dir);
                player.pos.x = pos;
                return;
            }
        }
    }

    let dropCounter = 0;
    let dropInterval = 1000;
    let lastTime = 0;

    function update(time = 0) {
        if (gameOver) {
            context.fillStyle = 'rgba(0,0,0,0.7)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.font = '2px "Helvetica Neue"';
            context.fillStyle = 'white';
            context.textAlign = 'center';
            context.fillText('游戏结束', COLS / 2, ROWS / 2);
            cancelAnimationFrame(animationFrameId);
            return;
        }

        const deltaTime = time - lastTime;
        lastTime = time;
        dropCounter += deltaTime;

        if (dropCounter > dropInterval) {
            playerDrop();
        }

        draw();
        animationFrameId = requestAnimationFrame(update);
    }
    
    function playerDrop() {
        player.pos.y++;
        if (collide(board, player)) {
            player.pos.y--;
            merge(board, player);
            playerReset();
            sweep();
            updateScore();
        }
        dropCounter = 0;
    }
    
    function playerMove(dir) {
        player.pos.x += dir;
        if (collide(board, player)) {
            player.pos.x -= dir;
        }
    }
    
    function sweep() {
        let rowCount = 1;
        outer: for (let y = board.length - 1; y > 0; --y) {
            for (let x = 0; x < board[y].length; ++x) {
                if (board[y][x] === 0) continue outer;
            }
            const row = board.splice(y, 1)[0].fill(0);
            board.unshift(row);
            ++y;
            score += rowCount * 10;
            rowCount *= 2;
        }
    }
    
    function updateScore() {
        scoreElement.innerText = score;
    }

    document.addEventListener('keydown', event => {
        if(document.getElementById('tetris-game-page').classList.contains('active')) {
            if (event.key === 'ArrowLeft') playerMove(-1);
            else if (event.key === 'ArrowRight') playerMove(1);
            else if (event.key === 'ArrowDown') playerDrop();
            else if (event.key === 'q' || event.key === 'w') playerRotate(-1);
            else if (event.key === 'e') playerRotate(1);
        }
    });

    function restart() {
        if(animationFrameId) cancelAnimationFrame(animationFrameId);
        board = createBoard(ROWS, COLS);
        score = 0;
        gameOver = false;
        updateScore();
        playerReset();
        update();
    }
    
    function exit() {
        if(animationFrameId) cancelAnimationFrame(animationFrameId);
        closePage('tetris-game-page');
    }
    
    // 监听页面打开事件
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.attributeName === 'class' && mutation.target.id === 'tetris-game-page') {
                const isActive = mutation.target.classList.contains('active');
                if (isActive) restart(); // 页面打开时自动开始/重开
                else if (animationFrameId) cancelAnimationFrame(animationFrameId);
            }
        });
    });
    observer.observe(document.getElementById('tetris-game-page'), { attributes: true });


    return {
        restart,
        exit,
        rotate: () => playerRotate(1),
        moveLeft: () => playerMove(-1),
        moveRight: () => playerMove(1),
        drop: playerDrop
    };
})();

// 将游戏控制函数暴露到全局
