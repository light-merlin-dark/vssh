import { PluginContext, McpResponse } from './types';
import { formatResponse, formatError, ResponseMetadata } from './response-utils';

export interface ListOptions {
  limit?: number;
  offset?: number;
  filter?: Record<string, any>;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

/**
 * Abstract base class for resource handlers
 * Provides consistent CRUD operations and response formatting
 */
export abstract class ResourceHandler<T> {
  protected abstract resourceName: string;
  
  /**
   * List all resources
   */
  abstract list(context: PluginContext, options?: ListOptions): Promise<T[]>;
  
  /**
   * Get a specific resource by ID
   */
  abstract get(context: PluginContext, id: string): Promise<T | null>;
  
  /**
   * Create a new resource (optional)
   */
  abstract create?(context: PluginContext, data: Partial<T>): Promise<T>;
  
  /**
   * Update an existing resource (optional)
   */
  abstract update?(context: PluginContext, id: string, data: Partial<T>): Promise<T>;
  
  /**
   * Delete a resource (optional)
   */
  abstract delete?(context: PluginContext, id: string): Promise<boolean>;
  
  /**
   * Format a list response with metadata
   */
  protected formatListResponse(items: T[], metadata?: Partial<ResponseMetadata>): McpResponse {
    return formatResponse(items, {
      plugin: this.resourceName,
      command: 'list',
      count: items.length,
      ...metadata
    });
  }
  
  /**
   * Format a single item response
   */
  protected formatItemResponse(item: T | null, metadata?: Partial<ResponseMetadata>): McpResponse {
    if (!item) {
      return formatError('Resource not found', {
        plugin: this.resourceName,
        command: 'get',
        ...metadata
      });
    }
    
    return formatResponse(item, {
      plugin: this.resourceName,
      command: 'get',
      ...metadata
    });
  }
  
  /**
   * Format a create response
   */
  protected formatCreateResponse(item: T, metadata?: Partial<ResponseMetadata>): McpResponse {
    return formatResponse(item, {
      plugin: this.resourceName,
      command: 'create',
      ...metadata
    });
  }
  
  /**
   * Format an update response
   */
  protected formatUpdateResponse(item: T, metadata?: Partial<ResponseMetadata>): McpResponse {
    return formatResponse(item, {
      plugin: this.resourceName,
      command: 'update',
      ...metadata
    });
  }
  
  /**
   * Format a delete response
   */
  protected formatDeleteResponse(success: boolean, id: string, metadata?: Partial<ResponseMetadata>): McpResponse {
    if (!success) {
      return formatError('Failed to delete resource', {
        plugin: this.resourceName,
        command: 'delete',
        resourceId: id,
        ...metadata
      });
    }
    
    return formatResponse({ id, deleted: true }, {
      plugin: this.resourceName,
      command: 'delete',
      ...metadata
    });
  }
  
  /**
   * Apply list options to an array of items
   */
  protected applyListOptions(items: T[], options?: ListOptions): T[] {
    if (!options) return items;
    
    let result = [...items];
    
    // Apply filtering
    if (options.filter) {
      result = result.filter(item => {
        return Object.entries(options.filter!).every(([key, value]) => {
          return (item as any)[key] === value;
        });
      });
    }
    
    // Apply sorting
    if (options.sort) {
      const { field, order } = options.sort;
      result.sort((a, b) => {
        const aVal = (a as any)[field];
        const bVal = (b as any)[field];
        
        if (aVal < bVal) return order === 'asc' ? -1 : 1;
        if (aVal > bVal) return order === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    // Apply pagination
    if (options.offset !== undefined || options.limit !== undefined) {
      const offset = options.offset || 0;
      const limit = options.limit || result.length;
      result = result.slice(offset, offset + limit);
    }
    
    return result;
  }
}