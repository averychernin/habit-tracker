// Load the environment variables
require('dotenv').config();

// Your web app's Firebase configuration
var firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);


// Dialogflow setup code
const dialogflow = require('@google-cloud/dialogflow');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Load the environment variables
require('dotenv').config();

// Your Google Cloud Project ID
const projectId = 'habit-tracker-448801';

// Use the environment variable to get the path
const credentialsPath = process.env.DIALOGFLOW_CREDENTIALS_PATH;

// Check if the environment variable is set
if (!credentialsPath) {
    console.error('DIALOGFLOW_CREDENTIALS_PATH environment variable is not set');
    process.exit(1);
}

// Generate a dynamic session ID
const sessionId = uuidv4();

// Create a new session
const sessionClient = new dialogflow.SessionsClient({
    keyFilename: path.join(__dirname, credentialsPath)
});

const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);


// Functions to add goals and habits
function addGoal(title, description) {
    const userId = 'user1'; // Static user ID for now
    const goalRef = firebase.database().ref('users/' + userId + '/goals').push();
    goalRef.set({
        title: title,
        description: description,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        state: 'active', // Initial state is 'active'
        habits: [] // Initially empty, habits will be added later
    });
    return goalRef.key; // Return the key for reference when adding habits
}

function completeGoal(goalId) {
    const userId = 'user1';
    firebase.database().ref('users/' + userId + '/goals/' + goalId).update({
        state: 'completed'
    });
}

function addHabit(title, description, goalId = null, frequency) {
    const userId = 'user1';
    const habitRef = firebase.database().ref('users/' + userId + '/habits').push();
    habitRef.set({
        title: title,
        description: description,
        goalId: goalId, // Can be null if standalone
        frequency: frequency,
        lastCompleted: null,
        history: []
    });
    // If the habit is associated with a goal, update the goal's habits array
    if (goalId) {
        firebase.database().ref('users/' + userId + '/goals/' + goalId + '/habits').push(habitRef.key);
    }
}

function updateHabitCompletion(habitId) {
    const userId = 'user1';
    const updates = {};
    updates['users/' + userId + '/habits/' + habitId + '/lastCompleted'] = firebase.database.ServerValue.TIMESTAMP;
    updates['users/' + userId + '/habits/' + habitId + '/history/' + Date.now()] = true; // Add to history with current timestamp as key

    return firebase.database().ref().update(updates);
}


// Define sendMessage function outside of the event listener
function sendMessage() {
    const message = document.getElementById('chatInput').value;
    if (message.trim() !== '') {
        // Display user's message
        const userMessageElement = document.createElement('p');
        userMessageElement.textContent = `You: ${message}`;
        userMessageElement.style.textAlign = 'right'; // Align user's message to the right for distinction
        document.getElementById('chatMessages').appendChild(userMessageElement);

        // Clear the input field
        document.getElementById('chatInput').value = '';

        // Simulate AI's response with a delay
        setTimeout(() => {
            const aiResponse = document.createElement('p');
            aiResponse.textContent = `AI: That's a great goal! Keep up the good work!`;
            document.getElementById('chatMessages').appendChild(aiResponse);
            document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight; // Scroll to bottom
        }, 1000);
    }
}

// Event listener to ensure the DOM is loaded
document.addEventListener('DOMContentLoaded', (event) => {
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    const goalsList = document.getElementById('goalsList');
    const addGoalButton = document.getElementById('addGoal');

    let goals = ['Exercise daily', 'Read a book weekly', 'Save money'];

    function renderGoals() {
        goalsList.innerHTML = '';
        goals.forEach(goal => {
            const li = document.createElement('li');
            li.textContent = goal;
            goalsList.appendChild(li);
        });
    }

    // Function to send an initial prompt from the AI coach
    function startConversation() {
        const initialPrompt = document.createElement('p');
        initialPrompt.textContent = `AI: Welcome! How can I help you with your goals today?`;
        chatMessages.appendChild(initialPrompt);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    addGoalButton.addEventListener('click', () => {
        const newGoal = prompt("Enter your new goal:");
        if (newGoal && newGoal.trim() !== "") {
            goals.push(newGoal);
            renderGoals();
        }
    });

    // Call this function when the page loads to start the conversation
    startConversation();
    renderGoals();
});
