import { createApp } from 'vue';
import { createPinia } from 'pinia';

import { createRouter, createWebHistory } from 'vue-router'; // Import router functions
import App from './App.vue';
import Lobby from './views/Lobby.vue';     // Import components
import Session from './views/Session.vue'; // Import components

import '@fortawesome/fontawesome-free/css/all.css'

// Define routes
const routes = [
  { path: '/', component: Lobby },
  { path: '/s/:id', component: Session }
];

// Create router instance
const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Create Vue app, use Pinia, use Router, and mount
const app = createApp(App);
app.use(createPinia());
app.use(router); // Use the router instance
app.mount('#app');

