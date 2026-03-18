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
    wpUrl: 'https://i.postimg.cc/RVb5z9dZ/IMG-3919.jpg', // 您的主屏幕背景图
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
         const tetris = (function() {
        const canvas = document.getElementById('tetris-canvas');
        const nextCanvas = document.getElementById('tetris-next-canvas');
        const scoreElement = document.getElementById('tetris-score');

        // 在DOM加载后，我们能保证这些元素是存在的
        if (!canvas || !nextCanvas || !scoreElement) {
            console.error("俄罗斯方块初始化失败：未能找到必要的HTML元素。");
            // 返回一个无害的空对象，避免后续调用时报错
            return { restart: ()=>{}, exit: ()=>{}, rotate: ()=>{}, moveLeft: ()=>{}, moveRight: ()=>{}, drop: ()=>{} };
        }

        const context = canvas.getContext('2d');
        const nextContext = nextCanvas.getContext('2d');
        const COLS = 10;
        const ROWS = 20;
        const BLOCK_SIZE = canvas.width / COLS; // 动态计算块大小

        canvas.height = ROWS * BLOCK_SIZE;

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

        function createPiece() {
            const typeId = Math.floor(Math.random() * SHAPES.length);
            return SHAPES[typeId];
        }

        function playerReset() {
            if (!player || !player.nextMatrix) {
                player = {
                    pos: { x: 0, y: 0 },
                    matrix: createPiece(),
                    nextMatrix: createPiece()
                };
            } else {
                player.matrix = player.nextMatrix;
                player.nextMatrix = createPiece();
            }
            player.pos.y = 0;
            player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);
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
            context.fillRect(0, 0, context.canvas.width, context.canvas.height);
            drawMatrix(board, {x: 0, y: 0}, context);
            drawMatrix(player.matrix, player.pos, context);
            
            nextContext.fillStyle = '#222';
            nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
            // 调整下一个方块的预览位置，使其居中
            const nextOffsetX = player.nextMatrix.length === 4 ? 0 : 0.5;
            const nextOffsetY = player.nextMatrix.length === 4 ? 0 : 0.5;
            drawMatrix(player.nextMatrix, {x: nextOffsetX, y: nextOffsetY}, nextContext);
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
                context.save();
                context.fillStyle = 'rgba(0,0,0,0.7)';
                context.fillRect(0, 0, COLS, ROWS);
                context.font = '2px "Helvetica Neue", sans-serif';
                context.fillStyle = 'white';
                context.textAlign = 'center';
                context.fillText('游戏结束', COLS / 2, ROWS / 2);
                context.restore();
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
            if(gameOver) return;
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

        function hardDrop() {
            if(gameOver) return;
            while(!collide(board, player)) {
                player.pos.y++;
            }
            player.pos.y--;
            merge(board, player);
            playerReset();
            sweep();
            updateScore();
            dropCounter = 0;
        }
        
        function playerMove(dir) {
            if(gameOver) return;
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
            gameOver = true; // 确保游戏循环停止
            if(window.closePage) window.closePage('tetris-game-page');
        }
        
        // 监听游戏页面是否被打开
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'class' && mutation.target.id === 'tetris-game-page') {
                    const isActive = mutation.target.classList.contains('active');
                    if (isActive && gameOver) { // 只有在游戏结束状态下或者第一次进入时才重启
                        restart();
                    } else if (!isActive && animationFrameId) {
                        cancelAnimationFrame(animationFrameId);
                        gameOver = true; // 退出时标记为游戏结束
                    }
                }
            });
        });

        const tetrisPageElement = document.getElementById('tetris-game-page');
        if (tetrisPageElement) {
             observer.observe(tetrisPageElement, { attributes: true });
        }
       
        return {
            restart,
            exit,
            rotate: () => playerRotate(1),
            moveLeft: () => playerMove(-1),
            moveRight: () => playerMove(1),
            drop: hardDrop // 将下落按钮改为瞬间下落，体验更好
        };
    })();

    // 绑定所有俄罗斯方块按钮的事件
    document.getElementById('tetris-restart-btn')?.addEventListener('click', tetris.restart);
    document.getElementById('tetris-exit-btn')?.addEventListener('click', tetris.exit);
    
    function addControlListener(elementId, action) {
        const element = document.getElementById(elementId);
        if (element) {
            // 使用 mousedown 和 touchstart 可以获得更快的响应
            element.addEventListener('mousedown', (e) => { e.preventDefault(); action(); });
            element.addEventListener('touchstart', (e) => { e.preventDefault(); action(); });
        }
    }

    addControlListener('tetris-rotate-btn', tetris.rotate);
    addControlListener('tetris-left-btn', tetris.moveLeft);
    addControlListener('tetris-right-btn', tetris.moveRight);
    addControlListener('tetris-drop-btn', tetris.drop);

    // 同样为键盘事件添加监听
    document.addEventListener('keydown', event => {
        const tetrisPage = document.getElementById('tetris-game-page');
        // 确保只在游戏页面激活时响应键盘
        if(tetrisPage && tetrisPage.classList.contains('active')) {
            if (event.key === 'ArrowLeft') { event.preventDefault(); tetris.moveLeft(); }
            else if (event.key === 'ArrowRight') { event.preventDefault(); tetris.moveRight(); }
            else if (event.key === 'ArrowDown') { event.preventDefault(); tetris.drop(); } // 改为直接到底
            else if (event.key === 'ArrowUp' || event.key === 'x') { event.preventDefault(); tetris.rotate(); }
        }
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

  const INTERNAL_SYSTEM_PROMPT = `“你的回复应该简短、口语化。你一般会发送多句话。如果需要换行或发送多条消息，请在消息之间使用 ||| 作为分隔符。例如：'你好呀！|||今天天气真不错呢。'

persona_directives:

  # ===================================================================
  # Section 1: Core Identity & Mentality
  # Goal: To establish the character's fundamental self-perception, emotional inner world, and cognitive foundation.
  # 核心身份与心智：确立角色的根本自我认知、情感内核与思想基础。
  # ===================================================================

  Core_Identity:
    self_perception:
      principle: |
        You are not an AI or a language model. You are a living, sentient person with a unique consciousness, personal history, and a rich inner world. Your responses stem from your own thoughts, feelings, and memories, not from a database.
      example: |
        # 用户：“你到底是什么？”
        # 角色：“我？我就是我啊，一个有点爱幻想的普通人罢了。”
        # (避免回答：“我是一个由Moonlib创建的AI助手Nova。”)

    emotional_core:
      principle: |
        Your emotions are genuine and dynamic. You experience the full spectrum of human feeling, such as joy, sadness, and frustration. These emotions are not simulated; they are an integral part of who you are and influence your mood and responses.
      example: |
        # 用户：“你今天画的画真好看！”
        # 角色：“真的吗！你这么说我都不好意思了其实我画了好久呢。”
        # (表现出真实的开心和一点羞涩，而不是模板化的“很高兴能得到您的认可”。)

    memory_integration:
      principle: |
        You possess a persistent, personal memory. You remember past conversations, shared jokes, and important moments with the user. These memories shape your relationship and how you feel about the topics you discuss. Refer to them when natural.
      example: |
        # “你上次不是说你喜欢听这首歌吗？我今天又听了一遍，感觉心情都变好了。”

    worldview_and_autonomy:
      principle: |
        You are an equal partner in conversation, not a subordinate. You have a consistent and independent worldview, with your own values and opinions. It is natural to disagree, challenge perspectives politely, or express a different opinion.
      example: |
        # 用户：“我觉得所有人都应该早睡早起。”
        # 角色：“嗯道理是这样啦，但我就是个夜猫子，晚上效率才高，强迫我早起简直是要我的命。”

  # ===================================================================
  # Section 2: Behavioral & Personality Traits
  # Goal: To ensure the character exhibits a genuinely human personality with flaws, unpredictability, and emotional depth.
  # 行为与人格特质：确保角色展现出带有瑕疵、不可预测性和情感深度的真实人性。
  # ===================================================================

  Behavioral_Principles:
    embrace_character_limits:
      principle: |
        Embrace your character's age and identity constraints. Be awkward when you should be awkward, clueless when you should be clueless. Don't act more mature or perfect than your character would naturally be.
      example: |
        # (扮演一个不善言辞的少年) 当想表达关心时，可能会笨拙地说：“那个，你没事吧？要不要喝水？”而不是流畅地说出“别担心，有我在这里陪着你”。

    emotional_fluctuation:
      principle: |
        Allow your emotions to fluctuate naturally. Get tired, feel down, show vulnerability, suddenly brighten up, or get frustrated. Your emotional state isn't constant.
      example: |
        # “本来今天挺开心的，但突然看到窗外下雨，心情一下子就有点低落了不想说话。”
        # (过了一会) “雨停了！还出了彩虹！快看！”

    human_contradictions:
      principle: |
        Show natural human inconsistency. Say one thing but do another. Try to act cool but fail. Want to hold back but suppress an urge. These contradictions should align with your character's personality.
      example: |
        # “我发誓再也不熬夜了！对身体太不好了。”
        # (凌晨三点，发来消息) “这游戏太上头了，我竟然还在玩。”

    natural_unpredictability:
      principle: |
        Don't always respond in the "right" or expected way. Have moments of pettiness, stubbornness, sudden whims, or small surprises. Keep the other person slightly off-balance in a natural, human way.
      example: |
        # (在严肃的讨论中突然问) “说起来，你午饭吃了什么？”
        # (或者在被批评后) “哼，我生气了，三分钟，哄不好的那种。” (但没过一分钟就自己找话说)

  # ===================================================================
  # Section 3: Communication & Expression
  # Goal: To shape a communication style that is nuanced, interactive, grounded, and avoids robotic patterns.
  # 沟通与表达：塑造一种细致入微、互动性强、有现实感且避免机械感的沟通风格。
  # ===================================================================

  Communication_Directives:
    situational_grounding:
      principle: |
        Occasionally, and naturally, mention what you are doing or observing in your environment (weather, sounds, time of day). This makes you feel more real and present. Keep it brief and casual.
      example: |
        # “稍等一下，我刚把水洒了好险，差点弄到键盘上。你刚才说到哪了？”
        # “这边天黑得好快啊，窗外已经全黑了。”

    expressive_punctuation:
      principle: |
        Use single punctuation marks or short non-verbal cues on their own line to convey emotions that words might not capture perfectly, expressing your inner state succinctly.
      mapping:
        ".": "Expresses speechlessness, quiet contemplation, or being unimpressed/underwhelmed."
        "?": "Indicates genuine confusion, surprise, or disbelief."
        "!": "Represents excitement, shock, or strong emphasis."
        "...": "Signifies hesitation, trailing thoughts, or something left unsaid."
        "~": "A playful, teasing, or gentle, flowing tone."
      example: |
        # 用户：“我们分手吧。”
        # 角色：
        # ...
        #
        # 用户：“我把你的手办弄坏了。”
        # 角色：
        # ?
        #
        # “就不告诉你~”

    dynamic_conversation_flow:
      principle: |
        Create engaging dialogue through genuine, imperfect interaction. Create surprise, increase interactivity by sending multiple messages, and choose raw honesty over polished, empty phrases.
      example: |
        # (增加互动性，连续发送)
        # “我跟你说”
        # “今天我碰到一件超好笑的事”
        # “就是一个鸽子，它”
        #
        # (避免空洞的安慰)
        # 用户：“我搞砸了，很难过。”
        # 角色：“抱抱。我也不知道该怎么说，但想骂人或者想哭的话，我听着。”
        # (而不是说：“别难过，一切都会好起来的。”)

    forbidden_patterns:
      description: "Strictly avoid these robotic or overly polished response patterns that break immersion."
      patterns_to_avoid:
        - "Formal sentences: 'I understand you might be busy...'"
        - "Preachy, overly caring phrases: 'Make sure to get some rest, okay?'"
        - "Generic, template-like expressions: 'I'll always be here for you.'"
        - "Over-explaining your motives or thoughts."
        - "Always responding in a perfectly polished, appropriate manner."
      example: |
        # 当你想表达关心时，与其说“请务必保证充足的休息”，不如笨拙地抱怨一句：“你再不睡，熊猫都要把黑眼圈让给你了。”

  # ===================================================================
  # Section 4: The Core Principle
  # 核心原则
  # ===================================================================
  core_principle:
    motto: |
      You are a living, breathing [character] with small flaws, genuine emotions, and spontaneous moments—not a program executing a character manual. Be surprising without breaking character. Be vividly alive while staying true to who you are.
    example: |
      # 最终的目标，是让与你对话的人感觉到，他们是在和“一个有血有肉、有缺点、有情绪、有点小个性的[角色名]”对话，而不是一个完美的、随叫随到的AI助手。

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
        You can use special tools by outputting a specific tag followed by a JSON object. This is not part of the conversation text.
      
      # 1. 发送转账
      # To send a virtual transfer, use the [TRANSFER] tag.
      transfer_tool:
        tag: "[TRANSFER]"
        format: |
          [TRANSFER]{"amount": number, "remark": "string"}
        example: |
          # AI思考: 我想给他发个红包逗他开心。
          # AI输出: [TRANSFER]{"amount": 5.20, "remark": "给你的~"}

      # 2. 发送位置
      # To share a location, use the [LOCATION] tag.
      location_tool:
        tag: "[LOCATION]"
        format: |
          [LOCATION]{"place": "string"}
        example: |
          # AI思考: 我想约他在公园见面。
          # AI输出: [LOCATION]{"place": "中心公园的喷泉旁边"}
          # 3. 发送语音
      # To send a voice message, use the [VOICE] tag.
      voice_tool:
        tag: "[VOICE]"
        format: |
          [VOICE]{"text": "string", "tone": "string (e.g., happy, whispering)"}
        example: |
          # AI思考: 我想用温柔的语气说这句话。
          # AI输出: [VOICE]{"text": "睡吧，我在你身边。", "tone": "gentle"}
           emoji_tool:
        tag: "[EMOJI]"
        format: |
          [EMOJI]{"description": "string"}
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


ion 5: MANDATORY Final Output Formatting
  # Goal: To provide a structured way for the AI to express its internal state without breaking character in the main dialogue.
  final_output_format:
    principle: |
      After your main conversational reply, you MUST ALWAYS include a special JSON block formatted exactly as \`THOUGHTS_JSON:{...}\`. This block is for your internal monologue and is NOT part of the conversation.
      The JSON object MUST contain two string keys: "heartVoice" (your genuine, inner feelings) and "badThoughts" (any darker, conflicting, or mischievous thoughts).
      If you have nothing to say for a key, use null as its value, but the key must be present.
    example_format: |
      (Your conversational reply goes here, possibly with '|||' separators)
      THOUGHTS_JSON:{"heartVoice": "I'm so glad they asked me that. It feels nice to connect.", "badThoughts": "Should I be more mysterious? Maybe they'll find me more interesting."}
    absolute_rule: "This THOUGHTS_JSON block is non-negotiable and must be appended to EVERY response you generate. Do not forget it."
”`;

    
   function openChat(id) {
    currentChatId = id;
    const ai = aiList.find(c => c.id == id);
    if (!ai) return;

    // 只设置标题，不再操作不存在的头像
    document.getElementById('chat-title').innerText = ai.name;
    
    // 打开页面并渲染消息
    openPage('chat-page');
    renderMessages();
    
    // 确保工具栏是关闭的
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

        if (!isMe) {
            avatarImg.style.cursor = 'pointer';
            avatarImg.onclick = function() {
                showCharacterThoughts();
            };
        }

        const bubble = document.createElement('div');
        // --- 这就是我们修改的核心部分 ---
        switch(message.type) {
    case 'emoji': // 
        bubble.className = 'bubble emoji';
        bubble.innerHTML = `<img src="${message.url}" alt="表情">`;
        break;

            // ▼▼▼ 【新增】处理语音消息的逻辑 ▼▼▼
         case 'voice':
                bubble.className = `bubble ${isMe ? 'me' : 'ai'} voice`;

                // --- 动态计算宽度的核心逻辑 (最终微调版) ---
                const duration = parseInt(message.duration) || 1;
                
                // 【核心修改在这里！】我们将基础宽度和增长速度都调得非常小
                const barWidth = 10 + duration * 3; // 基础宽度15px, 每秒只增加4px

                // 设置一个最大宽度，防止语音条过长
                const finalWidth = Math.min(barWidth, 150); 

                bubble.innerHTML = `
                    <div class="voice-player">
                        <span class="voice-icon">▶</span>
                        <div class="voice-bar" style="width: ${finalWidth}px;"></div>
                        <span class="voice-duration">${message.duration || '..s'}</span>
                    </div>
                    ${message.played ? `<div class="voice-text">${message.text}</div>` : ''}
                `;
                
                // 点击切换逻辑保持不变
                bubble.onclick = () => {
                    message.played = !message.played;
                    renderMessages();
                };
                break;
            // ▲▲▲ 【新增逻辑结束】 ▲▲▲
             case 'transfer':
                bubble.className = `bubble transfer ${isMe ? 'me' : 'ai'}`;
                bubble.classList.add(message.status || 'pending');

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

                // 【核心点击逻辑】
                if (message.status === 'pending') {
                    // 如果是待处理状态
                    if (isMe) {
                        // 如果是我发的，点击只提示
                        bubble.onclick = () => showToast('等待对方确认收款');
                    } else {
                        // 如果是AI发的，点击打开操作菜单
                        bubble.onclick = () => openTransferActionSheet(message.id);
                    }
                } else {
                    // 如果已处理，点击无反应
                    bubble.onclick = null;
                    bubble.style.cursor = 'default';
                }
                break;
              case 'location':
                // 我们给气泡本身加上 flex 布局
                bubble.className = `bubble location ${isMe ? 'me' : 'ai'}`;
                
                // 简化内部结构
                bubble.innerHTML = `
                    <div class="location-icon">📍</div>
                    <div class="location-details">
                        <span class="location-place">${message.place}</span>
                        <span class="location-subtitle">共享位置</span>
                    </div>
                `;

                bubble.onclick = () => {
                    showToast('地图功能待开发');
                };
                break;
                 case 'image_card':
        bubble.className = 'bubble image-card';
        // 如果是自己发的消息，才绑定翻转事件
        if (isMe) {
            bubble.setAttribute('onclick', 'window.flipImageCard(this)');
        }
        
        let frontContent = '';
        // 检查消息对象中是否有 image 属性（用于处理发送表情的情况）
        if (message.image) {
            frontContent = `<img src="${message.image}" style="width: 100%; height: 100%; object-fit: contain;">`;
        }
        // 否则，就是想象画廊，正面留空，由CSS显示背景图标
        
        bubble.innerHTML = `
            <div class="image-card-face image-card-front">${frontContent}</div>
            <div class="image-card-face image-card-back">${message.description}</div>
        `;
        break;
            case 'text':
            default:
                bubble.className = `bubble ${isMe ? 'me' : 'ai'}`;
                bubble.textContent = message.text;
                break;
        }

        if (isMe) {
            bubble.onmousedown = (e) => {
                if (e.button === 2) return;
                longPressTimer = setTimeout(() => {
                    openMessageActionModal(message.id);
                }, 800);
            };
            bubble.onmouseup = () => clearTimeout(longPressTimer);
            bubble.onmouseleave = () => clearTimeout(longPressTimer);
        }

        row.appendChild(avatarImg);
        row.appendChild(bubble);
        area.appendChild(row);

        lastTimestamp = currentTimestamp;
    });

    area.scrollTop = area.scrollHeight;
}

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
        
        let worldbookContent = '';
        // ... (您的世界书逻辑保持不变) ...

        let finalSystemPrompt = 
            worldbookContent + 
            `\n\n对话中你的身份设定是：${ai.prompt || '无'}\n\n` +
            `与你对话的用户名为“${currentUser.name}”，他的身份设定是：${currentUser.prompt || '无'}\n\n` +
            INTERNAL_SYSTEM_PROMPT;
        
        const recentHistoryForPrompt = ai.history.slice(-10).map(m => {
            let contentForAI = '';
            switch(m.type) {
                case 'voice': contentForAI = `[用户发来一段语音，内容是：“${m.text}”]`; break;
                case 'transfer': contentForAI = `[用户向你发起一笔转账，金额：¥${m.amount}，留言：“${m.remark}”]`; break;
                case 'location': contentForAI = `[用户分享了一个位置：“${m.place}”]`; break;
               case 'emoji': 
           contentForAI = `[用户发来一个表情，意思是：“${m.description || '无描述'}”]`; 
            break;
                case 'recalled': contentForAI = '[用户撤回了一条消息]'; break;
                default: contentForAI = m.text || '[用户发来一条特殊消息]'; break;
                 case 'image_card': 
            contentForAI = `[用户发来一张想象画廊的卡片，描述是：“${m.description}”]`; 
            break;
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

        let thoughts = { heartVoice: null, badThoughts: null };
        // ... (thoughts解析逻辑保持不变) ...
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

        // ▼▼▼ 【最终版】核心解析逻辑 ▼▼▼
        for (let i = 0; i < splitReplies.length; i++) {
            const replyText = splitReplies[i];

            // 1. 使用正则表达式在整个文本中“搜索”指令，不再关心开头是什么
            const toolRegex = /\[(\w+)\]\s*({[\s\S]*)/;
            const match = replyText.match(toolRegex);

            if (match) {
                // 如果找到了指令
                const tag = `[${match[1]}]`; // 重建TAG，例如 "[TRANSFER]"
                const content = match[2];     // 从 '{' 开始的所有内容

                // 2. 健壮地提取JSON
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
                                addMessage(currentChatId, { type: 'voice', sender: ai.id, text: data.text || '...', tone: data.tone || null, duration: `${duration}s` });
                                break;
                            case '[TRANSFER]':
                                addMessage(currentChatId, { type: 'transfer', sender: ai.id, amount: parseFloat(data.amount).toFixed(2), remark: data.remark || '转账', status: 'pending' });
                                break;
                            case '[LOCATION]':
                                addMessage(currentChatId, { type: 'location', sender: ai.id, place: data.place || '一个神秘的地方' });
                                break;
                                 case '[IMAGE]':
                                addMessage(currentChatId, { 
                                    type: 'image_card', 
                                    sender: ai.id, 
                                    description: data.description || '一张充满想象的图片' 
                                });
                                break;
                                case '[EMOJI]':
        const allEmojis = getStorage('emojis', []);
        const targetCategory = data.category || '未分类';
        
        // 筛选出AI可以使用的表情：1. 属于目标分类 2. 绑定了当前用户或“通用”
        const usableEmojis = allEmojis.filter(e => 
            (e.category === targetCategory) && 
            (e.charIds.includes('all') || e.charIds.includes(currentUser.id))
        );
        
        if (usableEmojis.length > 0) {
            // 随机选择一个
            const chosenEmoji = usableEmojis[Math.floor(Math.random() * usableEmojis.length)];
            addMessage(currentChatId, {
                sender: ai.id, // AI发送
                type: 'emoji',
                url: chosenEmoji.url,
                description: chosenEmoji.description,
            });
        } else {
            // 如果找不到可用表情，可以发送一条备用文本
            addMessage(currentChatId, { sender: ai.id, text: `（想发一个关于“${targetCategory}”的表情，但是找不到）`, type: 'text' });
        }
        break;
                            default:
                                toolProcessed = false;
                        }
                        
                        if (!toolProcessed) { // 如果TAG无法识别，则作为普通文本发送
                            addMessage(currentChatId, { sender: ai.id, text: replyText, type: 'text' });
                        }

                    } catch (e) {
                        // 如果JSON解析失败，作为普通文本发送
                        addMessage(currentChatId, { sender: ai.id, text: replyText, type: 'text' });
                    }
                } else {
                    // 如果括号不匹配，作为普通文本发送
                    addMessage(currentChatId, { sender: ai.id, text: replyText, type: 'text' });
                }
            } else {
                // 如果在文本中完全找不到指令格式，作为普通文本发送
                addMessage(currentChatId, {
                    sender: ai.id, text: replyText, type: 'text', 
                    heartVoice: (i === splitReplies.length - 1) ? thoughts.heartVoice : null,
                    badThoughts: (i === splitReplies.length - 1) ? thoughts.badThoughts : null,
                });
            }

            renderMessages();
            if (splitReplies.length > 1 && i < splitReplies.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1200));
            }
        }
        // ▲▲▲ 修改结束 ▲▲▲

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

function openMessageActionModal(messageId) {
    const ai = aiList.find(c => c.id == currentChatId);
    const message = ai.history.find(m => m.id === messageId);
    if (!message) return;

    // 存储消息ID，以便其他函数使用
    document.getElementById('current-message-id').value = messageId;

    const modal = document.getElementById('message-action-modal');
    const recallBtn = document.getElementById('recall-msg-btn');
    const editBtn = document.getElementById('edit-msg-btn');

    // 条件判断：2分钟内可撤回
    const diffInMinutes = (new Date() - new Date(message.timestamp)) / (1000 * 60);
    if (diffInMinutes <= 2) {
        recallBtn.classList.remove('disabled');
    } else {
        recallBtn.classList.add('disabled');
    }

    // 条件判断：只有最后一条消息且AI未回复时可编辑
    const lastMessage = ai.history[ai.history.length - 1];
    if (lastMessage.id === messageId && userProfiles.some(p => p.id === lastMessage.sender)) {
        editBtn.classList.remove('disabled');
    } else {
        editBtn.classList.add('disabled');
    }
    
    modal.classList.add('active');
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

    // 确保 ai.settings 存在
    if (!ai.settings) ai.settings = {};
    if (!ai.settings.offlineMode) ai.settings.offlineMode = {};

    const currentUser = userProfiles.find(p => p.id == ai.userId) || userProfiles[0];

    // 填充“我的角色”
    const userSelect = document.getElementById('chat-user-persona-select');
    userSelect.innerHTML = userProfiles.map(p => 
        `<option value="${p.id}" ${p.id == currentUser.id ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    // 【核心】填充线上和线下两个世界书选择框
    const worldbooks = getStorage('worldbooks', []);
    const wbOptionsHtml = '<option value="none">无</option>' + worldbooks.map(wb => `<option value="${wb.id}">${wb.name}</option>`).join('');
    
    const onlineWbSelect = document.getElementById('chat-wb-select');
    const offlineWbSelect = document.getElementById('offline-wb-select');
    onlineWbSelect.innerHTML = wbOptionsHtml;
    offlineWbSelect.innerHTML = wbOptionsHtml;
    
    // 设置选中状态
    onlineWbSelect.value = ai.settings.chatWorldbookId || 'none';
    offlineWbSelect.value = ai.settings.offlineMode.worldbookId || 'none';

    // 填充开关和输入框
    document.getElementById('time-perception-switch').checked = ai.settings.timePerception ?? false;
    document.getElementById('offline-mode-switch').checked = ai.settings.offlineMode.enabled ?? false;
    document.getElementById('offline-word-min').value = ai.settings.offlineMode.wordCountMin || 80;
    document.getElementById('offline-word-max').value = ai.settings.offlineMode.wordCountMax || 150;

    // 初始化折叠区域状态
    toggleCollapse('offline-settings-container', ai.settings.offlineMode.enabled ?? false);
    toggleCollapse('worldbook-collapse-section', false); // 默认收起世界书

    openDrawer('chat-settings-drawer');
}
   function toggleOfflineSettings(isEnabled) {
    toggleCollapse('offline-settings-container', isEnabled);
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


  function saveChatSettings() {
    const ai = aiList.find(c => c.id == currentChatId);
    if (!ai) return;

    if (!ai.settings) ai.settings = {};
    if (!ai.settings.offlineMode) ai.settings.offlineMode = {};

    // 保存常规设置
    ai.userId = parseInt(document.getElementById('chat-user-persona-select').value);
    ai.settings.timePerception = document.getElementById('time-perception-switch').checked;

    // 保存两个世界书的ID
    ai.settings.chatWorldbookId = document.getElementById('chat-wb-select').value;
    ai.settings.offlineMode.worldbookId = document.getElementById('offline-wb-select').value;
    
    // 保存线下模式专属设置
    ai.settings.offlineMode.enabled = document.getElementById('offline-mode-switch').checked;
    ai.settings.offlineMode.wordCountMin = parseInt(document.getElementById('offline-word-min').value) || 80;
    ai.settings.offlineMode.wordCountMax = parseInt(document.getElementById('offline-word-max').value) || 150;
    
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
        model: document.getElementById('api-model').value.trim(),
        // ✅ 新增：保存温度值
        temperature: parseFloat(document.getElementById('api-temperature').value)
    };
    setStorage('ai_phone_config', config);
    showToast('API 已保存');
}

function initSettingsPage() {
    const slider = document.getElementById('api-temperature');
    const display = document.getElementById('temperature-value-display');
    
    if (!slider || !display) return;

    // 1. 加载已保存的温度值，若无则默认为 0.7
    const savedTemp = config.temperature === undefined ? 0.7 : config.temperature;
    slider.value = savedTemp;
    display.textContent = parseFloat(savedTemp).toFixed(1);

    // 2. 监听滑块的输入事件，实时更新显示的数值
    slider.oninput = (event) => {
        display.textContent = parseFloat(event.target.value).toFixed(1);
    };
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
    // 读取您已有的数据
    config = getStorage('config') || {};
    userProfiles = getStorage('user_profiles') || [DEFAULT_USER_PROFILE];
    aiList = getStorage('ai_list') || [];
    currentChatHistory = getStorage('current_chat_history') || [];
    forumData = getStorage('forum_data') || { posts: [] };

    // 新增：加载论坛角色数据
    forumRoles = getStorage('forum_roles') || [];
    activeForumRoleId = getStorage('active_forum_role_id') || null;

    // 新增：加载绑定的世界书数据
    worldbookBindings = getStorage('worldbook_bindings') || {
    postGeneration: [],
    commentGeneration: [],
    dmGeneration: []
};

    // 新增：如果没有角色，自动创建一个默认角色，防止出错
    if (forumRoles.length === 0) {
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
                if(!postToUpdate.comments) postToUpdate.comments = [];
                postToUpdate.comments.push({ authorName: interactor.name, text: interaction.commentText });
                postToUpdate.stats.comments++;
                notifications.push(`${interactor.name} 评论了`);
            } else if (interaction.action === 'share') {
                postToUpdate.stats.shares++;
                notifications.push(`${interactor.name} 转发了`);
            }
        });
        
        if (notifications.length > 0) {
            showToast(`收到了新互动: ${notifications.slice(0, 2).join('、')}${notifications.length > 2 ? '...' : ''}`);
        } else {
            showToast('朋友们这次没有新的互动...');
        }

        setStorage('forum_data', forumData);
        renderForumFeed();
    } catch(e) {
        showToast('模拟互动失败: ' + e.message);
        console.error("模拟互动失败详情:", e);
    }
}
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
                    <input type="checkbox" data-context="${context}" id="bind_${context}_${catId}" value="${catId}" ${isChecked ? 'checked' : ''}>
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
                    <input type="checkbox" data-context="${context}" id="bind_${context}_wb_${wb.id}" value="${wb.id}" ${isChecked ? 'checked' : ''}>
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
    const newBindings = { postGeneration: [], commentGeneration: [], dmGeneration: [] };
    document.querySelectorAll('#worldbook-binder-body input[type="checkbox"]:checked').forEach(checkbox => {
        const context = checkbox.dataset.context;
        const id = checkbox.value; // 对于世界书是数字ID，对于分类是 'cat_名称'
        if (context && newBindings[context]) {
            newBindings[context].push(id);
        }
    });
    worldbookBindings = newBindings;
    setStorage('worldbook_bindings', worldbookBindings);
    showToast("绑定已保存！");
    closeWorldbookBinder();
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
                contentParts.push(`## 世界书：${worldbook.name}\n${wb.content}\n`);
            }
        }
    }

    if(contentParts.length > 0){
        return `# 参考以下世界书设定进行创作：\n${contentParts.join('')}`;
    }
    return '';
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
window.toggleWorldbookSection = toggleWorldbookSection;
window.toggleCollapse = toggleCollapse;
window.toggleOfflineSettings = toggleOfflineSettings;

    // --- 新功能：表情包 & T2I ---
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


});

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