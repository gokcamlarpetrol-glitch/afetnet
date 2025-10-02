import { PreferencesManager } from '../storage/prefs';

export interface BackendConfig {
  apiBaseUrl: string;
  wsUrl: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: number;
  version?: string;
  uptime?: number;
}

export interface WebSocketTestResult {
  connected: boolean;
  latency?: number;
  error?: string;
}

export class BackendManager {
  private static instance: BackendManager;
  private prefs = PreferencesManager.getInstance();
  private wsConnection: WebSocket | null = null;

  static getInstance(): BackendManager {
    if (!BackendManager.instance) {
      BackendManager.instance = new BackendManager();
    }
    return BackendManager.instance;
  }

  async ping(apiBaseUrl: string): Promise<boolean> {
    try {
      console.log('Pinging backend:', apiBaseUrl);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${apiBaseUrl}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log('Backend ping failed:', response.status, response.statusText);
        return false;
      }

      const healthData: HealthCheckResponse = await response.json();
      console.log('Backend ping successful:', healthData);
      
      return healthData.status === 'healthy';
    } catch (error) {
      console.error('Backend ping error:', error);
      return false;
    }
  }

  async testWebSocket(wsUrl: string): Promise<WebSocketTestResult> {
    return new Promise((resolve) => {
      try {
        console.log('Testing WebSocket connection:', wsUrl);
        
        const startTime = Date.now();
        const ws = new WebSocket(wsUrl);
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve({
            connected: false,
            error: 'Connection timeout',
          });
        }, 10000); // 10 second timeout

        ws.onopen = () => {
          const latency = Date.now() - startTime;
          clearTimeout(timeout);
          
          console.log('WebSocket connection established');
          
          // Send a test message
          ws.send(JSON.stringify({
            type: 'ping',
            timestamp: Date.now(),
          }));

          // Wait for pong response
          setTimeout(() => {
            ws.close();
            resolve({
              connected: true,
              latency,
            });
          }, 2000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'pong' || data.type === 'greeting') {
              clearTimeout(timeout);
              ws.close();
              resolve({
                connected: true,
                latency: Date.now() - startTime,
              });
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error('WebSocket error:', error);
          resolve({
            connected: false,
            error: 'Connection failed',
          });
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          console.log('WebSocket connection closed');
        };

        this.wsConnection = ws;
      } catch (error) {
        console.error('WebSocket test error:', error);
        resolve({
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  async sendHelpRequest(helpRequest: any): Promise<boolean> {
    try {
      const config = await this.getBackendConfig();
      if (!config) {
        throw new Error('Backend not configured');
      }

      console.log('Sending help request to backend:', helpRequest);

      const response = await fetch(`${config.apiBaseUrl}/help-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0.0',
        },
        body: JSON.stringify(helpRequest),
      });

      if (!response.ok) {
        console.error('Failed to send help request:', response.status, response.statusText);
        return false;
      }

      const result = await response.json();
      console.log('Help request sent successfully:', result);
      
      return true;
    } catch (error) {
      console.error('Error sending help request:', error);
      return false;
    }
  }

  async sendResourcePost(resourcePost: any): Promise<boolean> {
    try {
      const config = await this.getBackendConfig();
      if (!config) {
        throw new Error('Backend not configured');
      }

      console.log('Sending resource post to backend:', resourcePost);

      const response = await fetch(`${config.apiBaseUrl}/resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0.0',
        },
        body: JSON.stringify(resourcePost),
      });

      if (!response.ok) {
        console.error('Failed to send resource post:', response.status, response.statusText);
        return false;
      }

      const result = await response.json();
      console.log('Resource post sent successfully:', result);
      
      return true;
    } catch (error) {
      console.error('Error sending resource post:', error);
      return false;
    }
  }

  async sendDamageReport(damageReport: any): Promise<boolean> {
    try {
      const config = await this.getBackendConfig();
      if (!config) {
        throw new Error('Backend not configured');
      }

      console.log('Sending damage report to backend:', damageReport);

      const response = await fetch(`${config.apiBaseUrl}/damage-reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'AfetNet/1.0.0',
        },
        body: JSON.stringify(damageReport),
      });

      if (!response.ok) {
        console.error('Failed to send damage report:', response.status, response.statusText);
        return false;
      }

      const result = await response.json();
      console.log('Damage report sent successfully:', result);
      
      return true;
    } catch (error) {
      console.error('Error sending damage report:', error);
      return false;
    }
  }

  async getBackendStatus(): Promise<{
    configured: boolean;
    apiHealthy: boolean;
    wsHealthy: boolean;
    config: BackendConfig | null;
  }> {
    try {
      const config = await this.getBackendConfig();
      if (!config) {
        return {
          configured: false,
          apiHealthy: false,
          wsHealthy: false,
          config: null,
        };
      }

      const apiHealthy = await this.ping(config.apiBaseUrl);
      const wsResult = await this.testWebSocket(config.wsUrl);

      return {
        configured: true,
        apiHealthy,
        wsHealthy: wsResult.connected,
        config,
      };
    } catch (error) {
      console.error('Failed to get backend status:', error);
      return {
        configured: false,
        apiHealthy: false,
        wsHealthy: false,
        config: null,
      };
    }
  }

  private async getBackendConfig(): Promise<BackendConfig | null> {
    try {
      // First try to get from wizard config
      const wizardConfig = await this.prefs.get('activationWizardConfig');
      if (wizardConfig) {
        const parsed = JSON.parse(wizardConfig);
        if (parsed.backend && parsed.backend.apiBaseUrl && parsed.backend.wsUrl) {
          return parsed.backend;
        }
      }

      // Fallback to default config
      return {
        apiBaseUrl: 'https://api.afetnet.org',
        wsUrl: 'wss://api.afetnet.org/ws',
      };
    } catch (error) {
      console.error('Failed to get backend config:', error);
      return null;
    }
  }

  async connectWebSocket(): Promise<WebSocket | null> {
    try {
      const config = await this.getBackendConfig();
      if (!config) {
        throw new Error('Backend not configured');
      }

      if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
        return this.wsConnection;
      }

      console.log('Connecting to WebSocket:', config.wsUrl);
      
      const ws = new WebSocket(config.wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected to backend');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          // Handle incoming messages here
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.wsConnection = null;
      };

      this.wsConnection = ws;
      return ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      return null;
    }
  }

  async disconnectWebSocket(): Promise<void> {
    try {
      if (this.wsConnection) {
        this.wsConnection.close();
        this.wsConnection = null;
        console.log('WebSocket disconnected');
      }
    } catch (error) {
      console.error('Failed to disconnect WebSocket:', error);
    }
  }

  async sendWebSocketMessage(message: any): Promise<boolean> {
    try {
      if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket not connected, attempting to reconnect');
        await this.connectWebSocket();
        
        if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
          throw new Error('WebSocket connection failed');
        }
      }

      this.wsConnection.send(JSON.stringify(message));
      console.log('WebSocket message sent:', message);
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return false;
    }
  }

  async getBackendConfig(): Promise<BackendConfig | null> {
    return this.getBackendConfig();
  }

  async updateBackendConfig(config: BackendConfig): Promise<void> {
    try {
      const wizardConfig = await this.prefs.get('activationWizardConfig');
      const parsed = wizardConfig ? JSON.parse(wizardConfig) : {};
      
      parsed.backend = config;
      await this.prefs.set('activationWizardConfig', JSON.stringify(parsed));
      
      console.log('Backend config updated:', config);
    } catch (error) {
      console.error('Failed to update backend config:', error);
      throw error;
    }
  }
}
