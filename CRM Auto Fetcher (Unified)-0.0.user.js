// ==UserScript==
// @name         CRM Auto Fetcher (Unified)
// @namespace    info.bge-adil.eu
// @match        http://localhost:*/*
// @match        https://preprod.bge-adil.eu/*
// @match        https://info.bge-adil.eu/*
// @match        https://jungo2.bge.asso.fr/libres_resultats
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    const isApp = location.hostname.includes('info.bge-adil.eu') ||
                  location.hostname.includes('localhost') ||
                  location.hostname.includes('preprod.bge-adil.eu');

    const isCRM = location.hostname === 'jungo2.bge.asso.fr';
    const isResultPage = location.pathname === '/libres_resultats';

    if (isApp || isCRM) {
        window.addEventListener('message', (event) => {
            if (event.data?.type === 'tampermonkeyCheck') {
                const allowedOrigins = [
                    'http://localhost',
                    'https://preprod.bge-adil.eu',
                    'https://info.bge-adil.eu'
                ];
                if (allowedOrigins.includes(event.origin)) {
                    event.source.postMessage('tampermonkeyActive', event.origin);
                }
            }
        });
    }

    if (isApp) {
        console.log("✅ CRM Fetcher: App side ready");

        setTimeout(() => {
            window.postMessage({ type: 'tampermonkeyActive' }, '*');
        }, 300);

        window.addEventListener('message', async (event) => {
            if (event.data?.type === 'storeClientId') {
                const clientId = event.data.clientId;
                await GM_setValue('jungoClientId', clientId);
                await GM_setValue('currentMode', 'client');
                console.log('[CRM Fetcher] Stored client ID and mode: client');
                window.open('https://jungo2.bge.asso.fr/libres_requete/812011', '_blank');
            }

            if (event.data?.type === 'fetchAgenda') {
                await GM_setValue('currentMode', 'agenda');
                await GM_setValue('agendaReady', false);
                console.log('[CRM Fetcher] Mode set to: agenda');
                window.open('https://jungo2.bge.asso.fr/libres_requete/1272011', '_blank');
            }

            if (event.data?.type === 'getMatrice') {
                const { matriceId, username } = event.data;
                await GM_setValue('currentMode', 'matrice');
                await GM_setValue('matriceId', matriceId);
                await GM_setValue('username', username);
                console.log('[CRM Fetcher] Mode set to: matrice', matriceId, username);
                window.open(`https://jungo2.bge.asso.fr/libres_requete/${matriceId}`, '_blank');
            }

        });
    }

    if (isCRM && isResultPage) {
        console.log("✅ CRM Fetcher: result page loaded");

        (async () => {
            const mode = await GM_getValue('currentMode');
            console.log('[CRM Fetcher] Mode:', mode);

            if (mode === 'client') {
                const clientId = await GM_getValue('jungoClientId');
                if (!clientId) {
                    console.warn('[CRM Fetcher] No stored client ID found.');
                    return;
                }

                const input = [...document.querySelectorAll('input')].find(el => el.value === '58849011');
                const button = document.querySelector('#tableaux_libres_resultats_lancer');

                if (input && button) {
                    console.log("[CRM Fetcher] Injecting client ID…");

                    input.value = '';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.value = clientId;
                    input.dispatchEvent(new Event('input', { bubbles: true }));

                    button.click();
                    return;
                }
            }

            if (mode === 'agenda') {
                const agendaReady = await GM_getValue('agendaReady');
                if (!agendaReady) {
                    const now = new Date();
                    const pad = (n) => String(n).padStart(2, '0');
                    const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
                    const timeStart = `${dateStr} 08:00`;
                    const timeEnd = `${dateStr} 20:00`;

                    const inputs = document.querySelectorAll('input');
                    inputs.forEach(input => {
                        if (input.value.includes('01/01/2025 08:00')) {
                            input.value = timeStart;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        if (input.value.includes('31/12/2025 20:00')) {
                            input.value = timeEnd;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    });

                    const button = document.querySelector('#tableaux_libres_resultats_lancer');
                    if (button) {
                        await GM_setValue('agendaReady', true);
                        setTimeout(() => button.click(), 500);
                        return;
                    }
                }
            }

            if (mode === 'matrice') {
                const username = await GM_getValue('username');
                if (!username) {
                    console.warn('[CRM Fetcher] No username provided.');
                    return;
                }
            
                // Trouver le SELECT multiple contenant "QUIJOUX Florent"
                const selects = [...document.querySelectorAll('select[multiple]')];
                const targetSelect = selects.find(select => {
                    return [...select.options].some(opt => opt.selected && opt.text.includes('QUIJOUX Florent'));
                });
            
                if (!targetSelect) {
                    console.warn('[CRM Fetcher] No select with QUIJOUX Florent selected found.');
                    return;
                }
            
                // Trouver l'option correspondant à username
                const optionToSelect = [...targetSelect.options].find(opt =>
                    opt.text.trim().toLowerCase() === username.trim().toLowerCase()
                );
            
                if (!optionToSelect) {
                    console.warn(`[CRM Fetcher] Username "${username}" not found in select options.`);
                    return;
                }
            
                // Sélectionner la nouvelle valeur avec jQuery + Chosen
                if (window.jQuery) {
                    const $select = jQuery(targetSelect);
                    $select.val([optionToSelect.value]); // sélectionne une seule valeur
                    $select.trigger('chosen:updated');   // met à jour l'affichage Chosen
                    $select.trigger('change');           // notifie tout listener de la mise à jour
                } else {
                    console.warn('jQuery not available. Cannot update Chosen select properly.');
                    return;
                }
            
                // Lancer la recherche
                const button = document.querySelector('#tableaux_libres_resultats_lancer');
                if (button) {
                    console.log('[CRM Fetcher] Username injected and ready to launch.');
                    setTimeout(() => button.click(), 500);
                } else {
                    console.warn('[CRM Fetcher] Launch button not found.');
                }
            }

    async function observeAndReturnTable() {
        const mode = await GM_getValue('currentMode');
        let attempt = 0;
        const maxAttempts = 30;
        const intervalId = setInterval(() => {
            attempt++;
            const tables = document.querySelectorAll('table.table.table-striped.table-hover.table-bordered');
            const resultTable = tables[1];

            if (resultTable) {
                clearInterval(intervalId);
                console.log('[CRM Fetcher] ✅ Table found, parsing…');

                const headers = [...resultTable.querySelectorAll('thead th')].map(th =>
                    th.textContent.trim()
                );

                const rows = [...resultTable.querySelectorAll('tbody tr')].map(tr => {
                    const cells = [...tr.querySelectorAll('td')].map(td => td.textContent.trim());
                    return headers.reduce((acc, header, i) => {
                        acc[header] = cells[i] || '';
                        return acc;
                    }, {});
                });

                console.log(`[CRM Fetcher] ✅ Scraped ${mode} result table:`, rows);

                if (window.opener) {
                    window.opener.postMessage({
                        type: mode === 'agenda' ? 'agendaData' : 'crmData',
                        data: rows
                    }, '*');
                    console.log(`[CRM Fetcher] 📤 Sent ${mode} result table to opener`);
                }

                // Clean up after sending
                GM_setValue('currentMode', null);
                GM_setValue('agendaReady', null);

                setTimeout(() => window.close(), 1000);
            } else if (attempt >= maxAttempts) {
                clearInterval(intervalId);
                console.warn('[CRM Fetcher] ❌ Table not found after max attempts');
                alert('CRM Fetcher: La table de résultats n’a pas pu être trouvée après 30 secondes.');
            } else {
                console.log(`[CRM Fetcher] ⏳ Attempt ${attempt}: Table not found yet...`);
            }
        }, 1000);
    }

})();
