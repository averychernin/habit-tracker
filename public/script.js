// Initialize Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC8LtuBKM73BRVCH7U0UredY66FcMqhAnM",
  authDomain: "habit-tracker-cd931.firebaseapp.com",
  projectId: "habit-tracker-cd931",
  storageBucket: "habit-tracker-cd931.firebasestorage.app",
  messagingSenderId: "493333285146",
  appId: "1:493333285146:web:77b3526e8533a5b4b5c4a3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const db = firebase.database();
const auth = firebase.auth();

// Authentication state observer
auth.onAuthStateChanged((user) => {
  const authContainer = document.getElementById('authContainer');
  const mainContent = document.getElementById('mainContent');
  
  if (user) {
    // User is signed in
    console.log('User signed in:', user.uid);
    authContainer.style.display = 'none';
    mainContent.style.display = 'block';
    if (window.chatBot) {
      window.chatBot.startConversation();
    }
  } else {
    // No user is signed in
    console.log('No user signed in');
    authContainer.style.display = 'flex';
    mainContent.style.display = 'none';
  }
});

// Handle login
document.getElementById('loginButton').addEventListener('click', () => {
  const email = document.getElementById('emailInput').value;
  const password = document.getElementById('passwordInput').value;
  
  auth.signInWithEmailAndPassword(email, password)
    .catch((error) => {
      alert('Login error: ' + error.message);
    });
});

// Handle signup
document.getElementById('signupButton').addEventListener('click', () => {
  const email = document.getElementById('emailInput').value;
  const password = document.getElementById('passwordInput').value;
  
  auth.createUserWithEmailAndPassword(email, password)
    .catch((error) => {
      alert('Signup error: ' + error.message);
    });
});

// Handle logout
document.getElementById('logoutButton').addEventListener('click', () => {
  auth.signOut();
});

// Chat handling
class ChatBot {
  constructor() {
    this.chatMessages = document.getElementById('chatMessages');
    this.chatInput = document.getElementById('chatInput');
    this.currentContext = null;
    this.userData = {
      name: null,
      currentGoal: null,
      currentHabit: null
    };
    this.conversationHistory = [];
  }

  async displayMessage(text, isUser = false) {
    if (!text) {
      console.error('Attempted to display undefined message');
      return;
    }

    const messageElement = document.createElement('div');
    messageElement.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    
    if (isUser) {
      messageElement.textContent = `You: ${text}`;
      this.chatMessages.appendChild(messageElement);
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    } else {
      messageElement.innerHTML = 'Janus: ';
      const textSpan = document.createElement('span');
      textSpan.className = 'typing-animation';
      messageElement.appendChild(textSpan);
      this.chatMessages.appendChild(messageElement);
      
      const delay = 30;
      for (let i = 0; i < text.length; i++) {
        await new Promise(resolve => setTimeout(resolve, delay));
        textSpan.textContent += text[i];
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
      }
    }
  }

  async processUserInput(input) {
    if (!input) {
      console.error('Received undefined input');
      return;
    }

    await this.displayMessage(input, true);

    // Special handling for first response (name)
    if (this.currentContext === 'greeting') {
      try {
        // Ask Claude to extract just the name
        const nameResponse = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: [
              { role: "user", content: input }
            ],
            systemPrompt: "The user is introducing themselves. Extract ONLY their name from their message, with no additional text or punctuation. For example, if they say 'Yo what's up, I'm John!' respond only with 'John'. If they say 'Hey Janus, name's Sarah J. Williams here' respond only with 'Sarah J. Williams'."
          })
        });

        const data = await nameResponse.json();
        const name = data.content[0].text.trim();
        console.log('Extracted name:', name);
        
        this.userData.name = name;
        await this.displayMessage(`Nice to meet you, ${name}. To get started, please tell me a goal you'd like to accomplish or a habit you want to develop.`);
        this.currentContext = 'goal_or_habit_choice';
        return;
      } catch (error) {
        console.error('Error extracting name:', error);
        // Fallback to simpler name extraction if AI extraction fails
        const simpleName = input.trim().split(/[.,!?]/)[0];
        this.userData.name = simpleName;
        await this.displayMessage(`Nice to meet you. To get started, please tell me a goal you'd like to accomplish or a habit you want to develop.`);
        this.currentContext = 'goal_or_habit_choice';
        return;
      }
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            { role: "user", content: input }
          ],
          systemPrompt: `You are Janus, an AI accountability coach who helps users achieve their goals through habit formation.

Key principles to follow:
1. Goals are outcomes but must be specific and measurable (like "lose 10 lbs in 3 months" or "learn enough Spanish to hold a basic conversation by June"), while habits are specific, actionable behaviors that can be done regularly
2. When users present vague goals, help them make them more concrete by asking about specific targets and timeframes
3. Every goal should have one or more supporting habits that will lead to achieving that goal
4. Users can also create standalone habits without an associated goal
5. When a user mentions a goal, first help make it concrete, then break it down into specific, actionable habits
6. When a user mentions a habit, ask if it's connected to a specific goal or if it's a standalone habit

Example flow for a goal:
User: "I want to lose weight"
You: Help them make it concrete ("How much weight would you like to lose and by when?") then break it down into specific habits

Example flow for a standalone habit:
User: "I want to read more"
You: Help define a specific habit like "read for 15 minutes before bed each day"

Conversation guidelines:
- If they share a vague goal, ask clarifying questions to make it concrete
- Help break concrete goals down into supporting habits
- If they choose a habit, ask if it's connected to a goal or standalone
- Be encouraging and supportive while maintaining focus on concrete actions
- When confirming a goal or habit, say "I've added that [goal/habit]" so the system knows to save it

Current user data: ${JSON.stringify(this.userData)}`
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Response from server:', data);
      
      if (data && data.content && Array.isArray(data.content) && data.content.length > 0) {
        const messageContent = data.content[0].text;
        console.log('Processing message content:', messageContent);
        
        this.conversationHistory.push(
          { role: "user", content: input },
          { role: "assistant", content: messageContent }
        );
        
        await this.displayMessage(messageContent);
        this.checkForGoalsAndHabits(input, messageContent);
      } else {
        console.error('Invalid response structure from server:', data);
        await this.displayMessage("I apologize, but I'm having trouble processing your request. Could you try again?");
      }
    } catch (error) {
      console.error('Error in processUserInput:', error);
      await this.displayMessage("I apologize, but I'm having trouble right now. Please try again in a moment.");
    }
  }

  checkForGoalsAndHabits(userInput, aiResponse) {
    if (!aiResponse) return;
    
    console.log('Checking response:', aiResponse);
    
    if (aiResponse.toLowerCase().includes("i've added that goal") || 
        aiResponse.toLowerCase().includes("great goal!")) {
      console.log('Goal detected, saving:', userInput);
      this.saveGoalToFirebase(userInput);
    }
    
    if (aiResponse.toLowerCase().includes("i've added that habit") || 
        aiResponse.toLowerCase().includes("great habit!")) {
      console.log('Habit detected, saving:', userInput);
      this.saveHabitToFirebase(userInput);
    }
  }

  saveGoalToFirebase(goalText) {
    if (auth.currentUser) {
      console.log('Saving goal to Firebase:', goalText);
      const goalRef = db.ref(`users/${auth.currentUser.uid}/goals`).push();
      goalRef.set({
        text: goalText,
        dateAdded: firebase.database.ServerValue.TIMESTAMP,
        completed: false
      }).then(() => {
        console.log('Goal saved successfully');
        this.updateSidebar();
      }).catch(error => {
        console.error('Error saving goal:', error);
      });
    } else {
      console.error('No user signed in, cannot save goal');
    }
  }

  saveHabitToFirebase(habitText, associatedGoal = null) {
    if (auth.currentUser) {
      console.log('Saving habit to Firebase:', habitText);
      const habitRef = db.ref(`users/${auth.currentUser.uid}/habits`).push();
      habitRef.set({
        text: habitText,
        associatedGoal: associatedGoal,
        dateAdded: firebase.database.ServerValue.TIMESTAMP,
        completed: false
      }).then(() => {
        console.log('Habit saved successfully');
        this.updateSidebar();
      }).catch(error => {
        console.error('Error saving habit:', error);
      });
    } else {
      console.error('No user signed in, cannot save habit');
    }
  }

  updateSidebar() {
    console.log('Updating sidebar...');
    const goalsList = document.getElementById('goalsList');
    goalsList.innerHTML = '';

    if (auth.currentUser) {
      db.ref(`users/${auth.currentUser.uid}/goals`).once('value', (snapshot) => {
        console.log('Goals from Firebase:', snapshot.val());
        snapshot.forEach((childSnapshot) => {
          const goal = childSnapshot.val();
          const li = document.createElement('li');
          li.textContent = goal.text;
          goalsList.appendChild(li);
        });
      });

      db.ref(`users/${auth.currentUser.uid}/habits`).once('value', (snapshot) => {
        console.log('Habits from Firebase:', snapshot.val());
        snapshot.forEach((childSnapshot) => {
          const habit = childSnapshot.val();
          const li = document.createElement('li');
          li.textContent = habit.text;
          if (habit.associatedGoal) {
            li.style.marginLeft = '20px';
          }
          goalsList.appendChild(li);
        });
      });
    }
  }

  startConversation() {
    this.displayMessage("Hi, I'm Janus, your new accountability partner. I'm here to help you achieve your goals and develop new habits. Before we get started, can you tell me your name so I know how to address you?");
    this.currentContext = 'greeting';
  }
}

// Initialize the chatbot globally
window.chatBot = new ChatBot();

// Event listener for chat input
document.getElementById('chatInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const message = e.target.value.trim();
    if (message) {
      window.chatBot.processUserInput(message);
      e.target.value = '';
    }
  }
});

// Function for the send button
function sendMessage() {
  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value.trim();
  if (message) {
    window.chatBot.processUserInput(message);
    chatInput.value = '';
  }
}