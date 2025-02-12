const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
require('dotenv').config();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Test route 
app.get('/test', (req, res) => {
    res.send('Server is running!');
});

// Endpoint to proxy requests to Claude
app.post('/api/chat', async (req, res) => {
    console.log('Received chat request:', req.body);
    const { messages, systemPrompt } = req.body;
    try {
        const requestBody = {
            model: "claude-3-haiku-20240307",
            max_tokens: 1024,
            temperature: 0.7,
            system: systemPrompt,  // Move system prompt here
            messages: messages     // Keep only the user messages here
        };
        
        console.log('Full request to Claude:', {
            url: 'https://api.anthropic.com/v1/messages',
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
                // not logging API key for security
            },
            body: requestBody
        });
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        console.log('Raw Claude API response:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers),
            data
        });
        
        if (!response.ok) {
            console.error('Claude API error:', data);
            throw new Error(JSON.stringify(data));
        }
        
        res.json(data);
    } catch (error) {
        console.error('Detailed error:', error);
        res.status(500).json({ 
            type: 'error', 
            error: {
                message: error.message,
                details: error.toString()
            } 
        });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});