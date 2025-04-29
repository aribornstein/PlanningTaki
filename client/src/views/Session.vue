<template>
  <div v-if="!s">Connecting to session...</div>
  <div v-else class="session-view">
    <h2>Planning Taki Session {{ s.id }}</h2>
    <p><strong>Your Name:</strong> {{ me?.name }} (Budget: {{ me?.budget }})</p>
    <hr>

    <section class="players-section">
      <h3>Players in Session ({{ players.length }})</h3>
      <ul>
        <li v-for="p in players" :key="p.id" :class="{ 'is-me': p.id === me?.id }">
          <div>
            👤 {{ p.name }} (Remaining: {{ p.remaining }} / Budget: {{ p.budget }})
            <span v-if="s.phase === 'vote' && p.vote !== null">🗳️ Voted</span>
            <span v-if="s.phase === 'reveal' || s.phase === 'discuss'">🗳️ {{ p.vote }}</span>
            <span v-if="s.currentTask?.owner === p.id"> (Owner)</span>
          </div>
          <!-- Display budgeted tasks for each player -->
          <div class="budgeted-tasks" v-if="playerBudgetedTasks[p.id] && playerBudgetedTasks[p.id].length > 0">
            <strong>Budgeted Tasks:</strong>
            <ul>
              <li v-for="task in playerBudgetedTasks[p.id]" :key="task.id" class="budgeted-task-item">
                - {{ task.title }} ({{ task.points }} points)
              </li>
            </ul>
          </div>
          <div v-else class="budgeted-tasks-empty">
            <small>No budgeted tasks yet.</small>
          </div>
        </li>
      </ul>
    </section>
    <hr>

    <!-- LOBBY PHASE -->
    <section v-if="s.phase === 'lobby'" class="lobby-phase">
      <h3>Phase: Lobby 🛋️</h3>
      <p>Waiting for players to join and tasks to be added.</p>

      <h4>Tasks to Estimate:</h4>
      <div class="task-input">
        <input v-model="newTask" placeholder="Enter new task title" @keyup.enter="addTask"/>
        <button @click="addTask" :disabled="!newTask.trim()">Add Task</button>
      </div>
      <!-- Use the new computed property myTasksInLobby -->
      <ul v-if="myTasksInLobby.length > 0" class="task-list">
        <li v-for="t in myTasksInLobby" :key="t.id">
          <span>{{ t.title }}</span>
          <button @click="selectTask(t.id)">Start Estimation</button>
        </li>
      </ul>
      <p v-else>You haven't added any tasks yet.</p>
    </section>

    <!-- EXPLANATION PHASE -->
    <section v-if="s.phase === 'explain'" class="explain-phase">
      <h3>Phase: Explain Task 🗣️</h3>
      <h4>Task: {{ s.currentTask?.title }}</h4>
      <p>Owner ({{ players.find(p => p.id === s.currentTask?.owner)?.name }}) is explaining...</p>
      <p>Please be sure to clearly explain the task's scope, risks, and acceptence criteria.</p>
      <p>⏱️ Time Remaining: {{ countdown }}</p>
      <button v-if="isOwner" @click="doneExplain">Done Explaining</button>
    </section>

    <!-- VOTING PHASE -->
    <section v-if="s.phase === 'vote'" class="vote-phase">
       <h3>Phase: Vote 🗳️</h3>
       <h4>Task: {{ s.currentTask?.title }}</h4>
       <p>Owner: {{ players.find(p => p.id === s.currentTask?.owner)?.name }} (Remaining Points: {{ players.find(p => p.id === s.currentTask?.owner)?.remaining }})</p>
       <p>Select your estimate (must be ≤ owner's remaining points):</p>
       <!-- Use Taki cards for voting -->
       <div class="vote-cards-container">
         <!-- Number Cards -->
         <div v-for="v in availableFib"
              :key="v"
              @click="vote(v)"
              class="taki-card"
              :class="{ 'selected-vote': me?.vote === v }"
              :style="{ background: getCardColor(v) }">
           <div class="card-number">{{ v }}</div>
         </div>
         <!-- Stop Card for Reprioritization -->
         <div v-if="me?.vote === null"
              @click="proposeRepr"
              class="taki-card stop-card"
              :style="{ background: '#ef4444' }"> <!-- Example: Red background -->
            <div class="stop-icon">✋</div>
            <div class="card-text">Reprioritize</div> <!-- Added text -->
         </div>
         <!-- Add Abandon Task Card for Owner -->
         <div v-if="isOwner"
              @click="abandonTask"
              class="taki-card abandon-card"
              :style="{ background: '#fcd34d' }"> <!-- Example: Amber background -->
            <div class="abandon-icon">👑</div> <!-- Crown Icon -->
            <div class="card-text">Abandon</div> <!-- Added text -->
         </div>
       </div>
       <p v-if="me?.vote !== null">You voted: {{ me.vote }}</p>
    </section>

    <!-- REPRIORITIZATION VOTE PHASE -->
    <section v-if="s.phase === 'reprVote'" class="repr-vote-phase">
      <h3>Phase: Reprioritization Vote 🤔</h3>
      <h4>Task: {{ s.currentTask?.title }}</h4>
      <p>A player proposed reprioritization. Should the team review the owner's tasks to potentially free up points?</p>
      <div class="repr-vote-buttons">
        <button @click="repr('yes')">Yes, Reprioritize</button>
        <button @click="repr('no')">No, Continue Voting</button>
      </div>
      <!-- Add display for who voted yes/no if needed -->
    </section>

    <!-- REVEAL PHASE -->
    <section v-if="s.phase === 'reveal'" class="reveal-phase">
       <h3>Phase: Reveal Votes ✨</h3>
       <h4>Task: {{ s.currentTask?.title }}</h4>
       <p>Final Estimate (Majority Vote): {{ s.currentTask?.points }}</p>
       <ul><li v-for="p in players" :key="p.id">{{ p.name }}: {{ p.vote }}</li></ul>
       <div v-if="isOwner" class="owner-actions">
         <button @click="accept">Accept Estimate ({{ s.currentTask?.points }} points)</button>
         <button @click="dispute" :disabled="me?.disputes === 0">Dispute Estimate ({{ me?.disputes }} left)</button>
       </div>
       <p v-else>Waiting for owner ({{ players.find(p => p.id === s.currentTask?.owner)?.name }}) to respond...</p>
    </section>

    <!-- DISCUSSION PHASE -->
    <section v-if="s.phase === 'discuss'" class="discuss-phase">
      <h3>Phase: Discussion 💬</h3>
      <h4>Task: {{ s.currentTask?.title }}</h4>
      <p>Owner disputed the estimate. Discuss for 1 minute.</p>
      <p>⏱️ Time Remaining: {{ countdown }}</p>
      <button v-if="isOwner" @click="revote">Start Revote</button>
       <p v-else>Waiting for owner ({{ players.find(p => p.id === s.currentTask?.owner)?.name }}) to start revote...</p>
    </section>

    <!-- REPRIORITIZATION ADJUSTMENT PHASE -->
    <section v-if="s.phase === 'repr'" class="repr-phase">
       <h3>Phase: Adjust Tasks 🔄</h3>
       <h4>Task Being Estimated: {{ s.currentTask?.title }}</h4>
       <p>Reprioritization approved. Owner ({{ players.find(p => p.id === s.currentTask?.owner)?.name }}) can propose removing a previously budgeted task to free up points.</p>

       <div v-if="isOwner">
         <h4>Your Budgeted Tasks:</h4>
         <ul v-if="playerBudgetedTasks[me.id] && playerBudgetedTasks[me.id].length > 0">
           <li v-for="task in playerBudgetedTasks[me.id]" :key="task.id" class="budgeted-task-item adjustable-task">
             <span>- {{ task.title }} ({{ task.points }} points)</span>
             <button @click="proposeTaskRemoval(task.id)" class="propose-removal-button">Propose Removal</button>
           </li>
         </ul>
         <p v-else><i>You have no budgeted tasks to remove.</i></p>
         <hr>
         <button @click="doneRepr">Finish Adjustment & Resume Voting</button>
       </div>
       <p v-else><i>Waiting for owner to review budgeted tasks...</i></p>
    </section>

    <!-- REPRIORITIZATION DISCUSSION PHASE -->
    <section v-if="s.phase === 'reprDiscuss'" class="repr-discuss-phase">
        <h3>Phase: Discuss Task Removal 🤔💬</h3>
        <h4>Task Being Estimated: {{ s.currentTask?.title }}</h4>
        <p>Owner proposed removing the following task to free up points:</p>
        <p><strong>Task to Remove:</strong> {{ s.tasks.find(t => t.id === s.taskToReprioritizeId)?.title }} ({{ s.tasks.find(t => t.id === s.taskToReprioritizeId)?.points }} points)</p>
        <p>Discuss for 1 minute.</p>
        <p>⏱️ Time Remaining: {{ countdown }}</p>
        <div v-if="isOwner">
            <button @click="confirmTaskRemoval" class="confirm-removal-button">Confirm Removal & Resume Voting</button>
            <button @click="cancelReprioritization" class="cancel-repr-button">Keep Task & Abandon Current Estimation</button>
        </div>
        <p v-else><i>Waiting for owner decision after discussion...</i></p>
    </section>

  </div>
</template>

<script setup>
import { useSession } from '../store';
import { computed, ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const store = useSession();

const s = computed(() => store.session);
const me = computed(() => {
  if (!s.value || !s.value.players) return null;
  // Find player by comparing socket ID stored during join
  return s.value.players[store.socketId] || null;
});
const players = computed(() => Object.values(s.value?.players || {}));
const isOwner = computed(() => s.value?.currentTask?.owner === me.value?.id);
const fib = [1, 2, 3, 5, 8, 13, 21];

// Computed property to show only tasks created by the current user in the lobby
const myTasksInLobby = computed(() => {
  if (s.value?.phase !== 'lobby' || !s.value?.tasks || !me.value?.id) {
    return [];
  }
  // Filter based on owner matching the current user's ID
  // and ensure the task hasn't already been assigned points (meaning it was accepted)
  return s.value.tasks.filter(task => task.owner === me.value.id && task.points === null);
});

const availableFib = computed(() => {
  if (s.value?.phase !== 'vote' || !s.value.currentTask) return [];
  const owner = s.value.players[s.value.currentTask.owner];
  if (!owner) return [];
  return fib.filter(v => v <= owner.remaining);
});

// Add computed property to track budgeted tasks for each player
const playerBudgetedTasks = computed(() => {
  const budgeted = {};
  if (s.value && s.value.players) {
    // Initialize an empty array for each player
    Object.values(s.value.players).forEach(player => {
      budgeted[player.id] = [];
    });

    // Populate with tasks that have an owner and points
    if (s.value.tasks) {
      s.value.tasks.forEach(task => {
        // Check if the task has been assigned points and has an owner
        // This logic correctly includes accepted tasks now
        if (task.owner && task.points != null && budgeted[task.owner]) {
          budgeted[task.owner].push(task);
        }
      });
    }
  }
  return budgeted;
});

const newTask = ref('');
function addTask() {
  if (newTask.value.trim()) {
    // Only send the title, owner is determined server-side
    store.addTask(newTask.value.trim());
    newTask.value = '';
  }
}
function selectTask(id) { store.selectTask(id); }
function doneExplain() { store.doneExplain(); }
function vote(v) { store.vote(v); }
function proposeRepr() { store.proposeRepr(); }
function repr(c) { store.reprBallot(c); }
function accept() { store.accept(); }
function dispute() { store.dispute(); }
function revote() { store.revote(); }
// Add new action for abandoning task
function abandonTask() { store.abandonTask(); }
// Add new actions for reprioritization adjustment
function proposeTaskRemoval(taskId) { store.proposeTaskRemoval(taskId); }
function doneRepr() { store.doneRepr(); }


// --- Countdown Timer ---
const countdown = ref('');
let intervalId = null;

function updateCountdown() {
  // Include 'reprDiscuss' in phases that use the timer
  if (!s.value?.timer || (s.value.phase !== 'explain' && s.value.phase !== 'discuss' && s.value.phase !== 'reprDiscuss')) {
    countdown.value = '';
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    return;
  }

  const update = () => {
    const now = Date.now();
    const ms = s.value.timer - now;
    if (ms <= 0) {
      countdown.value = '0m 0s'; // Changed format
      clearInterval(intervalId);
      intervalId = null;
      // Optionally trigger server action if timer ends (server should ideally handle this)
    } else {
      const totalSeconds = Math.ceil(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      countdown.value = `${minutes}m ${seconds}s`; // Changed format
    }
  };

  if (!intervalId) {
     intervalId = setInterval(update, 500); // Update slightly faster than 1s
  }
  update(); // Initial update
}

watch(() => s.value?.timer, updateCountdown, { immediate: true });
watch(() => s.value?.phase, updateCountdown, { immediate: true });

onMounted(async () => {
    const sessionIdFromRoute = route.params.id;
    console.log('Session.vue: Read sessionId from route:', sessionIdFromRoute); // Add log
    const name = ref(route.query.n);
    const budget = ref(Number(route.query.b));
    if (name.value && !isNaN(budget.value) && sessionIdFromRoute) {
        await store.join(sessionIdFromRoute, name.value, budget.value);
    } else {
        // Handle error: missing join info
        console.error("Missing name, budget, or session ID");
        // Optionally redirect back to lobby or show error message
    }
});

// Cleanup timer on unmount
import { onUnmounted } from 'vue';
onUnmounted(() => {
  if (intervalId) clearInterval(intervalId);
  // Consider socket disconnect logic if leaving session view means leaving session
  // store.disconnect(); // Example if you add a disconnect action
});

const cardColors = ['blue', 'red', 'green', '#ffd92f']; // Example colors

function getCardColor(value) {
  // Simple logic: cycle through colors based on Fibonacci index
  const index = fib.indexOf(value);
  return cardColors[index % cardColors.length] || '#ffd92f'; // Fallback to yellow
}
</script>

<style scoped>
/* Add some basic styling */
.session-view {
  font-family: sans-serif;
  padding: 15px;
  max-width: 800px;
  margin: auto;
}
hr {
  margin: 15px 0;
  border: 0;
  border-top: 1px solid #eee;
}
section {
  background-color: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 15px;
}
h2, h3, h4 {
  margin-top: 0;
}
ul {
  list-style: none;
  padding: 0;
}
li {
  margin-bottom: 8px;
  padding: 5px;
  border-radius: 3px;
}
.players-section > ul > li { /* Target only top-level player li */
  border: 1px solid #eee;
  background-color: #fff;
  padding: 10px;
}
.players-section li.is-me {
  font-weight: bold;
  background-color: #e0f2fe;
  border-color: #a5d8ff;
}
.budgeted-tasks {
  margin-top: 8px;
  padding-left: 15px; /* Indent budgeted tasks */
  font-size: 0.9em;
}
.budgeted-tasks ul {
  margin-top: 4px;
}
.budgeted-task-item {
  margin-bottom: 2px;
  padding: 0;
  border: none; /* Remove default li border */
  background: none; /* Remove default li background */
}
.budgeted-tasks-empty {
   margin-top: 8px;
   padding-left: 15px;
   font-size: 0.9em;
   color: #666;
}
button {
  padding: 8px 12px;
  margin: 0 5px 5px 0;
  cursor: pointer;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #fff;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
button:hover:not(:disabled) {
  background-color: #f0f0f0;
}
input[type="text"], input[type="number"] {
  padding: 8px;
  margin-right: 5px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.task-input {
  display: flex;
  margin-bottom: 10px;
}
.task-input input {
  flex-grow: 1;
}
.task-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #fff;
  padding: 8px;
  border: 1px solid #eee; /* Add border to task list items */
}
.vote-buttons button.selected-vote {
  background-color: #a5d8ff;
  font-weight: bold;
}
.propose-button {
  background-color: #fffbe6;
  border-color: #ffe58f;
}
.owner-actions button {
  margin-right: 10px;
}
.owner-actions button:first-of-type {
   background-color: #dcfce7;
   border-color: #86efac;
}
.owner-actions button:last-of-type {
   background-color: #fee2e2;
   border-color: #fca5a5;
}
.adjustable-task {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #fff; /* Add background for clarity */
  padding: 8px; /* Add padding */
  border: 1px solid #eee; /* Add border */
  margin-bottom: 5px; /* Add margin */
}
.propose-removal-button {
  background-color: #fffbe6;
  border-color: #ffe58f;
  font-size: 0.9em;
  padding: 4px 8px;
}
.confirm-removal-button {
  background-color: #dcfce7; /* Green */
  border-color: #86efac;
}
.cancel-repr-button {
  background-color: #fee2e2; /* Red */
  border-color: #fca5a5;
}
.repr-discuss-phase strong {
    color: #b91c1c; /* Dark red for emphasis */
}

/* ---------- Taki Card Styles ---------- */
.vote-cards-container {
  display: flex;
  gap: 15px; /* Adjust gap between cards */
  padding: 10px 0; /* Add some padding */
  justify-content: center; /* Center cards */
  align-items: center;
  flex-wrap: wrap; /* Allow wrapping on smaller screens */
  margin-bottom: 15px; /* Space below cards */
}

.taki-card {
  flex: 0 0 80px; /* Fixed base size, adjust as needed */
  max-width: 100px; /* Max width */
  aspect-ratio: 2 / 3;
  border: 4px solid #fff; /* Slightly smaller border */
  border-radius: 10px; /* Adjust radius */
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffd92f; /* Default yellow */
  box-shadow: 0 2px 5px rgba(0,0,0,.15);
  transition: .2s;
  cursor: pointer;
  overflow: hidden;
}

.taki-card:hover {
  transform: scale(1.05) translateY(-5px); /* Adjust hover effect */
  box-shadow: 0 4px 10px rgba(0,0,0,.2);
}

.taki-card.selected-vote {
  border-color: #007bff; /* Highlight selected card */
  box-shadow: 0 0 15px rgba(0, 123, 255, 0.5);
  transform: scale(1.08);
}

.card-number {
  font-size: clamp(20px, 4vw, 38px); /* Adjust font size */
  font-weight: bold;
  color: #fff;
  text-shadow: 1px 1px 2px rgba(0,0,0,.4);
}

/* UTF-8 stop hand */
.stop-icon {
  font-size: clamp(35px, 7vw, 60px); /* Slightly adjusted size range */
  line-height: 1;
  flex-grow: 1; /* Allow icon to take up space */
  display: flex;
  align-items: center; /* Center vertically */
  justify-content: center;
  color: white;
  padding-top: 5px; /* Add some padding at the top */
}

/* Style for text on cards */
.card-text {
  font-size: clamp(8px, 1.5vw, 12px); /* Smaller text */
  font-weight: bold;
  color: white;
  text-align: center;
  padding: 0 5px 5px 5px; /* Padding around text */
  line-height: 1.1;
  text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
}

/* Specific style adjustments for the stop card */
.stop-card {
  display: flex; /* Use flexbox */
  flex-direction: column; /* Stack icon and text vertically */
  justify-content: space-between; /* Push text towards bottom */
  align-items: center; /* Center horizontally */
  /* border-color: black; */ /* Optional border */
}

.abandon-card {
  /* Style similar to stop-card */
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Change justify-content to space-between to push text down */
  justify-content: space-between;
  cursor: pointer;
  border: 4px solid #fff; /* Match other card borders */
  /* Keep amber background */
  /* color: #92400e; /* Dark amber text - applied via .card-text */
}

.abandon-icon {
  font-size: clamp(35px, 7vw, 60px); /* Match stop-icon size */
  line-height: 1;
  flex-grow: 1; /* Allow icon to take up space, pushing text down */
  display: flex;
  align-items: center; /* Center vertically within its space */
  justify-content: center;
  color: white; /* Match other card icon colors */
  padding-top: 5px; /* Match stop-icon padding */
}

/* Ensure .card-text style applies correctly */
.card-text {
  font-size: clamp(8px, 1.5vw, 12px); /* Match stop-card text size */
  font-weight: bold;
  color: white; /* Match other card text colors */
  text-align: center;
  padding: 0 5px 5px 5px; /* Match stop-card text padding */
  line-height: 1.1;
  text-shadow: 1px 1px 1px rgba(0,0,0,0.5); /* Match other card text shadow */
  /* Remove margin-top if previously added specifically for abandon */
  /* margin-top: 5px; */
}
</style>