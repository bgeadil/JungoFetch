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
                // Only respond to allowed origins
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
                // 👉 Before form is submitted: inject ID and submit
                console.log("[CRM Fetcher] Found input, injecting ID and submitting…");

                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.value = clientId;
                input.dispatchEvent(new Event('input', { bubbles: true }));

                button.click(); // this reloads the page
                return;
            }

            // 👉 After page reload: observe and scrape the correct table
            const observer = new MutationObserver(() => {
                const tables = document.querySelectorAll('table.table.table-striped.table-hover.table-bordered');
                const resultTable = tables[1]; // ✅ second one is the actual data table

                if (!resultTable) return;

                observer.disconnect();

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
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            console.log('[CRM Fetcher] ⏳ Waiting for result table to appear…');
        })();
    }

})();
