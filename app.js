import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc, Timestamp } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚠️ 請換成您的 Config
const firebaseConfig = {
  apiKey: "AIzaSyAGtak9bLhVXR7oJDKr3R1ZM6OdL6JyI8A",
  authDomain: "my-pocket-ledger.firebaseapp.com",
  projectId: "my-pocket-ledger",
  storageBucket: "my-pocket-ledger.firebasestorage.app",
  messagingSenderId: "226784562748",
  appId: "1:226784562748:web:a63498ccecbec428e53d39",
  measurementId: "G-TBRP3W8TME"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// UI 變數
const loginArea = document.getElementById('login-area');
const appArea = document.getElementById('app-area');
const userInfo = document.getElementById('user-info');
const inpType = document.getElementById('inp-type');
const inpDate = document.getElementById('inp-date');
const inpTitle = document.getElementById('inp-title');
const inpAmount = document.getElementById('inp-amount');
const txnList = document.getElementById('txn-list');
const totalBalanceEl = document.getElementById('total-balance');
const filterMonth = document.getElementById('filter-month');

let currentUser = null;
let unsubscribeList = null; // 用來停止監聽資料庫

// 1. 初始化日期 (預設今天 / 本月)
const today = new Date();
inpDate.valueAsDate = today; // 設定表單預設為今天
filterMonth.value = today.toISOString().slice(0, 7); // 設定列表預設為本月 (YYYY-MM)

// --- 登入/登出邏輯 (不變) ---
document.getElementById('btn-login').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        loginArea.style.display = 'none';
        appArea.style.display = 'block';
        userInfo.innerText = `帳戶: ${user.email}`;
        
        // 登入後，馬上載入這個月的資料
        loadTransactions(filterMonth.value);
    } else {
        loginArea.style.display = 'block';
        appArea.style.display = 'none';
        if (unsubscribeList) unsubscribeList(); // 登出時停止監聽
    }
});

// --- 功能 A: 新增交易 (INSERT) ---
document.getElementById('btn-add').addEventListener('click', async () => {
    const title = inpTitle.value;
    const amount = parseFloat(inpAmount.value);
    const dateStr = inpDate.value; // YYYY-MM-DD
    const type = inpType.value;

    if (!title || !amount || !dateStr) {
        alert("請填寫完整資料！");
        return;
    }

    try {
        // 寫入 Firestore
        // 對應 SQL: INSERT INTO transactions (uid, title, amount, type, date) VALUES (...)
        await addDoc(collection(db, "transactions"), {
            uid: currentUser.uid, // 重要！標記這筆資料是誰的
            title: title,
            amount: amount,
            type: type,
            date: Timestamp.fromDate(new Date(dateStr)) // 轉成 Firestore 專用時間格式
        });

        // 清空輸入框
        inpTitle.value = '';
        inpAmount.value = '';
        alert("記帳成功！");
    } catch (e) {
        console.error("寫入錯誤", e);
        alert("錯誤: " + e.message);
    }
});

// --- 功能 B: 切換月份時重新查詢 ---
filterMonth.addEventListener('change', (e) => {
    loadTransactions(e.target.value);
});

// --- 功能 C: 讀取並監聽資料 (SELECT WHERE... ORDER BY...) ---
function loadTransactions(monthStr) {
    // monthStr 格式是 "2023-12"
    if (!currentUser) return;
    
    // 1. 計算該月的「第一天」和「最後一天」
    // 用來做 WHERE date >= Start AND date <= End
    const startDate = new Date(monthStr + "-01");
    const endDate = new Date(monthStr + "-01");
    endDate.setMonth(endDate.getMonth() + 1); // 下個月的1號，用來當界線

    // 2. 建立查詢 Query
    const q = query(
        collection(db, "transactions"),
        where("uid", "==", currentUser.uid), // 只抓自己的
        where("date", ">=", Timestamp.fromDate(startDate)),
        where("date", "<", Timestamp.fromDate(endDate)), // 小於下個月1號 = 這個月月底
        orderBy("date", "desc") // 按日期倒序 (最新的在上面)
    );

    // 3. 停止上一次的監聽 (避免重複監聽浪費流量)
    if (unsubscribeList) unsubscribeList();

    // 4. 開始即時監聽 (onSnapshot)
    // 這比 SQL 強的地方：資料庫一變，這裡馬上自動執行，不用手動 reload
    unsubscribeList = onSnapshot(q, (snapshot) => {
        txnList.innerHTML = ""; // 清空列表
        let total = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.date.toDate().toLocaleDateString();
            
            // 計算結餘
            if (data.type === 'income') total += data.amount;
            else total -= data.amount;

            // 渲染 HTML
            const li = document.createElement('li');
            li.className = 'txn-item';
            
            // 判斷顏色 class
            const colorClass = data.type === 'income' ? 'income' : 'expense';
            const sign = data.type === 'income' ? '+' : '-';

            li.innerHTML = `
                <div>
                    <span style="color:#888; font-size:0.8em;">${date}</span><br>
                    <strong>${data.title}</strong>
                </div>
                <div class="${colorClass}">
                    ${sign}$${data.amount}
                    <button class="delete-btn" onclick="window.deleteItem('${doc.id}')">x</button>
                </div>
            `;
            txnList.appendChild(li);
        });

        // 更新總結餘
        totalBalanceEl.innerText = `本月結餘: $${total}`;
        if(total < 0) totalBalanceEl.style.color = 'red';
        else totalBalanceEl.style.color = 'black';
    });
}

// --- 功能 D: 刪除 (DELETE) ---
// 把這個函式掛到 window 上，這樣 HTML 裡的 onclick 才能呼叫到
window.deleteItem = async (docId) => {
    if (confirm("確定要刪除這筆嗎？")) {
        await deleteDoc(doc(db, "transactions", docId));
    }
};
