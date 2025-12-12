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
let unsubscribeList = null;

// 初始化日期
const today = new Date();
inpDate.valueAsDate = today;
filterMonth.value = today.toISOString().slice(0, 7);

// --- 登入/登出 ---
document.getElementById('btn-login').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(err => alert("登入錯誤: " + err.message));
});

document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth).then(() => alert("已登出"));
});

// --- 監聽狀態 ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        loginArea.style.display = 'none';
        appArea.style.display = 'block';
        userInfo.innerText = `帳戶: ${user.email}`;
        loadTransactions(filterMonth.value);
    } else {
        loginArea.style.display = 'block';
        appArea.style.display = 'none';
        if (unsubscribeList) unsubscribeList();
    }
});

// --- 新增 ---
document.getElementById('btn-add').addEventListener('click', async () => {
    const title = inpTitle.value;
    const amount = parseFloat(inpAmount.value);
    const dateStr = inpDate.value;
    const type = inpType.value;

    if (!title || !amount || !dateStr) {
        alert("請填寫完整資料！");
        return;
    }

    try {
        await addDoc(collection(db, "transactions"), {
            uid: currentUser.uid,
            title: title,
            amount: amount,
            type: type,
            date: Timestamp.fromDate(new Date(dateStr))
        });
        inpTitle.value = '';
        inpAmount.value = '';
    } catch (e) {
        alert("記帳錯誤: " + e.message);
    }
});

// --- 篩選 ---
filterMonth.addEventListener('change', (e) => {
    loadTransactions(e.target.value);
});

// --- 讀取 ---
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
            txnList.innerHTML = "<li>本月尚無資料</li>";
            totalBalanceEl.innerText = "結餘: $0";
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.date.toDate().toLocaleDateString();
            
            if (data.type === 'income') total += data.amount;
            else total -= data.amount;

            const li = document.createElement('li');
            li.className = 'txn-item';
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

        totalBalanceEl.innerText = `結餘: $${total}`;
    });
}

// --- 刪除 ---
window.deleteItem = async (docId) => {
    if (confirm("確定刪除？")) {
        await deleteDoc(doc(db, "transactions", docId));
    }
};
