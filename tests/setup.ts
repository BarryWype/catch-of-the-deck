import { setText } from '../src/engine';
import { en } from '../src/locales/en';

// The engine's text comes from a language file; tests read it in English.
setText(en.engine, en.terms, 'en');
