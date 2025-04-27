<template>
  <div class="lobby-container">
    <h1 class="title">Planning‑Taki</h1>
    <img alt="Taki Logo" :src="takiLogo" class="logo">
    <div class="input-group">
      <label for="name">Name:</label>
      <input type="text" id="name" v-model="name" placeholder="Enter your name here" />
    </div>
    <div class="input-group">
      <label for="budget">Budget:</label>
      <input type="number" id="budget" v-model.number="budget" placeholder="Budget" />
    </div>
    <div class="input-group">
      <label for="id">Session ID:</label>
      <input
        v-if="!generatedId"
        type="text"
        id="id"
        v-model="id"
        placeholder="Session ID"
      />
      <div v-else class="session-id-display">
        {{ id }}
      </div>
    </div>
    <button @click="go" class="join-button">Join</button>
    <div v-if="generatedId" class="invite-section">
      <p>
        Invite Link: <a :href="inviteLink">{{ inviteLink }}</a>
        <button @click="copyInviteLink" class="copy-button">
          <i class="fas fa-copy"></i>
        </button>
      </p>
      <!-- QR Code would go here -->
    </div>
    <div v-if="copySuccess" class="copy-success-message">
      Copied!
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import takiLogo from '../../img/taki.png'; // Import the image


const router = useRouter();
const route = useRoute();

const name = ref(''); // No default name
const budget = ref(21);
const id = ref('');
const generatedId = ref(false);
const copySuccess = ref(false);

const inviteLink = computed(() => {
  return `${window.location.origin}?id=${id.value}`;
});

function generateId() {
  id.value = Math.random().toString(36).substring(2, 15);
  generatedId.value = true;
}

function go() {
  router.push(`/s/${id.value}?n=${name.value}&b=${budget.value}`);
}

onMounted(() => {
  generateId();

  if (route.query.id) {
    id.value = route.query.id;
    generatedId.value = true;
  }
});

async function copyInviteLink() {
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    copySuccess.value = true;
    setTimeout(() => {
      copySuccess.value = false;
    }, 2000); // Show the message for 2 seconds
  } catch (err) {
    console.error('Failed to copy: ', err);
    alert('Failed to copy invite link. Please copy manually.');
  }
}
</script>

<style scoped>
.lobby-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background-color: #f5f5f5; /* Example background */
}

.title {
  font-size: 2.5em;
  margin-bottom: 20px;
  color: #333;
}

.logo {
  max-width: 200px; /* Adjust as needed */
  margin-bottom: 20px;
}

.input-group {
  margin-bottom: 15px;
  display: flex;
  flex-direction: column;
  width: 300px; /* Adjust width as needed */
}

label {
  margin-bottom: 5px;
  font-weight: bold;
  color: #555;
}

input {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
  font-size: 16px;
}

.budget-input {
  display: flex;
  align-items: center;
  border: 1px solid #ccc;
  border-radius: 5px;
  padding-left: 5px;
}

.budget-input span {
  margin-right: 5px;
  color: #777;
}

.session-id-display {
  padding: 10px;
  background-color: #eee;
  border: 1px solid #ccc;
  border-radius: 5px;
  font-size: 16px;
  color: #555;
}

.join-button {
  padding: 12px 25px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 18px;
  transition: background-color 0.3s ease;
}

.join-button:hover {
  background-color: #3e8e41;
}

.invite-section {
  margin-top: 20px;
  text-align: center;
}

.copy-button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2em;
  margin-left: 10px;
  color: #777;
}

.copy-success-message {
  color: green;
  margin-top: 5px;
}
</style>