document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxBnqUwqXwIt0L75dQvUWZixUQMRUo7nap4ZaLEKz8yE4ww2o_DM3sOsny0LdKKZv7i/exec"; // ❗️❗️❗️ ใส่ URL ของคุณที่นี่
    const POLL_MS = 300000; // 5 นาที

    const sheetConfig = {
        'Consignment': {
            headers: ['id','lastUpdated','ประเภท', 'ทำเล', 'ราคา', 'เจ้าของ', 'เบอร์โทร', 'ผู้รับผิดชอบ', 'สถานะ', 'รายละเอียด', 'จัดการ'],
            fields: {
                propertyType: { label: 'ประเภททรัพย์', type: 'select', options: ['บ้าน', 'ที่ดิน', 'คอนโด', 'ทาวน์โฮม', 'อื่นๆ'], filterable: true, defaultText: 'ทุกประเภท' },
                location: { label: 'สถานที่ตั้ง/ทำเล', type: 'text', searchable: true },
                price: { label: 'ราคา (บาท)', type: 'number' },
                ownerName: { label: 'ชื่อเจ้าของ', type: 'text', required: true, searchable: true },
                phone: { label: 'เบอร์โทร', type: 'tel', searchable: true },
                assignedTo: { label: 'ผู้รับผิดชอบ', type: 'select', options: ['พี่เอก', 'ข้าวจ้าว', 'ฟลุ๊ค', 'พี่โอ'], filterable: true, defaultText: 'ทุกคน' },
                status: { label: 'สถานะ', type: 'select', options: ['ใหม่', 'ติดต่อแล้ว', 'นัดชม', 'ต่อรอง', 'ปิดดีล', 'ไม่สนใจ'], filterable: true, defaultText: 'ทุกสถานะ' },
                details: { label: 'รายละเอียดเพิ่มเติม', type: 'textarea' }
            }
        },
        'CustomerNeeds': {
            // --- UPDATED THIS SECTION ---
            headers: ['id','lastUpdated','ความต้องการ', 'ชื่อลูกค้า', 'เบอร์โทร', 'ประเภททรัพย์', 'ผู้รับผิดชอบ', 'สถานะ', 'รายละเอียด', 'จัดการ'],
            fields: {
                requirement: { label: 'ความต้องการของลูกค้า', type: 'select', options: ['ต้องการซื้อ', 'ปรึกษา', 'ติดตามเอกสาร', 'เตรียมยื่นกู้', 'ฝากขายทรัพย์'], filterable: true, defaultText: 'ทุกความต้องการ' },
                clientName: { label: 'ชื่อลูกค้า', type: 'text', required: true, searchable: true },
                phone: { label: 'เบอร์โทร', type: 'tel', searchable: true },
                propertyType: { label: 'ประเภททรัพย์ที่สนใจ', type: 'select', options: ['บ้าน', 'ที่ดิน', 'คอนโด', 'ทาวน์โฮม', 'อื่นๆ'], filterable: true, defaultText: 'ทุกประเภท' },
                assignedTo: { label: 'ผู้รับผิดชอบ', type: 'select', options: ['พี่เอก', 'ข้าวจ้าว', 'ฟลุ๊ค', 'พี่โอ'], filterable: true, defaultText: 'ทุกคน' },
                status: { label: 'สถานะ', type: 'select', options: ['ใหม่', 'ติดต่อแล้ว', 'นัดชม', 'ต่อรอง', 'ปิดดีล', 'ไม่สนใจ'], filterable: true, defaultText: 'ทุกสถานะ' },
                details: { label: 'รายละเอียดอื่นๆ', type: 'textarea' } // Added this line
            }
        }
    };

    let activeSheet = 'Consignment';
    let allItems = [];
    let filters = {};
    let editingItemId = null;
    let itemToDeleteId = null;

    const dom = {
        tableHead: document.querySelector('table thead'),
        tableBody: document.getElementById('table-body'),
        metaInfo: document.getElementById('meta-info'),
        loader: document.getElementById('loader'),
        loaderText: document.getElementById('loader-text'),
        formDialog: document.getElementById('form-dialog'),
        confirmDialog: document.getElementById('confirm-dialog'),
        dialogTitle: document.getElementById('dialog-title'),
        dialogContent: document.getElementById('dialog-content'),
        searchInput: document.getElementById('search-input'),
        filterWrapper: document.getElementById('filter-wrapper'),
        btnAdd: document.getElementById('btn-add'),
        btnSave: document.getElementById('btn-save'),
        btnCancel: document.getElementById('btn-cancel'),
        btnConfirmDelete: document.getElementById('btn-confirm-delete'),
        btnConfirmCancel: document.getElementById('btn-confirm-cancel'),
        btnRefresh: document.getElementById('btn-refresh'),
        tabs: document.querySelectorAll('.tab')
    };

    function showLoader(message) {
        dom.loaderText.textContent = message;
        dom.loader.classList.add('active');
    }

    function hideLoader() {
        dom.loader.classList.remove('active');
    }
    
    async function apiFetch(url, options = {}, loaderMessage) {
        showLoader(loaderMessage);
        try {
            const res = await fetch(url, options);
            const result = await res.json();
            if (!res.ok || !result.success) throw new Error(result.message || `HTTP Error: ${res.status}`);
            return result;
        } catch (err) {
            alert(`❌ เกิดข้อผิดพลาด: ${err.message}`);
            throw err;
        } finally {
            hideLoader();
        }
    }
    
    const api = {
        get: (sheetName) => apiFetch(`${WEB_APP_URL}?sheet=${sheetName}`, {}, "กำลังโหลดข้อมูล..."),
        post: (body) => {
            let loaderMessage = "กำลังบันทึกข้อมูล...";
            if (body.action === 'UPDATE') loaderMessage = "กำลังอัปเดตข้อมูล...";
            if (body.action === 'DELETE') loaderMessage = "กำลังลบข้อมูล...";
            
            return apiFetch(WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify(body),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            }, loaderMessage);
        }
    };

    function formatPhoneNumber(phoneStr) {
        if (!phoneStr) return "";
        const cleaned = ('' + phoneStr).replace(/\D/g, '');
        if (cleaned.length !== 10) return phoneStr;
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
        return match ? `${match[1]}-${match[2]}-${match[3]}` : phoneStr;
    }

    function applyFiltersAndRender() {
        const config = sheetConfig[activeSheet];
        const lowerCaseQuery = (filters.query || '').toLowerCase().trim();
        const searchableFields = Object.keys(config.fields).filter(key => config.fields[key].searchable);
        const filteredItems = allItems.filter(item => {
            const matchesQuery = lowerCaseQuery === '' || searchableFields.some(field =>
                String(item[field] || '').toLowerCase().includes(lowerCaseQuery)
            );
            const matchesFilters = Object.keys(filters).every(key => {
                if (key === 'query' || filters[key] === 'All' || !filters[key]) return true;
                return item[key] === filters[key];
            });
            return matchesQuery && matchesFilters;
        });
        renderTable(filteredItems);
    }

    function renderTable(itemsToRender) {
        const config = sheetConfig[activeSheet];
        const displayHeaders = config.headers.filter(h => h !== 'id' && h !== 'lastUpdated');
        const displayFields = Object.keys(config.fields);
        dom.tableHead.innerHTML = `<tr>${displayHeaders.map(h => `<th>${h}</th>`).join('')}</tr>`;
        if (itemsToRender.length === 0) {
            dom.tableBody.innerHTML = `<tr><td colspan="${displayHeaders.length}" style="text-align:center;padding:2rem;">ไม่พบข้อมูล</td></tr>`;
        } else {
            dom.tableBody.innerHTML = itemsToRender.map(item => {
                const cells = displayFields.map(key => {
                    let value = item[key] || '-';
                    if (key === 'phone') value = formatPhoneNumber(value);
                    if (config.fields[key].type === 'number' && item[key]) value = Number(item[key]).toLocaleString();
                    return `<td>${value}</td>`;
                }).join('');
                return `<tr>${cells}<td>
                    <button class="btn-action" onclick="window.handleEdit('${item.id}')">✏️</button>
                    <button class="btn-action" onclick="window.handleDelete('${item.id}')">🗑️</button>
                </td></tr>`;
            }).join('');
        }
        dom.metaInfo.textContent = `แสดง ${itemsToRender.length} จากทั้งหมด ${allItems.length} รายการ`;
    }

    function setupFilters() {
        dom.filterWrapper.innerHTML = '';
        const config = sheetConfig[activeSheet];
        Object.entries(config.fields).forEach(([key, fieldConfig]) => {
            if (fieldConfig.filterable) {
                const select = document.createElement('select');
                select.innerHTML = `<option value="All">${fieldConfig.defaultText}</option>${fieldConfig.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}`;
                select.addEventListener('change', e => { filters[key] = e.target.value; applyFiltersAndRender(); });
                dom.filterWrapper.appendChild(select);
            }
        });
        const clearButton = document.createElement('button');
        clearButton.className = 'btn danger';
        clearButton.innerHTML = `<span class="icon">❌</span> ล้างค่า`;
        clearButton.onclick = clearFilters;
        dom.filterWrapper.appendChild(clearButton);
    }

    async function fetchAndRender(isManualRefresh = false) {
        if (isManualRefresh) showLoader("กำลังรีเฟรชข้อมูล...");
        try {
            const result = await api.get(activeSheet);
            allItems = result.data || [];
            applyFiltersAndRender();
        } catch (err) {
            dom.metaInfo.textContent = 'ไม่สามารถโหลดข้อมูลได้';
        } finally {
             if (isManualRefresh) hideLoader();
        }
    }

    function switchTab(newSheet) {
        activeSheet = newSheet;
        dom.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.sheet === newSheet));
        clearFilters();
        setupFilters(); 
        fetchAndRender();
    }

    function clearFilters() {
        filters = { query: '' };
        dom.searchInput.value = '';
        document.querySelectorAll('.filter-row select, .filter-wrapper select').forEach(s => s.value = 'All');
        applyFiltersAndRender();
    }
    
    function createFormField(id, config) {
        let fieldHtml = `<div><label for="f-${id}">${config.label}${config.required ? ' *' : ''}</label>`;
        if (config.type === 'select') {
            fieldHtml += `<select id="f-${id}" name="${id}">${config.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`;
        } else if (config.type === 'textarea') {
            fieldHtml += `<textarea id="f-${id}" name="${id}" rows="3"></textarea>`;
        } else {
            fieldHtml += `<input type="${config.type || 'text'}" id="f-${id}" name="${id}" ${config.required ? 'required' : ''}>`;
        }
        return fieldHtml + `</div>`;
    }
    
    window.handleEdit = (id) => {
        editingItemId = id;
        const item = allItems.find(i => i.id === id);
        if (!item) return;
        dom.dialogTitle.textContent = 'แก้ไขข้อมูล';
        const config = sheetConfig[activeSheet];
        dom.dialogContent.innerHTML = Object.keys(config.fields).map(key => createFormField(key, config.fields[key])).join('');
        Object.keys(item).forEach(key => {
            const input = document.getElementById(`f-${key}`);
            if (input) input.value = item[key] || '';
        });
        dom.formDialog.showModal();
    };

    window.handleDelete = (id) => { itemToDeleteId = id; dom.confirmDialog.showModal(); };

    dom.btnAdd.onclick = () => {
        editingItemId = null;
        dom.dialogTitle.textContent = 'เพิ่มข้อมูลใหม่';
        const config = sheetConfig[activeSheet];
        dom.dialogContent.innerHTML = Object.keys(config.fields).map(key => createFormField(key, config.fields[key])).join('');
        document.getElementById('data-form').reset();
        dom.formDialog.showModal();
    };
    
    async function handleSave() {
        const form = document.getElementById('data-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        if (data.phone) data.phone = formatPhoneNumber(data.phone);
        const action = editingItemId ? 'UPDATE' : 'CREATE';
        const payload = { action, sheet: activeSheet, id: editingItemId, data };
        try {
            await api.post(payload);
            dom.formDialog.close();
            await fetchAndRender(true);
        } catch {}
    }

    async function handleDeleteConfirm() {
        if (!itemToDeleteId) return;
        const payload = { action: 'DELETE', sheet: activeSheet, id: itemToDeleteId };
        try {
            await api.post(payload);
            dom.confirmDialog.close();
            await fetchAndRender(true);
        } finally { itemToDeleteId = null; }
    }
    
    dom.btnSave.onclick = handleSave;
    dom.btnConfirmDelete.onclick = handleDeleteConfirm;
    dom.btnRefresh.onclick = () => fetchAndRender(true);
    
    dom.searchInput.addEventListener('input', e => { filters.query = e.target.value; applyFiltersAndRender(); });
    dom.btnCancel.onclick = () => dom.formDialog.close();
    dom.btnConfirmCancel.onclick = () => dom.confirmDialog.close();
    dom.tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.sheet)));

    function initialize() {
        switchTab('Consignment');
        setInterval(fetchAndRender, POLL_MS);
    }
    initialize();
});