import { McpResponse, StandardResponse } from './types';

export interface ResponseMetadata {
  timestamp?: string;
  duration?: number;
  plugin?: string;
  command?: string;
  [key: string]: any;
}

/**
 * Format a successful response with standardized structure
 */
export function formatResponse(data: any, metadata: Partial<ResponseMetadata> = {}): McpResponse {
  const response: StandardResponse = {
    status: 'success',
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      duration: 0,
      plugin: '',
      command: '',
      ...metadata
    }
  };

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(response, null, 2)
    }]
  };
}

/**
 * Format an error response with standardized structure
 */
export function formatError(
  error: Error | string, 
  metadata: Partial<ResponseMetadata> = {}
): McpResponse {
  const errorObj = typeof error === 'string' 
    ? { code: 'ERROR', message: error, details: undefined }
    : { 
        code: error.name || 'ERROR', 
        message: error.message, 
        details: error.stack 
      };

  const response: StandardResponse = {
    status: 'error',
    error: errorObj,
    metadata: {
      timestamp: new Date().toISOString(),
      duration: 0,
      plugin: '',
      command: '',
      ...metadata
    }
  };

  return {
    isError: true,
    content: [{
      type: 'text' as const,
      text: JSON.stringify(response, null, 2)
    }]
  };
}

/**
 * Format a warning response with standardized structure
 */
export function formatWarning(
  message: string, 
  data?: any,
  metadata: Partial<ResponseMetadata> = {}
): McpResponse {
  const response: StandardResponse = {
    status: 'warning',
    data,
    error: {
      code: 'WARNING',
      message,
      details: undefined
    },
    metadata: {
      timestamp: new Date().toISOString(),
      duration: 0,
      plugin: '',
      command: '',
      ...metadata
    }
  };

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(response, null, 2)
    }]
  };
}

/**
 * Parse a standardized response from text
 */
export function parseResponse(text: string): StandardResponse | null {
  try {
    return JSON.parse(text) as StandardResponse;
  } catch {
    return null;
  }
}

/**
 * Legacy response format converter for backwards compatibility
 */
export function convertLegacyResponse(text: string, metadata: Partial<ResponseMetadata> = {}): McpResponse {
  // Check if it's already in new format
  const parsed = parseResponse(text);
  if (parsed) {
    return {
      content: [{
        type: 'text' as const,
        text
      }]
    };
  }

  // Convert legacy format
  return formatResponse(text, metadata);
}