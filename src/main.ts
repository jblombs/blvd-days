import './style.css';
import { Game } from './game/Game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
if (!canvas) throw new Error('Missing #game-canvas');

const game = new Game(canvas);
game.start();
