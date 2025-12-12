import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc, Timestamp } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚠️ 貼上您的 Config
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

// DOM 元素 (確保這些 ID 在 index.html 都找得到)
const loginArea = document.getElementById('login-area');
const appContainer = document.getElementById('app-container');
const headerTitle = document.getElementById('header-title');
const totalBalanceEl = document.getElementById('total-balance');
const txnList = document.getElementById('txn-list');
const filterMonth = document.getElementById('filter-month');
const modalOverlay = document.getElementById('modal-overlay');

// 輸入框
const inpType = document.getElementById('inp-type');
const inpDate = document.getElementById('inp-date');
const inpTitle = document.getElementById('inp-title');
const inpAmount = document.getElementById('inp-amount');

let currentUser = null;
let unsubscribeList = null;

// 初始化
const today = new Date();
filterMonth.value = today.toISOString().slice(0, 7);

// --- 登入與登出 ---
document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(err => alert(err.message));
});

document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth); // 登出後 onAuthStateChanged 會自動處理 UI 切換
});

// --- Auth 狀態監聽 ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        // 登入成功：隱藏登入頁，顯示主頁
        loginArea.style.display = 'none';
        appContainer.style.display = 'flex';
        headerTitle.innerText = user.email.split('@')[0]; // 標題顯示名字
        loadTransactions(filterMonth.value);
    } else {
        // 未登入：顯示登入頁，隱藏主頁
        loginArea.style.display = 'flex';
        appContainer.style.display = 'none';
        if (unsubscribeList) unsubscribeList();
    }
});

// --- Modal 控制 ---
document.getElementById('btn-open-modal').addEventListener('click', () => {
    modalOverlay.style.display = 'flex';
    inpDate.valueAsDate = new Date(); // 預設今天
});

document.getElementById('btn-close-modal').addEventListener('click', () => {
    modalOverlay.style.display = 'none';
});

// --- 新增功能 ---
document.getElementById('btn-add').addEventListener('click', async () => {
    const title = inpTitle.value;
    const amount = parseFloat(inpAmount.value);
    const dateStr = inpDate.value;
    const type = inpType.value;

    if (!title || !amount || !dateStr) {
        alert("請填寫完整");
        return;
    }

    try {
        await addDoc(collection(db, "transactions"), {
            uid: currentUser.uid,
            title, amount, type,
            date: Timestamp.fromDate(new Date(dateStr))
        });
        
        // 成功後關閉視窗並清空
        modalOverlay.style.display = 'none';
        inpTitle.value = '';
        inpAmount.value = '';
    } catch (e) {
        alert("錯誤: " + e.message);
    }
});

// --- 篩選月份 ---
filterMonth.addEventListener('change', (e) => loadTransactions(e.target.value));

// --- 讀取資料 ---
function loadTransactions(monthStr) {
    if (!currentUser) return;
    
    const startDate = new Date(monthStr + "-01");
    const endDate = new Date(monthStr + "-01");
    endDate.setMonth(endDate.getMonth() + 1);

    const q = query(
        collection(db, "transactions"),
        where("uid", "==", currentUser.uid),
        where("date", ">=", Timestamp.fromDate(startDate)),
        where("date", "<", Timestamp.fromDate(endDate)),
        orderBy("date", "desc")
    );

    if (unsubscribeList) unsubscribeList();

    unsubscribeList = onSnapshot(q, (snapshot) => {
        txnList.innerHTML = "";
        let total = 0;

        if (snapshot.empty) {
            txnList.innerHTML = '<li style="text-align:center; color:#ccc; padding:20px;">本月尚無紀錄</li>';
            totalBalanceEl.innerText = "$0";
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const dateObj = data.date.toDate();
            const dateDisplay = `${dateObj.getMonth()+1}/${dateObj.getDate()}`;
            
            if (data.type === 'income') total += data.amount;
            else total -= data.amount;

            const isIncome = data.type === 'income';
            const sign = isIncome ? '+' : '-';
            const amountClass = isIncome ? 'income' : 'expense';

            const li = document.createElement('li');
            li.className = 'txn-item';
            li.innerHTML = `
                <div class="txn-info">
                    <strong>${data.title}</strong>
                    <span>${dateDisplay}</span>
                </div>
                <div class="txn-right">
                    <div class="txn-amount ${amountClass}">
                        ${sign}$${data.amount}
                    </div>
                    <button class="delete-btn" id="del-${doc.id}">✕</button>
                </div>
            `;
            txnList.appendChild(li);

            // 為每個刪除按鈕綁定事件
            document.getElementById(`del-${doc.id}`).addEventListener('click', () => deleteItem(doc.id));
        });

        totalBalanceEl.innerText = `$${total}`;
        totalBalanceEl.style.color = total >= 0 ? '#000' : '#FF3B30';
    });
}

// --- 刪除功能 ---
async function deleteItem(docId) {
    if (confirm("確定要刪除這筆嗎？")) {
        await deleteDoc(doc(db, "transactions", docId));
    }
}
