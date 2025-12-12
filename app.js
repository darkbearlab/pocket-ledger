import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc, Timestamp } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚠️ 您的設定檔
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

// DOM 元素
const loginArea = document.getElementById('login-area');
const appContainer = document.getElementById('app-container'); // 變更
const userInfo = document.getElementById('user-info');
const inpType = document.getElementById('inp-type');
const inpDate = document.getElementById('inp-date');
const inpTitle = document.getElementById('inp-title');
const inpAmount = document.getElementById('inp-amount');
const txnList = document.getElementById('txn-list');
const totalBalanceEl = document.getElementById('total-balance');
const filterMonth = document.getElementById('filter-month');

let currentUser = null;
let unsubscribeList = null;

// 初始化
const today = new Date();
filterMonth.value = today.toISOString().slice(0, 7);

// 登入
document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(err => alert(err.message));
});

// 登出 (掛在 window 上給 HTML 用)
window.doLogout = () => signOut(auth);

// 監聽狀態
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        loginArea.style.display = 'none';
        appContainer.style.display = 'flex'; // Flex layout
        userInfo.innerText = user.email.split('@')[0]; // 只顯示 @ 前面的名字比較短
        loadTransactions(filterMonth.value);
    } else {
        loginArea.style.display = 'flex';
        appContainer.style.display = 'none';
        if (unsubscribeList) unsubscribeList();
    }
});

// 新增交易
document.getElementById('btn-add').addEventListener('click', async () => {
    const title = inpTitle.value;
    const amount = parseFloat(inpAmount.value);
    const dateStr = inpDate.value;
    const type = inpType.value;

    if (!title || !amount || !dateStr) return alert("請填寫完整");

    try {
        await addDoc(collection(db, "transactions"), {
            uid: currentUser.uid,
            title, amount, type,
            date: Timestamp.fromDate(new Date(dateStr))
        });
        
        // 成功後關閉視窗並清空
        window.closeModal(); // 呼叫 HTML 裡的函式
        inpTitle.value = '';
        inpAmount.value = '';
    } catch (e) {
        alert("錯誤: " + e.message);
    }
});

// 切換月份
filterMonth.addEventListener('change', (e) => loadTransactions(e.target.value));

// 讀取資料
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

        if(snapshot.empty) {
            txnList.innerHTML = '<li style="text-align:center; color:#ccc; padding:20px;">本月尚無紀錄</li>';
            totalBalanceEl.innerText = "$0";
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const dateObj = data.date.toDate();
            // 格式化日期： 12/05
            const dateDisplay = `${dateObj.getMonth()+1}/${dateObj.getDate()}`;
            
            if (data.type === 'income') total += data.amount;
            else total -= data.amount;

            const li = document.createElement('li');
            li.className = 'txn-item';
            
            const isIncome = data.type === 'income';
            const amountClass = isIncome ? 'income' : 'expense';
            const sign = isIncome ? '+' : '-';

            li.innerHTML = `
                <div class="txn-info">
                    <strong>${data.title}</strong>
                    <span>${dateDisplay}</span>
                </div>
                <div style="display:flex; align-items:center;">
                    <div class="txn-amount ${amountClass}">
                        ${sign}$${data.amount}
                    </div>
                    <button class="delete-btn" onclick="window.deleteItem('${doc.id}')">✕</button>
                </div>
            `;
            txnList.appendChild(li);
        });

        totalBalanceEl.innerText = `$${total}`;
        totalBalanceEl.style.color = total >= 0 ? '#000' : '#ff3b30'; // 負數變紅
    });
}

// 刪除
window.deleteItem = async (docId) => {
    if (confirm("刪除這筆紀錄？")) {
        await deleteDoc(doc(db, "transactions", docId));
    }
};

// 註冊 Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
}
