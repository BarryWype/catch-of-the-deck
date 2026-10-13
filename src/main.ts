import { createApp } from 'vue';
import App from './ui/App.vue';
import { vTip } from './ui/tooltip';
import './ui/style.css';

createApp(App).directive('tip', vTip).mount('#app');
