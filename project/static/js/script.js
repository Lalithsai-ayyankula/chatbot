let currentChatId = null;
let chatHistory = {};
let chatToDeleteId = null;
let isSidebarOpen = false;
const FLASK_BASE_URL = 'http://127.0.0.1:5000';

// DOM Elements
const chatDisplay = document.getElementById('chatDisplay');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const viewHistoryBtn = document.getElementById('viewHistoryBtn');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const themeToggle = document.getElementById('themeToggle');
const confirmModal = document.getElementById('confirmModal');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

// Initialize the app
function initApp() {
    initTheme();
    initEventListeners();
    startNewChat();
}

// Theme management
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
        document.documentElement.classList.toggle('dark', systemPrefersDark);
        localStorage.setItem('theme', systemPrefersDark ? 'dark' : 'light');
    }
    updateThemeIcon();
}

function updateThemeIcon() {
    const isDark = document.documentElement.classList.contains('dark');
    themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

// Sidebar management
function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
    sidebar.classList.toggle('-translate-x-full', !isSidebarOpen);
    
    if (isSidebarOpen) {
        const overlay = document.createElement('div');
        overlay.id = 'sidebarOverlay';
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-10 md:hidden';
        overlay.addEventListener('click', toggleSidebar);
        document.body.appendChild(overlay);
    } else {
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) overlay.remove();
    }
}

// Chat display functions
function showMessage(message, role) {
    if (chatDisplay.children.length === 1 && chatDisplay.children[0].classList.contains('text-center')) {
        chatDisplay.innerHTML = '';
    }

    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', role === 'user' ? 'chat-message-user' : 'chat-message-bot');
    
    let formattedContent = message
        .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    messageElement.innerHTML = `
        <div class="flex items-start">
            <div class="flex-shrink-0 pt-1">
                ${role === 'user' ? '<i class="fas fa-user-circle mr-2 text-blue-500"></i>' : '<i class="fas fa-robot mr-2 text-green-500"></i>'}
            </div>
            <div class="chat-message-content ml-2">
                ${formattedContent}
            </div>
        </div>
    `;
    
    chatDisplay.appendChild(messageElement);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

function clearChatDisplay() {
    chatDisplay.innerHTML = `
        <div class="flex justify-center items-center h-full text-gray-500 dark:text-gray-400 text-lg">
            <div class="text-center">
                <i class="fas fa-comments text-4xl mb-4"></i>
                <p>Start a new conversation</p>
            </div>
        </div>
    `;
}

function showLoadingIndicator() {
    const loadingElement = document.createElement('div');
    loadingElement.id = 'loadingIndicator';
    loadingElement.classList.add('chat-message', 'chat-message-bot');
    loadingElement.innerHTML = `
        <div class="flex items-start">
            <div class="flex-shrink-0 pt-1">
                <i class="fas fa-robot mr-2 text-green-500"></i>
            </div>
            <div class="ml-2">
                <div class="loading-indicator inline-block"></div>
            </div>
        </div>
    `;
    chatDisplay.appendChild(loadingElement);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

function hideLoadingIndicator() {
    const loadingElement = document.getElementById('loadingIndicator');
    if (loadingElement) loadingElement.remove();
}

// Modal functions
function showModal(modalElement) {
    modalElement.style.display = 'flex';
}

function hideModal(modalElement) {
    modalElement.style.display = 'none';
}

function showNotification(message, isSuccess = true) {
    const notification = document.createElement('div');
    notification.className = `fixed bottom-4 right-4 px-4 py-2 rounded-md shadow-lg text-white ${
        isSuccess ? 'bg-green-500' : 'bg-red-500'
    } notification`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// API functions
async function sendMessage() {
    const message = userInput.value.trim();
    if (message === '') return;

    userInput.value = '';
    showMessage(message, 'user');
    showLoadingIndicator();

    try {
        const response = await fetch(`${FLASK_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, chat_id: currentChatId }),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        hideLoadingIndicator();
        showMessage(data.response, 'bot');
        currentChatId = data.chat_id;
    } catch (error) {
        hideLoadingIndicator();
        console.error('Error sending message:', error);
        showMessage('Error: Could not get a response. Please try again.', 'bot');
    }
}

async function startNewChat() {
    try {
        const response = await fetch(`${FLASK_BASE_URL}/new_chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_chat_id: currentChatId })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        currentChatId = data.chat_id;
        clearChatDisplay();
        showMessage('Hello! How can I help you today?', 'bot');
        
        // Update history list with server response
        updateHistoryList(data.updated_history);
    } catch (error) {
        console.error('Error starting new chat:', error);
        showMessage('Error: Could not start a new chat.', 'bot');
    }
}

async function loadHistoryList() {
    try {
        const response = await fetch(`${FLASK_BASE_URL}/get_history?t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        updateHistoryList(data.sessions);
    } catch (error) {
        console.error('Error loading history:', error);
        showNotification('Failed to load chat history', false);
    }
}

function updateHistoryList(sessions) {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';

    if (!sessions || sessions.length === 0) {
        historyList.innerHTML = '<li class="p-3 text-gray-500 dark:text-gray-400">No chat history found</li>';
        return;
    }

    sessions.forEach(session => {
        const listItem = document.createElement('li');
        listItem.className = 'p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center border-b border-gray-200 dark:border-gray-600 last:border-b-0';
        listItem.innerHTML = `
            <span class="flex-1 truncate" data-chat-id="${session.id}">${session.title}</span>
            <button class="delete-chat-btn p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400" data-chat-id="${session.id}">
                <i class="fas fa-trash"></i>
            </button>
        `;
        historyList.appendChild(listItem);
    });
}

async function loadChatSession(chatId) {
    try {
        const response = await fetch(`${FLASK_BASE_URL}/load_chat/${chatId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        clearChatDisplay();
        data.messages.forEach(msg => showMessage(msg.content, msg.role));
        currentChatId = chatId;
        
        if (window.innerWidth < 768) {
            toggleSidebar();
        }
    } catch (error) {
        console.error('Error loading chat:', error);
        showMessage('Error loading chat session', 'bot');
    }
}

async function deleteChatSession(chatId) {
    try {
        const response = await fetch(`${FLASK_BASE_URL}/delete_chat/${chatId}`, {
            method: 'DELETE',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        
        if (!data.success) {
            throw new Error('Deletion failed on server');
        }

        // Update local state
        if (chatHistory[chatId]) {
            delete chatHistory[chatId];
        }

        // If we deleted the current chat, start a new one
        if (currentChatId === chatId) {
            await startNewChat();
        }

        // Update history list with server response
        updateHistoryList(data.updated_history);
        
        showNotification('Chat deleted successfully');
        return true;
    } catch (error) {
        console.error('Error deleting chat:', error);
        showNotification('Failed to delete chat', false);
        return false;
    }
}

// Event listeners
function initEventListeners() {
    // Theme toggle
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeIcon();
    });

    // Sidebar toggle
    sidebarToggle.addEventListener('click', toggleSidebar);

    // Send message
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // New chat
    newChatBtn.addEventListener('click', startNewChat);

    // View history
    viewHistoryBtn.addEventListener('click', async () => {
        await loadHistoryList();
        if (window.innerWidth < 768) {
            toggleSidebar();
        }
    });

    // History list interactions
    document.getElementById('historyList').addEventListener('click', (e) => {
        const target = e.target;
        const chatItem = target.closest('[data-chat-id]');
        const deleteBtn = target.closest('.delete-chat-btn');
        
        if (chatItem) {
            const chatId = chatItem.dataset.chatId;
            loadChatSession(chatId);
        }
        
        if (deleteBtn) {
            chatToDeleteId = deleteBtn.dataset.chatId;
            showModal(confirmModal);
        }
    });

    // Confirmation modal
    cancelDeleteBtn.addEventListener('click', () => hideModal(confirmModal));
    confirmDeleteBtn.addEventListener('click', async () => {
        if (chatToDeleteId) {
            await deleteChatSession(chatToDeleteId);
            hideModal(confirmModal);
            chatToDeleteId = null;
        }
    });

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === confirmModal) hideModal(confirmModal);
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) {
            sidebar.classList.remove('-translate-x-full');
            const overlay = document.getElementById('sidebarOverlay');
            if (overlay) overlay.remove();
            isSidebarOpen = false;
        }
    });
}

// Initialize the app
document.addEventListener('DOMContentLoaded', initApp);