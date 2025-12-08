const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatMessages = document.getElementById('chat-messages');

// Scroll to bottom functionality
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add message to DOM
function addMessage(content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type);

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageDiv.innerHTML = `
    <div class="message-content glass-bubble">
      <p>${content}</p>
    </div>
    <div class="message-time">${time}</div>
  `;

    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Show typing indicator
function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.classList.add('typing-indicator');
    indicator.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;
    chatMessages.appendChild(indicator);
    scrollToBottom();
}

// Remove typing indicator
function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Handle form submission
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = userInput.value.trim();
    if (!message) return;

    // Add user message
    addMessage(message, 'user');
    userInput.value = '';
    userInput.disabled = true;

    // Show typing indicator
    showTypingIndicator();

    try {
        const response = await fetch('/.netlify/functions/chat', {
            method: 'POST',
            body: JSON.stringify({ message }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        removeTypingIndicator();

        if (response.ok) {
            addMessage(data.reply, 'ai');
        } else {
            console.error('API Error:', data.error);
            addMessage("Sorry, I'm having trouble connecting to my brain right now. Please try again later.", 'ai');
        }
    } catch (error) {
        removeTypingIndicator();
        console.error('Network Error:', error);
        addMessage("Network error. Please check your connection.", 'ai');
    } finally {
        userInput.disabled = false;
        userInput.focus();
    }
});
