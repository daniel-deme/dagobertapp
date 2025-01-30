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

