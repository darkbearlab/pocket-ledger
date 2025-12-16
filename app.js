import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, query, where, orderBy, onSnapshot, deleteDoc, doc, Timestamp } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚠️⚠️⚠️ 記得貼上您的 Key ⚠️⚠️⚠️
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

// Helper: 抓取 DOM 元件
function getEl(id) {
    return document.getElementById(id);
}

// DOM 綁定
const loginArea = getEl('login-area');
const appContainer = getEl('app-container');
const headerTitle = getEl('header-title');
const totalBalanceEl = getEl('total-balance');
const txnList = getEl('txn-list');
const filterMonth = getEl('filter-month');
const modalOverlay = getEl('modal-overlay');
const modalTitle = getEl('modal-title');
const btnSaveTxn = getEl('btn-save-txn');

// 輸入框
const inpType = getEl('inp-type');
const inpMethod = getEl('inp-method'); // 新增
const inpDate = getEl('inp-date');
const inpTitle = getEl('inp-title');
const inpAmount = getEl('inp-amount');

let currentUser = null;
let unsubscribeList = null;
let editingDocId = null; 

// 初始化月份
const today = new Date();
if(filterMonth) filterMonth.value = today.toISOString().slice(0, 7);

// --- 登入/登出 ---
getEl('btn-login')?.addEventListener('click', () => signInWithPopup(auth, provider).catch(e => alert(e.message)));
getEl('btn-logout')?.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        if(loginArea) loginArea.style.display = 'none';
        if(appContainer) appContainer.style.display = 'flex';
        if(headerTitle) headerTitle.innerText = user.email.split('@')[0];
        loadTransactions(filterMonth.value);
    } else {
        if(loginArea) loginArea.style.display = 'flex';
        if(appContainer) appContainer.style.display = 'none';
        if (unsubscribeList) unsubscribeList();
    }
});

// --- Modal 控制 (包含初始化表單) ---
function openModal(mode = 'create', data = null) {
    if (!modalOverlay) return;
    modalOverlay.style.display = 'flex';
    
    if (mode === 'edit' && data) {
        // 編輯模式
        editingDocId = data.id;
        modalTitle.innerText = "編輯帳目";
        btnSaveTxn.innerText = "更新";
        
        inpType.value = data.type;
        inpTitle.value = data.title;
        inpAmount.value = data.amount;
        
        // 填入付款方式 (舊資料若是 undefined，預設為現金)
        inpMethod.value = data.method || 'cash';

        // 處理日期
        const dateObj = data.date.toDate();
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        inpDate.value = `${y}-${m}-${d}`;
    } else {
        // 新增模式
        editingDocId = null;
        modalTitle.innerText = "記一筆";
        btnSaveTxn.innerText = "儲存";
        
        inpTitle.value = '';
        inpAmount.value = '';
        inpMethod.value = 'cash'; // 預設現金
        inpDate.valueAsDate = new Date(); 
    }
}

getEl('btn-open-modal')?.addEventListener('click', () => openModal('create'));
getEl('btn-close-modal')?.addEventListener('click', () => modalOverlay.style.display = 'none');
modalOverlay?.addEventListener('click', (e) => {
    if (e.target === modalOverlay) modalOverlay.style.display = 'none';
});

// --- 儲存邏輯 ---
btnSaveTxn?.addEventListener('click', async () => {
    const title = inpTitle.value.trim();
    const amount = parseFloat(inpAmount.value);
    const dateStr = inpDate.value;
    const type = inpType.value;
    const method = inpMethod.value; // 抓取付款方式

    if (!title || !amount || !dateStr) return alert("請填寫完整資料");

    const txnData = {
        uid: currentUser.uid,
        title, amount, type, method, // 存入 method
        date: Timestamp.fromDate(new Date(dateStr))
    };

    try {
        if (editingDocId) {
            await updateDoc(doc(db, "transactions", editingDocId), txnData);
        } else {
            await addDoc(collection(db, "transactions"), txnData);
        }
        modalOverlay.style.display = 'none';
    } catch (e) {
        alert("儲存失敗: " + e.message);
    }
});

// --- 篩選與列表讀取 ---
filterMonth?.addEventListener('change', (e) => loadTransactions(e.target.value));

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

        snapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const docId = docSnapshot.id;
            
            if (data.type === 'income') total += data.amount;
            else total -= data.amount;

            // 顯示設定
            const dateObj = data.date.toDate();
            const dateDisplay = `${dateObj.getMonth()+1}/${dateObj.getDate()}`;
            const isIncome = data.type === 'income';
            const sign = isIncome ? '+' : '-';
            const amountClass = isIncome ? 'income' : 'expense';

            // 圖示邏輯
            let methodIcon = '';
            if (data.method === 'card') methodIcon = '💳';
            else if (data.method === 'cash') methodIcon = '💵';
            // 舊資料 (undefined) 也會預設不顯示或顯示現金，這裡讓它顯示現金比較一致
            if (!data.method) methodIcon = '💵'; 

            const li = document.createElement('li');
            li.className = 'txn-item';
            
            // 點擊編輯
            li.onclick = () => {
                openModal('edit', { id: docId, ...data });
            };

            li.innerHTML = `
                <div class="txn-content">
                    <div class="txn-info">
                        <strong style="font-size:16px; display:block; margin-bottom:4px;">${data.title}</strong>
                        <span style="font-size:12px; color:#888;">
                           ${methodIcon} ${dateDisplay}
                        </span>
                    </div>
                    <div class="txn-amount ${amountClass}">
                        ${sign}$${data.amount}
                    </div>
                </div>
                <button class="delete-btn" onclick="event.stopPropagation(); window.deleteItem('${docId}')">✕</button>
            `;
            txnList.appendChild(li);
        });

        totalBalanceEl.innerText = `$${total}`;
        totalBalanceEl.style.color = total >= 0 ? '#000' : '#FF3B30';
    });
}

// 刪除
window.deleteItem = async (docId) => {
    if (confirm("確定要刪除這筆紀錄嗎？")) {
        await deleteDoc(doc(db, "transactions", docId));
    }
};
