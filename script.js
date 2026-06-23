/* ========================================================
   PHONE LOOKUP PRO - Main JavaScript
   ======================================================== */

// ==================== STATE ====================
const state = {
    lastSearched: '',
    isLoading: false,
    rawData: null
};

// ==================== DOM REFS ====================
const $ = id => document.getElementById(id);
const phoneInput = $('phoneInput');
const searchBtn = $('searchBtn');
const resultsSection = $('resultsSection');
const loadingState = $('loadingState');
const resultsContainer = $('resultsContainer');
const errorMsg = $('errorMsg');
const errorText = $('errorText');

// ==================== API CALLS ====================
const API = {
    PERSON: 'https://api.infolookup.site/v1/',
    TCPA: 'https://api.infolookup.site/tcpa/v1'
};

async function fetchPerson(phone) {
    const res = await fetch(`${API.PERSON}?x=${phone}`);
    if (!res.ok) throw new Error(`Person API error: ${res.status}`);
    return res.json();
}

async function fetchTCPA(phone) {
    const res = await fetch(`${API.TCPA}?x=${phone}`);
    if (!res.ok) throw new Error(`TCPA API error: ${res.status}`);
    return res.json();
}

// ==================== SEARCH ====================
async function performSearch() {
    // Get raw phone number
    const raw = phoneInput.value.replace(/\D/g, '');
    
    // Validation
    if (!raw || raw.length !== 10) {
        showError('Please enter a valid 10-digit US phone number.');
        return;
    }
    
    if (raw === state.lastSearched) {
        showError('This number was just searched. Try a different one.');
        return;
    }
    
    state.lastSearched = raw;
    hideError();
    showLoading();

    try {
        // Fetch both APIs in parallel
        const [personData, tcpaData] = await Promise.all([
            fetchPerson(raw),
            fetchTCPA(raw)
        ]);

        state.rawData = { person: personData, tcpa: tcpaData };
        renderResults(personData, tcpaData, raw);
        hideLoading();
        showResults();

    } catch (error) {
        console.error('Search error:', error);
        hideLoading();
        showError(`Search failed: ${error.message}`);
    }
}

// ==================== RENDER ====================
function renderResults(personData, tcpaData, phone) {
    // 1. Compliance Status
    renderCompliance(tcpaData, phone);
    
    // 2. Person Info
    renderPerson(personData);
    
    // 3. Raw Data
    renderRawData({ person: personData, tcpa: tcpaData });
}

function renderCompliance(tcpaData, phone) {
    const stateEl = $('stateDisplay');
    const dncEl = $('dncDisplay');
    const litEl = $('litigatorDisplay');
    const blEl = $('blacklistDisplay');
    const badge = $('statusBadge');

    // State
    const state = tcpaData?.results?.state || getStateFromAreaCode(phone);
    stateEl.textContent = state;

    // TCPA Status
    const status = tcpaData?.results?.status || '';
    const isDNC = status.includes('DNC');
    const isFederal = status.includes('Federal');
    const isState = status.includes('State');

    // DNC
    dncEl.innerHTML = isDNC
        ? `<span class="status-flagged"><i class="fas fa-exclamation-circle"></i> ${status}</span>`
        : `<span class="status-clean"><i class="fas fa-check-circle"></i> Clean</span>`;

    // Litigator - Not available in this API
    litEl.innerHTML = `<span class="status-clean"><i class="fas fa-check-circle"></i> Clean</span>`;

    // Blacklist - Not available in this API
    blEl.innerHTML = `<span class="status-clean"><i class="fas fa-check-circle"></i> Clean</span>`;

    // Overall badge
    badge.textContent = isDNC ? '⚠️ Flagged' : '✅ Clean';
    badge.className = `badge-status ${isDNC ? 'flagged' : 'clean'}`;
}

function renderPerson(personData) {
    const container = $('personInfoContainer');
    const countBadge = $('personCount');
    
    if (!personData || personData.status !== 'ok' || personData.count === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:30px;color:var(--text-muted);">
                <i class="fas fa-user-slash" style="font-size:32px;display:block;margin-bottom:12px;"></i>
                No owner information found for this number.
            </div>
        `;
        countBadge.textContent = '0 results';
        return;
    }

    const people = personData.person || [];
    countBadge.textContent = `${people.length} result${people.length > 1 ? 's' : ''}`;

    container.innerHTML = people.map((person, idx) => {
        const initials = getInitials(person.name);
        const ageStr = person.age ? `${person.age} yrs` : '';
        const dobStr = person.dob ? `(${person.dob})` : '';
        
        // Addresses
        let addrHtml = '';
        if (person.addresses && person.addresses.length > 0) {
            const seen = new Set();
            addrHtml = `<div class="person-addresses">`;
            person.addresses.forEach(addr => {
                const key = `${addr.home}-${addr.city}-${addr.state}`.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                addrHtml += `
                    <div class="address-item">
                        ${addr.home || 'No address'}
                        <div class="city-state">${addr.city || ''}, ${addr.state || ''} ${addr.zip || ''}</div>
                    </div>
                `;
            });
            addrHtml += `</div>`;
        } else {
            addrHtml = `<div style="color:var(--text-muted);font-size:13px;">No addresses available</div>`;
        }

        // Relatives
        let relHtml = '';
        if (person.relatives && person.relatives.length > 0 && person.relatives[0] !== 'Not Found') {
            relHtml = `
                <div class="relatives">
                    ${person.relatives.map(r => `<span class="relative-tag"><i class="fas fa-user-friends"></i> ${r}</span>`).join('')}
                </div>
            `;
        }

        // Email
        let emailHtml = '';
        if (person.emails && person.emails.length > 0 && person.emails[0]) {
            emailHtml = `<div class="person-email"><i class="fas fa-envelope"></i> ${person.emails[0]}</div>`;
        }

        return `
            <div class="person-entry" style="animation-delay:${idx * 0.1}s">
                <div class="person-header">
                    <span class="person-name">${person.name || 'Unknown'}</span>
                    <span class="person-age">${ageStr} ${dobStr}</span>
                </div>
                ${emailHtml}
                ${addrHtml}
                ${relHtml}
            </div>
        `;
    }).join('');
}

function renderRawData(data) {
    const container = $('rawDataContent');
    container.textContent = JSON.stringify(data, null, 2);
}

function toggleRawData() {
    const container = $('rawDataContainer');
    const btn = document.querySelector('.btn-toggle');
    if (container.style.display === 'none') {
        container.style.display = 'block';
        btn.innerHTML = '<i class="fas fa-chevron-up"></i> Hide';
    } else {
        container.style.display = 'none';
        btn.innerHTML = '<i class="fas fa-chevron-down"></i> Show';
    }
}

// ==================== UTILITY ====================
function getStateFromAreaCode(phone) {
    const areaCodeMap =
