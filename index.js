const MIN_ORE = "Pépite de cuivre";
const EXCLUDED_FROM_PAYMENT = ["Écaille de tatou", "Écaille de tortue", "Bloc de fer", "Bloc de cuivre"];
const DATA_FILE = 'soufflet.json';
const DATA_LANG_FILE = 'lang.json';

let uiTexts = {};
let currentLang = 'fr';
let allItems = [];
let conversion = {};
let sortedOres = [];
let currentTotalRequired = 0;
let selectedItem = null;

const itemInput = document.getElementById('item-input');
const optionsContainer = document.getElementById('options-container');
const grid = document.getElementById('calculator-grid');
const resultDiv = document.getElementById('result');
const paymentStatus = document.getElementById('payment-status');
const tabButtons = document.querySelectorAll('.tab-btn');
const langButtons = document.querySelectorAll('.lang-btn');
const priceContainer = document.getElementById('total-price-container');

Promise.all([
    fetch(DATA_LANG_FILE)
        .then(response => {
            if (!response.ok) throw new Error("Impossible de lire le fichier de langue.");
            return response.json();
        })
        .catch(error => {
            console.error("Erreur de chargement des textes : " + error.message);
            return {
                fr: {
                    "title": "🔥 Le Soufflet 🔥",
                    "orderTitle": "1. Commande",
                    "balanceTitle": "2. Balance",
                    "tabAll": "Tout",
                    "tabTrim": "Trim",
                    "tabBooks": "Livres",
                    "placeholder": "-- Taper pour chercher un objet --",
                    "invoiceDetails": "Détails de la facture :",
                    "totalPrice": "Prix total converti :",
                    "selectItem": "Sélectionne un objet pour commencer le calcul.",
                    "exactChange": "Le compte est bon !",
                    "generous": "C'est généreux.<br>Le Soufflet doit rendre la monnaie :",
                    "missing": "Les calculs sont pas bons, Kévin !<br>Il manque :",
                    "footer": "Conçu pour les Verteluniens.",
                    "resourceCost": "Coût ressource :",
                    "laborVendre": "Main d'œuvre : +1x ",
                    "laborVendreForfait": "Main d'œuvre : +1x Pépite de cuivre",
                    "laborTrim": "Main d'œuvre : Offerte !",
                    "laborLivre": "Main d'œuvre : Offerte !",
                    "nothing": "rien"
                }
            };
        }),
    fetch(DATA_FILE)
        .then(response => {
            if (!response.ok) throw new Error("Impossible de lire le JSON.");
            return response.json();
        })
])
    .then(([langData, data]) => {
        uiTexts = langData;
        const processCategory = (arr, categoryType) => {
            if (arr) {
                arr.forEach(item => {
                    if (categoryType === 'trim' || item.available !== false) {
                        allItems.push({ ...item, type: categoryType });
                    }
                });
            }
        };

        processCategory(data.Vendre, 'vendre');
        processCategory(data.Trim, 'trim');
        processCategory(data.Livres, 'livre');

        const baseMax = data.Correspondance[MIN_ORE];
        for (let ore in data.Correspondance) {
            let val = baseMax / data.Correspondance[ore];
            conversion[ore] = val;
            if (!EXCLUDED_FROM_PAYMENT.includes(ore)) {
                sortedOres.push({ name: ore, val: val });
            }
        }
        sortedOres.sort((a, b) => b.val - a.val);

        const checkTabStatus = (btnId, categoryArray) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;

            const isDisabled = !categoryArray || categoryArray.length === 0;

            if (isDisabled) {
                btn.disabled = true;
                btn.classList.add('tab-disabled');
                btn.classList.remove('active');
            }
        };

        checkTabStatus('tab-all', data.Vendre);
        checkTabStatus('tab-trim', data.Trim);
        checkTabStatus('tab-books', data.Livres);

        const currentActive = document.querySelector('.tab-btn.active');
        if (!currentActive) {
            const firstAvailableTab = document.querySelector('.tab-btn:not([disabled])');
            if (firstAvailableTab) firstAvailableTab.classList.add('active');
        }

        initApp();
    })
    .catch(error => {
        document.getElementById('loading').innerText = "Erreur : " + error.message;
    });

function getOreName(oreNameFr) {
    return currentLang === 'fr' ? oreNameFr : (uiTexts[currentLang][oreNameFr] || oreNameFr);
}

function initApp() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';

    renderDropdown();
    renderGrid();

    langButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            langButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLang = btn.getAttribute('data-lang');

            updateStaticTexts();
            renderDropdown();
            renderGrid();

            if (selectedItem) {
                itemInput.value = currentLang === 'fr' ? selectedItem.name : (selectedItem.name_en || selectedItem.name);
            }
            calculateTotal();
        });
    });

    itemInput.addEventListener('focus', () => {
        optionsContainer.style.display = 'block';
        filterOptions();
    });

    itemInput.addEventListener('input', () => {
        optionsContainer.style.display = 'block';
        filterOptions();
        calculateTotal();
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-dropdown')) {
            optionsContainer.style.display = 'none';
        }
    });

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            optionsContainer.style.display = 'block';
            filterOptions();
        });
    });
}

function updateStaticTexts() {
    const lang = currentLang;
    document.documentElement.lang = lang;
    document.getElementById('app-title').innerHTML = uiTexts[lang].title;
    document.getElementById('title-order').textContent = uiTexts[lang].orderTitle;
    document.getElementById('title-balance').textContent = uiTexts[lang].balanceTitle;
    document.getElementById('tab-all').textContent = uiTexts[lang].tabAll;
    document.getElementById('tab-trim').textContent = uiTexts[lang].tabTrim;
    document.getElementById('tab-books').textContent = uiTexts[lang].tabBooks;
    itemInput.placeholder = uiTexts[lang].placeholder;
    document.getElementById('label-invoice-details').textContent = uiTexts[lang].invoiceDetails;
    document.getElementById('label-total-price').textContent = uiTexts[lang].totalPrice;
    document.getElementById('app-footer').textContent = uiTexts[lang].footer;
}

function renderDropdown() {
    optionsContainer.innerHTML = '';
    allItems.sort((a, b) => {
        const nameA = currentLang === 'fr' ? a.name : (a.name_en || a.name);
        const nameB = currentLang === 'fr' ? b.name : (b.name_en || b.name);
        return nameA.localeCompare(nameB, currentLang);
    });

    allItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'option-item';
        const displayName = currentLang === 'fr' ? item.name : (item.name_en || item.name);
        div.textContent = displayName;
        div.setAttribute('data-type', item.type);
        div.addEventListener('click', () => {
            selectedItem = item;
            itemInput.value = displayName;
            optionsContainer.style.display = 'none';
            calculateTotal();
        });
        optionsContainer.appendChild(div);
    });
}

function renderGrid() {
    const currentValues = {};
    document.querySelectorAll('.pay-input').forEach(input => {
        currentValues[input.getAttribute('data-ore')] = input.value;
    });

    grid.innerHTML = '';
    sortedOres.forEach(ore => {
        const div = document.createElement('div');
        div.className = 'ore-input';
        const savedValue = currentValues[ore.name] || "0";
        div.innerHTML = `
                    <label>${getOreName(ore.name)}</label>
                    <input type="number" min="0" value="${savedValue}" data-ore="${ore.name}" class="pay-input">
                `;
        grid.appendChild(div);
    });

    document.querySelectorAll('.pay-input').forEach(input => {
        input.addEventListener('input', updatePayment);
    });

    updateInputRestrictions();
}

function filterOptions() {
    const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-category');
    const searchText = itemInput.value.toLowerCase();
    const options = optionsContainer.querySelectorAll('.option-item');

    options.forEach(opt => {
        const type = opt.getAttribute('data-type');
        const name = opt.textContent.toLowerCase();
        const matchesTab = (type === activeTab);
        const matchesSearch = name.includes(searchText);

        if (matchesTab && matchesSearch) {
            opt.style.display = 'block';
        } else {
            opt.style.display = 'none';
        }
    });
}

function formatOres(amount) {
    if (amount === 0) return uiTexts[currentLang].nothing;
    let result = [];
    let remaining = amount;

    for (let ore of sortedOres) {
        if (remaining >= ore.val) {
            let qty = Math.floor(remaining / ore.val);
            result.push(`<b>${qty}x ${getOreName(ore.name)}</b>`);
            remaining %= ore.val;
        }
    }
    return result.join("<br>");
}

function updateInputRestrictions() {
    const isLivre = selectedItem && selectedItem.type === 'livre';
    document.querySelectorAll('.pay-input').forEach(input => {
        const ore = input.getAttribute('data-ore');
        const container = input.closest('.ore-input');

        if (isLivre && ore !== "Émeraude") {
            input.value = "0";
            input.disabled = true;
            if (container) {
                container.style.opacity = "0.25";
                container.style.pointerEvents = "none";
            }
        } else {
            input.disabled = false;
            if (container) {
                container.style.opacity = "1";
                container.style.pointerEvents = "auto";
            }
        }
    });
}

function calculateTotal() {
    const text = itemInput.value.trim().toLowerCase();

    if (!selectedItem || (currentLang === 'fr' ? selectedItem.name : (selectedItem.name_en || selectedItem.name)).toLowerCase() !== text) {
        selectedItem = allItems.find(i =>
            i.name.toLowerCase() === text ||
            (i.name_en && i.name_en.toLowerCase() === text)
        ) || null;
    }

    if (!selectedItem) {
        resultDiv.style.display = 'none';
        currentTotalRequired = 0;
        updateInputRestrictions();
        updatePayment();
        return;
    }

    resultDiv.style.display = 'block';
    const details = document.getElementById('bill-details');
    details.innerHTML = '';
    let totalValue = 0;
    const lang = currentLang;

    if (selectedItem.type === 'vendre') {
        let lowestValue = Infinity;
        let lowestOre = null;

        selectedItem.mat.forEach(m => {
            if (conversion[m.name]) {
                totalValue += conversion[m.name] * m.quantity;
                const matName = lang === 'fr' ? m.name : (m.name_en || m.name);
                details.innerHTML += `<li>${uiTexts[lang].resourceCost} ${m.quantity}x ${matName}</li>`;

                if (conversion[m.name] < lowestValue) {
                    lowestValue = conversion[m.name];
                    lowestOre = m.name;
                }
            }
        });

        if (lowestOre) {
            totalValue += conversion[lowestOre];
            details.innerHTML += `<li><strong>${uiTexts[lang].laborVendre}${getOreName(lowestOre)}</strong></li>`;
        } else {
            totalValue += conversion[MIN_ORE];
            details.innerHTML += `<li><strong>${uiTexts[lang].laborVendreForfait}</strong></li>`;
        }
        priceContainer.style.display = 'block';
    } else if (selectedItem.type === 'livre') {
        selectedItem.mat.forEach(m => {
            if (conversion[m.name]) {
                totalValue += conversion[m.name] * m.quantity;
                const matName = lang === 'fr' ? m.name : (m.name_en || m.name);
                details.innerHTML += `<li>${uiTexts[lang].resourceCost} ${m.quantity}x ${matName}</li>`;
            }
        });
        const laborText = uiTexts[lang].laborLivre;
        details.innerHTML += `<li><strong>${laborText}</strong></li>`;
        priceContainer.style.display = 'none';
    } else if (selectedItem.type === 'trim') {
        selectedItem.mat.forEach(m => {
            if (conversion[m.name]) {
                totalValue += conversion[m.name] * m.quantity;
                const matName = lang === 'fr' ? m.name : (m.name_en || m.name);
                details.innerHTML += `<li>${uiTexts[lang].resourceCost} ${m.quantity}x ${matName}</li>`;
            }
        });
        const laborText = uiTexts[lang].laborTrim;
        details.innerHTML += `<li><strong>${laborText}</strong></li>`;
        priceContainer.style.display = 'none';
    }

    currentTotalRequired = totalValue;
    document.getElementById('total-readable').innerHTML = formatOres(totalValue);

    updateInputRestrictions();
    updatePayment();
}

function updatePayment() {
    if (currentTotalRequired === 0) {
        paymentStatus.innerHTML = uiTexts[currentLang].selectItem;
        return;
    }

    let totalPaid = 0;
    document.querySelectorAll('.pay-input').forEach(input => {
        const ore = input.getAttribute('data-ore');
        const qty = parseInt(input.value) || 0;
        totalPaid += qty * conversion[ore];
    });

    const diff = totalPaid - currentTotalRequired;
    const lang = currentLang;

    if (diff === 0) {
        paymentStatus.innerHTML = `<span class="good">${uiTexts[lang].exactChange}</span>`;
    } else {
        let formattedDiff = "";
        
        if (selectedItem && selectedItem.type === 'livre') {
            let emeraldsQty = Math.abs(diff) / conversion["Émeraude"];
            formattedDiff = `<b>${emeraldsQty}x ${getOreName("Émeraude")}</b>`;
        } else if (selectedItem && selectedItem.type === 'trim') {
            let diamandsQty = Math.abs(diff) / conversion["Diamant"];
            formattedDiff = `<b>${diamandsQty}x ${getOreName("Diamant")}</b>`;
        } else {
            formattedDiff = formatOres(Math.abs(diff));
        }

        if (diff > 0) {
            paymentStatus.innerHTML = `<span class="good">${uiTexts[lang].generous}<br>${formattedDiff}</span>`;
        } else {
            paymentStatus.innerHTML = `<span class="bad">${uiTexts[lang].missing}<br>${formattedDiff}</span>`;
        }
    }
}

document.addEventListener('wheel', function (e) {
    if (e.target.classList.contains('pay-input')) {
        e.preventDefault();

        let step = parseFloat(e.target.step) || 1;
        let currentValue = parseFloat(e.target.value) || 0;

        if (e.deltaY < 0) {
            e.target.value = currentValue + step;
        } else {
            if (currentValue > 0) {
                e.target.value = currentValue - step;
            }
        }

        e.target.dispatchEvent(new Event('input'));
    }
}, { passive: false });