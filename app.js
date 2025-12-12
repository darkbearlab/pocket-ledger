// 1. 引入 Firebase SDK (直接從 Google CDN 抓，不用安裝)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. 貼上您的設定檔 (從 Firebase 後台複製來的)
const firebaseConfig = {
  apiKey: "AIzaSyAGtak9bLhVXR7oJDKr3R1ZM6OdL6JyI8A",
  authDomain: "my-pocket-ledger.firebaseapp.com",
  projectId: "my-pocket-ledger",
  storageBucket: "my-pocket-ledger.firebasestorage.app",
  messagingSenderId: "226784562748",
  appId: "1:226784562748:web:a63498ccecbec428e53d39",
  measurementId: "G-TBRP3W8TME"
};

// 3. 啟動 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- 程式邏輯開始 ---

const btnLogin = document.getElementById('btnLogin'); // Typo fix: matched HTML ID
const btnLogout = document.getElementById('btn-logout');
const loginArea = document.getElementById('login-area');
const appArea = document.getElementById('app-area');
const userInfo = document.getElementById('user-info');
const dbStatus = document.getElementById('db-status');

// 登入按鈕
document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log("登入成功:", result.user);
        })
        .catch((error) => {
            console.error("登入失敗:", error);
            alert("登入失敗: " + error.message);
        });
});

// 登出按鈕
btnLogout.addEventListener('click', () => {
    signOut(auth).then(() => {
        alert("已登出");
    });
});

// 監聽登入狀態改變 (這最重要！重新整理網頁也會記得登入狀態)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 使用者已登入
        loginArea.style.display = 'none';
        appArea.style.display = 'block';
        userInfo.innerText = `嗨，${user.displayName} (${user.email})`;
        
        // 測試資料庫連線
        try {
            await addDoc(collection(db, "test_logs"), {
                msg: "連線測試",
                time: new Date(),
                uid: user.uid
            });
            dbStatus.innerText = "✅ 資料庫連線正常 (寫入成功)";
            dbStatus.style.color = "green";
        } catch (e) {
            dbStatus.innerText = "❌ 資料庫連線失敗: " + e.message;
            dbStatus.style.color = "red";
        }

    } else {
        // 使用者未登入
        loginArea.style.display = 'block';
        appArea.style.display = 'none';
    }
});
