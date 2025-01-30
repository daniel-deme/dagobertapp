// ----------------------
// Változók
// ----------------------

var onlyUnpaid = false;
var activeID;
let dataMap = {}; // Globális változó az adatok tárolására
let activeTab = ''; // Globális változó az aktuális tab számára
let sheetUrl = '';
var detailsItem;
var categoryNames = [];
var paymentTypes = [];
var tabs = [];
var categories = {};
var payments = {};
var dates = {};
var paids = {};

var white =  "#ffffff";
var lightest = "#F8F8F8";
var lighter = "#F0F0F0";
var light = "#DDDDDD";
var grey = "#B2B2B2";
var dark = "#797979";
var black = "#1A1A1A";
var red = "#F16E6E";
var green = "#6FCF97";
var yellow = "FEF4D0";

var translations;
var ipCurrency;
var stats;

// Nyelvi fájlok betöltése

function getBrowserLanguage() {
    return navigator.language || navigator.userLanguage; // Például: 'en', 'hu', 'de'
}

const language = getBrowserLanguage().slice(0, 2); // Csak az első két karakter 

async function loadLanguageFile(language) {
    console.log("GITHUB!");
    try {
        const response = await fetch(`locales/${language}.json`);
        if (!response.ok) throw new Error("Language file not found");
        return await response.json();
    } catch (error) {
        console.error("Error loading language file:", error);
        return null;
    }
}

async function applyTranslations() {
    let language = getBrowserLanguage().slice(0, 2);
    translations = await loadLanguageFile(language);

    // Alapértelmezett nyelv beállítása, ha a választott nyelv nincs meg
    if (!translations) {
        language = 'en'; // vagy más alapértelmezett nyelv
        translations = await loadLanguageFile(language);
    }
    

    if (translations) {
        
        document.getElementById("itemLabel").textContent = translations["itemLabel"];
        
        document.getElementById("itemName").placeholder = translations["itemName"];
        document.getElementById("itemCategory").placeholder = translations["itemCategory"];
        document.getElementById("itemAmount").placeholder = translations["itemAmount"];
        document.getElementById("itemDate").placeholder = translations["itemDate"];
        document.getElementById("itemPayment").placeholder = translations["itemPayment"];
        document.getElementById("itemComment").placeholder = translations["itemComment"];
        document.getElementById("itemPaidText").placeholder = translations["notPaid"];
        
        document.getElementById("cancelNew").textContent = translations["cancelNew"];
        document.getElementById("submitNew").textContent = translations["submitNew"];
        document.getElementById("submitUpdate").textContent = translations["submitUpdate"];
        document.getElementById("deleteItem").textContent = translations["deleteItem"];
        
        document.getElementById("emptyTitle").textContent = translations["emptyTitle"];
        document.getElementById("emptyCTA").textContent = translations["emptyCTA"];
        
        document.getElementById("filterCategory").textContent = translations["filterCategory"];
        document.getElementById("filterNotPaid").textContent = translations["filterNotPaid"];
        document.getElementById("filterDate").textContent = translations["filterDate"];
        document.getElementById("filterPayment").textContent = translations["filterPayment"];
        
        document.getElementById("feedbackLink").textContent = translations["feedbackLink"];
        document.getElementById("feedbackLabel").textContent = translations["feedbackLabel"];
        document.getElementById("feedbackDescription").textContent = translations["feedbackDescription"];
        document.getElementById("feedback").placeholder = translations["feedback"];
        document.getElementById("feedbackCancel").textContent = translations["feedbackCancel"];
        document.getElementById("feedbackSend").textContent = translations["feedbackSend"];
        document.getElementById("feedbackThanksText").textContent = translations["feedbackThanksText"];
        
        document.getElementById("privacyLink").textContent = translations["privacyLink"];
        document.getElementById("contactLink").textContent = translations["contactLink"];
        document.getElementById("contactLinkInner").textContent = translations["contactLink"];
        document.getElementById("logOutLink").textContent = translations["logOutLink"];
        document.getElementById("appFooterVersion").textContent = translations["appFooterVersion"];
        
        document.getElementById("heroUVP").textContent = translations["heroUVP"];
        document.getElementById("heroDescription").textContent = translations["heroDescription"];
        document.getElementById("heroValue").textContent = translations["heroValue"];
        document.getElementById("authButton").textContent = translations["authButton"];
        document.getElementById("authButtonAgain").textContent = translations["authButton"];
        
        document.getElementById("autoSheetHead").textContent = translations["autoSheetHead"];
        document.getElementById("autoSheetDesc").textContent = translations["autoSheetDesc"];
        document.getElementById("mobileLoveHead").textContent = translations["mobileLoveHead"];
        document.getElementById("mobileLoveDesc").textContent = translations["mobileLoveDesc"];

        document.getElementById("secureHead").textContent = translations["secureHead"];
        document.getElementById("secureDesc").textContent = translations["secureDesc"];
        document.getElementById("betaHead").textContent = translations["betaHead"];
        document.getElementById("betaDesc").textContent = translations["betaDesc"];
        document.getElementById("homeScreenHead").textContent = translations["homeScreenHead"];
        document.getElementById("homeScreenDesc").textContent = translations["homeScreenDesc"];
        
        document.getElementById("homeScreenStep1").textContent = translations["homeScreenStep1"];
        document.getElementById("homeScreenStep2").textContent = translations["homeScreenStep2"];
        document.getElementById("homeScreenStep3").textContent = translations["homeScreenStep3"];
        
        document.getElementById("statLabel").textContent = translations["statLabelNotPaid"];
        
        document.getElementById("frequencyLabel").textContent = translations["frequency"];
        document.getElementById("itemFrequency").placeholder = translations["frequency"];
        document.getElementById("frequencyLabel0").textContent = translations["0frequency"];
        document.getElementById("frequencyLabel1").textContent = translations["1frequency"];
        document.getElementById("frequencyLabel3").textContent = translations["3frequency"];
        document.getElementById("frequencyLabel6").textContent = translations["6frequency"];
        document.getElementById("frequencyLabel12").textContent = translations["12frequency"];


        
    }
}

// Statisztika számítása

function calculateStats(data) {
    // Pénznem átváltási árfolyamok
    const exchangeRates = {
        HUF: 1,     // Alap pénznem
        EUR: 370,   // 1 EUR = 370 HUF
        USD: 340    // 1 USD = 340 HUF
    };

    // Statisztikák változók
    let totalPaidByMode = {};
    let totalUnpaidByMode = {};
    let totalPaidByCurrency = {};
    let totalUnpaidByCurrency = {};
    let countPaid = 0;
    let countUnpaid = 0;
    let countNoAmount = 0;

    let totalConvertedAmount = 0;
    let percentages = [];

    data.forEach(item => {
        const amount = parseFloat(item.amount) || 0;
        const paymentMode = item.payment_mode || "Unknown";
        const currency = item.currency || "HUF";
        const isPaid = item.paid === "Yes";

        if (amount > 0) {
            // Átváltás HUF-ra
            const convertedAmount = amount * (exchangeRates[currency] || 1);
            totalConvertedAmount += convertedAmount;

            // Kifizetett vagy ki nem fizetett összegek
            if (isPaid) {
                totalPaidByMode[paymentMode] = (totalPaidByMode[paymentMode] || 0) + amount;
                totalPaidByCurrency[currency] = (totalPaidByCurrency[currency] || 0) + amount;
                countPaid++;
            } else {
                totalUnpaidByMode[paymentMode] = (totalUnpaidByMode[paymentMode] || 0) + amount;
                totalUnpaidByCurrency[currency] = (totalUnpaidByCurrency[currency] || 0) + amount;
                countUnpaid++;
            }

            // Százalékos arány
            percentages.push({ item, convertedAmount });
        } else {
            countNoAmount++;
        }
    });

    // Százalékos arányok számítása
    percentages = percentages.map(({ item, convertedAmount }) => ({
        ...item,
        percentage: (convertedAmount / totalConvertedAmount) * 100
    }));

    // Pénznemek szerinti összegzés és formázás (kifizetett)
    const sortedPaidByCurrency = Object.entries(totalPaidByCurrency)
        .sort(([, a], [, b]) => b - a) // Csökkenő sorrend az összeg alapján
        .map(([currency, amount]) => {
            const formattedAmount = amount.toLocaleString('hu-HU', { useGrouping: true }); // Szóköz elválasztás
            return `${formattedAmount} ${currency}`; // Formázott szöveg
        });

    // Pénznemek szerinti összegzés és formázás (ki nem fizetett)
    const sortedUnpaidByCurrency = Object.entries(totalUnpaidByCurrency)
        .sort(([, a], [, b]) => b - a) // Csökkenő sorrend az összeg alapján
        .map(([currency, amount]) => {
            const formattedAmount = amount.toLocaleString('hu-HU', { useGrouping: true }); // Szóköz elválasztás
            return `${formattedAmount} ${currency}`; // Formázott szöveg
        });

    // Összeggel rendelkező tételek százalékos aránya
    const percentWithAmount = ((countPaid + countUnpaid) / data.length) * 100 || 0;

    return {
        totalPaidByMode,
        totalUnpaidByMode,
        sortedPaidByCurrency,
        sortedUnpaidByCurrency,
        countPaid,
        countUnpaid,
        countNoAmount,
        percentWithAmount,
        percentages
    };
}


function toggleChartSum(s = document.getElementById("statAmounts").value) {
    
    const isUnpaid = s === "unPaid";
    const statType = isUnpaid ? stats.sortedUnpaidByCurrency : stats.sortedPaidByCurrency;
    const statLabel = isUnpaid ? "Not Paid Total" : "Paid Total";

    document.getElementById("statLabel").innerHTML = statLabel;
    document.getElementById("statAmounts").value = isUnpaid ? translations["statLabelNotPaid"] : translations["statLabelNotPaid"];

    const statAmounts = document.getElementById("statAmounts");
    statAmounts.innerHTML = ''; // Korábbi elemek törlése

    statType.forEach(item => {
        const statAmount = document.createElement('div');
        statAmount.className = 'statAmount';
        statAmount.innerHTML = item;
        statAmounts.appendChild(statAmount);
    });
    
    // Toggle módon kezeljük az unfocusedChart class-t a paidChart és notPaidChart elemeknél
    const paidCharts = document.querySelectorAll('.paidChart');
    const notPaidCharts = document.querySelectorAll('.notPaidChart');

    [...paidCharts, ...notPaidCharts].forEach(chart => {
        chart.classList.toggle('unfocusedChart');
    });
    
    adjustListPadding();
    
}



// Adatok renderelése

function renderItems(data) {
    
    // ----------------------------------------
    // Statisztikák kiszámítása
    // ----------------------------------------

    // Számított statisztikák lekérése
    
    stats = calculateStats(data);

    console.log("Kifizetett összegek fizetési mód szerint:", stats.totalPaidByMode);
    console.log("Nem kifizetett összegek fizetési mód szerint:", stats.totalUnpaidByMode);
    console.log("Kifizetett összegek pénznemenként (rendezve):", stats.sortedPaidByCurrency);
    console.log("Ki nem fizetett összegek pénznemenként (rendezve):", stats.sortedUnpaidByCurrency);
    console.log("Kifizetett tételek száma:", stats.countPaid);
    console.log("Ki nem fizetett tételek száma:", stats.countUnpaid);
    console.log("Összeg nélküli tételek száma:", stats.countNoAmount);
    console.log("Összeggel rendelkező tételek százalékos aránya (összesen):", stats.percentWithAmount.toFixed(2) + "%");
    console.log("Tételek százalékos arányai:", stats.percentages);
    
    // Summa összegek
    
    toggleChartSum("unPaid");
    
    // Tételek és arányok
    
    const chartContainer = document.getElementById("chart");
    chartContainer.innerHTML = ""; // Korábbi elemek törlése

    // Elemek szétválogatása állapot és kategórián belüli növekvő sorrend szerint
    const paidItems = stats.percentages
        .filter(({ paid }) => paid === "Yes")
        .sort((a, b) => a.percentage - b.percentage); // Növekvő sorrend

    const notPaidItems = stats.percentages
        .filter(({ paid }) => paid === "No")
        .sort((a, b) => a.percentage - b.percentage); // Növekvő sorrend

    const unknownItems = stats.percentages
        .filter(({ paid }) => paid === "Unknown");

    // Az elemeket a megfelelő sorrendben összefűzzük
    const sortedItems = [...paidItems, ...notPaidItems, ...unknownItems];

    // Diagram elemek létrehozása a rendezett tömb alapján
    sortedItems.forEach(({ percentage, paid }) => {
        const bar = document.createElement("div");
        
        // Állapot alapján class hozzáadása
        if (paid === "Yes") {
            bar.className = "paidChart unfocusedChart"; // Szürke
        } else if (paid === "No") {
            bar.className = "notPaidChart"; // Sárga
        } else {
            bar.className = "unknownChart"; // Körvonalas sárga, fix szélesség
        }

        // Szélesség beállítása százalékos arány alapján (kivéve "unknownChart")
        if (paid !== "Unknown") {
            bar.style.width = `${percentage}%`;
        }

        // Doboz hozzáadása a diagramhoz
        chartContainer.appendChild(bar);
    });
    
    adjustListPadding();
    
    // ----------------------------------------
    // Rendező tömbök létrehozása
    // ----------------------------------------
    
    console.log("data: ",data);
    
    // Objektumok létrehozása
    
    categories = {};
    payments = {};
    dates = {};
    paids = {};
    
    data.forEach(item => {
        
        if (!categories[item.category]) { categories[item.category] = [];}
        if (!payments[item.payment_mode]) { payments[item.payment_mode] = [];}
        if (!dates[item.date]) { dates[item.date] = []; }
        if (!paids[item.paid]) { paids[item.paid] = []; }
        
        categories[item.category].push(item);
        payments[item.payment_mode].push(item);
        dates[item.date].push(item);
        paids[item.paid].push(item);
        
    });
    
    // Dátumok rendezése
    
    if (dates[""]) {
        dates["-"] = dates[""];
        delete dates[""];
    }

    const sortedKeys = Object.keys(dates).sort((a, b) => {
        if (a === '-') return 1;
        if (b === '-') return -1;
        return parseDate(a) - parseDate(b); // Számított értékek összehasonlítása
    });

    sortedKeys.forEach(key => {
        const value = dates[key];
        delete dates[key];
        dates[key] = value;
    });
    
    // Fizetési módok rendezése
    
    if (payments[""]) {
        payments["-"] = payments[""];
        delete payments[""];
    }

    const sortedPaymentKeys = Object.keys(payments).sort((a, b) => {
        if (a === '-') return 1; 
        if (b === '-') return -1; 
        return payments[b].length - payments[a].length; 
    });

    sortedPaymentKeys.forEach(key => {
        const value = payments[key];
        delete payments[key]; 
        payments[key] = value;
    });
    
    // Fizetettek kivétele
    
    delete paids["Yes"];
    paids[""] = paids["No"];
    delete paids["No"];
    
    
    // ----------------------------------------
    // Adatlap selectorok
    // ----------------------------------------
    
    // Kategória selector
    
    const categoryOptions = document.getElementById('categorySelect');
    const categorySelectParent = categoryOptions.parentElement;
    categoryOptions.innerHTML = '';
    
    if (Object.keys(categories).length > 0) {
        
        const categoryhintOption = document.createElement('option');
        categoryhintOption.value = '';
        categoryhintOption.text = translations["itemCategory"];
        categoryhintOption.disabled = true;
        categoryhintOption.selected = true;
        categoryOptions.appendChild(categoryhintOption);
        
        Object.keys(categories).forEach(item => {
            
            if(item !== '') {
            
                const categoryOption = document.createElement('option');
                categoryOption.value = item;
                categoryOption.text = item;
                categoryOptions.appendChild(categoryOption);
                
            }
            
        });
        
        categorySelectParent.style.display = 'block';
        
        
    } else {
        
        categorySelectParent.style.display = 'none';
        
    }
    
    // Fizetési mód selector
    
    const paymentOptions = document.getElementById('paymentSelect');
    const paymentSelectParent = paymentOptions.parentElement;
    paymentOptions.innerHTML = ''; 
    
    if (Object.keys(payments).length > 0) {
        
        const hintOption = document.createElement('option');
        hintOption.value = '';
        hintOption.text = translations["itemPayment"];
        hintOption.disabled = true;
        hintOption.selected = true;
        paymentOptions.appendChild(hintOption);
        
        Object.keys(payments).forEach(item => {
            
            if(item !== '') {
            
                const paymentOption = document.createElement('option');
                paymentOption.value = item;
                paymentOption.text = item;
                paymentOptions.appendChild(paymentOption);
                
            }
            
        });
        
        paymentSelectParent.style.display = 'block';
        
        
    } else {
        
        paymentSelectParent.style.display = 'none';
        
    }

    
    // ----------------------------------------
    // tabSelector beállítása
    // ----------------------------------------
    
    const tabSelector = document.getElementById('tabSelector');
    tabSelector.innerHTML = '';
    
    const monthSelector = document.getElementById('monthSelector');
    monthSelector.innerHTML = '';
    
    extendedTabs = extendTabs(tabs, 3);
    
    console.log("activeTab: "+activeTab);
    activeMonth = formatMonthYear(activeTab);
    
    extendedTabs.forEach(item => {
            
        const tabItem = document.createElement('div');
        const tabTexts = formatMonthYear(item)
        tabItem.className = 'tabItem';

        if(item == activeTab) { 
            tabItem.classList.add('disabled'); 
        } else {
            tabItem.onclick = function() { 
                tabSelected(item.toString()); // Biztosítsd, hogy a tabID átadásakor az item értékét átadjuk, ne az eseményt.
            };
        }
        
        tabItem.innerHTML = `
                <p class="tabText year">${tabTexts["year"]}</p>
                <p class="tabText month">${tabTexts["month"]}</p>
                
            `;
        
        tabSelector.appendChild(tabItem);
        
        // new tabselector
        
        const monthItem = document.createElement('div');
        if(item == activeTab) { 
            
            //monthItem.
            
        } else {
            
            monthItem.classList.add('active');
            monthItem.onclick = function() { 
                tabSelected(item.toString()); // Biztosítsd, hogy a tabID átadásakor az item értékét átadjuk, ne az eseményt.
            };
        }
        monthItem.innerHTML = `${tabTexts["month"]}`;
        monthSelector.appendChild(monthItem);
        
        
        
        

    });
    
    scrollToCurrentMonth("monthSelector", activeMonth["month"]);

    
    var defaultTab = formatMonthYear(activeTab);
   // document.getElementById('tabName').innerHTML = defaultTab["month"];
    document.getElementById('headerContainer').style.display = "flex";
    document.getElementById('list').style.display = 'flex';
    
    // ----------------------------------------
    // Home footer elrejtése
    // ----------------------------------------
    
    document.getElementById("footer").style.display = "none";
    
    // ----------------------------------------
    // Stats
    // ----------------------------------------
    
    
    
    
    // ----------------------------------------
    // Tételek kirajzolása
    // ----------------------------------------
    
    document.getElementById("feedbackButton").style.display = "flex";
    document.getElementById("appFooter").style.display = "flex";

    if(data.length == 0) {
        
        document.getElementById("emptyState").style.display = "flex";
        document.getElementById("filters").style.display = "none";
        document.getElementById("items-container").style.display = "none";
    
    } else {
        
        document.getElementById("emptyState").style.display = "none";
        document.getElementById("filters").style.display = "flex";
        document.getElementById("items-container").style.display = "block";
        filterList("category");
    }
    
    
    
    hideSpinner();
}



function showOnlyPaid() {
    
    const container = document.getElementById('items-container');
    //container.style.paddingTop = '240px';
    orderBy(paids)

}

function orderBy(obj) {
    
    const container = document.getElementById('items-container');
    container.innerHTML = '';
   // container.style.paddingTop = '190px';
    
    Object.keys(obj).forEach(item => {
        
        const groupHeader = document.createElement('div');
        groupHeader.innerHTML = `<p class="label listGroup">${item}</p> `;
        container.appendChild(groupHeader);
        
        obj[item].forEach(item => {
            const paidClass = item.paid;
            const row = document.createElement('div');
            let amountSuffix;
            let currencyColor;
            row.className = paidClass + ' row';
            row.id = item.id;
            row.onclick = () => openDetails(item.id);
            
            let formattedAmount;
            
            if (item.amount) {
                amountSuffix = item.currency ? item.currency : ipCurrency;
                currencyColor = item.currency ? "" : light;
                formattedAmount = parseInt(item.amount, 10).toLocaleString("hu");
            } else {
                amountSuffix = "";
                formattedAmount = "";
            }

            row.innerHTML = `
                <img class="${paidClass}" height="24" style="display:block;" width="24" />
                <div style="display:flex; gap:8px; flex-direction:column; margin:0px; padding-top:2px; width:100%;">
                    <p style="font-weight:600;">${item.name}</p>
                    <p class="${paidClass} paid" style="font-size:14px; color:${grey};">${item.date} ${item.payment_mode}</p>
                    <p style="font-weight:400; color:${dark}; font-size:14px;"><i>${item.comment}</i></p>
                </div>
                <div style="display:flex; gap:6px; flex-direction:row;">
                    <div class="${paidClass} amount">${formattedAmount}</div>
                    <div class="${paidClass} amount" style="color:${currencyColor}">${amountSuffix}</div>
                </div>

            `;

            container.appendChild(row);
            
            
        });
    });
    
    adjustListPadding();

}


function filterList(filter) {
    
    const filtersDiv = document.getElementById('filters');
    const filters = Array.from(filtersDiv.children);
    
    filters.forEach(item => {
        item.classList.remove("active");
        if(item.getAttribute("name")==filter) {item.classList.add("active");}
    });
    
    switch (filter) {
        case 'category':
            orderBy(categories);
            break;
        case 'unpaid':
            showOnlyPaid();
            break;
        case 'payment':
            orderBy(payments);
            break;
        case 'date':
            orderBy(dates);
            break;
    }
    
    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
    
}

// ----------------------
// ÚJ ELEM FORM
// ----------------------

function addDetails() {
    
    detailsItem = null;
    fadeInDetails(true);
    togglePayment(true);
    
    document.getElementById("itemName").value = "";
    document.getElementById("itemCategory").value = "";
    document.getElementById("itemAmount").value = "";
    document.getElementById("itemDate").value = "";
    document.getElementById("itemPayment").value = "";
    document.getElementById("itemPaid").value = "No";
    document.getElementById("itemComment").value = "";
    document.getElementById("itemFrequency").value = translations["1frequency"];
    document.getElementById("frequencySelect").value = "1";
    
    document.getElementById("submitNew").onclick = null;
    document.getElementById("submitNew").classList.add('disabled');
    
    document.getElementById("itemCurrency").textContent = ipCurrency;
    document.getElementById("currencySelect").value = ipCurrency;
    
    // Kontrollok
    
    document.getElementById("editControls").style.display = 'none';
    document.getElementById("newControls").style.display = 'flex';
}


// ----------------------
// FEEDBACK
// ----------------------

function addFeedback() {
    
    const feedbackDialog = document.getElementById('feedbackDialog');
    
    document.getElementById('feedbackForm').style.display = 'block';
    document.getElementById('feedbackDescription').style.display = 'block';
    document.getElementById('feedback').value = "";
    
    fadeInFader();
    
    fader.onclick = null;
    fader.onclick = () => closeFeedback();

    feedbackDialog.style.display = 'block';
    feedbackDialog.classList.remove('move-out-sheet');
    feedbackDialog.classList.add('move-in-sheet');
    
}

function closeFeedback() {
    
    fadeOutFader();
    
    const feedbackDialog = document.getElementById('feedbackDialog');
    
    feedbackDialog.classList.remove('move-in-sheet');
    feedbackDialog.classList.add('move-out-sheet');

    feedbackDialog.addEventListener('animationend', function() {
        feedbackDialog.style.display = 'none';
    }, { once: true });
    
}

async function sendFeedback() {
    
    closeFeedback();
    fadeInFader();
    showSpinner();

    const feedbackText = document.getElementById("feedback").value;

    try {
        const response = await fetch('https://dagobertapp.com/feedback.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({ feedback: feedbackText })
        });

        // Ha a válasz sikeres, töröljük a feedback mező tartalmát
        if (response.ok) {
            document.getElementById("feedback").value = ""; // Törli a textarea tartalmát
        } else {
            console.error("Error response from server:", response.statusText);
            alert("There was an issue sending your feedback. Please try again later.");
        }

    } catch (error) {
        console.error("Error sending feedback:", error);
        alert("There was an error sending your feedback. Please try again later.");
    } finally {
        showThanks();
        fadeOutFader();
        hideSpinner(); // Spinner elrejtése a kérés befejezése után
    }
}

function showThanks() {
    
    const feedbackThanks = document.getElementById("feedbackThanks");
    
    // Beúsztatás
    feedbackThanks.classList.add("show");
    feedbackThanks.classList.remove("hide");

    // 2 másodperc múlva eltüntetés
    setTimeout(() => {
        feedbackThanks.classList.remove("show");
        feedbackThanks.classList.add("hide");
    }, 2000);
}



// ----------------------
// ELEM részletek
// ----------------------


// Megjelenítés

function openDetails(id) {
    
    fadeInFader();
    fadeInDetails();
    
    activeID = id;
    detailsItem = dataMap[id];
    
    // Az elem adatainak betöltése a form mezőibe
    
    document.getElementById("itemName").value = detailsItem.name;
    document.getElementById("itemCategory").value = detailsItem.category;
    document.getElementById("itemAmount").value = detailsItem.amount;
    document.getElementById("itemDate").value = detailsItem.date;
    document.getElementById("itemPayment").value = detailsItem.payment_mode;
    document.getElementById("itemPaid").value = detailsItem.paid;
    document.getElementById("itemComment").value = detailsItem.comment;
    
    
    var currency = detailsItem.currency ? detailsItem.currency : ipCurrency;
    
    document.getElementById("currencySelect").value = currency;
    document.getElementById("itemCurrency").textContent = currency;
    
    
    
    var frequency = detailsItem.frequency ? detailsItem.frequency : "0";
    var frequencyValueToText = translations[frequency+"frequency"]

    document.getElementById("itemFrequency").value = frequencyValueToText;
    document.getElementById("frequencySelect").value = frequency;
    
    


    // Fizetési állapot szövegezés és kép beállítása
    
    if (detailsItem.paid == "Yes") {
        document.getElementById("itemPaidText").value = translations["paid"];
        document.getElementById("itemPaidIcon").src = "svg/toggle_yes.svg";
    } else {
        document.getElementById("itemPaidText").value = "";
        document.getElementById("itemPaidIcon").src = "svg/toggle_no.svg";
    }
    
    document.getElementById("submitUpdate").onclick = null;
    document.getElementById("submitUpdate").classList.add('hided');
    
    // Kontrollok
    
    document.getElementById("editControls").style.display = 'flex';
    document.getElementById("newControls").style.display = 'none';
    
    if(!detailsItem.currency) { setInput("currency"); } 

}

function formValidation() {
    
    var name = document.getElementById('itemName').value;
    
    if(detailsItem == null) {
        
        // ha új elem hozzáadása történik, akkor csak a nevet vizsgáljuk.

        if(name.length > 0) {

            document.getElementById("submitNew").onclick = function(){ addNewItem() };
            document.getElementById("submitNew").classList.remove('disabled');

        } else {

            document.getElementById("submitNew").onclick = null;
            document.getElementById("submitNew").classList.add('disabled');

        }
        
    } else {

        // ha létező elem hozzáadása történik, akkor a változást vizsgáljuk
        
        var edited = false;

        
        if(document.getElementById("itemName").value != detailsItem.name ) { edited = true; }
        if(document.getElementById("itemCategory").value != detailsItem.category ) { edited = true; }
        if(document.getElementById("itemAmount").value != detailsItem.amount.toLocaleString('hu-HU') ) { edited = true; }
        if(document.getElementById("itemCurrency").textContent != detailsItem.currency ) { edited = true; }
        if(document.getElementById("itemDate").value != detailsItem.date ) { edited = true; }
        if(document.getElementById("itemPayment").value != detailsItem.payment_mode ) { edited = true; }
        if(document.getElementById("itemPaid").value != detailsItem.paid ) { edited = true; }
        if(document.getElementById("itemComment").value != detailsItem.comment ) { edited = true; }
        if(document.getElementById("itemFrequency").value != detailsItem.frequency ) { edited = true; }

        
        if(edited) {

            document.getElementById("submitUpdate").onclick = function(){ updateItem() };
            document.getElementById("submitUpdate").classList.remove('hided');

        } else {

            document.getElementById("submitUpdate").onclick = null;
            document.getElementById("submitUpdate").classList.add('hided');

        }
        
    }

}

// Elrejtés

function closeDetails() {
    
    fadeOutDetails();
    fadeOutFader();
    
}

// Fizetett - Nem fizetett állapotok közötti váltás

function togglePayment(forcedNo) {
    
    const paidTextElement = document.getElementById("itemPaidText");
    const paidImageElement = document.getElementById("itemPaidIcon");
    const paidValueElement = document.getElementById("itemPaid");

    if (paidValueElement.value === "Yes") {

        paidTextElement.value = "";
        paidImageElement.src = "svg/toggle_no.svg";
        paidValueElement.value = "No";
        
    } else {

        paidTextElement.value = translations["paid"];
        paidImageElement.src = "svg/toggle_yes.svg";
        paidValueElement.value = "Yes";
    }
    
    if (forcedNo) {

        paidTextElement.value = "";
        paidImageElement.src = "svg/toggle_no.svg";
        paidValueElement.value = "No";
        
    }
    
    formValidation();

}

// ----------------------
// TAB választó
// ----------------------

var tabSelectorContainer = document.getElementById('tabSelectorContainer');

function openTabSelector() {
    
    fadeInFader();
    fader.onclick = null;
    fader.onclick = () => closeTabSelector();
    
    tabSelectorContainer.style.display = "block";
    
    tabSelectorContainer.classList.remove('move-out-tabselector');
    tabSelectorContainer.classList.add('move-in-tabselector');
    
}

function closeTabSelector() {
    
    fadeOutFader();
    
    tabSelectorContainer.classList.remove('move-in-tabselector');
    tabSelectorContainer.classList.add('move-out-tabselector');
    
    tabSelectorContainer.addEventListener('animationend', function() {
        tabSelectorContainer.style.display = 'none';
    }, { once: true });

}

function tabSelected(tabID) {
    
    getSpreadsheetData(tabID);
    fadeOutFader();
    showSpinner();
    
    document.getElementById('list').style.display = 'none';
    document.getElementById("headerContainer").style.display = "none";
    
    tabSelectorContainer.classList.remove('move-in-tabselector');
    tabSelectorContainer.classList.add('move-out-tabselector');
    
    tabSelectorContainer.addEventListener('animationend', function() {
        tabSelectorContainer.style.display = 'none';
    }, { once: true });
   

}

// ----------------------
// SHEET megnyitása
// ----------------------


function openSheet(){
    
    if (sheetUrl) {
        window.open(sheetUrl, '_blank'); // Új ablak nyitása a megadott URL-lel
    } else {
        console.error('Sheet URL nem érhető el');
    }
    
}

// ----------------------
// SELECTOR függvények
// ----------------------



function setInput(t) {
    
    console.log("setInput, t:"+t);
    
    var inputElement;
    var selectElement;
    var value;
    
    if(t=="currency") {
        
        inputElement = document.getElementById('itemCurrency');
        selectElement = document.getElementById('currencySelect');
        inputElement.textContent = selectElement.value;
    
    }
    
    if(t=="payment") {
        
        inputElement = document.getElementById('itemPayment');
        selectElement = document.getElementById('paymentSelect');
    
    }
    
    if(t=="category") {
        
        inputElement = document.getElementById('itemCategory');
        selectElement = document.getElementById('categorySelect');
        
    
    }
    
    if(t=="date") {
        
        inputElement = document.getElementById('itemDate');
        selectElement = document.getElementById('dateSelect');
    
    }
    
    if(t=="date") { 
        
        const selectedDate = new Date(document.getElementById('dateSelect').value);
        const month = selectedDate.toLocaleString('default', { month: 'short' });
        const day = selectedDate.getDate();
        value = month+" "+day+"."; 
    
    } else if(t=="frequency") {
        
        inputElement = document.getElementById('itemFrequency');
        selectElement = document.getElementById('frequencySelect');

        
        switch (selectElement.value) {
          case "0":
            value = "No frequency";
            break;
          case "1":
            value = "Every month";
            break;
          case "3":
             value = "Every 3 months";
            break;
          case "6":
            value = "Every 6 months";
            break;
          case "12":
            value = "Every year";
            break;
        }
    
    } else {
              
         value = selectElement.value;     
    }
    
    inputElement.value = value;
    formValidation();


}



// ----------------------
// Támogató függvények
// ----------------------

function scrollToCurrentMonth(monthSelectorId, activeMonth) {
    const monthSelector = document.getElementById(monthSelectorId);
    if (!monthSelector) {
        console.error("monthSelector not found!");
        return;
    }

    console.log("monthSelector clientWidth:", monthSelector.clientWidth);
    console.log("monthSelector scrollWidth:", monthSelector.scrollWidth);

    setTimeout(() => {
        const monthItems = monthSelector.children;

        console.log("monthItems:", monthItems);

        for (let i = 0; i < monthItems.length; i++) {
            const monthItem = monthItems[i];
            console.log(`Checking item: ${monthItem.innerText.trim()}`);
            if (monthItem.innerText.trim() === activeMonth) {
                console.log(`Scrolling to: ${monthItem.innerText.trim()}`);
                monthItem.scrollIntoView({ behavior: "auto", inline: "start" });
                break;
            }
        }
    }, 100);
}


function extendTabs(tabs, monthsToAdd) {
    const lastTab = tabs.length > 0 ? new Date(`${tabs[tabs.length - 1]}-01`) : new Date();
    let currentMonth = new Date(lastTab);

    for (let i = 0; i < monthsToAdd+1; i++) { // Módosítás: i = 0, hogy pontosan monthsToAdd hónapot adjon hozzá
        currentMonth.setMonth(currentMonth.getMonth() + 1);

        // Dátum helyreállítása a túlcsordulás miatt
        if (currentMonth.getDate() !== 1) {
            currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        }

        tabs.push(currentMonth.toISOString().slice(0, 7));
    }
    return Array.from(new Set(tabs)); // Megakadályozzuk a duplikációt
}

let lastScrollTop = 0;

window.addEventListener("scroll", function () {
    const statNumbers = document.getElementById("statNumbers");
    const currentScrollTop = window.scrollY;
    console.log(currentScrollTop);

    if (currentScrollTop > lastScrollTop && currentScrollTop > 80) {
        // Lefelé scrollozás: statNumbers eltüntetése
        statNumbers.style.opacity = "0"; // Elhalványítás
        statNumbers.style.height = "0"; // Magasság csökkentése
        statNumbers.style.padding = "0"; // Padding eltüntetése
        statNumbers.style.margin = "0"; // Margin eltüntetése
        statNumbers.style.pointerEvents = "none"; // Interakciók tiltása
    } else if (currentScrollTop < 80) {
        // Vissza az oldal tetejére: statNumbers visszahozása
        statNumbers.style.opacity = "1"; // Visszahalványítás
        statNumbers.style.height = ""; // Eredeti magasság visszaállítása
        statNumbers.style.padding = ""; // Eredeti padding visszaállítása
        statNumbers.style.margin = ""; // Eredeti margin visszaállítása
        statNumbers.style.pointerEvents = "auto"; // Interakciók engedélyezése
    }

    lastScrollTop = currentScrollTop; // Frissítjük az utolsó scrollpozíciót
});

function adjustListPadding() {
    const headerContainer = document.getElementById('headerContainer');
    if (headerContainer) {
        const headerHeight = headerContainer.offsetHeight; // Lekérdezzük a magasságot
        document.documentElement.style.setProperty('--header-height', `${headerHeight}px`); // CSS változó frissítése
    }
    console.log("adjustListPadding");
}


async function getCurrencyFromIP() {
    
     try {
        const response = await fetch("https://ipinfo.io/json?token=da94a803ca7855");
        const data = await response.json();
        const country = data.country;

        const currencyMap = {
            "HU": "HUF",
            "US": "USD",
            "DE": "EUR",
            "FR": "EUR",
            "GB": "GBP",
            "CA": "CAD"
        };

        return currencyMap[country] || "EUR"; // Fallback érték
         
    } catch (error) {

        return "EUR"; // Fallback érték
    }
}

getCurrencyFromIP().then((currency) => {
    ipCurrency = currency;
});


function formatAmount(amount) {
    if (!amount) return ""; // Ha az amount üres vagy null, térj vissza üres stringgel
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function parseDate(dateString) {
    if (!dateString) return Infinity;

    // Rövid hónapnevek konverziója számértékre
    const months = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };

    const parts = dateString.match(/([a-zA-Z]+)\s(\d{1,2})\.?/); // Pl.: "Nov 8."
    if (parts) {
        const month = months[parts[1]];
        const day = parseInt(parts[2], 10);
        const year = new Date().getFullYear(); // Jelenlegi év használata

        const date = new Date(year, month, day);
        return date.getTime();
    }

    // Ha formátum YYYY-MM-DD, akkor szabványos módon parszolható
    const standardDate = new Date(dateString);
    return isNaN(standardDate.getTime()) ? Infinity : standardDate.getTime();
}

// Kapott tab névből csinál lokális értéket egy tömbre rendezve

function formatMonthYear(dateString) {
    // Ellenőrizzük, hogy a dateString megfelel-e az elvárt formátumnak (YYYY-MM-DD vagy YYYY-MM)
    const parts = dateString.split('-');
    
    let year, month, day;
    
    if (parts.length === 3) {
        // Ha YYYY-MM-DD formátumú, akkor mindhárom értéket kinyerjük
        [year, month, day] = parts;
    } else if (parts.length === 2) {
        // Ha csak YYYY-MM formátumú, akkor nap nincs
        [year, month] = parts;
        day = 1; // Alapértelmezett érték a napra
    } else {
        return { month: "Invalid", year: "Invalid", day: "Invalid" }; // Érvénytelen formátum kezelése
    }

    // Date objektum létrehozása (a hónap 0-alapú)
    const date = new Date(year, month - 1, day); 

    // Hónap neve az operációs rendszer nyelvének megfelelően
    const monthName = date.toLocaleString('default', { month: 'long' });

    // Nap kivétele
    const dayOfMonth = date.getDate(); 

    // Visszaadjuk a hónap nevét, az évet és a napot külön
    return { month: monthName, year: year, day: dayOfMonth };
}


var dialog = document.getElementById('detailsDialog');
var fader = document.getElementById('fader');

function fadeInDetails(f) {
    
    fadeInFader()
    
    fader.onclick = null;
    fader.onclick = () => closeDetails();

    dialog.style.display = 'block';
    dialog.classList.remove('move-out-sheet');
    dialog.classList.add('move-in-sheet');

}

function fadeOutDetails() {
    
    dialog.classList.remove('move-in-sheet');
    dialog.classList.add('move-out-sheet');

    dialog.addEventListener('animationend', function() {
        dialog.style.display = 'none';
    }, { once: true });
}

// fader megjelenítés és eltűntetés

function fadeInFader() {

    fader.style.display = 'block';
    fader.classList.remove('fade-out');
    fader.classList.add('fade-in'); // Hozzáadjuk a fade-out osztályt
}

function fadeOutFader() {

    fader.classList.remove('fade-in');
    fader.classList.add('fade-out'); // Hozzáadjuk a fade-out osztályt

    // Itt is hozzáadjuk az eseményfigyelőt az elrejtés animáció végén
    fader.addEventListener('animationend', function() {
        fader.style.display = 'none';
    }, { once: true });
}


// ----------------------
// SPINNER események
// ----------------------


function showSpinner() {
    document.getElementById('spinner').style.display = 'flex';
}

function hideSpinner() {
    document.getElementById('spinner').style.display = 'none';
}
