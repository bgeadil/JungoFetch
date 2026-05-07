// ==UserScript==
// @name         CRM Auto Fetcher (Unified)
// @namespace    info.bge-adil.eu
// @match        http://localhost:*/*
// @match        https://preprod.bge-adil.eu/*
// @match        https://info.bge-adil.eu/*
// @match        https://jungo2.bge.asso.fr/libres_resultats*
// @match        https://jungo2.bge.asso.fr/libres_requete/812011
// @match        https://jungo2.bge.asso.fr/libres_requete/1272011
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

// V 07.05.26

(function () {
    'use strict';

    const isApp = location.hostname.includes('info.bge-adil.eu') ||
                  location.hostname.includes('localhost') ||
                  location.hostname.includes('preprod.bge-adil.eu');

    const isCRM = location.hostname === 'jungo2.bge.asso.fr';
    const isResultPage = location.pathname === '/libres_resultats';

    // Message listener commun
    if (isApp || isCRM) {
        window.addEventListener('message', (event) => {

            if (event.data?.type === 'tampermonkeyCheck') {

                const allowedOrigins = [
                    'http://localhost',
                    'https://preprod.bge-adil.eu',
                    'https://info.bge-adil.eu'
                ];

                if (allowedOrigins.includes(event.origin)) {
                    event.source.postMessage({ type: 'tampermonkeyActive' }, event.origin);
                }
            }
        });
    }

    // =========================
    // PARTIE APPLICATION
    // =========================

    if (isApp) {

        console.log("✅ CRM Fetcher: App side ready");

        // 🔁 SPA keep alive
        const observer = new MutationObserver(() => {
            window.postMessage({ type: 'tampermonkeyActive' }, '*');
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        window.addEventListener('message', async (event) => {

            // =========================
            // CLIENT
            // =========================

            if (event.data?.type === 'storeClientId') {

                const clientId = event.data.clientId;

                await GM_setValue('jungoClientId', clientId);
                await GM_setValue('currentMode', 'client');

                console.log('[CRM Fetcher] Stored client ID and mode: client');

                window.open(
                    'https://jungo2.bge.asso.fr/libres_requete/812011',
                    '_blank'
                );
            }

            // =========================
            // AGENDA TODAY
            // =========================

            if (event.data?.type === 'fetchAgenda') {

                await GM_setValue('currentMode', 'agenda');
                await GM_setValue('agendaReady', false);

                console.log('[CRM Fetcher] Mode set to: agenda');

                window.open(
                    'https://jungo2.bge.asso.fr/libres_requete/1272011',
                    '_blank'
                );
            }

            // =========================
            // AGENDA CUSTOM DATES
            // =========================

            if (event.data?.type === 'fetchAgendaTomorrow') {

                const {
                    startDate,
                    endDate
                } = event.data;

                await GM_setValue('currentMode', 'agenda_tomorrow');
                await GM_setValue('agendaReady', false);

                await GM_setValue('agendaStartDate', startDate);
                await GM_setValue('agendaEndDate', endDate);

                console.log(
                    '[CRM Fetcher] Mode set to: agenda_tomorrow',
                    startDate,
                    endDate
                );

                window.open(
                    'https://jungo2.bge.asso.fr/libres_requete/1272011',
                    '_blank'
                );
            }

            // =========================
            // MATRICE
            // =========================

            if (event.data?.type === 'getMatrice') {

                const {
                    matriceId,
                    username
                } = event.data;

                await GM_setValue('currentMode', 'matrice');
                await GM_setValue('matriceId', matriceId);
                await GM_setValue('username', username);

                console.log(
                    '[CRM Fetcher] Mode set to: matrice',
                    matriceId,
                    username
                );

                window.open(
                    `https://jungo2.bge.asso.fr/libres_requete/${matriceId}`,
                    '_blank'
                );
            }
        });
    }

    // =========================
    // PARTIE CRM RESULTATS
    // =========================

    if (isCRM && isResultPage) {

        console.log("✅ CRM Fetcher: result page loaded");

        (async () => {

            const mode = await GM_getValue('currentMode');

            console.log('[CRM Fetcher] Mode:', mode);

            // =========================
            // CLIENT
            // =========================

            if (mode === 'client') {

                const clientId = await GM_getValue('jungoClientId');

                if (!clientId) {
                    console.warn('[CRM Fetcher] No stored client ID found.');
                    return;
                }

                const input = [...document.querySelectorAll('input')]
                    .find(el => el.value === '58849011');

                const button = document.querySelector(
                    '#tableaux_libres_resultats_lancer'
                );

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

            // =========================
            // AGENDA TODAY
            // =========================

            if (mode === 'agenda') {

                const agendaReady = await GM_getValue('agendaReady');

                if (!agendaReady) {

                    const now = new Date();

                    const pad = (n) => String(n).padStart(2, '0');

                    const dateStr =
                        `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

                    const timeStart = `${dateStr} 08:00`;
                    const timeEnd = `${dateStr} 20:00`;

                    const inputs = document.querySelectorAll('input');

                    inputs.forEach(input => {

                        if (input.value.includes('01/01/2025 08:00')) {

                            input.value = timeStart;

                            input.dispatchEvent(
                                new Event('input', { bubbles: true })
                            );
                        }

                        if (input.value.includes('31/12/2025 20:00')) {

                            input.value = timeEnd;

                            input.dispatchEvent(
                                new Event('input', { bubbles: true })
                            );
                        }
                    });

                    const button = document.querySelector(
                        '#tableaux_libres_resultats_lancer'
                    );

                    if (button) {

                        await GM_setValue('agendaReady', true);

                        setTimeout(() => button.click(), 500);

                        return;
                    }
                }
            }

            // =========================
            // AGENDA CUSTOM DATES
            // =========================

            if (mode === 'agenda_tomorrow') {

                const agendaReady = await GM_getValue('agendaReady');

                if (!agendaReady) {

                    const startDate = await GM_getValue('agendaStartDate');
                    const endDate = await GM_getValue('agendaEndDate');

                    const timeStart = `${startDate} 08:00`;
                    const timeEnd = `${endDate} 20:00`;

                    const inputs = document.querySelectorAll('input');

                    inputs.forEach(input => {

                        if (input.value.includes('01/01/2025 08:00')) {

                            input.value = timeStart;

                            input.dispatchEvent(
                                new Event('input', { bubbles: true })
                            );
                        }

                        if (input.value.includes('31/12/2025 20:00')) {

                            input.value = timeEnd;

                            input.dispatchEvent(
                                new Event('input', { bubbles: true })
                            );
                        }
                    });

                    const button = document.querySelector(
                        '#tableaux_libres_resultats_lancer'
                    );

                    if (button) {

                        await GM_setValue('agendaReady', true);

                        setTimeout(() => button.click(), 500);

                        return;
                    }
                }
            }

            // =========================
            // MATRICE
            // =========================

            if (mode === 'matrice') {

                const button = document.querySelector(
                    '#tableaux_libres_resultats_lancer'
                );

                if (button) {

                    button.click();

                    return;
                }
            }

            // =========================
            // SCRAPING
            // =========================

            observeAndReturnTable();

        })();
    }

    // =========================
    // SCRAPING COMMUN
    // =========================

    async function observeAndReturnTable() {

        const mode = await GM_getValue('currentMode');

        let attempt = 0;
        const maxAttempts = 30;

        const intervalId = setInterval(async () => {

            attempt++;

            const tables = document.querySelectorAll(
                'table.table.table-striped.table-hover.table-bordered'
            );

            const resultTable = tables[1];

            if (resultTable) {

                clearInterval(intervalId);

                console.log('[CRM Fetcher] ✅ Table found, parsing…');

                const headers = [...resultTable.querySelectorAll('thead th')]
                    .map(th => th.textContent.trim());

                const rows = [...resultTable.querySelectorAll('tbody tr')]
                    .map(tr => {

                        const cells = [...tr.querySelectorAll('td')]
                            .map(td => td.textContent.trim());

                        return headers.reduce((acc, header, i) => {

                            acc[header] = cells[i] || '';

                            return acc;

                        }, {});
                    });

                console.log(
                    `[CRM Fetcher] ✅ Scraped ${mode} result table:`,
                    rows
                );

                if (window.opener) {

                    window.opener.postMessage({

                        type:
                            mode === 'agenda' ||
                            mode === 'agenda_tomorrow'
                                ? 'agendaData'
                                : 'crmData',

                        data: rows

                    }, '*');

                    console.log(
                        `[CRM Fetcher] 📤 Sent ${mode} result table to opener`
                    );
                }

                // CLEANUP

                await GM_setValue('currentMode', null);
                await GM_setValue('agendaReady', null);

                await GM_setValue('agendaStartDate', null);
                await GM_setValue('agendaEndDate', null);

                setTimeout(() => window.close(), 1000);

            } else if (attempt >= maxAttempts) {

                clearInterval(intervalId);

                console.warn(
                    '[CRM Fetcher] ❌ Table not found after max attempts'
                );

                alert(
                    "CRM Fetcher: La table de résultats n'a pas pu être trouvée après 30 secondes."
                );

            } else {

                console.log(
                    `[CRM Fetcher] ⏳ Attempt ${attempt}: Table not found yet...`
                );
            }

        }, 1000);
    }

})();
