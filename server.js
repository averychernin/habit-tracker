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
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1024,
            temperature: 0.7,
            system: systemPrompt,
            messages: messages
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
        
        const responseData = await response.json();
        
        console.log('Complete Claude response:', JSON.stringify({
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers),
            data: responseData
        }, null, 2));
        
        if (!response.ok) {
            console.error('Claude API error:', responseData);
            throw new Error(JSON.stringify(responseData));
        }
        
        res.json(responseData);
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