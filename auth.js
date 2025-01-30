const REDIRECT_URI = "https://dagobertapp.com/staging/callback.php";
const CLIENT_ID = '1095032107087-jpb28e0l3tjmuh0iseftcpoaqb0o5cpd.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';


// AUTH FÜGGVÉNYEK

function logout() {

    sessionStorage.removeItem("access_token");
    localStorage.removeItem("access_token"); // Ha localStorage-t is használsz

    window.location.href = "/staging/index.html?logged_out=true"; // Vagy a bejelentkezési oldal URL-je
}

async function getAccessToken() {
    const response = await fetch('refresh_token.php');
    const data = await response.json();

    if (data.access_token) {
        sessionStorage.setItem("access_token", data.access_token);
        return data.access_token;
    } else {
        console.error("Token frissítés sikertelen:", data.error);
        throw new Error("Nem sikerült access tokent szerezni");
    }
}

window.onload = async () => {
    
    applyTranslations();
    
    const urlParams = new URLSearchParams(window.location.search);
    const loggedOut = urlParams.get('logged_out');
    const accessToken = urlParams.get('access_token');
    const storedToken = sessionStorage.getItem("access_token");
    
    console.log("loggedOut:", loggedOut);
    console.log("accessToken:", accessToken);
    console.log("storedToken:", storedToken);
    
    if (loggedOut) {
        
        console.log("user logged out.");
        
        // Ha a felhasználó kijelentkezett, ne kezdjük újra a hitelesítést
        document.getElementById("homePage").style.display = "flex";
        document.getElementById("footer").style.display = "flex";
        document.getElementById("list").style.display = "none";
        document.getElementById("authButton").onclick = () => {
            window.location.href = '/staging/auth.php?prompt=select_account';
        };
        document.getElementById("authButtonAgain").onclick = () => {
            window.location.href = '/staging/auth.php?prompt=select_account';
        };
        return;
    }
    
    

    if (accessToken) {
        
        console.log("user got access token.");
        
        sessionStorage.setItem("access_token", accessToken);
        urlParams.delete('access_token');
        window.history.replaceState({}, document.title, window.location.pathname);
        checkOrCreateSpreadsheet();
        
        return;
        
    }
    
    if (storedToken) {
        
        console.log("user has stored access token.");
        
        await attemptSpreadsheetAccess(storedToken);
        
        return;
        
    }
            
    try {

        const newToken = await fetchNewAccessToken();
        sessionStorage.setItem("access_token", newToken);
        checkOrCreateSpreadsheet();

    } catch (error) {

        console.log("problem fetching new access token.");

        document.getElementById("homePage").style.display = "flex";
        document.getElementById("footer").style.display = "flex";
        document.getElementById("list").style.display = "none";
        document.getElementById("authButton").onclick = () => {
            window.location.href = '/staging/auth.php?prompt=consent';
        };
        document.getElementById("authButtonAgain").onclick = () => {
            window.location.href = '/staging/auth.php?prompt=consent';
        };
    }

};

async function attemptSpreadsheetAccess(token) {
    try {
        await checkOrCreateSpreadsheet(token);
    } catch (error) {
        if (error.status === 401) {
            try {
                const newToken = await fetchNewAccessToken();
                sessionStorage.setItem("access_token", newToken);
                await checkOrCreateSpreadsheet(newToken);
            } catch (refreshError) {
                document.getElementById("homePage").style.display = "flex";
                document.getElementById("authButton").onclick = () => {
                    window.location.href = '/staging/auth.php';
                };
            }
        }
    }
}

// Általános fetch függvény 401-es hiba kezelésére és token frissítésre
async function fetchWithToken(url, options = {}) {
    let token = sessionStorage.getItem("access_token");
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
    };

    let response = await fetch(url, options);

    if (response.status === 401) {
        console.warn("Token lejárt, új token kérése...");
        
        try {
            const newToken = await fetchNewAccessToken();
            sessionStorage.setItem("access_token", newToken);
            options.headers['Authorization'] = `Bearer ${newToken}`;
            response = await fetch(url, options); // Újraküldjük a kérést a frissített tokennel
        } catch (error) {
            console.error("Nem sikerült frissíteni a tokent:", error);
            throw error;
        }
    }

    return response;
}

// Új access token lekérése a szervertől a refresh token használatával
async function fetchNewAccessToken() {
    console.log("fetching new access token");
    const response = await fetch('/staging/refresh_token.php');
    const data = await response.json();

    if (data.access_token) {
        console.log("success, new access token:", data.access_token);
        return data.access_token;
    } else {
        console.error("failed to fetch new access token:", data);
        throw new Error("Nem sikerült frissített tokent szerezni a szervertől.");
    }
}

