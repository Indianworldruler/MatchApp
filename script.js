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
        // Copy Connection ID
        this.copyIdButton.addEventListener('click', this.copyId.bind(this));

        // Connect to Peer
        this.connectButton.addEventListener('click', this.connectToPeer.bind(this));

        // Accept/Decline Connection
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
                this.updateStatus('Connection ID generated. Ready to connect.');
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

    async copyId() {
        try {
            const id = this.localIdSpan.textContent;
            if (id === "Generating...") {
                this.updateStatus("ID not ready. Please wait.");
                return;
            }
            await navigator.clipboard.writeText(id);
            this.updateStatus('ID copied to clipboard');
        } catch (error) {
            console.error('Failed to copy ID:', error);
            this.updateStatus('Failed to copy ID');
        }
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
                metadata: this.userProfile || { name: "Anonymous User" }
            });

            this.setupConnection(conn);
            this.updateStatus('Connecting...');
        } catch (error) {
            console.error('Connection error:', error);
            this.updateStatus('Failed to connect');
        }
    }

    handleIncomingConnection(conn) {
        const remoteProfile = conn.metadata || { name: "Anonymous" };
        this.showConnectionRequest(remoteProfile, () => {
            this.setupConnection(conn);
        });
    }

    setupConnection(conn) {
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            this.updateStatus('Connected');
            this.showScreen('chat');
            this.chatPartnerName.textContent = conn.metadata?.name || "Chat Partner";
        });

        conn.on('data', (data) => {
            this.displayMessage(data, false);
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
            sender: "You",
            timestamp: new Date().toISOString()
        };

        this.connections.forEach(conn => {
            if (conn.open) conn.send(message);
        });

        this.displayMessage(message, true);
        this.messageInput.value = '';
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

    updateStatus(message) {
        this.connectionStatus.textContent = `Status: ${message}`;
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    showConnectionRequest(profile, acceptCallback) {
        this.connectionRequestText.textContent = `${profile.name} wants to connect.`;
        this.connectionModal.classList.add('active');

        this.acceptConnectionBtn.onclick = () => {
            acceptCallback();
            this.connectionModal.classList.remove('active');
        };

        this.declineConnectionBtn.onclick = () => {
            this.connectionModal.classList.remove('active');
        };
    }
}

// Initialize the app when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new LocalDatingApp();
});
