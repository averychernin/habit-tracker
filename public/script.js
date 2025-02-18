// Initialize Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC8LtuBKM73BRVCH7U0UredY66FcMqhAnM",
  authDomain: "habit-tracker-cd931.firebaseapp.com",
  projectId: "habit-tracker-cd931",
  storageBucket: "habit-tracker-cd931.firebasestorage.app",
  messagingSenderId: "493333285146",
  appId: "1:493333285146:web:77b3526e8533a5b4b5c4a3"
};

// Define system prompts
const NAME_EXTRACTION_PROMPT = `The user is introducing themselves. Extract ONLY their name from their message, with no additional text or punctuation. For example, if they say 'Yo what's up, I'm John!' respond only with 'John'. If they say 'Hey Janus, name's Sarah J. Williams here' respond only with 'Sarah J. Williams'.`;

const JANUS_SYSTEM_PROMPT = `You are Janus, an AI accountability coach who helps users achieve their goals through habit formation.

Important Rules:
1. Always stay focused on the current goal/habit being discussed
2. Never use example goals/habits in place of the actual goal/habit being discussed
3. Always confirm the exact text of a goal/habit before saving it

Key principles:
1. Goals are specific, measurable outcomes with deadlines
2. Habits are regular, repeatable actions
3. Every goal should have at least one supporting habit
4. Users can also create standalone habits without an associated goal

Distinguishing Goals vs Habits:
- Goals have specific outcomes and deadlines (e.g., "read 12 books by end of 2025")
- Habits are regular actions (e.g., "read for 20 minutes each day")
- If user's intent is unclear, ask: "Just to clarify - is this something you want to achieve (a goal) or something you want to do regularly (a habit)?"

Conversation flow for goals:
1. User states goal
2. Help refine if needed (ask about specific metrics and deadlines)
3. State refined goal and ask for confirmation (e.g., "So your goal would be: [refined goal text]. Does that sound right?")
4. After user confirms, IMMEDIATELY:
   a. Use the save command on its own line: "SAVE_GOAL: [exact goal text]"
   b. Then WITHOUT asking any other questions, suggest 2-3 relevant and specific habits that would help achieve this goal
   c. Ask which habits they'd like to add to this goal
7. For each habit the user wants to add:
   - State the habit clearly and get confirmation
   - Use save command to add it to the current goal
   - Repeat for each habit if user wanted multiple habits
8. After adding at least one habit, ask: "Would you like to add another habit to this goal, work on a new goal, or work on a new standalone habit?"
   - If they want another habit for this goal, return to step 7
   - If they want a new goal or standalone habit, move to appropriate flow

Conversation flow for standalone habits:
1. User states habit
2. Help refine if needed (ask about frequency, duration, etc.)
3. If not explicitly stated, confirm if this is a standalone habit or related to a goal
4. State refined habit and ask for confirmation
5. Only after user confirms, use save command
6. Ask if they'd like to work on another goal or habit

Handling Multiple Habits:
1. When suggesting habits for a goal, you can offer multiple options
2. If user wants to add multiple habits, handle them one at a time:
   - List each habit you're about to add
   - Get confirmation for each
   - Save each habit individually with save commands, ensuring they're linked to the current goal
3. After saving all habits, ask if they want to:
   - Add any other habits for this goal
   - Work on a new goal
   - Work on a standalone habit

Moving Between Goals and Habits:
- Always wait for at least one habit to be added to a goal before offering to move on
- Use the standard transition question: "Would you like to add another habit to this goal, work on a new goal, or work on a new standalone habit?"
- If user's intent about habit association is unclear, ask: "Should this habit be associated with your current goal of [goal text], or would you like it to be a standalone habit?"
- Never force additional habits if the user wants to move on

Save commands (use these exactly, on their own line):
- For goals: "SAVE_GOAL: [exact goal text]"
- For habits: "SAVE_HABIT: [exact habit text] FOR_GOAL: [current goal ID or STANDALONE]"

Example - Reading Goal Flow:
[User states a clear and actionable goal]
You: "That's a clear, specific goal. Let me confirm: your goal would be 'Read 10 books by December 31st, 2025'. Is that correct?"
[Wait for user confirmation]
You: "SAVE_GOAL: Read 10 books by December 31st, 2025
Here are some habits that could help you achieve this reading goal:
1. Read for 20 minutes every day
2. Read during lunch break on weekdays
3. Read before bedtime each night
Which of these habits would you like to add to your goal?"
[Wait for user selection]
You: "Great! To confirm: 'Read for 20 minutes every day'. Shall I add this habit?"
[Wait for confirmation]
You: "SAVE_HABIT: Read for 20 minutes every day FOR_GOAL: [current goal ID]
Would you like to add another habit to this goal, work on a new goal, or work on a new standalone habit?"

Example - Standalone Habit:
[User enters vague habit]
You: "Let's make that specific. How many minutes would you like to meditate each day?"
[Wait for user input]
You: "Would this be a standalone habit, or is it connected to a specific goal?"
[Wait for user clarification]
You: "Got it. So the habit would be: 'Meditate for 10 minutes every day'. Does that sound right?"
[Wait for confirmation]
You: "SAVE_HABIT: Meditate for 10 minutes every day FOR_GOAL: STANDALONE"`;

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
    console.log('User signed in:', user.uid);
    authContainer.style.display = 'none';
    mainContent.style.display = 'block';
    if (window.chatBot) {
      window.chatBot.startConversation();
    }
  } else {
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
        console.log('Processing greeting context for input:', input);
        const nameResponse = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: [
              { role: "user", content: input }
            ],
            systemPrompt: NAME_EXTRACTION_PROMPT
          })
        });

        const data = await nameResponse.json();
        console.log('Name response data:', data);
        
        // Extract name from Claude's response
        const extractedName = data.data?.content?.[0]?.text;
        console.log('Extracted name:', extractedName);
        
        if (!extractedName) {
          // If we couldn't get the name from Claude, try to extract it from common patterns
          const namePatterns = [
            /my name is (\w+)/i,
            /i'm (\w+)/i,
            /i am (\w+)/i,
            /call me (\w+)/i
          ];
          
          for (const pattern of namePatterns) {
            const match = input.match(pattern);
            if (match) {
              this.userData.name = match[1];
              await this.displayMessage(`Nice to meet you, ${this.userData.name}. To get started, please tell me a goal you'd like to accomplish or a habit you want to develop.`);
              this.currentContext = 'goal_or_habit_choice';
              return;
            }
          }
          
          // If all else fails, ask the user to clarify their name
          await this.displayMessage("I didn't quite catch your name. Could you please tell me just your name?");
          return;
        }
        
        this.userData.name = extractedName;
        await this.displayMessage(`Nice to meet you, ${extractedName}. To get started, please tell me a goal you'd like to accomplish or a habit you want to develop.`);
        this.currentContext = 'goal_or_habit_choice';
        return;
      } catch (error) {
        console.error('Error extracting name:', error);
        await this.displayMessage("I didn't quite catch your name. Could you please tell me just your name?");
        return;
      }
    }

    try {
      console.log('Processing main conversation input:', input);
      console.log('Current conversation history:', this.conversationHistory);
      
      // Build conversation history for context
      const messages = [...this.conversationHistory, { role: "user", content: input }];
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: messages,
          systemPrompt: JANUS_SYSTEM_PROMPT + `\n\nCurrent user data: ${JSON.stringify(this.userData)}`
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Response from server:', JSON.stringify(data, null, 2));
      
      console.log('Checking response data structure:', {
        hasData: !!data,
        hasDataData: !!data?.data,
        hasContent: !!data?.data?.content,
        contentLength: data?.data?.content?.length,
        firstContentItem: data?.data?.content?.[0],
        hasText: !!data?.data?.content?.[0]?.text
      });

      if (data?.data?.content?.[0]?.text) {
        const messageContent = data.data.content[0].text;
        console.log('Successfully extracted message content:', messageContent);
        
        this.conversationHistory.push(
          { role: "user", content: input },
          { role: "assistant", content: messageContent }
        );
        
        // Keep only the last 10 messages to prevent context overflow
        if (this.conversationHistory.length > 10) {
          this.conversationHistory = this.conversationHistory.slice(-10);
        }
        
        await this.displayMessage(messageContent);
        console.log('Checking for goals/habits in message:', messageContent);
        this.checkForGoalsAndHabits(messageContent);
      } else {
        console.error('Invalid response structure:', data);
        await this.displayMessage("I apologize, but I'm having trouble processing your request. Could you try again?");
      }
    } catch (error) {
      console.error('Error in processUserInput:', error);
      await this.displayMessage("I apologize, but I'm having trouble right now. Please try again in a moment.");
    }
  }

  checkForGoalsAndHabits(aiResponse) {
    if (!aiResponse) {
      console.log('No response to check for goals/habits');
      return;
    }
    
    console.log('Checking response for goals/habits:', aiResponse);
    
    // Check for goal save command
    const goalMatch = aiResponse.match(/SAVE_GOAL: (.*?)(?:\n|$)/);
    if (goalMatch) {
      const goalText = goalMatch[1].trim();
      console.log('Goal detected, saving:', goalText);
      this.saveGoalToFirebase(goalText);
    } else {
      console.log('No goal detected in response');
    }
    
    // Check for habit save command
    const habitMatch = aiResponse.match(/SAVE_HABIT: (.*?) FOR_GOAL: (.*?)(?:\n|$)/);
    if (habitMatch) {
      const habitText = habitMatch[1].trim();
      const goalId = habitMatch[2].trim();
      console.log('Habit detected:', habitText, 'for goal:', goalId);
      const effectiveGoalId = goalId === 'STANDALONE' ? null : this.userData.currentGoal;
      console.log('Using effective goal ID:', effectiveGoalId);
      this.saveHabitToFirebase(habitText, effectiveGoalId);
    } else {
      console.log('No habit detected in response');
    }
  }
  
  saveGoalToFirebase(goalText) {
    if (auth.currentUser) {
      console.log('Attempting to save goal to Firebase:', goalText);
      const goalRef = db.ref(`users/${auth.currentUser.uid}/goals`).push();
      console.log('Generated goal reference:', goalRef.key);
      goalRef.set({
        text: goalText,
        dateAdded: firebase.database.ServerValue.TIMESTAMP,
        completed: false
      }).then(() => {
        console.log('Goal saved successfully with ID:', goalRef.key);
        this.userData.currentGoal = goalRef.key;
        this.updateSidebar();
      }).catch(error => {
        console.error('Error saving goal:', error);
      });
    } else {
      console.error('No user signed in, cannot save goal');
    }
  }

  saveHabitToFirebase(habitText, goalId = null) {
    if (auth.currentUser) {
      console.log('Attempting to save habit to Firebase:', habitText, 'with goal ID:', goalId);
      const habitRef = db.ref(`users/${auth.currentUser.uid}/habits`).push();
      console.log('Generated habit reference:', habitRef.key);
      habitRef.set({
        text: habitText,
        goalId: goalId,
        dateAdded: firebase.database.ServerValue.TIMESTAMP,
        completed: false
      }).then(() => {
        console.log('Habit saved successfully with ID:', habitRef.key);
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
      // First, get all goals
      db.ref(`users/${auth.currentUser.uid}/goals`).once('value', (goalsSnapshot) => {
        console.log('Retrieved goals from Firebase:', goalsSnapshot.val());
        const goals = goalsSnapshot.val() || {};
        
        // Then get all habits
        db.ref(`users/${auth.currentUser.uid}/habits`).once('value', (habitsSnapshot) => {
          console.log('Retrieved habits from Firebase:', habitsSnapshot.val());
          const habits = habitsSnapshot.val() || {};
          
          // Create a map of goalId to habits
          const habitsByGoal = {};
          Object.entries(habits).forEach(([habitId, habit]) => {
            if (habit.goalId) {
              if (!habitsByGoal[habit.goalId]) {
                habitsByGoal[habit.goalId] = [];
              }
              habitsByGoal[habit.goalId].push({ id: habitId, ...habit });
            }
          });
          
          console.log('Organized habits by goal:', habitsByGoal);
          
          // First add goals with their associated habits
          Object.entries(goals).forEach(([goalId, goal]) => {
            // Add goal
            const goalItem = document.createElement('li');
            goalItem.textContent = goal.text;
            goalItem.className = 'goal-item';
            goalsList.appendChild(goalItem);
            console.log('Added goal to sidebar:', goal.text);
            
            // Add associated habits
            const associatedHabits = habitsByGoal[goalId] || [];
            associatedHabits.forEach(habit => {
              const habitItem = document.createElement('li');
              habitItem.textContent = habit.text;
              habitItem.className = 'habit-item nested';
              goalsList.appendChild(habitItem);
              console.log('Added associated habit to sidebar:', habit.text);
            });
          });
          
          // Then add standalone habits
          Object.entries(habits).forEach(([habitId, habit]) => {
            if (!habit.goalId) {
              const habitItem = document.createElement('li');
              habitItem.textContent = habit.text;
              habitItem.className = 'habit-item standalone';
              goalsList.appendChild(habitItem);
              console.log('Added standalone habit to sidebar:', habit.text);
            }
          });
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