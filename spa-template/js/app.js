/**
 * app.js — Модульная логика SPA (Vanilla JS).
 * CSRF-токены передаются через заголовок X-CSRF-Token.
 * Все пользовательские данные экранируются через sanitize().
 */

// =====================
// УТИЛИТЫ / БЕЗОПАСНОСТЬ
// =====================

let csrfToken = '';
let currentRole = '';
let allServices = [];
let allAdminRequests = [];
let allAdminReviews = [];
let adminStatusFilter = 'all';

/** Экранирование HTML (защита от XSS). */
function sanitize(str) {
    if (str == null) return '';
    const el = document.createElement('div');
    el.textContent = String(str);
    return el.innerHTML;
}

/** Обёртка над fetch с CSRF-заголовком. */
async function api(url, opts = {}) {
    opts.headers = opts.headers || {};
    if (csrfToken) opts.headers['X-CSRF-Token'] = csrfToken;
    const res = await fetch(url, opts);
    return res.json();
}

/** Маска ввода для телефона: +7 (XXX) XXX-XX-XX */
function applyPhoneMask(input) {
    input.addEventListener('input', function () {
        let d = this.value.replace(/\D/g, '').match(/(\d{0,1})(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})/);
        this.value = !d[2] ? '+7' : '+7 (' + d[2] + (d[3] ? ') ' + d[3] : '') + (d[4] ? '-' + d[4] : '') + (d[5] ? '-' + d[5] : '');
    });
}

/** Показать уведомление-тост. */
function toast(message, type = 'success') {
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
}

// =====================
// НАВИГАЦИЯ (SPA Routing)
// =====================

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    window.scrollTo(0, 0);
}

function switchClientTab(tabId) {
    document.querySelectorAll('#screen-client-dashboard .client-nav-link').forEach(n => n.classList.remove('active'));
    document.getElementById('client-nav-' + tabId)?.classList.add('active');

    document.querySelectorAll('#screen-client-dashboard .client-tab-pane').forEach(t => t.classList.remove('active'));
    document.getElementById('client-tab-' + tabId)?.classList.add('active');
}

function switchAdminTab(tabId) {
    document.querySelectorAll('#screen-admin-dashboard .nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('admin-nav-' + tabId)?.classList.add('active');

    document.querySelectorAll('#screen-admin-dashboard .tab-pane').forEach(t => t.classList.remove('active'));
    document.getElementById('admin-tab-' + tabId)?.classList.add('active');
}

function smoothScroll(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    document.getElementById('navLinks')?.classList.remove('open');
}

// =====================
// FAQ АККОРДЕОН
// =====================

function initFaqAccordion() {
    document.querySelectorAll('.faq-question').forEach(item => {
        item.addEventListener('click', () => {
            const faqItem = item.parentElement;
            const isOpen = faqItem.classList.contains('open');

            // Закрыть другие
            document.querySelectorAll('.faq-item').forEach(el => el.classList.remove('open'));

            // Тогглим текущий
            if (!isOpen) {
                faqItem.classList.add('open');
            }
        });
    });
}

// =====================
// МОДАЛЬНОЕ ОКНО АВТОРИЗАЦИИ
// =====================

function openAuthModal() {
    document.getElementById('authModal').style.display = 'flex';
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}

function switchAuthTab(type) {
    document.querySelectorAll('#authModal .tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-btn-' + type)?.classList.add('active');

    document.querySelectorAll('#authModal .form-wrapper').forEach(f => f.classList.remove('active'));
    document.getElementById('form-' + type)?.classList.add('active');

    document.getElementById('login-error').style.display = 'none';
    document.getElementById('register-error').style.display = 'none';
}

// =====================
// АВТОРИЗАЦИЯ
// =====================

document.getElementById('form-login-submit').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('login-error');
    errDiv.style.display = 'none';

    const fd = new FormData(e.target);
    const data = await api('api/auth.php', { method: 'POST', body: fd });

    if (data.success) {
        csrfToken = data.csrf_token;
        closeAuthModal();
        initDashboard(data);
    } else {
        errDiv.textContent = data.error;
        errDiv.style.display = 'block';
    }
});

document.getElementById('form-register-submit').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('register-error');
    errDiv.style.display = 'none';

    // Фронтенд-валидация
    const pw = document.getElementById('reg-password').value;
    if (pw.length < 8 || !/[A-Za-zА-Яа-яЁё]/u.test(pw) || !/[0-9]/.test(pw)) {
        errDiv.textContent = 'Пароль: мин. 8 символов, обязательно буквы и цифры.';
        errDiv.style.display = 'block';
        return;
    }

    const fd = new FormData(e.target);
    const data = await api('api/register.php', { method: 'POST', body: fd });

    if (data.success) {
        csrfToken = data.csrf_token;
        closeAuthModal();
        initDashboard(data);
    } else {
        errDiv.textContent = data.error;
        errDiv.style.display = 'block';
    }
});

async function logout() {
    await api('api/logout.php');
    csrfToken = '';
    currentRole = '';
    
    // Восстановим кнопку Войти
    const authBtn = document.getElementById('btn-navbar-auth');
    if (authBtn) {
        authBtn.textContent = 'Войти';
        authBtn.onclick = openAuthModal;
    }
    
    // Перерендерим услуги на лендинге
    renderServices(allServices);
    
    showScreen('screen-site');
}

// ===================================
// ЛЕНДИНГ — ЗАГРУЗКА УСЛУГ И ОТЗЫВОВ
// ===================================

async function loadLandingServices() {
    try {
        const services = await api('api/services.php');
        if (!Array.isArray(services)) return;
        allServices = services;

        // Фильтры категорий на лендинге
        const categories = ['Все', ...new Set(services.map(s => s.category))];
        const filtersDiv = document.getElementById('category-filters');
        if (filtersDiv) {
            filtersDiv.innerHTML = categories.map((cat, i) => `
                <button class="btn-filter ${i === 0 ? 'active' : ''}" onclick="filterServices('${cat}', this)">${cat}</button>
            `).join('');
        }

        renderServices(allServices);
    } catch (e) {
        console.error('Ошибка при загрузке услуг:', e);
    }
}

function filterServices(category, btn) {
    document.querySelectorAll('#category-filters .btn-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (category === 'Все') {
        renderServices(allServices);
    } else {
        const filtered = allServices.filter(s => s.category === category);
        renderServices(filtered);
    }
}

function renderServices(services) {
    const grid = document.getElementById('services-grid');
    if (!grid) return;
    if (services.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:var(--text-muted)">Нет доступных услуг в этой категории.</p>';
        return;
    }
    const icons = ['🔧', '💻', '🛡️', '📦', '🌐'];
    grid.innerHTML = services.map((s, i) => {
        const titleEscaped = sanitize(s.title).replace(/'/g, "\\'");
        // Если авторизован клиент — вешаем вызов окна заказа, иначе — модалку логина
        const onClickAction = (csrfToken && currentRole === 'client')
            ? `openOrderModal(${s.id}, '${titleEscaped}', ${s.price})`
            : `openAuthModal()`;

        return `
            <div class="service-card glass">
                <div class="service-icon">${icons[i % icons.length]}</div>
                <h3>${sanitize(s.title)}</h3>
                <p class="service-category">${sanitize(s.category)}</p>
                <div class="service-price">${Number(s.price).toLocaleString()} ₽</div>
                <button class="btn-service" onclick="${onClickAction}">Заказать</button>
            </div>
        `;
    }).join('');
}

async function loadLandingReviews() {
    try {
        const reviews = await api('api/reviews.php');
        const grid = document.getElementById('reviews-grid');
        if (!grid) return;
        if (!Array.isArray(reviews) || reviews.length === 0) {
            grid.innerHTML = '<p style="text-align:center;color:var(--text-muted)">Отзывов пока нет.</p>';
            return;
        }
        grid.innerHTML = reviews.map(r => `
            <div class="review-card glass">
                <div class="review-header">
                    <div class="review-user">${sanitize(r.user_fio)}</div>
                    <div class="review-rating">${'⭐'.repeat(r.rating)}</div>
                </div>
                <p class="review-text">«${sanitize(r.text)}»</p>
            </div>
        `).join('');
    } catch (e) {
        console.error('Ошибка загрузки отзывов:', e);
    }
}

// =====================
// ЕДИНЫЙ ВХОД В ДАШБОРДЫ
// =====================

async function initDashboard(userData) {
    csrfToken = userData.csrf_token;
    currentRole = userData.role;

    const authBtn = document.getElementById('btn-navbar-auth');
    if (authBtn) {
        authBtn.textContent = 'Кабинет';
        authBtn.onclick = () => {
            if (currentRole === 'admin') {
                showScreen('screen-admin-dashboard');
            } else {
                showScreen('screen-client-dashboard');
            }
        };
    }

    // Перерисовываем услуги на лендинге, чтобы обновились обработчики клика на "Заказать"
    renderServices(allServices);

    if (currentRole === 'admin') {
        await initAdminDashboard(userData);
    } else {
        await initClientDashboard(userData);
    }
}

// =============================================
// ЛОГИКА ЛИЧНОГО КАБИНЕТА КЛИЕНТА (НОВЫЙ ЛК)
// =============================================

async function initClientDashboard(userData) {
    // Профиль
    document.getElementById('client-user-name').textContent = sanitize(userData.fio);
    document.getElementById('profile-card-fio').textContent = sanitize(userData.fio);
    document.getElementById('profile-fio').textContent = sanitize(userData.fio);
    document.getElementById('profile-login').textContent = sanitize(userData.login);
    document.getElementById('profile-email').textContent = sanitize(userData.email);
    document.getElementById('profile-phone').textContent = sanitize(userData.phone || 'Не указан');

    showScreen('screen-client-dashboard');
    switchClientTab('overview');

    await loadClientCatalog();
    await loadClientRequests();
}

async function loadClientCatalog() {
    try {
        const services = await api('api/services.php');
        if (!Array.isArray(services)) return;
        allServices = services;

        // Фильтры категорий в ЛК
        const categories = ['Все', ...new Set(services.map(s => s.category))];
        const filtersDiv = document.getElementById('client-category-filters');
        if (filtersDiv) {
            filtersDiv.innerHTML = categories.map((cat, i) => `
                <button class="btn-filter ${i === 0 ? 'active' : ''}" onclick="filterClientCatalog('${cat}', this)">${cat}</button>
            `).join('');
        }

        renderClientCatalog(allServices);
    } catch (e) {
        console.error('Ошибка каталога ЛК:', e);
    }
}

function filterClientCatalog(category, btn) {
    document.querySelectorAll('#client-category-filters .btn-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (category === 'Все') {
        renderClientCatalog(allServices);
    } else {
        const filtered = allServices.filter(s => s.category === category);
        renderClientCatalog(filtered);
    }
}

function renderClientCatalog(services) {
    const grid = document.getElementById('client-services-grid');
    if (!grid) return;
    if (services.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:var(--text-muted)">Нет доступных услуг в этой категории.</p>';
        return;
    }
    const icons = ['🔧', '💻', '🛡️', '📦', '🌐'];
    grid.innerHTML = services.map((s, i) => `
        <div class="service-card glass">
            <div class="service-icon">${icons[i % icons.length]}</div>
            <h3>${sanitize(s.title)}</h3>
            <p class="service-category">${sanitize(s.category)}</p>
            <div class="service-price">${Number(s.price).toLocaleString()} ₽</div>
            <button class="btn-service" onclick="openOrderModal(${s.id}, '${sanitize(s.title.replace(/'/g, "\\'"))}', ${s.price})">Заказать</button>
        </div>
    `).join('');
}

async function loadClientRequests() {
    const res = await api('api/requests.php');
    if (!res.success) return;

    const tbody = document.getElementById('client-requests-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let total = res.data.length, progress = 0, done = 0;

    if (total === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">У вас пока нет оформленных заказов.</td></tr>`;
    }

    const statusLabels = { new: 'Новая', in_progress: 'В работе', completed: 'Выполнена', canceled: 'Отменена' };

    res.data.forEach(r => {
        if (r.status === 'in_progress') progress++;
        if (r.status === 'completed') done++;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${r.id}</td>
            <td><strong>${sanitize(r.service_title)}</strong><br><small>${sanitize(r.details)}</small></td>
            <td>${new Date(r.created_at).toLocaleDateString('ru-RU')}</td>
            <td><span class="badge badge-${r.status}">${statusLabels[r.status] || r.status}</span></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('client-stat-total').textContent = total;
    document.getElementById('client-stat-progress').textContent = progress;
    document.getElementById('client-stat-done').textContent = done;
}

// =====================
// КЛИЕНТ: ОФОРМЛЕНИЕ ЗАКАЗА ЧЕРЕЗ КАТАЛОГ
// =====================

function openOrderModal(serviceId, title, price) {
    document.getElementById('order-service-id').value = serviceId;
    document.getElementById('order-service-title').textContent = title;
    document.getElementById('order-service-price').textContent = Number(price).toLocaleString() + ' ₽';
    document.getElementById('order-details').value = '';
    document.getElementById('order-details-modal').style.display = 'flex';
}

function closeOrderModal() {
    document.getElementById('order-details-modal').style.display = 'none';
}

function closeSuccessOrderModal() {
    document.getElementById('order-success-modal').style.display = 'none';
}

document.getElementById('form-order-submit').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const res = await api('api/requests.php', { method: 'POST', body: fd });

    if (res.success) {
        closeOrderModal();
        e.target.reset();
        
        // Показываем подтверждение заказа с ID
        document.getElementById('success-order-id').textContent = '#' + res.id;
        document.getElementById('order-success-modal').style.display = 'flex';
        
        switchClientTab('overview');
        await loadClientRequests();
    } else {
        toast(res.error || 'Ошибка', 'error');
    }
});


// =============================================
// ЛОГИКА АДМИН-ПАНЕЛИ (CRUD СЕРВИСОВ И ОТЗЫВОВ)
// =============================================

async function initAdminDashboard(userData) {
    document.getElementById('admin-user-name').textContent = sanitize(userData.fio);

    showScreen('screen-admin-dashboard');
    switchAdminTab('requests');

    await loadAdminRequests();
    await loadAdminServices();
    await loadAdminReviews();
}

async function loadAdminRequests() {
    const res = await api('api/requests.php');
    if (!res.success) return;
    allAdminRequests = res.data;

    renderAdminRequests();
    updateAdminStats();
}

function renderAdminRequests() {
    const tbody = document.getElementById('admin-requests-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchVal = document.getElementById('admin-search').value.toLowerCase();

    const filtered = allAdminRequests.filter(r => {
        if (adminStatusFilter !== 'all' && r.status !== adminStatusFilter) return false;
        const clientName = (r.fio || '').toLowerCase();
        const clientPhone = (r.phone || '').toLowerCase();
        const serviceTitle = (r.service_title || '').toLowerCase();
        const details = (r.details || '').toLowerCase();
        return clientName.includes(searchVal) || clientPhone.includes(searchVal) || serviceTitle.includes(searchVal) || details.includes(searchVal);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Заявок не найдено.</td></tr>`;
        return;
    }

    const statusLabels = { new: 'Новая', in_progress: 'В работе', completed: 'Выполнена', canceled: 'Отменена' };

    filtered.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${r.id}</td>
            <td>${sanitize(r.fio)}<br><small>${sanitize(r.phone)}</small></td>
            <td><strong>${sanitize(r.service_title)}</strong><br><small>${sanitize(r.details)}</small></td>
            <td>${new Date(r.created_at).toLocaleDateString('ru-RU')}</td>
            <td><span class="badge badge-${r.status}">${statusLabels[r.status] || r.status}</span></td>
            <td><button class="btn-action" onclick="openStatusModal(${r.id},'${r.status}')">Изменить</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function filterAdminRequests() {
    renderAdminRequests();
}

function setAdminStatusFilter(status) {
    adminStatusFilter = status;
    document.querySelectorAll('.status-filters .btn-filter').forEach(btn => btn.classList.remove('active'));

    const btnMap = {
        all: 'btn-filter-all',
        new: 'btn-filter-new',
        in_progress: 'btn-filter-progress',
        completed: 'btn-filter-completed',
        canceled: 'btn-filter-canceled'
    };
    document.getElementById(btnMap[status])?.classList.add('active');
    renderAdminRequests();
}

function updateAdminStats() {
    let total = allAdminRequests.length;
    let newReq = 0, progress = 0, done = 0, canceled = 0;

    allAdminRequests.forEach(r => {
        if (r.status === 'new') newReq++;
        if (r.status === 'in_progress') progress++;
        if (r.status === 'completed') done++;
        if (r.status === 'canceled') canceled++;
    });

    document.getElementById('admin-stat-total').textContent = total;
    document.getElementById('admin-stat-new').textContent = newReq;
    document.getElementById('admin-stat-progress').textContent = progress;
    document.getElementById('admin-stat-done').textContent = done;
    document.getElementById('admin-stat-canceled').textContent = canceled;
}

// ---------------------
// АДМИН: УПРАВЛЕНИЕ УСЛУГАМИ
// ---------------------

async function loadAdminServices() {
    const services = await api('api/services.php');
    const tbody = document.getElementById('admin-services-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (Array.isArray(services)) {
        if (services.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Список услуг пуст.</td></tr>`;
            return;
        }
        services.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${s.id}</td>
                <td><span class="badge badge-new" style="background: rgba(224,137,6,.15); color: var(--accent);">${sanitize(s.category)}</span></td>
                <td><strong>${sanitize(s.title)}</strong></td>
                <td>${Number(s.price).toLocaleString()} ₽</td>
                <td style="text-align: right;">
                    <button class="btn-action" style="margin-right: 6px;" onclick="openServiceModal(${s.id}, '${sanitize(s.category.replace(/'/g, "\\'"))}', '${sanitize(s.title.replace(/'/g, "\\'"))}', ${s.price})">Ред.</button>
                    <button class="btn-action" style="background: rgba(239,68,68,.1); color: var(--danger);" onclick="deleteAdminService(${s.id})">Удал.</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Ошибка при загрузке услуг.</td></tr>`;
    }
}

function openServiceModal(id = null, category = '', title = '', price = '') {
    document.getElementById('service-modal-id').value = id || '';
    document.getElementById('service-modal-category').value = category;
    document.getElementById('service-modal-name').value = title;
    document.getElementById('service-modal-price').value = price;
    document.getElementById('service-modal-title').textContent = id ? 'Редактировать услугу' : 'Добавить новую услугу';
    document.getElementById('service-modal').style.display = 'flex';
}

async function saveAdminService() {
    const id = document.getElementById('service-modal-id').value;
    const category_name = document.getElementById('service-modal-category').value.trim();
    const title = document.getElementById('service-modal-name').value.trim();
    const price = parseFloat(document.getElementById('service-modal-price').value);

    if (category_name === '' || title === '' || isNaN(price) || price <= 0) {
        toast('Пожалуйста, заполните корректно все поля!', 'error');
        return;
    }

    let res;
    if (id) {
        res = await api('api/services.php', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: +id, category_name, title, price })
        });
    } else {
        const fd = new FormData();
        fd.append('category_name', category_name);
        fd.append('title', title);
        fd.append('price', price);
        res = await api('api/services.php', {
            method: 'POST',
            body: fd
        });
    }

    if (res.success) {
        document.getElementById('service-modal').style.display = 'none';
        toast(id ? 'Услуга успешно обновлена!' : 'Новая услуга успешно добавлена!');
        await loadAdminServices();
        await loadLandingServices();
    } else {
        toast(res.error || 'Ошибка при сохранении', 'error');
    }
}

async function deleteAdminService(id) {
    if (!confirm('Вы действительно хотите удалить эту услугу? Это повлечет за собой удаление всех связанных заявок!')) return;

    const res = await api('api/services.php', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: +id })
    });

    if (res.success) {
        toast('Услуга удалена из базы!');
        await loadAdminServices();
        await loadLandingServices();
    } else {
        toast(res.error || 'Не удалось удалить услугу', 'error');
    }
}

// ---------------------
// АДМИН: УПРАВЛЕНИЕ ОТЗЫВАМИ
// ---------------------

async function loadAdminReviews() {
    const reviews = await api('api/reviews.php');
    const tbody = document.getElementById('admin-reviews-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (Array.isArray(reviews)) {
        allAdminReviews = reviews;
        if (reviews.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Список отзывов пуст.</td></tr>`;
            return;
        }
        reviews.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${r.id}</td>
                <td><strong>${sanitize(r.user_fio)}</strong></td>
                <td>${'⭐'.repeat(r.rating)}</td>
                <td><small>${sanitize(r.text)}</small></td>
                <td style="text-align: right;">
                    <button class="btn-action" style="margin-right: 6px;" onclick="openReviewModal(${r.id}, '${sanitize(r.user_fio.replace(/'/g, "\\'"))}', ${r.rating}, '${sanitize(r.text.replace(/'/g, "\\'"))}')">Ред.</button>
                    <button class="btn-action" style="background: rgba(239,68,68,.1); color: var(--danger);" onclick="deleteAdminReview(${r.id})">Удал.</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Ошибка загрузки отзывов.</td></tr>`;
    }
}

function openReviewModal(id = null, author = '', rating = 5, text = '') {
    document.getElementById('review-modal-id').value = id || '';
    document.getElementById('review-modal-author').value = author;
    document.getElementById('review-modal-rating').value = rating;
    document.getElementById('review-modal-text').value = text;
    document.getElementById('review-modal-title').textContent = id ? 'Редактировать отзыв' : 'Добавить новый отзыв';
    document.getElementById('review-modal').style.display = 'flex';
}

async function saveAdminReview() {
    const id = document.getElementById('review-modal-id').value;
    const user_fio = document.getElementById('review-modal-author').value.trim();
    const rating = parseInt(document.getElementById('review-modal-rating').value);
    const text = document.getElementById('review-modal-text').value.trim();

    if (user_fio === '' || text === '') {
        toast('Пожалуйста, заполните имя автора и текст отзыва!', 'error');
        return;
    }

    let res;
    if (id) {
        res = await api('api/reviews.php', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: +id, user_fio, rating, text })
        });
    } else {
        const fd = new FormData();
        fd.append('user_fio', user_fio);
        fd.append('rating', rating);
        fd.append('text', text);
        res = await api('api/reviews.php', {
            method: 'POST',
            body: fd
        });
    }

    if (res.success) {
        document.getElementById('review-modal').style.display = 'none';
        toast(id ? 'Отзыв обновлен!' : 'Отзыв добавлен!');
        await loadAdminReviews();
        await loadLandingReviews();
    } else {
        toast(res.error || 'Ошибка при сохранении отзыва', 'error');
    }
}

async function deleteAdminReview(id) {
    if (!confirm('Вы действительно хотите удалить этот отзыв?')) return;

    const res = await api('api/reviews.php', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: +id })
    });

    if (res.success) {
        toast('Отзыв удален!');
        await loadAdminReviews();
        await loadLandingReviews();
    } else {
        toast(res.error || 'Не удалось удалить отзыв', 'error');
    }
}

// =====================
// МОДАЛКА ИЗМЕНЕНИЯ СТАТУСА (АДМИН)
// =====================

function openStatusModal(id, status) {
    document.getElementById('modal-req-id').value = id;
    document.getElementById('modal-status').value = status;
    document.getElementById('status-modal').style.display = 'flex';
}

async function saveStatus() {
    const id     = document.getElementById('modal-req-id').value;
    const status = document.getElementById('modal-status').value;

    const res = await api('api/requests.php', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: +id, status }),
    });

    if (res.success) {
        document.getElementById('status-modal').style.display = 'none';
        toast('Статус обновлён!');
        await loadAdminRequests();
    } else {
        toast(res.error || 'Ошибка', 'error');
    }
}

// =====================
// ИНИЦИАЛИЗАЦИЯ
// =====================

document.addEventListener('DOMContentLoaded', async () => {
    // Инициализация FAQ аккордеона
    initFaqAccordion();

    // Маска телефона
    const phoneInput = document.getElementById('reg-phone');
    if (phoneInput) applyPhoneMask(phoneInput);

    // Скролл навбара
    window.addEventListener('scroll', () => {
        document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 50);
    });

    // Загрузить услуги и отзывы на лендинг
    await loadLandingServices();
    await loadLandingReviews();

    // Проверяем, есть ли активная сессия
    try {
        const info = await api('api/get_user_info.php');
        if (info.success) {
            csrfToken = info.csrf_token;
            initDashboard(info);
        }
    } catch (e) { /* Нет сессии — остаёмся на лендинге */ }
});