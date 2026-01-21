/**
 * Upload Processing Logger
 * 
 * Detailed logging utility for diagnosing call sheet upload issues.
 * Logs are stored in memory during upload and can be persisted to the database.
 */

export interface UploadLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  stage: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface UploadLogSession {
  sessionId: string;
  uploadId?: string;
  agentId: string;
  fileName: string;
  startedAt: string;
  entries: UploadLogEntry[];
}

class UploadLogger {
  private currentSession: UploadLogSession | null = null;
  private readonly MAX_ENTRIES = 1000;

  startSession(agentId: string, fileName: string): string {
    const sessionId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentSession = {
      sessionId,
      agentId,
      fileName,
      startedAt: new Date().toISOString(),
      entries: [],
    };
    
    this.log('info', 'session_start', `Upload session started for file: ${fileName}`, {
      agentId,
      fileName,
      sessionId,
    });
    
    return sessionId;
  }

  setUploadId(uploadId: string) {
    if (this.currentSession) {
      this.currentSession.uploadId = uploadId;
      this.log('info', 'upload_record', `Upload record created with ID: ${uploadId}`, { uploadId });
    }
  }

  log(
    level: UploadLogEntry['level'],
    stage: string,
    message: string,
    data?: Record<string, unknown>
  ) {
    const entry: UploadLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      stage,
      message,
      data,
    };

    // Always log to console with appropriate level
    const consolePrefix = `[Upload:${stage}]`;
    switch (level) {
      case 'error':
        console.error(consolePrefix, message, data || '');
        break;
      case 'warn':
        console.warn(consolePrefix, message, data || '');
        break;
      case 'debug':
        console.debug(consolePrefix, message, data || '');
        break;
      default:
        console.log(consolePrefix, message, data || '');
    }

    // Store in session
    if (this.currentSession) {
      if (this.currentSession.entries.length >= this.MAX_ENTRIES) {
        // Remove oldest entries if we hit the limit
        this.currentSession.entries = this.currentSession.entries.slice(-500);
      }
      this.currentSession.entries.push(entry);
    }
  }

  // Convenience methods
  info(stage: string, message: string, data?: Record<string, unknown>) {
    this.log('info', stage, message, data);
  }

  warn(stage: string, message: string, data?: Record<string, unknown>) {
    this.log('warn', stage, message, data);
  }

  error(stage: string, message: string, data?: Record<string, unknown>) {
    this.log('error', stage, message, data);
  }

  debug(stage: string, message: string, data?: Record<string, unknown>) {
    this.log('debug', stage, message, data);
  }

  // Log contact processing with detailed info
  logContactProcessing(
    index: number,
    total: number,
    phone: string,
    result: 'inserted' | 'existing' | 'skipped' | 'error',
    contactId?: string,
    error?: string
  ) {
    const data: Record<string, unknown> = {
      index,
      total,
      phone: this.maskPhone(phone),
      result,
    };
    
    if (contactId) data.contactId = contactId;
    if (error) data.error = error;

    const level = result === 'error' ? 'error' : result === 'skipped' ? 'warn' : 'debug';
    
    this.log(
      level,
      'contact_processing',
      `Contact ${index + 1}/${total}: ${result}${error ? ` - ${error}` : ''}`,
      data
    );
  }

  // Log call list entry creation
  logCallListEntry(
    contactId: string,
    callOrder: number,
    result: 'created' | 'exists' | 'error',
    error?: string
  ) {
    const level = result === 'error' ? 'error' : 'debug';
    this.log(level, 'call_list_entry', `Call list entry ${result} for contact ${contactId}`, {
      contactId,
      callOrder,
      result,
      error,
    });
  }

  // Mask phone for privacy in logs
  private maskPhone(phone: string): string {
    if (!phone || phone.length < 4) return '****';
    return `****${phone.slice(-4)}`;
  }

  // Get session summary
  getSummary(): {
    sessionId: string;
    duration: number;
    totalLogs: number;
    errors: number;
    warnings: number;
    contacts: { inserted: number; existing: number; skipped: number; errors: number };
  } | null {
    if (!this.currentSession) return null;

    const duration = Date.now() - new Date(this.currentSession.startedAt).getTime();
    const errors = this.currentSession.entries.filter(e => e.level === 'error').length;
    const warnings = this.currentSession.entries.filter(e => e.level === 'warn').length;
    
    // Count contact processing results
    const contactEntries = this.currentSession.entries.filter(e => e.stage === 'contact_processing');
    const contacts = {
      inserted: contactEntries.filter(e => e.data?.result === 'inserted').length,
      existing: contactEntries.filter(e => e.data?.result === 'existing').length,
      skipped: contactEntries.filter(e => e.data?.result === 'skipped').length,
      errors: contactEntries.filter(e => e.data?.result === 'error').length,
    };

    return {
      sessionId: this.currentSession.sessionId,
      duration,
      totalLogs: this.currentSession.entries.length,
      errors,
      warnings,
      contacts,
    };
  }

  // Get full session for debugging
  getSession(): UploadLogSession | null {
    return this.currentSession;
  }

  // Get errors only
  getErrors(): UploadLogEntry[] {
    return this.currentSession?.entries.filter(e => e.level === 'error') || [];
  }

  // Get warnings and errors
  getIssues(): UploadLogEntry[] {
    return this.currentSession?.entries.filter(e => e.level === 'error' || e.level === 'warn') || [];
  }

  // Export logs as JSON for debugging
  exportLogs(): string {
    if (!this.currentSession) return '{}';
    return JSON.stringify(this.currentSession, null, 2);
  }

  // Clear current session
  endSession() {
    if (this.currentSession) {
      const summary = this.getSummary();
      this.log('info', 'session_end', 'Upload session ended', summary || undefined);
      
      // Log final summary to console
      console.log('[Upload:SUMMARY]', {
        sessionId: this.currentSession.sessionId,
        uploadId: this.currentSession.uploadId,
        ...summary,
      });
    }
    
    // Keep session data available for debugging but mark as ended
    const endedSession = this.currentSession;
    this.currentSession = null;
    return endedSession;
  }
}

// Singleton instance
export const uploadLogger = new UploadLogger();
