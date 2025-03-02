const SPREADSHEET_NAME = "dagobert";
let sheetID;

// SHEET FÜGGVÉNYEK

async function checkOrCreateSpreadsheet() {
    showSpinner();
    document.getElementById("homePage").style.display = "none";

    try {
        let spreadsheetId = await findSpreadsheet(SPREADSHEET_NAME);

        if (!spreadsheetId) {
            spreadsheetId = await createSpreadsheet(SPREADSHEET_NAME);
        }

        sheetID = spreadsheetId;
        await getSpreadsheetData();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function findSpreadsheet(name) {
    const query = `name='${name}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed = false`;
    const response = await fetchWithToken(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
}

async function createSpreadsheet(name) {
    const currentDate = new Date();
    const monthNames = Array.from({ length: 3 }, (_, i) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    });

    const response = await fetchWithToken('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            properties: { title: name },
            sheets: monthNames.map(month => ({
                properties: { title: month },
                data: [{
                    rowData: [{
                        values: [
                            { userEnteredValue: { stringValue: 'ID' }},
                            { userEnteredValue: { stringValue: 'Name' }},
                            { userEnteredValue: { stringValue: 'Category' }},
                            { userEnteredValue: { stringValue: 'Payment mode' }},
                            { userEnteredValue: { stringValue: 'Date' }},
                            { userEnteredValue: { stringValue: 'Amount' }},
                            { userEnteredValue: { stringValue: 'Currency' }},
                            { userEnteredValue: { stringValue: 'Frequency' }},
                            { userEnteredValue: { stringValue: 'Paid' }},
                            { userEnteredValue: { stringValue: 'Comment' }}
                        ]
                    }]
                }]
            }))
        })
    });

    const data = await response.json();
    return data.spreadsheetId;
}

async function getSpreadsheetData(sheetName = null) {
    document.getElementById("homePage").style.display = "none";

    try {
        if (!sheetName) {
            const currentDate = new Date();
            sheetName = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        }

        // Ellenőrzi, létezik-e a tab
        const sheetMetadataResponse = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}`);
        const sheetMetadata = await sheetMetadataResponse.json();
        const sheet = sheetMetadata.sheets.find(sheet => sheet.properties.title === sheetName);

        if (!sheet) {
            console.log(`A ${sheetName} tab nem létezik. Létrehozás...`);
            await createSheet(sheetName); // Automatikus tab létrehozás
        }

        // Adatok lekérése az adott tabról
        const response = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${encodeURIComponent(sheetName)}`);
        const data = await response.json();

        // Ha a tab üres, alapértelmezett fejléc létrehozása
        if (!data.values || data.values.length === 0) {
            console.log(`A ${sheetName} tab üres. Alapértelmezett fejléc létrehozása...`);
            await addDefaultHeaders(sheetName);
        }

        // Az adatok újra lekérése az alapértelmezett fejléc hozzáadása után
        const refreshedResponse = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${encodeURIComponent(sheetName)}`);
        const refreshedData = await refreshedResponse.json();

        if (!refreshedData.values || refreshedData.values.length === 0) {
            throw new Error('A táblázat üres vagy nem találhatóak benne adatok.');
        }

        const columnHeaders = refreshedData.values[0]; // Fejléc
        const rows = refreshedData.values.slice(1); // Sorok

        const headerMap = columnHeaders.reduce((map, header, index) => {
            map[header] = index;
            return map;
        }, {});

        dataMap = {};
        rows.forEach(row => {
            const item = {
                id: row[headerMap["ID"]] || "",
                name: row[headerMap["Name"]] || "",
                category: row[headerMap["Category"]] || "",
                payment_mode: row[headerMap["Payment mode"]] || "",
                date: row[headerMap["Date"]] || "",
                amount: row[headerMap["Amount"]] || "",
                currency: row[headerMap["Currency"]] || "",
                frequency: row[headerMap["Frequency"]] || "",
                paid: row[headerMap["Paid"]] || "",
                comment: row[headerMap["Comment"]] || ""
            };
            dataMap[item.id] = item; // Adatok hozzáadása az id alapján
        });

        tabs = sheetMetadata.sheets.map(sheet => sheet.properties.title);
        activeTab = sheetName;
        sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetID}/edit`;

        renderData();
    } catch (error) {
        console.error('Hiba a getSpreadsheetData függvényben:', error);
    }
}

async function createSheet(sheetName) {
    try {
        const [year, month] = sheetName.split("-").map(Number);

        // Új tab létrehozása
        const requestBody = {
            requests: [
                {
                    addSheet: {
                        properties: { title: sheetName }
                    }
                }
            ]
        };

        const addSheetResponse = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}:batchUpdate`, {
            method: "POST",
            body: JSON.stringify(requestBody),
            headers: {
                "Content-Type": "application/json"
            }
        });

        if (!addSheetResponse.ok) {
            const errorText = await addSheetResponse.text();
            console.error("Hiba a tab létrehozásakor:", errorText);
            throw new Error("Nem sikerült létrehozni az új tabot.");
        }

        console.log(`A ${sheetName} tab sikeresen létrehozva.`);

        // Releváns előző tabok adatainak összegyűjtése
        const sheetMetadataResponse = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}`);
        const sheetMetadata = await sheetMetadataResponse.json();
        const availableTabs = sheetMetadata.sheets.map(sheet => sheet.properties.title);

        const relevantTabs = availableTabs.filter(tabName => {
            const [tabYear, tabMonth] = tabName.split("-").map(Number);
            const monthDifference = (year - tabYear) * 12 + (month - tabMonth);
            return monthDifference >= 0 && monthDifference <= 12; // Az elmúlt 12 hónapban releváns tabok
        });

        if (relevantTabs.length === 0) {
            console.log("Nincsenek releváns tabok a másoláshoz.");
            await addDefaultHeaders(sheetName);
            return;
        }

        // Az oszlopok új sorrendje
        const allHeaders = ["ID", "Name", "Category", "Payment mode", "Paid", "Date", "Amount", "Comment", "Currency", "Frequency"];
        let allRows = [];

        for (const tab of relevantTabs) {
            const response = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${encodeURIComponent(tab)}`);
            const data = await response.json();

            if (data.values && data.values.length > 0) {
                const headers = data.values[0];
                const rows = data.values.slice(1);
                const frequencyIndex = headers.indexOf("Frequency");
                const dateIndex = headers.indexOf("Date");

                const relevantRows = rows.filter(row => {
                    const frequency = parseInt(row[frequencyIndex], 10);
                    if (!frequency || frequency <= 0) return false; // Ha nincs frequency, vagy hibás, kihagyjuk

                    const [tabYear, tabMonth] = tab.split("-").map(Number);
                    const sourceMonthIndex = (tabYear - 1900) * 12 + tabMonth; // Számítjuk az abszolút hónapot
                    const targetMonthIndex = (year - 1900) * 12 + month;

                    // Csak akkor másoljuk, ha a frequency alapján illeszkedik
                    return (targetMonthIndex - sourceMonthIndex) % frequency === 0;
                });

                const filteredRows = relevantRows.map(row => {
                    const newRow = Array(allHeaders.length).fill("");

                    allHeaders.forEach((header, targetIndex) => {
                        const originalIndex = headers.indexOf(header);

                        if (header === "Paid") {
                            // Paid oszlop alapértelmezett értéke "No"
                            newRow[targetIndex] = "No";
                        } else if (header === "Comment") {
                            // Comment oszlop mindig üres
                            newRow[targetIndex] = "";
                        } else if (header === "Date") {
                            // Date oszlop dátum formátumának frissítése (pl. Jan 7.)
                            if (originalIndex !== -1 && row[originalIndex]) {
                                const originalDate = new Date(row[originalIndex]);
                                const updatedDate = new Date(year, month - 1, originalDate.getDate());
                                if (!isNaN(updatedDate.getTime())) {
                                    newRow[targetIndex] = updatedDate.toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric"
                                    }) + "."; // Hozzáadjuk a pontot
                                }
                            }
                        } else if (originalIndex !== -1) {
                            // Egyéb oszlopok értékeinek másolása
                            newRow[targetIndex] = row[originalIndex] || "";
                        }
                    });

                    return newRow;
                });

                filteredRows.forEach(row => {
                    const isDuplicate = allRows.some(existingRow => JSON.stringify(existingRow) === JSON.stringify(row));
                    if (!isDuplicate) {
                        allRows.push(row);
                    }
                });
            }
        }

        // Adatok beillesztése az új tabra
        const range = `${sheetName}!A1`;
        const dataInsertRequest = {
            range,
            values: [allHeaders, ...allRows],
            majorDimension: "ROWS"
        };

        const insertDataResponse = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
            method: "PUT",
            body: JSON.stringify(dataInsertRequest),
            headers: {
                "Content-Type": "application/json"
            }
        });

        if (!insertDataResponse.ok) {
            const errorText = await insertDataResponse.text();
            console.error("Hiba az adatok beillesztésekor:", errorText);
            throw new Error("Nem sikerült beilleszteni az adatokat az új tabra.");
        }

        console.log(`Adatok sikeresen beillesztve a ${sheetName} tabra.`);
    } catch (error) {
        console.error("Hiba a tab létrehozásakor:", error);
    }
}

async function addDefaultHeaders(sheetName) {
    try {
        const defaultHeaders = ["ID", "Name", "Category", "Payment mode", "Date", "Amount", "Currency", "Frequency", "Paid", "Comment"];
        const response = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${sheetName}!A1?valueInputOption=USER_ENTERED`, {
            method: "PUT",
            body: JSON.stringify({ range: `${sheetName}!A1`, values: [defaultHeaders], majorDimension: "ROWS" }),
            headers: { "Content-Type": "application/json" }
        });

        if (!response.ok) {
            console.error("Hiba az alapértelmezett fejléc létrehozásakor:", await response.text());
        }
    } catch (error) {
        console.error("Hiba az alapértelmezett fejléc létrehozásakor:", error);
    }
}

function renderData() {
    renderItems(Object.values(dataMap));
}

async function updateItem() {
    fadeOutDetails();
    showSpinner();

    const currencyValue = document.getElementById("itemCurrency").textContent.trim();

    const updatedData = {
        id: activeID,
        name: document.getElementById("itemName").value,
        category: document.getElementById("itemCategory").value,
        amount: document.getElementById("itemAmount").value,
        date: document.getElementById("itemDate").value,
        payment_mode: document.getElementById("itemPayment").value,
        paid: document.getElementById("itemPaid").value,
        comment: document.getElementById("itemComment").value,
        currency: currencyValue,
        frequency: document.getElementById("frequencySelect").value
    };

    try {
        const response = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${encodeURIComponent(activeTab)}`);
        const data = await response.json();

        if (!data.values || data.values.length === 0) {
            throw new Error("A táblázat üres vagy nem található.");
        }

        const headers = data.values[0];
        const rows = data.values.slice(1);
        const rowIndex = rows.findIndex(row => row[headers.indexOf("ID")] === activeID.toString());

        if (rowIndex === -1) {
            console.error("A megadott ID nem található.");
            return;
        }

        const valuesToUpdate = Array(headers.length).fill("");
        valuesToUpdate[headers.indexOf("ID")] = updatedData.id;
        valuesToUpdate[headers.indexOf("Name")] = updatedData.name;
        valuesToUpdate[headers.indexOf("Category")] = updatedData.category;
        valuesToUpdate[headers.indexOf("Payment mode")] = updatedData.payment_mode;
        valuesToUpdate[headers.indexOf("Paid")] = updatedData.paid;
        valuesToUpdate[headers.indexOf("Date")] = updatedData.date;
        valuesToUpdate[headers.indexOf("Amount")] = updatedData.amount;
        valuesToUpdate[headers.indexOf("Currency")] = updatedData.currency;
        valuesToUpdate[headers.indexOf("Comment")] = updatedData.comment;
        valuesToUpdate[headers.indexOf("Frequency")] = updatedData.frequency;

        while (valuesToUpdate.length < headers.length) {
            valuesToUpdate.push("");
        }

        console.log("Headers:", headers);
        console.log("Values to Update:", valuesToUpdate);

        const updateRequest = {
            range: `${activeTab}!A${rowIndex + 2}:${String.fromCharCode(65 + headers.length - 1)}${rowIndex + 2}`,
            values: [valuesToUpdate],
            majorDimension: "ROWS"
        };

        console.log("Update Request:", updateRequest);

        const updateResponse = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${encodeURIComponent(activeTab)}!A${rowIndex + 2}:${String.fromCharCode(65 + headers.length - 1)}${rowIndex + 2}?valueInputOption=USER_ENTERED`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(updateRequest)
        });

        if (updateResponse.ok) {
            console.log("Sikeres frissítés:", updatedData);

            dataMap[activeID] = updatedData;
            renderItems(Object.values(dataMap));
            fadeOutFader();
            hideSpinner();
        } else {
            console.error("Hiba történt az adatok frissítésekor:", await updateResponse.json());
        }
    } catch (error) {
        console.error("Hiba az updateItem függvényben:", error);
    }
}




// További hónapok frissítése a mező vagy teljes elem alapján
async function updateFollowingItems(updateType, updatedData) {
    const sheetMetadataResponse = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}`);
    const sheetMetadata = await sheetMetadataResponse.json();
    const tabs = sheetMetadata.sheets.map(sheet => sheet.properties.title);

    const [currentYear, currentMonth] = activeTab.split("-").map(Number);

    for (const tab of tabs) {
        const [tabYear, tabMonth] = tab.split("-").map(Number);

        if (tabYear > currentYear || (tabYear === currentYear && tabMonth > currentMonth)) {
            const tabResponse = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${encodeURIComponent(tab)}`);
            const tabData = await tabResponse.json();

            if (!tabData.values || tabData.values.length === 0) continue;

            const headers = tabData.values[0];
            const rowIndex = tabData.values.slice(1).findIndex(row => row[headers.indexOf("ID")] === updatedData.id.toString());

            if (rowIndex !== -1) {
                const updatedRow = [...tabData.values[rowIndex]];

                if (updateType === "frequency") {
                    updatedRow[headers.indexOf("Frequency")] = updatedData.frequency;
                } else if (updateType === "details") {
                    ["Name", "Category", "Amount", "Currency", "Date", "Payment mode"].forEach(header => {
                        updatedRow[headers.indexOf(header)] = updatedData[header.toLowerCase().replace(" ", "_")] || "";
                    });
                }

                await updateRow(tab, rowIndex, updatedRow);
            }
        }
    }
}

async function updateRow(tabName, rowIndex, updatedRow) {
    const range = `${tabName}!A${rowIndex + 1}:Z${rowIndex + 1}`;
    const requestBody = {
        range,
        values: [updatedRow],
        majorDimension: "ROWS"
    };

    const response = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const result = await response.json();
        throw new Error(`Hiba a sor frissítésekor: ${result.error.message}`);
    }
}

async function addNewItem() {
    fadeOutDetails();
    showSpinner();

    try {
        // Az új sor azonosítója
        const newId = newDataMapId();

        // Az oszlopnevek (fejléc) lekérése
        const response = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${encodeURIComponent(activeTab)}!A1:Z1`);
        const data = await response.json();

        let headers = data.values ? data.values[0] : [];

        // Ha a fejléc nem tartalmazza a Frequency és Currency oszlopokat, hozzáadjuk azokat
        const requiredHeaders = ["ID", "Name", "Category", "Payment mode", "Paid", "Date", "Amount", "Currency", "Comment", "Frequency"];
        let headersToUpdate = false;

        requiredHeaders.forEach(header => {
            if (!headers.includes(header)) {
                headers.push(header);
                headersToUpdate = true;
            }
        });

        // Ha új oszlopokat adtunk hozzá, frissítsük a sheet fejlécét
        if (headersToUpdate) {
            await updateSheetHeaders(activeTab, headers);
        }

        // Az oszlopnevekhez tartozó adatok összegyűjtése
        const valuesToInsert = Array(headers.length).fill(""); // Üres tömb az oszlopok számára

        const newData = {
            ID: newId.toString(),
            Name: document.getElementById('itemName').value,
            Category: document.getElementById('itemCategory').value,
            "Payment mode": document.getElementById('itemPayment').value,
            Paid: document.getElementById('itemPaid').value,
            Date: document.getElementById('itemDate').value,
            Amount: document.getElementById('itemAmount').value,
            Currency: document.getElementById('itemCurrency').textContent,
            Comment: document.getElementById('itemComment').value,
            Frequency: document.getElementById("frequencySelect").value
        };

        // Az oszlopokhoz rendeljük az értékeket
        headers.forEach((header, index) => {
            if (newData[header]) {
                valuesToInsert[index] = newData[header];
            }
        });

        // Kérelem a sor hozzáadására az aktuális hónaphoz
        await addRowToSheet(activeTab, valuesToInsert);

        // A frequency értékének megfelelő jövőbeli tabok bejárása és az elem másolása
        const frequency = parseInt(newData.Frequency, 10);
        if (frequency > 0) {
            await addToFutureTabs(activeTab, frequency, valuesToInsert);
        }

        // Frissítjük a megjelenített adatokat
        dataMap[newId] = {
            id: newId,
            name: newData.Name,
            category: newData.Category,
            payment_mode: newData["Payment mode"],
            paid: newData.Paid,
            date: newData.Date,
            amount: newData.Amount,
            currency: newData.Currency,
            comment: newData.Comment,
            frequency: newData.Frequency
        };

        renderItems(Object.values(dataMap));
        fadeOutFader();
        hideSpinner();

    } catch (error) {
        console.error('Hiba a addNewItem függvényben:', error);
    }
}

async function addRowToSheet(tabName, valuesToInsert) {
    const requestBody = {
        values: [valuesToInsert],
        majorDimension: "ROWS"
    };

    const appendResponse = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${encodeURIComponent(tabName)}:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!appendResponse.ok) {
        const result = await appendResponse.json();
        throw new Error(`Hiba történt a(z) ${tabName} tabhoz történő hozzáadás során: ${result.error.message}`);
    }
}

async function addToFutureTabs(currentTab, frequency, valuesToInsert) {
    const [currentYear, currentMonth] = currentTab.split("-").map(Number);

    // Az összes létező tab lekérése
    const sheetMetadataResponse = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}`);
    const sheetMetadata = await sheetMetadataResponse.json();
    const tabs = sheetMetadata.sheets.map(sheet => sheet.properties.title);

    // Jövőbeli tabok bejárása és az érték hozzáadása
    for (const tab of tabs) {
        const [tabYear, tabMonth] = tab.split("-").map(Number);
        const monthDifference = (tabYear - currentYear) * 12 + (tabMonth - currentMonth);

        if (monthDifference > 0 && monthDifference % frequency === 0) {
            await addRowToSheet(tab, valuesToInsert);
        }
    }
}

async function updateSheetHeaders(tabName, headers) {
    const columnRange = `A1:${String.fromCharCode(64 + headers.length)}1`; // Dinamikus tartomány kiszámítása

    const requestBody = {
        range: `${tabName}!${columnRange}`,
        values: [headers],
        majorDimension: "ROWS"
    };

    const response = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${encodeURIComponent(tabName)}!${columnRange}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const result = await response.json();
        throw new Error(`Hiba a fejléc frissítésekor: ${result.error.message}`);
    }
}



function newDataMapId() {
    const keys = Object.keys(dataMap); // Az összes kulcs megszerzése
    if (keys.length > 0) {
        const lastId = parseInt(keys[keys.length - 1], 10); // Az utolsó id számmá konvertálása
        return lastId + 1; // Visszaadjuk az egyel nagyobb id-t
    } else {
        return 1; // Ha nincs elem, akkor kezdje az id-t 1-től
    }
}

async function removeItem() {
    fadeOutDetails();
    showSpinner();

    try {
        // Ellenőrizzük az elem frequency értékét
        const currentItem = dataMap[activeID];
        const frequencyValue = currentItem.frequency ? currentItem.frequency : "";

        // Ha van frequency, kérdezzük meg, hogyan kezelje a törlést
        let userChoice;
        if (frequencyValue) {
            userChoice = prompt("Mit szeretnél törölni?\n1: Csak az adott elem\n2: Az adott elem és az összes utána következő\n3: Az összes elem az adatbázisban");
            if (!["1", "2", "3"].includes(userChoice)) {
                console.log("Törlés megszakítva.");
                return;
            }
        } else {
            const confirmDelete = confirm("Biztosan törölni szeretnéd az adott elemet?");
            if (!confirmDelete) {
                console.log("Törlés megszakítva.");
                return;
            }
            userChoice = "1";  // Ha nincs frequency, akkor alapértelmezetten csak az aktuális elemet töröljük
        }

        switch (userChoice) {
            case "1":  // Csak az aktuális elem törlése
                await deleteRow(activeTab, activeID);
                delete dataMap[activeID];  // Csak az aktuális hónapból töröljük lokálisan
                break;
            case "2":  // Az aktuális és az összes utána következő hónap
                await deleteFollowingItems(activeTab, activeID);
                delete dataMap[activeID];  // Az aktuális hónapból is töröljük
                break;
            case "3":  // Az összes előfordulás törlése az adatbázisban
                await deleteAllOccurrences(activeID);
                delete dataMap[activeID];  // Az aktuális hónapból is töröljük
                break;
        }

        renderItems(Object.values(dataMap));  // Lokális újrarenderelés
        fadeOutFader();
        hideSpinner();
        console.log("Törlési művelet sikeresen befejeződött.");
    } catch (error) {
        console.error("Hiba a törlési folyamat során:", error);
    }
}

// Csak az aktuális sor törlése a Google Sheetből
async function deleteRow(sheetName, itemId) {
    const response = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${encodeURIComponent(sheetName)}`);
    const data = await response.json();
    const rowIndex = data.values.findIndex(row => row[0] === itemId.toString());

    if (rowIndex !== -1) {
        const deleteRequest = {
            requests: [{
                deleteDimension: {
                    range: {
                        sheetId: await getSheetId(sheetName),
                        dimension: "ROWS",
                        startIndex: rowIndex,
                        endIndex: rowIndex + 1
                    }
                }
            }]
        };

        await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}:batchUpdate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(deleteRequest)
        });
    }
}


// Az adott elem és az összes utána következő törlése
async function deleteFollowingItems(sheetName, itemId) {
    const metadataResponse = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}`);
    const metadata = await metadataResponse.json();
    const tabs = metadata.sheets.map(sheet => sheet.properties.title);

    const [currentYear, currentMonth] = sheetName.split("-").map(Number);

    for (const tab of tabs) {
        const [tabYear, tabMonth] = tab.split("-").map(Number);
        if (tabYear > currentYear || (tabYear === currentYear && tabMonth >= currentMonth)) {
            const response = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${encodeURIComponent(tab)}`);
            const data = await response.json();
            const rowIndex = data.values.findIndex(row => row[0] === itemId.toString());

            if (rowIndex !== -1) {
                await deleteRow(tab, rowIndex);
            }
        }
    }
}

// Az összes előfordulás törlése az összes hónapban
async function deleteAllOccurrences(itemId) {
    const metadataResponse = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}`);
    const metadata = await metadataResponse.json();
    const tabs = metadata.sheets.map(sheet => sheet.properties.title);

    for (const tab of tabs) {
        const response = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}/values/${encodeURIComponent(tab)}`);
        const data = await response.json();
        const rowIndex = data.values.findIndex(row => row[0] === itemId.toString());

        if (rowIndex !== -1) {
            await deleteRow(tab, rowIndex);
        }
    }
}


async function getSheetId(sheetName) {
    const response = await fetchWithToken(`https://sheets.googleapis.com/v4/spreadsheets/${sheetID}`);
    const metadata = await response.json();
    const sheet = metadata.sheets.find(sheet => sheet.properties.title === sheetName);
    return sheet.properties.sheetId;
}
