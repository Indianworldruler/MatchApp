// Configuration and State Management
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

class DatingApp {
    constructor() {
        this.userProfile = null;
        this.connections = new Map(); // Stores RTCPeerConnection objects
        this.dataChannels = new Map(); // Stores RTCDataChannel objects
        this.nearbyUsers = new Set();
        this.currentChatPartner = null;
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        // Profile setup elements
        this.nameInput = document.getElementById('name-input');
        this.photoInput = document.getElementById('profile-photo');
        this.statusSelect = document.getElementById('status-select');
        this.termSelect = document.getElementById('term-select');
        this.completeProfileBtn = document.getElementById('complete-profile');
        this.photoPreview = document.getElementById('photo-preview');

        // Discovery elements
        this.toggleVisibilityBtn = document.getElementById('toggle-visibility');
        this.profilesList = document.getElementById('profiles-list');

        // Chat elements
        this.messagesContainer = document.getElementById('messages-container');
        this.messageInput = document.getElementById('message-input');
        this.sendMessageBtn = document.getElementById('send-message');

        // Modal elements
        this.matchModal = document.getElementById('match-modal');
        this.acceptMatchBtn = document.getElementById('accept-match');
        this.declineMatchBtn = document.getElementById('decline-match');
    }

    attachEventListeners() {
        // Profile setup
        this.photoInput.addEventListener('change', this.handlePhotoUpload.bind(this));
        this.completeProfileBtn.addEventListener('click', this.completeProfile.bind(this));
        
        // Discovery
        this.toggleVisibilityBtn.addEventListener('click', this.toggleVisibility.bind(this));
        
        // Chat
        this.sendMessageBtn.addEventListener('click', this.sendMessage.bind(this));
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Match requests
        this.acceptMatchBtn.addEventListener('click', this.acceptMatch.bind(this));
        this.declineMatchBtn.addEventListener('click', this.declineMatch.bind(this));
    }

    // Profile Management
    async handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                this.photoPreview.innerHTML = '';
                this.photoPreview.appendChild(img);
                this.userProfile = { ...this.userProfile, photo: e.target.result };
            };
            reader.readAsDataURL(file);
        }
    }

    completeProfile() {
        if (!this.nameInput.value) {
            this.showStatus('Please enter your name');
            return;
        }

        this.userProfile = {
            id: crypto.randomUUID(),
            name: this.nameInput.value,
            status: this.statusSelect.value,
            term: this.termSelect.value,
            photo: this.photoPreview.querySelector('img')?.src
        };

        this.showScreen('discovery');
        this.initializeWebRTC();
    }

    // WebRTC Implementation
    async initializeWebRTC() {
        try {
            // Create a broadcast channel for discovering nearby users
            this.broadcastChannel = new BroadcastChannel('nearby-discovery');
            this.broadcastChannel.onmessage = this.handleBroadcastMessage.bind(this);
            
            this.showStatus('WebRTC initialized');
        } catch (error) {
            this.showStatus('Failed to initialize WebRTC');
            console.error('WebRTC initialization error:', error);
        }
    }

    async createPeerConnection(targetId) {
        const peerConnection = new RTCPeerConnection(configuration);
        this.connections.set(targetId, peerConnection);

        // Create data channel
        const dataChannel = peerConnection.createDataChannel('chat');
        this.setupDataChannel(dataChannel, targetId);

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.broadcastChannel.postMessage({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    from: this.userProfile.id,
                    to: targetId
                });
            }
        };

        return peerConnection;
    }

    setupDataChannel(dataChannel, partnerId) {
        this.dataChannels.set(partnerId, dataChannel);

        dataChannel.onopen = () => {
            this.showStatus('Connected to chat');
            this.showScreen('chat');
        };

        dataChannel.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.displayMessage(message, false);
        };

        dataChannel.onclose = () => {
            this.showStatus('Chat disconnected');
            this.dataChannels.delete(partnerId);
        };
    }

    // Discovery and Matching
    toggleVisibility() {
        const isOnline = this.toggleVisibilityBtn.classList.toggle('offline');
        if (isOnline) {
            this.broadcastPresence();
            this.toggleVisibilityBtn.textContent = 'Go Offline';
        } else {
            this.broadcastChannel.postMessage({
                type: 'user-offline',
                userId: this.userProfile.id
            });
            this.toggleVisibilityBtn.textContent = 'Go Live';
        }
    }

    broadcastPresence() {
        this.broadcastChannel.postMessage({
            type: 'user-online',
            profile: this.userProfile
        });
    }

    handleBroadcastMessage(event) {
        const data = event.data;
        switch (data.type) {
            case 'user-online':
                this.addNearbyUser(data.profile);
                break;
            case 'user-offline':
                this.removeNearbyUser(data.userId);
                break;
            case 'match-request':
                if (data.to === this.userProfile.id) {
                    this.showMatchRequest(data.from);
                }
                break;
            case 'ice-candidate':
                if (data.to === this.userProfile.id) {
                    this.handleIceCandidate(data);
                }
                break;
        }
    }

    // Chat Implementation
    sendMessage() {
        const message = {
            text: this.messageInput.value,
            timestamp: new Date().toISOString(),
            sender: this.userProfile.name
        };

        const dataChannel = this.dataChannels.get(this.currentChatPartner);
        if (dataChannel?.readyState === 'open') {
            dataChannel.send(JSON.stringify(message));
            this.displayMessage(message, true);
            this.messageInput.value = '';
        }
    }

    displayMessage(message, isSent) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
        messageElement.textContent = `${message.sender}: ${message.text}`;
        this.messagesContainer.appendChild(messageElement);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    // UI Utilities
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    showStatus(message, duration = 3000) {
        const statusBar = document.getElementById('connection-status');
        const statusMessage = document.getElementById('status-message');
        statusMessage.textContent = message;
        statusBar.classList.add('active');
        setTimeout(() => statusBar.classList.remove('active'), duration);
    }

    addNearbyUser(profile) {
        if (profile.id === this.userProfile.id) return;
        
        const profileCard = document.createElement('div');
        profileCard.className = 'profile-card';
        profileCard.innerHTML = `
            <img src="${profile.photo || '/api/placeholder/100/100'}" alt="${profile.name}">
            <h3>${profile.name}</h3>
            <p>Looking for: ${profile.status}</p>
            <p>Term: ${profile.term}</p>
            <button onclick="app.requestMatch('${profile.id}')">Request Match</button>
        `;
        
        this.profilesList.appendChild(profileCard);
        this.nearbyUsers.add(profile.id);
    }

    removeNearbyUser(userId) {
        this.nearbyUsers.delete(userId);
        // Remove profile card from UI
        const profileCards = this.profilesList.children;
        for (let card of profileCards) {
            if (card.querySelector('button').onclick.toString().includes(userId)) {
                card.remove();
                break;
            }
        }
    }

    // Initialize the app
    static init() {
        const app = new DatingApp();
        window.app = app; // Make it globally accessible
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', DatingApp.init);
