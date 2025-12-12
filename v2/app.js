import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, query, where, orderBy, onSnapshot, deleteDoc, doc, Timestamp } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚠️ 您的設定檔 (請確保這裡填寫正確)
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

// 安全選取元件的函式 (找不到會報錯，方便除錯)
function getEl(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.error(`❌ 找不到 ID 為 "${id}" 的元件，請檢查 index.html`);
        // 如果是按鈕類的重要元件，直接跳視窗警告
        if(id.includes('btn') || id.includes('modal')) alert(`程式錯誤：畫面缺少 #${id}`);
    }
    return el;
}

// 綁定 DOM
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
const inpDate = getEl('inp-date');
const inpTitle = getEl('inp-title');
const inpAmount = getEl('inp-amount');

let currentUser = null;
let unsubscribeList = null;
let editingDocId = null; // 記錄正在編輯哪一筆

// 初始化
const today = new Date();
if(filterMonth) filterMonth.value = today.toISOString().slice(0, 7);

// --- 登入與登出 ---
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

// --- Modal 操作 ---
function openModal(mode = 'create', data = null) {
    if (!modalOverlay) return;
    
    modalOverlay.style.display = 'flex';
    
    if (mode === 'edit' && data) {
        // 編輯模式
        editingDocId = data.id;
        modalTitle.innerText = "編輯帳目";
        btnSaveTxn.innerText = "更新";
        
        // 填入舊資料
        inpType.value = data.type;
        inpTitle.value = data.title;
        inpAmount.value = data.amount;
        // 處理日期格式 YYYY-MM-DD
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
        inpDate.valueAsDate = new Date(); // 預設今天
    }
}

// 綁定按鈕
getEl('btn-open-modal')?.addEventListener('click', () => openModal('create'));
getEl('btn-close-modal')?.addEventListener('click', () => modalOverlay.style.display = 'none');

// 點擊背景關閉
modalOverlay?.addEventListener('click', (e) => {
    if (e.target === modalOverlay) modalOverlay.style.display = 'none';
});

// --- 儲存/更新邏輯 ---
btnSaveTxn?.addEventListener('click', async () => {
    const title = inpTitle.value.trim();
    const amount = parseFloat(inpAmount.value);
    const dateStr = inpDate.value;
    const type = inpType.value;

    if (!title || !amount || !dateStr) return alert("請填寫完整資料");

    const txnData = {
        uid: currentUser.uid,
        title, amount, type,
        date: Timestamp.fromDate(new Date(dateStr))
    };

    try {
        if (editingDocId) {
            // 更新舊資料
            await updateDoc(doc(db, "transactions", editingDocId), txnData);
        } else {
            // 新增資料
            await addDoc(collection(db, "transactions"), txnData);
        }
        
        modalOverlay.style.display = 'none';
    } catch (e) {
        alert("儲存失敗: " + e.message);
        console.error(e);
    }
});

// --- 篩選月份 ---
filterMonth?.addEventListener('change', (e) => loadTransactions(e.target.value));

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

        snapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const docId = docSnapshot.id;
            
            // 計算
            if (data.type === 'income') total += data.amount;
            else total -= data.amount;

            // 顯示
            const dateObj = data.date.toDate();
            const dateDisplay = `${dateObj.getMonth()+1}/${dateObj.getDate()}`;
            const isIncome = data.type === 'income';
            const sign = isIncome ? '+' : '-';
            const amountClass = isIncome ? 'income' : 'expense';

            const li = document.createElement('li');
            li.className = 'txn-item';
            
            // 點擊項目 -> 開啟編輯
            li.onclick = () => {
                openModal('edit', { id: docId, ...data });
            };

            li.innerHTML = `
                <div class="txn-content">
                    <div class="txn-info">
                        <strong style="font-size:16px; display:block; margin-bottom:4px;">${data.title}</strong>
                        <span style="font-size:12px; color:#888;">${dateDisplay}</span>
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

// --- 刪除 ---
window.deleteItem = async (docId) => {
    if (confirm("確定要刪除這筆紀錄嗎？")) {
        await deleteDoc(doc(db, "transactions", docId));
    }
};
