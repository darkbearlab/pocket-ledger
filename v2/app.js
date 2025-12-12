import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// 引入 updateDoc
import { getFirestore, collection, addDoc, updateDoc, query, where, orderBy, onSnapshot, deleteDoc, doc, Timestamp } 
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
const appContainer = document.getElementById('app-container');
const headerTitle = document.getElementById('header-title');
const totalBalanceEl = document.getElementById('total-balance');
const txnList = document.getElementById('txn-list');
const filterMonth = document.getElementById('filter-month');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title'); // 新增
const btnSaveTxn = document.getElementById('btn-save-txn'); // 新增

// 輸入框
const inpType = document.getElementById('inp-type');
const inpDate = document.getElementById('inp-date');
const inpTitle = document.getElementById('inp-title');
const inpAmount = document.getElementById('inp-amount');

let currentUser = null;
let unsubscribeList = null;
// 【關鍵變數】用來記錄現在正在編輯哪一筆資料，如果是 null 代表是新增模式
let editingDocId = null; 

const today = new Date();
filterMonth.value = today.toISOString().slice(0, 7);

// --- 登入/登出 ---
document.getElementById('btn-login').addEventListener('click', () => signInWithPopup(auth, provider).catch(e=>alert(e.message)));
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        loginArea.style.display = 'none';
        appContainer.style.display = 'flex';
        headerTitle.innerText = user.email.split('@')[0];
        loadTransactions(filterMonth.value);
    } else {
        loginArea.style.display = 'flex';
        appContainer.style.display = 'none';
        if (unsubscribeList) unsubscribeList();
    }
});

// --- Modal 控制與狀態重置 ---
// 打開 Modal (新增模式)
document.getElementById('btn-open-modal').addEventListener('click', () => {
    resetModalState(); // 重置為新增模式
    modalOverlay.style.display = 'flex';
    inpDate.valueAsDate = new Date();
});

// 關閉 Modal
document.getElementById('btn-close-modal').addEventListener('click', () => {
    modalOverlay.style.display = 'none';
    resetModalState(); // 關閉時也重置，確保下次打開是乾淨的
});

// 重置 Modal 狀態的 Helper function
function resetModalState() {
    editingDocId = null; // 清空編輯 ID
    modalTitle.innerText = "記一筆";
    btnSaveTxn.innerText = "儲存";
    inpTitle.value = '';
    inpAmount.value = '';
    inpType.value = 'expense';
    // 日期保留上次選擇可能體驗比較好，這裡先不清空日期
}


// --- 儲存按鈕 (同時處理新增和更新) ---
btnSaveTxn.addEventListener('click', async () => {
    const title = inpTitle.value;
    const amount = parseFloat(inpAmount.value);
    const dateStr = inpDate.value;
    const type = inpType.value;

    if (!title || !amount || !dateStr) return alert("請填寫完整");

    const txnData = {
        uid: currentUser.uid,
        title, amount, type,
        date: Timestamp.fromDate(new Date(dateStr))
    };

    try {
        if (editingDocId) {
            // --- 更新模式 (Update) ---
            await updateDoc(doc(db, "transactions", editingDocId), txnData);
        } else {
            // --- 新增模式 (Create) ---
            await addDoc(collection(db, "transactions"), txnData);
        }
        
        modalOverlay.style.display = 'none';
        resetModalState(); // 成功後重置

    } catch (e) {
        alert("錯誤: " + e.message);
    }
});


filterMonth.addEventListener('change', (e) => loadTransactions(e.target.value));

// --- 讀取與列表渲染 (重點修改) ---
function loadTransactions(monthStr) {
    if (!currentUser) return;
    const startDate = new Date(monthStr + "-01");
    const endDate = new Date(monthStr + "-01");
    endDate.setMonth(endDate.getMonth() + 1);

    const q = query(collection(db, "transactions"), where("uid", "==", currentUser.uid), where("date", ">=", Timestamp.fromDate(startDate)), where("date", "<", Timestamp.fromDate(endDate)), orderBy("date", "desc"));

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
            const docId = docSnapshot.id; // 拿到文件 ID
            const dateObj = data.date.toDate();
            const dateDisplay = `${dateObj.getMonth()+1}/${dateObj.getDate()}`;
            
            if (data.type === 'income') total += data.amount; else total -= data.amount;

            const isIncome = data.type === 'income';
            const sign = isIncome ? '+' : '-';
            const amountClass = isIncome ? 'income' : 'expense';
            const dateISO = dateObj.toISOString().slice(0, 10); // YYYY-MM-DD 給 input 用

            const li = document.createElement('li');
            li.className = 'txn-item';
            
            // 【關鍵】點擊整個 li 時觸發編輯模式
            li.onclick = () => {
                editingDocId = docId; // 設定目前正在編輯這個 ID
                modalTitle.innerText = "編輯帳目";
                btnSaveTxn.innerText = "更新";
                
                // 把資料填回輸入框
                inpType.value = data.type;
                inpTitle.value = data.title;
                inpAmount.value = data.amount;
                inpDate.value = dateISO;

                modalOverlay.style.display = 'flex';
            };

            // HTML 結構調整：加入 wrapper，把刪除按鈕放到最外面
            li.innerHTML = `
                <div class="txn-content-wrapper">
                    <div class="txn-info">
                        <strong>${data.title}</strong>
                        <span>${dateDisplay}</span>
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

window.deleteItem = async (docId) => {
    if (confirm("確定要刪除這筆嗎？")) {
        await deleteDoc(doc(db, "transactions", docId));
    }
};
