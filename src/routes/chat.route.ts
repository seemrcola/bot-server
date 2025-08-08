import { Router } from 'express';
import { streamChatHandler } from '../controllers/chat.controller.js';

const chatRouter: Router = Router();

chatRouter.post('/stream', streamChatHandler);

export { chatRouter };
