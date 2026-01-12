import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';

const router = Router();

// Get all conversations for current user
router.get('/conversations', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  try {
    const result = await pool.query(
      `SELECT id, title, created_at, updated_at 
       FROM coach_conversations 
       WHERE agent_id = $1 
       ORDER BY updated_at DESC 
       LIMIT 20`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Create a new conversation
router.post('/conversations', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  const { title } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO coach_conversations (agent_id, title) 
       VALUES ($1, $2) 
       RETURNING id, title, created_at, updated_at`,
      [userId, title]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get messages for a conversation
router.get('/conversations/:id/messages', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  const { id } = req.params;

  try {
    // Verify ownership
    const convCheck = await pool.query(
      'SELECT id FROM coach_conversations WHERE id = $1 AND agent_id = $2',
      [id, userId]
    );
    if (convCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const result = await pool.query(
      `SELECT id, role, content, created_at 
       FROM coach_messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Add a message to a conversation
router.post('/conversations/:id/messages', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  const { id } = req.params;
  const { role, content } = req.body;

  try {
    // Verify ownership
    const convCheck = await pool.query(
      'SELECT id FROM coach_conversations WHERE id = $1 AND agent_id = $2',
      [id, userId]
    );
    if (convCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Insert message
    const result = await pool.query(
      `INSERT INTO coach_messages (conversation_id, role, content) 
       VALUES ($1, $2, $3) 
       RETURNING id, role, content, created_at`,
      [id, role, content]
    );

    // Update conversation updated_at
    await pool.query(
      'UPDATE coach_conversations SET updated_at = NOW() WHERE id = $1',
      [id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// Delete a conversation
router.delete('/conversations/:id', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM coach_conversations WHERE id = $1 AND agent_id = $2 RETURNING id',
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Chat endpoint (placeholder - integrate with your AI service)
router.post('/chat', requireAuth, async (req: Request, res: Response) => {
  const { messages } = req.body;

  // Set headers for SSE streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Placeholder response - integrate with your AI service (OpenAI, etc.)
    const response = "I'm your AI Performance Coach. This feature requires integration with an AI service. Please configure an AI provider (like OpenAI) to enable coaching functionality.";
    
    // Simulate streaming response
    const chunks = response.split(' ');
    for (let i = 0; i < chunks.length; i++) {
      const content = (i === 0 ? '' : ' ') + chunks[i];
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Error in chat:', error);
    res.write(`data: ${JSON.stringify({ error: 'Failed to get response' })}\n\n`);
    res.end();
  }
});

export default router;
