// Initialize PeerJS and handle connections
class LocalDatingApp {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.userProfile = null;
        this.connections = new Map();
        this.initializeElements();
        this.attachEventListeners();
        this.initializePeerConnection();
    }

    initializeElements() {
        // Connection elements
        this.localIdSpan = document.getElementById('local-id');
        this.copyIdButton = document.getElementById('copy-id');
        this.remoteIdInput = document.getElementById('remote-id-input');
        this.connectButton = document.getElementById('connect-to-id');
        this.connectionStatus = document.getElementById('connection-status');

        // Profile elements
        this.nameInput = document.getElementById('name-input');
        this.photoInput = document.getElementById('profile-photo');
        this.statusSelect = document.getElementById('status-select');
        this.termSelect = document.getElementById('term-select');
        this.startDiscoveryBtn = document.getElementById('start-discovery');
        this.photoPreview = document.getElementById('photo-preview');

        // Chat elements
        this.messagesContainer = document.getElementById('messages-container');
        this.messageInput = document.getElementById('message-input');
        this.sendMessageBtn = document.getElementById('send-message');
        this.leaveChatBtn = document.getElementById('leave-chat');
        this.chatPartnerName = document.getElementById('chat-partner-name');

        // Connection modal
        this.connectionModal = document.getElementById('connection-modal');
        this.connectionRequestText = document.getElementById('connection-request-text');
        this.acceptConnectionBtn = document.getElementById('accept-connection');
        this.declineConnectionBtn = document.getElementById('decline-connection');
    }

    attachEventListeners() {
        // Profile setup
        this.photoInput.addEventListener('change', this.handlePhotoUpload.bind(this));
        this.startDiscoveryBtn.addEventListener('click', this.startDiscovery.bind(this));
        
        // Connection handling
        this.copyIdButton.addEventListener('click', this.copyId.bind(this));
        this.connectButton.addEventListener('click', this.connectToPeer.bind(this));
        this.acceptConnectionBtn.addEventListener('click', () => this.handleConnectionRequest(true));
        this.declineConnectionBtn.addEventListener('click', () => this.handleConnectionRequest(false));
        
        // Chat
        this.sendMessageBtn.addEventListener('click', this.sendMessage.bind(this));
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        this.leaveChatBtn.addEventListener('click', this.leaveChat.bind(this));
    }

    async initializePeerConnection() {
        try {
            this.peer = new Peer({
                debug: 2,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                this.localIdSpan.textContent = id;
                this.updateStatus('Ready to connect');
            });

            this.peer.on('connection', (conn) => {
                this.handleIncomingConnection(conn);
            });

            this.peer.on('error', (error) => {
                console.error('PeerJS error:', error);
                this.updateStatus('Connection error. Please try again.');
            });

        } catch (error) {
            console.error('PeerJS initialization error:', error);
            this.updateStatus('Failed to initialize connection');
        }
    }

    async handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (file) {
            try {
                const base64Image = await this.fileToBase64(file);
                const img = document.createElement('img');
                img.src = base64Image;
                this.photoPreview.innerHTML = '';
                this.photoPreview.appendChild(img);
            } catch (error) {
                console.error('Photo upload error:', error);
                this.updateStatus('Failed to upload photo');
            }
        }
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    startDiscovery() {
        if (!this.validateProfile()) return;

        this.userProfile = {
            name: this.nameInput.value,
            status: this.statusSelect.value,
            term: this.termSelect.value,
            photo: this.photoPreview.querySelector('img')?.src
        };

        this.showScreen('discovery');
        this.updateStatus('Discovery mode active');
    }

    validateProfile() {
        if (!this.nameInput.value) {
            this.updateStatus('Please enter your name');
            return false;
        }
        if (!this.statusSelect.value || !this.termSelect.value) {
            this.updateStatus('Please complete all profile fields');
            return false;
        }
        return true;
    }

    async connectToPeer() {
        const remoteId = this.remoteIdInput.value.trim();
        if (!remoteId) {
            this.updateStatus('Please enter a connection ID');
            return;
        }

        try {
            const conn = this.peer.connect(remoteId, {
                reliable: true,
                metadata: this.userProfile
            });
            
            this.setupConnection(conn);
            this.updateStatus('Connecting...');
        } catch (error) {
            console.error('Connection error:', error);
            this.updateStatus('Failed to connect');
        }
    }

    handleIncomingConnection(conn) {
        const remoteProfile = conn.metadata;
        this.showConnectionRequest(remoteProfile, () => {
            this.setupConnection(conn);
        });
    }

    setupConnection(conn) {
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            this.updateStatus('Connected');
            this.showScreen('chat');
            this.chatPartnerName.textContent = conn.metadata.name;
        });

        conn.on('data', (data) => {
            this.handleIncomingMessage(data);
        });

        conn.on('close', () => {
            this.connections.delete(conn.peer);
            this.updateStatus('Disconnected');
            this.showScreen('discovery');
        });
    }

    sendMessage() {
        const messageText = this.messageInput.value.trim();
        if (!messageText) return;

        const message = {
            text: messageText,
            sender: this.userProfile.name,
            timestamp: new Date().toISOString()
        };

        this.connections.forEach(conn => {
            if (conn.open) {
                conn.send(message);
            }
        });

        this.displayMessage(message, true);
        this.messageInput.value = '';
    }

    handleIncomingMessage(message) {
        this.displayMessage(message, false);
    }

    displayMessage(message, isSent) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
        messageElement.textContent = message.text;
        this.messagesContainer.appendChild(messageElement);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    leaveChat() {
        this.connections.forEach(conn => conn.close());
        this.connections.clear();
        this.showScreen('discovery');
    }

    // UI Utilities
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    updateStatus(message) {
        this.connectionStatus.textContent = message;
    }

    showConnectionRequest(profile, acceptCallback) {
        this.connectionRequestText.textContent = 
            `${profile.name} wants to connect with you. They are looking for: ${profile.status} (${profile.term})`;
        this.connectionModal.classList.add('active');

        this.acceptConnectionBtn.onclick = () => {
            acceptCallback();
            this.connectionModal.classList.remove('active');
        };

        this.declineConnectionBtn.onclick = () => {
            this.connectionModal.classList.remove('active');
        };
    }

    async copyId() {
        try {
            await navigator.clipboard.writeText(this.localIdSpan.textContent);
            this.updateStatus('ID copied to clipboard');
        } catch (error) {
            console.error('Failed to copy ID:', error);
            this.updateStatus('Failed to copy ID');
        }
    }
}

// Initialize the app when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new LocalDatingApp();
});
