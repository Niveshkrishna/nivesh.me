const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatMessages = document.getElementById('chat-messages');

// Scroll to bottom functionality
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add message to DOM - Modified to return elements for streaming
function addMessage(content, type, thinkingContent = null) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type);

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let thinkingHtml = '';
    // Always create structure for thinking if it might stream, or hidden
    thinkingHtml = `
        <div class="thinking-box" style="${thinkingContent ? '' : 'display:none'}">
            <details open>
                <summary>Thought Process</summary>
                <div class="thinking-content"></div>
            </details>
        </div>`;

    messageDiv.innerHTML = `
    <div class="message-content glass-bubble">
      ${thinkingHtml}
      <div class="markdown-body"></div>
    </div>
    <div class="message-time">${time}</div>
  `;

    const messageBody = messageDiv.querySelector('.markdown-body');
    if (content) {
        if (typeof marked !== 'undefined') {
            messageBody.innerHTML = marked.parse(content);
        } else {
            messageBody.textContent = content;
        }
    }

    chatMessages.appendChild(messageDiv);
    scrollToBottom();

    // Return references to update content dynamically
    return {
        thinkingBox: messageDiv.querySelector('.thinking-box'),
        thinkingContentDiv: messageDiv.querySelector('.thinking-content'),
        messageBody: messageBody
    };
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

// Handle suggestion chips
document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const message = chip.dataset.message;
        sendMessage(message);
    });
});

// Handle form submission
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (message) {
        sendMessage(message);
    }
});

let lastResponseId = null;

async function sendMessage(message) {
    // Add user message
    addMessage(message, 'user');
    userInput.value = '';
    userInput.disabled = true;

    showTypingIndicator();

    try {
        const payload = { message };
        if (lastResponseId) {
            payload.previous_response_id = lastResponseId;
        }

        const response = await fetch('/.netlify/functions/ask-nivesh', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        removeTypingIndicator();

        if (!response.ok) {
            const data = await response.json();
            console.error('API Error:', data.error);
            addMessage("Sorry, I'm having trouble connecting to my brain right now.", 'ai');
            return;
        }

        // Initialize AI message bubble for streaming
        const uiRefs = addMessage("", 'ai');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        let fullThinking = '';
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE format
            // Data comes as:
            // event: type\n
            // data: "..."\n\n

            const lines = buffer.split('\n\n');
            // Keep the last partial chunk in buffer
            buffer = lines.pop();

            for (const lineGroup of lines) {
                const eventMatch = lineGroup.match(/event: (.*?)\n/);
                const dataMatch = lineGroup.match(/data: (.*)/);

                if (eventMatch && dataMatch) {
                    const eventType = eventMatch[1].trim();
                    // Parse JSON data (it was stringified in backend)
                    let chunkData = dataMatch[1].trim();

                    if (chunkData === '[DONE]') continue;

                    try {
                        chunkData = JSON.parse(chunkData);
                    } catch (e) {
                        console.warn("Error parsing chunk", e);
                    }

                    if (eventType === 'meta') {
                        if (chunkData.response_id) {
                            lastResponseId = chunkData.response_id;
                            console.log("Context retained. New Response ID:", lastResponseId);
                        }
                    } else if (eventType === 'thinking') {
                        fullThinking += chunkData;
                        uiRefs.thinkingBox.style.display = 'block';
                        uiRefs.thinkingContentDiv.textContent = fullThinking;
                    } else if (eventType === 'content') {
                        fullContent += chunkData;
                        if (typeof marked !== 'undefined') {
                            uiRefs.messageBody.innerHTML = marked.parse(fullContent);
                        } else {
                            uiRefs.messageBody.textContent = fullContent;
                        }
                    }
                    scrollToBottom();
                }
            }
        }

    } catch (error) {
        removeTypingIndicator();
        console.error('Network Error:', error);
        addMessage("Network error. Please check your connection.", 'ai');
    } finally {
        userInput.disabled = false;
        userInput.focus();
    }
}
