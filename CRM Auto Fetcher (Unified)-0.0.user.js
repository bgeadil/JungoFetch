// ==UserScript==
// @name         CRM Auto Fetcher (Unified)
// @namespace    info.bge-adil.eu
// @match        http://localhost:*/*
// @match        https://preprod.bge-adil.eu/*
// @match        https://info.bge-adil.eu/*
// @match        https://jungo2.bge.asso.fr/libres_resultats*
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
    const isDetailsPage = location.pathname.includes('/libres_requete/812011');

    // ✅ Respond to install check from app
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

    // ✅ Vue App Side — Store clientId and open CRM tab
    if (isApp) {
        console.log("✅ CRM Fetcher: App side ready");

        setTimeout(() => {
            window.postMessage({ type: 'tampermonkeyActive' }, '*');
        }, 300);

        window.addEventListener('message', async (event) => {
            if (event.data?.type === 'storeClientId') {
                const clientId = event.data.clientId;
                await GM_setValue('jungoClientId', clientId);
                console.log('[CRM Fetcher] Stored client ID:', clientId);

                window.open('https://jungo2.bge.asso.fr/libres_requete/812011', '_blank');
            }
        });
    }

    // ✅ CRM Side — libres_resultats logic (form + scraping)
    if (isCRM && isResultPage) {
        console.log("✅ CRM Fetcher: libres_resultats loaded");

        (async () => {
            const clientId = await GM_getValue('jungoClientId');
            if (!clientId) {
                console.warn('[CRM Fetcher] No stored client ID found.');
                return;
            }

            const input = [...document.querySelectorAll('input')].find(el => el.value === '58849011');
            const button = document.querySelector('#tableaux_libres_resultats_lancer');

            if (input && button) {
                console.log("[CRM Fetcher] Found input, injecting ID and submitting…");

                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.value = clientId;
                input.dispatchEvent(new Event('input', { bubbles: true }));

                button.click(); // this reloads the page
                return;
            }

            // 👉 Retry every second to detect result table
            let attempt = 0;
            const maxAttempts = 30; // Try for up to 30 seconds
            const intervalId = setInterval(() => {
                attempt++;

                const tables = document.querySelectorAll('table.table.table-striped.table-hover.table-bordered');
                const resultTable = tables[1]; // second table is the real data

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

                    console.log('[CRM Fetcher] ✅ Scraped real result table:', rows);

                    if (window.opener) {
                        window.opener.postMessage({
                            type: 'crmData',
                            data: rows
                        }, '*');

                        console.log('[CRM Fetcher] 📤 Sent result table to opener');
                    }

                    setTimeout(() => window.close(), 1000);
                } else if (attempt >= maxAttempts) {
                    clearInterval(intervalId);
                    console.warn('[CRM Fetcher] ❌ Table not found after max attempts');
                    alert('CRM Fetcher: La table de résultats n’a pas pu être trouvée après 30 secondes.');
                } else {
                    console.log(`[CRM Fetcher] ⏳ Attempt ${attempt}: Table not found yet...`);
                }
            }, 1000);
        })();
    }

})();
